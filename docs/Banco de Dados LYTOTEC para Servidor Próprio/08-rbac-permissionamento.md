# 08 — RBAC / Permissionamento

## Arquitetura atual

```
auth.users ─┬─ profiles (id, acesso_global, funcionario_id)
            │
            └─ bd_user_roles (user_id, role_id)
                    └─ bd_roles (id, nome)
                            ├─ bd_role_permissions (role_id, permission_id)
                            │       └─ bd_permissions (codigo, rota, descricao)
                            │               └─ bd_permissoes_acoes (catálogo de ações)
                            └─ bd_role_permission_actions (role_id, permission_id, acao)

auth.users ─── bd_user_permission_overrides (user_id, permission_id, acao, permitido)

Legado (em descomissionamento):
profiles.funcoes (array text)
bd_funcoes_permissao (funcao_nome, permissao_id)
bd_permissoes (catálogo antigo)
bd_rbac_legacy_map (mapeamento legacy → novo)
```

## Tabelas oficiais

| Tabela | Propósito |
|---|---|
| `bd_roles` | Papéis (SuperAdm, Administrador, AdmRH, AdmLogistica, AdmEquipamentos, GestorLicitacoes, Mestre, Encarregado, Apontador, Operador, TecSSO, ADM SEDE, etc.) |
| `bd_permissions` | Catálogo (`codigo`, `rota`, `descricao`, `modulo`) |
| `bd_role_permissions` | N:N role ↔ permission (visualização global) |
| `bd_role_permission_actions` | Granularidade por ação (`visualizar`, `criar`, `editar`, `excluir`, `aprovar`) |
| `bd_user_roles` | N:N usuário ↔ role |
| `bd_user_permission_overrides` | Override individual (permite/nega) por usuário |
| `bd_permissoes_acoes` | Catálogo de ações disponíveis por permission |
| `bd_permission_audit_logs` | Log de verificações (telemetria) |
| `bd_permission_change_audit_logs` | Log de mudanças no catálogo (compliance) |

## Como o usuário recebe permissão

1. Login via Supabase Auth (`auth.users`).
2. `profiles` é criada/sincronizada (trigger `handle_new_user`).
3. Admin atribui role via `fn_assign_user_role_secure(target_user_id, role_id)`.
4. Role → permissions via `bd_role_permissions`.
5. Permissions → ações via `bd_role_permission_actions`.
6. Admin pode adicionar override individual via `setUserOverride()` (`bd_user_permission_overrides`).

## Como o sistema decide acesso

### Frontend
- Hook oficial: `usePermission()` em `src/hooks/usePermission.ts`.
- Componente oficial: `<ActionGuard codigo="..." acao="..." />`.
- Guard de rota: `usePermissionGuard({ requiredPermission })`.
- Mapeamento rota → permissão: `src/constants/routePermissions.ts`.
- Fallback offline (PWA): snapshot validado de `fn_get_my_permission_snapshot()`.
- Camadas (em ordem):
  - **A** — JWT `app_metadata.permissions` (se presente).
  - **B** — Snapshot offline validado.
  - **C** — Bypass administrativo (acesso_global + SuperAdm).
  - **D** — Fallback legado (controlado pela flag `VITE_RBAC_LEGACY_FALLBACK_ENABLED`).
  - **E** — Default deny.

### Backend (RLS)
- Toda policy delega para `user_has_permission_action(auth.uid(), codigo, acao)` ou helpers de escopo (`fn_diaria_can_*`, `fn_ponto_can_*`).
- Lógica do arbiter:
  1. Carregar `profiles.acesso_global` + roles ativas.
  2. Se override individual existir → respeitar (precedência máxima).
  3. Se role tem ação → permite.
  4. Bypass SuperAdm: somente se `acesso_global=true` **E** role `SuperAdm` ativa em `bd_user_roles` (hardening Fase 3 aplicado em 2026-06).
  5. Default deny.

### Edges / Services
- Helper único: `checkUserAction(userId, codigo, acao)` em `src/services/rbac/checkUserAction.ts`.
- Backend: `fn_backend_has_permission(text, text)`.

## SuperAdm / acesso_global

- **Antes da Fase 3**: `acesso_global=true` em qualquer perfil concedia bypass total.
- **Após Fase 3 (aplicada)**: bypass exige `acesso_global=true` **E** role `SuperAdm` ativa.
- Fase 1: `acesso_global` removido de perfis não-SuperAdm (Paula Renata e Silvane Santos).
- Fase 2: 26 overrides DENY confirmados como efetivos.
- Fase 4 (pendente): limpeza de `acesso_global` em conta QA legada.

## Legado ainda presente

| Item | Onde | Estado |
|---|---|---|
| `profiles.funcoes` | tabela `profiles` | Existe mas **não é fonte autoritativa**. Hooks legados em `usePermission.ts` ramo D1/D2. |
| `bd_funcoes_permissao` | tabela | Existe — usada em fallback D3/D4. |
| `bd_permissoes` (catálogo antigo) | tabela | Existe — coexiste com `bd_permissions`. |
| `bd_rbac_legacy_map` | tabela | Mapa de migração (view `vw_rbac_legacy_map_drift` monitora drift). |
| `check_is_super_admin_hybrid()` | função | Compatibilidade. |
| Permissão `gestao_abastecimento_view` ainda com fallback hardcoded em `guardian-web-proxy` | edge | Documentado em `docs/RBAC_HARDCODES_PENDENTES.md` |

## Hooks frontend

| Hook | Status | Uso |
|---|---|---|
| `usePermission()` | **Oficial** | Verificação granular |
| `usePermissionGuard()` | **Oficial** | Guarda de rota |
| `ActionGuard` | **Oficial** | Wrapper de UI |
| `useHybridPermissions()` | Legado | Em descomissionamento |
| `useOfflinePermissions()` | Suporte | Para PWA |

## Views auxiliares

- `vw_rbac_permissions_safe` / `vw_rbac_roles_safe` — leitura segura do catálogo.
- `vw_rbac_standard_permission_gaps` — diagnóstico de permissões esperadas vs atribuídas.
- `vw_rbac_standard_funcao_permissoes` — mapeamento padrão por função.
- `vw_rbac_legacy_map_drift` — monitora divergência legacy ↔ novo.

## O que precisa ser finalizado antes da migração para servidor próprio

| # | Pendência | Impacto |
|---|---|---|
| 1 | Descomissionar fallback legado (`VITE_RBAC_LEGACY_FALLBACK_ENABLED=false` em produção, B2) | Alto |
| 2 | Resolver hardcode `gestao_abastecimento_view` no `guardian-web-proxy` | Médio |
| 3 | Auditar uso restante de `profiles.funcoes`, `bd_funcoes_permissao`, `bd_permissoes` | Alto |
| 4 | Remover `check_is_super_admin_hybrid()` / `check_is_super_admin()` após confirmar zero uso | Médio |
| 5 | Limpeza Fase 4 — `acesso_global` em conta QA | Baixo |
| 6 | Revisar policies permissivas em `bd_funcionarios`, `bd_assinaturas`, `bd_desligamentos`, `bd_arquivo_morto` | Alto |
| 7 | Documentar matriz oficial role × permission × ação (CSV/seed) para versionamento Git | Médio |
| 8 | Criar testes E2E de RBAC cobrindo bypass, override DENY e override ALLOW | Alto |
