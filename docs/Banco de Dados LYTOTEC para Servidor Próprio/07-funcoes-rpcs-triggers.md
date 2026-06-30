# 07 — Funções, RPCs e Triggers

## Totais

- **Funções/RPCs em `public`:** 476
- **SECURITY DEFINER:** 297 (62%)
- **Triggers não internos em tabelas `public`:** 214

## 1. Funções de Permissionamento (RBAC)

| Função | Tipo | SECURITY DEFINER | `search_path` | Finalidade |
|---|---|---|---|---|
| `user_has_permission_action(uuid, text, text)` | Arbiter | ✅ | ✅ | Verifica overrides → role_actions → bypass SuperAdm. **Hardening Fase 3 aplicado.** |
| `fn_has_permission(text, text)` | Wrapper | ✅ | ✅ | Açúcar sintático para o atual user. |
| `fn_has_role(text)` | Wrapper | ✅ | ✅ | Verifica role do usuário corrente. |
| `has_role(uuid, app_role)` | Pattern Supabase | ✅ | ✅ | Verificação canônica (anti-recursão). |
| `fn_is_super_admin()` | Bypass | ✅ | ✅ | Hardened: AG=true ∧ role SuperAdm. |
| `check_is_super_admin_new()` / `check_is_super_admin_hybrid()` / `check_is_super_admin()` | Bypass legado | ✅ | ✅ | Compatibilidade. **Avaliar descomissionar.** |
| `fn_can_view_permission_admin()` | RBAC admin | ✅ | ✅ | Quem vê tela de Gestão de Permissões. |
| `fn_can_manage_permission_catalog()` | RBAC admin | ✅ | ✅ | Quem altera catálogo. |
| `fn_can_read_permission_row(uuid)` | RBAC admin | ✅ | ✅ | Leitura de linha do catálogo. |
| `fn_actor_can_override_permission(uuid)` | RBAC admin | ✅ | ✅ | Quem pode atribuir override por usuário. |
| `fn_assign_user_role_secure(uuid, uuid)` | RPC admin | ✅ | ✅ | Substitui INSERT direto em `bd_user_roles`. |
| `fn_remove_user_role_secure(uuid, uuid)` | RPC admin | ✅ | ✅ | Remoção segura. |
| `fn_clear_user_admin_roles_secure(uuid)` | RPC admin | ✅ | ✅ | Limpeza segura. |
| `fn_update_managed_profile_access_scope(uuid, bool)` | RPC admin | ✅ | ✅ | Altera `acesso_global` controladamente. |
| `fn_get_manageable_permission_profiles()` | RPC admin | ✅ | ✅ | Listagem de perfis gerenciáveis. |
| `fn_get_my_permission_snapshot()` | RPC user | ✅ | ✅ | Snapshot offline para PWA. |
| `fn_permission_aliases()` | Helper | ❌ STABLE | ✅ | Mapa de aliases (read-only). |
| `fn_permission_is_protected(text)` | Helper | ✅ | ✅ | Proteção de permissões críticas. |
| `fn_validate_permission_catalog_change()` | Trigger fn | ✅ | ✅ | Valida mutação do catálogo. |
| `fn_validate_role_permission_link_change()` | Trigger fn | ✅ | ✅ | Valida vínculo role↔perm. |
| `fn_validate_role_permission_action_change()` | Trigger fn | ✅ | ✅ | Valida ação granular. |
| `fn_audit_permission_change()` | Trigger fn | ✅ | ✅ | Grava em `bd_permission_change_audit_logs`. |
| `fn_audit_user_permission_overrides()` | Trigger fn | ✅ | ✅ | Auditoria de overrides. |

## 2. Funções do Módulo Diárias

| Função | Finalidade |
|---|---|
| `fn_diaria_can_select_row(uuid)` | Pode ver linha do CC? |
| `fn_diaria_can_create(uuid)` | Pode criar para o CC? |
| `fn_diaria_can_update_row(uuid)` | Pode editar (escopo + status)? |
| `fn_diaria_can_manage_row(uuid)` | Pode gerir (aprovar/cancelar)? |
| `fn_diaria_has_global_access()` | Bypass de escopo (cuidado) |
| `fn_diaria_scope_centros_custo()` | Lista de CCs visíveis ao usuário |
| `fn_diaria_funcionario_elegibilidade(uuid, date)` | Elegibilidade no dia |
| `fn_diaria_get_funcionarios_disponiveis(...)` | Lista de funcionários elegíveis |
| `fn_diaria_aditivos_pendentes_escopo()` | Aditivos pendentes no escopo |
| `fn_diaria_nomes_minimos()` | Helper de relatórios |
| `gerenciar_convocado_diaria(...)` | RPC oficial para escrita em convocados-pre |
| `gerenciar_convocado_diaria_no_dia(...)` | Variante diária |
| `fn_server_now_brt()` | Relógio servidor BRT (gate global SSO/diárias) |
| `fn_auditar_relatorio_diarias()` | Trigger de auditoria de relatórios |
| Triggers: `trg_recalcular_status_diaria`, lock de status, validação de períodos | — |

## 3. Funções do Módulo Ponto Eletrônico

| Função | Finalidade |
|---|---|
| `fn_ponto_audit_trigger()` | Trigger universal de auditoria do módulo |
| `fn_ponto_can_access_batida(uuid)` | Escopo por batida |
| `fn_ponto_user_can_access_cc(uuid)` | Escopo por CC |
| `fn_ponto_user_can_access_funcionario(uuid)` | Escopo por funcionário |
| `fn_ponto_can_view_rh()` / `fn_ponto_can_view_gestao()` / `fn_ponto_can_view_antifraude_logs()` | Visualizações específicas |
| `fn_ponto_can_manage_config()` / `fn_ponto_can_manage_devices()` / `fn_ponto_can_manage_vinculos()` | Mutações |
| `fn_ponto_get_funcionario_id()` | Resolve funcionário do `auth.uid()` |
| `fn_ponto_is_superadmin()` | Bypass específico |
| `fn_ponto_has_permission(text, text)` | Wrapper |
| `fn_ponto_diaria_integrar_batida(uuid)` | Integração ponto → diárias |
| `fn_ponto_diaria_integrar_lote(...)` | Lote |
| `fn_ponto_diaria_simular_batida(...)` / `fn_ponto_diaria_simular_lote(...)` | Simulação shadow |
| `fn_ponto_registrar_auditoria_config()` | Auditoria de config |

## 4. Funções de Auditoria

| Função | Trigger em | Finalidade |
|---|---|---|
| `fn_auditoria_log()` | Tabelas críticas (genérico) | Grava em `bd_auditoria_log` |
| `fn_arquivar_auditoria_log(int)` | Cron diário | Move > 12 meses para archive |
| `fn_audit_sensitive_read()` | Wrapper de leitura | `bd_auditoria_leitura_funcionario_sensivel` |
| `fn_audit_permission_change()` | RBAC | `bd_permission_change_audit_logs` |
| `fn_audit_user_permission_overrides()` | RBAC | Overrides |
| `fn_ativos_auditar_mutacao()` / `fn_auditar_ativos()` | Máquinas | `bd_ativos_auditoria` |
| `fn_auditar_os_mutacao()` | OS | `bd_os_auditoria` |
| `fn_auditar_logistica_mutacao()` | Logística | `bd_logistica_auditoria` |
| `fn_auditar_relatorio_diarias()` / `fn_auditar_relatorio_ponto()` / `fn_auditar_bi_relatorio()` | Geração de relatórios | tabelas dedicadas |
| `fn_storage_audit_access()` | Wrapper de acesso a Storage | `bd_storage_auditoria` |
| `fn_backend_audit_event(...)` | Edge / RPC | `bd_backend_exec_auditoria` + `bd_security_audit_log` |

## 5. Funções de Relatório / Cálculo

| Função | Finalidade |
|---|---|
| `mv_relatorio_diarias` refresh + `_mv_relatorio_diarias_dirty` | MV financeira com flag de invalidação |
| `fn_get_funcionarios_ativos_global()` | RPC para listagem unificada |
| `fn_processar_promocao()` | Trigger em exame "Mudança de Risco" |
| Funções de cálculo de diária (mirror PostgreSQL ↔ TS) | Cálculo financeiro |
| Funções de cálculo de jornada | Ponto |

## 6. Funções Administrativas / Sistema

| Função | Finalidade |
|---|---|
| `fn_backend_has_permission(text, text)` (2 overloads) | Backend (edges) verifica permissão sem RLS de usuário |
| `fn_backend_audit_event(text, jsonb)` | Loga evento administrativo |
| Funções de sincronização com PNCP / Alterdata / site | Integrações |

## 7. Funções Legadas / Deprecated

| Função | Status | Plano |
|---|---|---|
| `check_is_super_admin()` | Legado | Substituído por `fn_is_super_admin()` hardened |
| `check_is_super_admin_hybrid()` | Legado | Avaliar remoção pós-cutover RBAC |
| `check_is_super_admin_new()` | Transição | Manter durante migração |
| Funções referenciando `profiles.funcoes` ou `bd_funcoes_permissao` | Legado | Descomissionar com `RBAC_LEGACY_FALLBACK_ENABLED=false` em produção |

## Triggers — visão por tabela

> Total: **214 triggers** não internos. Padrões mais comuns:

- `set_updated_at` em quase todas as tabelas mestras/operacionais (usa `update_updated_at_column()`).
- `fn_auditoria_log` em tabelas críticas (RH, OS, máquinas, logística, fluxos).
- Validações de status / locking em diárias (`fn_lock_status_classificacao`, triggers de transição).
- Auditoria específica em RBAC, biometria e leituras sensíveis.

## Riscos para servidor próprio

1. **Volume de funções SECURITY DEFINER (297)** — superfície de ataque grande. Auditar via `supabase--linter` (já passou); manter linter recorrente on-prem.
2. **Funções legadas** ainda presentes — risco de uso acidental. Plano de descomissionamento documentado em `08-rbac-permissionamento.md`.
3. **Dependência de `auth.uid()`** em ~70% das funções SECURITY DEFINER — substituição de GoTrue exige reproduzir o claim JWT no banco.
4. **Triggers em massa (214)** — performance: alguns triggers de auditoria gravam JSONB em cada UPDATE; monitorar `pg_stat_user_tables.n_tup_upd` vs latência.
5. **Funções de cálculo duplicadas (TS ↔ SQL)** — manter mirrors testados (existem testes em `src/lib/diarias/__tests__/`).
