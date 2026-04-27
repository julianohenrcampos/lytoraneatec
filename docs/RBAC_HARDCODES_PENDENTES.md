# Inventário de Hardcodes de Permissão Pendentes

> **Status desta entrega**: APENAS documentação. Nenhum hardcode foi removido ou substituído.
> Migração para RBAC granular (`usePermission().hasActionPermission`) será feita em ondas controladas.

## Diretriz padrão de substituição

Toda checagem hardcoded deve ser migrada para:

```ts
import { usePermission } from '@/hooks/usePermission';
const { hasActionPermission, isSuperAdmin } = usePermission();

// Em vez de: if (funcoes.includes('AdmRH'))
if (hasActionPermission('gestao_rh_funcionarios_view', 'editar')) { ... }
```

A nova ordem de avaliação garantida pelo hook é:
1. **SuperAdm** → `true` (bypass total — overrides ignorados)
2. **Override do usuário** → `permitido === false` vence sobre a role
3. **Role actions** (`bd_role_permission_actions`)
4. **Fallback** para `bd_role_permissions` (apenas para `visualizar`)
5. **Negar**

---

## P1 — CRÍTICO (risco de elevação de privilégio)

### `src/hooks/useEmpresaAdmin.ts`
**Linhas**: 23, 36
**Problema**: Usa `user.user_metadata?.role === 'admin'` para decidir privilégio administrativo.
**Risco**: `user_metadata` pode ser manipulado em alguns fluxos do Supabase Auth e não é fonte confiável de autorização. Permite spoofing trivial pelo cliente.
**Substituição alvo**:
```ts
const { hasActionPermission } = usePermission();
const isAdmin = hasActionPermission('empresas_admin', 'editar');
```
Pré-requisito: registrar permissão `empresas_admin` via `fn_registrar_permissao` e atribuir à(s) role(s) corretas.
**Bloqueio nesta entrega**: hook é consumido em múltiplos lugares; requer regressão controlada e migração das roles antes da troca.

---

## P2 — Médio (lógica de UI/serviço)

| Arquivo | Linhas | Padrão | Substituição alvo |
|---|---|---|---|
| `src/hooks/useSimplePermissions.ts` | 93–110 | `funcoes.includes('SuperAdm' \| 'AdmRH' \| ...)` | `hasActionPermission` por contexto |
| `src/hooks/useProfile.ts` | 58, 90–102 | `funcoes.includes(...)` para definir rota inicial | Mapa centralizado em `routePermissions.ts` |
| `src/hooks/useAuthPermissionsStable.ts` | 98 | Idem | Idem |
| `src/hooks/useAdmSedeScope.ts` | 29 | `funcoes.includes('AdmSede')` | `hasPermission('admsede_scope')` |
| `src/hooks/dashboard/useRhSecurity.ts` | 79, 129 | `funcoes.includes('AdmSede' \| 'AdmOBRA')` | Permissões `dashboard_rh_admsede_view` e `dashboard_rh_admobra_view` |
| `src/hooks/diarias/useGestaoAprovacoesDiarias.ts` | 97–100 | Mapeamento manual `funcoes → fluxoRole` | View `vw_user_fluxo_role` ou tabela `bd_user_fluxo_roles` |
| `src/services/programacao/permissionService.ts` | 81–85, 145–149 | `funcoes.some(['SuperAdm','AdmRH','Administrador'])` | `hasPermission('programacao_admin')` |
| `src/services/programacao/massaControlService.ts` | 190–192 | Idem | Idem |
| `src/services/registro-aplicacao/createUpdateRegistroAplicacao.ts` | 65 | `funcoes.includes('SuperAdm')` para bypass de validação | `hasPermission('registro_aplicacao_bypass_validacao')` |
| `src/utils/permissionDiagnostics.ts` | 43 | Tooling de debug | Manter (somente debug) |
| `src/hooks/useProfileSecurity.ts` | 32 | `primary_role === 'AdmRH' \| 'Administrador'` | `hasPermission('global_data_access')` |
| `src/components/diarias/gestao-aprovacoes/GestaoAprovacoesTabelaDesktop.tsx` | 42–45 | `if (role === 'gerente_adm' \| 'diretor_operacional' \| ...)` | Estes são **fluxo de aprovação**, não permissão de tela. Manter como regra de negócio. |
| `src/components/diarias/gestao-aprovacoes/GestaoAprovacoesMobileCards.tsx` | 34–37 | Idem | Idem |

---

## P3 — Baixo (cosmético / fallback de role legada)

- `src/hooks/usePermission.ts` linha 157, 193: fallback de leitura legada de `profiles.funcoes` para detectar `SuperAdm` quando a tabela `bd_user_roles` está vazia. **Manter** — é um fallback de segurança, não um hardcode operacional.
- `src/components/equipes/TransferMembersModal.tsx` linha 52: `role === 'membro'` é **estado de membro de equipe**, não permissão. Manter.

---

## Itens fora do escopo de RBAC (regras de negócio operacionais)

Os pontos abaixo **NÃO devem** virar permissão. São regras operacionais já tratadas em outras estruturas (RLS, snapshot, validação de domínio):
- Filtros por centro de custo (`useDiariasDataScope`, `centroCustoRestrictions`)
- Regras de feriado/FDS (`calendarioOperacionalService`)
- Restrição de funcionários `Ativo` / `Ativo sem Registro`
- Duplicidade de período/funcionário (triggers de banco)
- Tipo de dia / matrícula / regras de remessa

---

## Próxima onda recomendada

1. **P1**: criar permissão `empresas_admin` + migrar `useEmpresaAdmin.ts` em PR isolado, com smoke test em todas as telas que consomem o hook.
2. **P2**: migração paginada por hook/serviço, sempre acompanhada de validação manual da feature impactada.
3. **P3**: pode ser ignorado ou tratado em última etapa.

---

## P0 — Pendências geradas pela Fase 2 de hardening (2026-04-26)

### ✅ `gestao_abastecimento_view` — RESOLVIDO em 2026-04-27 (Fase 3A)

**Origem**: hardening da Edge Function `guardian-web-proxy` (Fase 2).
**Status atual**: **RESOLVIDO**. A permissão `gestao_abastecimento_view` foi criada em `public.bd_permissions` e vinculada a:
- `SuperAdm`
- `AdmTransporte`
- `AdmEquipamentos`

**Decisão registrada**: `AdmSede` foi **deliberadamente excluído** desta vinculação por ser perfil administrativo e não operacional (princípio de menor privilégio). Confirmado em consulta pós-migration.

**Mudanças aplicadas na Fase 3A**:
1. Migration criou a permissão e os vínculos em `bd_role_permissions` + `bd_role_permission_actions` (ação `visualizar`).
2. `guardian-web-proxy` agora **exige obrigatoriamente** a permissão — fallback provisório removido (cache `permissaoExisteCache` e bloco `if (!permissaoExiste)` eliminados).
3. Tentativas de acesso negadas continuam logadas como `guardian_proxy_denied` em `bd_security_audit_log`.

### Hardcodes de e-mail SuperAdm — REMOVIDOS de `create-gestor`

A whitelist `['julianohcampos@yahoo.com.br', 'ramonvalentevalente@gmail.com']` foi removida da Edge Function `create-gestor`. A função agora valida via `has_role('SuperAdm', user_id)` (RPC) com fallback legado para `profiles.funcoes` / `profiles.funcao_sistema` (mantido conforme escopo aprovado da Fase 2). Tentativas de acesso negadas e operações bem-sucedidas passam a ser registradas em `bd_security_audit_log`.

O arquivo `src/config/superAdminEmails.ts` (front-end) **permanece** como fallback de UI — será tratado em onda posterior.
