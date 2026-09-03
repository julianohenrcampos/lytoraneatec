# 06 — RLS e Segurança

## Status atual

- **167 / 167 tabelas com RLS habilitado** (100%).
- **458 policies ativas**.
- Nenhuma tabela em `public` está exposta sem RLS.

## Padrões de policy identificados

### Padrão A — CRUD por permissão granular (mais usado)

Aplicado em ≈ 50 tabelas operacionais. Cada operação verifica permissão por ação:

```
USING        ( fn_has_permission(<codigo>, 'visualizar') )
WITH CHECK   ( fn_has_permission(<codigo>, 'criar' | 'editar') )
DELETE USING ( fn_has_permission(<codigo>, 'excluir') )
```

Exemplos: `bd_solicitacoes_desligamento`, `bd_solicitacoes_transferencia`, `bd_solicitacoes_classificacao`, `bd_agendamentos_exames`, `bd_ordens_servico`.

### Padrão B — Escopo por centro de custo / equipe

Aplicado em tabelas com responsável de campo:

```
USING ( fn_diaria_can_select_row(centro_custo_id) )
WITH CHECK ( fn_diaria_can_create(centro_custo_id) )
```

Tabelas: `bd_diaria_solicitacoes`, `bd_diaria_presencas`, `bd_diaria_apontamentos`, `bd_diaria_aprovacoes`, `bd_diaria_aditivos`, `bd_apontamento_equipe`, `bd_avaliacao_equipe`, `bd_registro_cargas`, `bd_lista_programacao_entrega`, `bd_requisicoes`, `bd_ruas_requisicao`.

### Padrão C — Própria identidade

Aplicado em tabelas de uso pessoal:

```
USING ( user_id = auth.uid() )
WITH CHECK ( user_id = auth.uid() )
```

Tabelas: `profiles`, `bd_notificacoes_usuarios`, `bd_ponto_batidas` (parcial), `bd_assinaturas_usuarios`.

### Padrão D — Admin via função SECURITY DEFINER

Usado em tabelas administrativas/auditoria:

```
USING ( fn_can_view_permission_admin() )
WITH CHECK ( fn_can_manage_permission_catalog() )
```

Tabelas: `bd_permissions`, `bd_role_permissions`, `bd_role_permission_actions`, `bd_user_permission_overrides`, `bd_permission_change_audit_logs`.

### Padrão E — Auditoria append-only

```
INSERT: WITH CHECK (true)   -- sistema grava
SELECT: USING ( fn_*_can_view_logs() )
UPDATE/DELETE: ausentes ou denied
```

Tabelas: todas as `bd_*_auditoria*`, `bd_auditoria_log*`, `bd_*_audit_log`.

## Distribuição de policies por tabela (top 20)

| Tabela | # Policies | Comandos |
|---|---|---|
| `bd_sso_checklist_itens` | 7 | I/U/D/S |
| `bd_diaria_presencas` | 5 | I/U/D/S |
| `bd_locais_atendimento` | 5 | I/U/D/S |
| `bd_pncp_perfis_busca` | 5 | I/U/D/S |
| `bd_sso_checklists` | 5 | I/U/D/S |
| `bd_agendamentos_exames` | 4 | I/U/D/S |
| `bd_funcionarios` | 4 | I/U/D/S |
| `bd_funcionarios_sensivel` | 4 | I/U/D/S |
| `bd_ordens_servico` | 4 | I/U/D/S |
| `bd_solicitacoes_classificacao` | 4 | I/U/S (sem DELETE intencional) |
| `bd_solicitacoes_desligamento` | 4 | I/U/D/S |
| (… 30+ tabelas com 4 policies cada) | | |

## Funções chamadas pelas policies (não exaustivo)

| Função | SECURITY DEFINER | search_path | Uso |
|---|---|---|---|
| `user_has_permission_action(uuid, text, text)` | ✅ | ✅ | Arbiter universal (com hardening Fase 3) |
| `fn_has_permission(text, text)` | ✅ | ✅ | Wrapper conveniente |
| `fn_has_role(text)` | ✅ | ✅ | Verificação de role |
| `fn_is_super_admin()` | ✅ | ✅ | Bypass SuperAdm |
| `check_is_super_admin_new()` / `check_is_super_admin_hybrid()` | ✅ | ✅ | Variantes legadas |
| `has_role(uuid, app_role)` | ✅ | ✅ | Pattern oficial Supabase |
| `fn_diaria_can_select_row(uuid)` | ✅ | ✅ | Escopo CC para diárias |
| `fn_diaria_can_update_row(uuid)` | ✅ | ✅ | Edição rascunho → emitida |
| `fn_diaria_can_manage_row(uuid)` | ✅ | ✅ | Gestão (cancelamento, aprovação) |
| `fn_diaria_has_global_access()` | ✅ | ✅ | Bypass de escopo |
| `fn_diaria_scope_centros_custo()` | ✅ | ✅ | Lista de CCs visíveis |
| `fn_ponto_can_access_batida(uuid)` | ✅ | ✅ | Escopo de ponto |
| `fn_ponto_user_can_access_cc(uuid)` | ✅ | ✅ | Escopo CC para ponto |
| `fn_ponto_can_view_rh()` / `fn_ponto_can_view_gestao()` | ✅ | ✅ | View específica |
| `fn_can_read_permission_row(uuid)` | ✅ | ✅ | Leitura catálogo |
| `fn_can_manage_permission_catalog()` | ✅ | ✅ | Mutação catálogo |
| `fn_actor_can_override_permission(uuid)` | ✅ | ✅ | Quem pode criar override |

**Todas as funções acima possuem `SET search_path` explícito** (auditado: 0 funções de permissionamento sem search_path).

## Pontos de hardening para servidor próprio

| Item | Status | Recomendação |
|---|---|---|
| `user_has_permission_action` exige role SuperAdm ativa | ✅ Aplicado Fase 3 | Manter |
| `acesso_global=true` removido de não-SuperAdm | ✅ Aplicado | Reauditar antes do cutover |
| RLS habilitada em 100% das tabelas | ✅ | Manter como invariante (CI check) |
| Funções `SECURITY DEFINER` com `search_path` | ✅ todas as críticas | Auditar 476 funções totais com `supabase--linter` antes da migração |
| Policies permissivas em tabelas sensíveis (`bd_funcionarios`, `bd_assinaturas`, `bd_desligamentos`, `bd_arquivo_morto`) | ⚠️ Pendente revisão (Fase 3 documentada) | Endurecer no servidor próprio |
| Auditoria de SELECT apenas em `bd_funcionarios_sensivel` e `bd_os_leituras_sensiveis` | ⚠️ Parcial | Ativar `pgAudit` (READ class) on-prem |
| Bypass por signed URL no Storage | ⚠️ Inerente ao Supabase | Resolvido migrando para MinIO |
| `bd_permissoes` e `bd_funcoes_permissao` ainda existem (legado) | ⚠️ | Descomissionar pré-migração |
| Permissão `gestao_abastecimento_view` ainda usa fallback hardcoded | ⚠️ Documentado em `docs/RBAC_HARDCODES_PENDENTES.md` | Resolver pré-migração |

## Riscos residuais

1. **Complexidade**: 458 policies × 476 funções é difícil de auditar manualmente. Em servidor próprio, manter `supabase--linter` ou equivalente (`pg_audit`, `pgwatch2`).
2. **Performance**: cada SELECT em tabela operacional executa de 1 a 4 chamadas a funções SECURITY DEFINER. Monitorar via `pg_stat_statements` (já instalado).
3. **Acoplamento ao `auth.uid()`**: a função existe apenas no contexto de GoTrue. Em servidor próprio sem GoTrue, será preciso emular via `SET LOCAL request.jwt.claims` (ver `11-servidor-proprio-plano-migracao.md`).
