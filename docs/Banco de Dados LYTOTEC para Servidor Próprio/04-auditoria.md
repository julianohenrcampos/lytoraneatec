# 04 — Auditoria

## Inventário de tabelas de auditoria (16+)

| Tabela | O que audita | Quem grava | Operações | Campos principais | RLS | Suficiência |
|---|---|---|---|---|---|---|
| `bd_auditoria_log` | Mutações genéricas em tabelas críticas | Trigger `fn_auditoria_log` | INSERT/UPDATE/DELETE | `tabela`, `operacao`, `registro_id`, `dados_anteriores` JSONB, `dados_novos` JSONB, `usuario_id`, `created_at` | Sim (2 policies) | **Boa** para rastreabilidade jurídica/operacional |
| `bd_auditoria_log_archive` | Cópia arquivada de `bd_auditoria_log` (>12 meses) | Cron `arquivar-auditoria-diario` via `fn_arquivar_auditoria_log` | INSERT | Mesmos campos + `archived_at` | Sim | Boa |
| `bd_permission_audit_logs` | Toda verificação de permissão | `usePermission` (frontend) + `checkUserAction` (service) | INSERT | `user_id`, `rota`, `permitido`, `origem`, `created_at` | Sim (2) | Boa para telemetria de cutover RBAC |
| `bd_permission_change_audit_logs` | Mudanças em catálogo RBAC | Trigger `fn_audit_permission_change` em `bd_permissions`, `bd_role_permissions`, `bd_role_permission_actions`, `bd_user_permission_overrides` | INSERT/UPDATE/DELETE | `tabela`, `operacao`, `permission_id`, `role_id`/`user_id`, `dados_anteriores`, `dados_novos`, `actor_id` | Sim (4) | **Crítica** para compliance |
| `bd_ponto_audit_log` | Mutações em `bd_ponto_batidas`, `bd_ponto_ajustes`, `bd_ponto_config` | `fn_ponto_audit_trigger` | INSERT/UPDATE/DELETE | `tabela`, `operacao`, `dados`, `usuario_id` | Sim (1) | Boa |
| `bd_security_audit_log` | Eventos de segurança | `fn_backend_audit_event` | INSERT | `evento`, `severidade`, `usuario_id`, `payload`, `ip` | Sim (2) | Boa |
| `bd_backend_exec_auditoria` | Execuções de RPCs administrativas | `fn_backend_audit_event` | INSERT | `funcao`, `caller_id`, `parametros`, `resultado`, `duracao_ms` | Sim (3) | Boa |
| `bd_auditoria_biometria` | CRUD em `bd_funcionarios_biometria_facial` | Triggers em `bd_funcionarios_biometria_facial` | I/U/D | `funcionario_id`, `operacao`, `usuario_id`, `payload` | Sim (1) | **Boa** (LGPD-crítica) |
| `bd_auditoria_leitura_funcionario_sensivel` | **Leituras** em `bd_funcionarios_sensivel` | `fn_audit_sensitive_read` (SECURITY DEFINER) | INSERT | `usuario_id`, `funcionario_id`, `colunas`, `created_at` | Sim (2) | **Excelente** — único caso de auditoria de SELECT |
| `bd_ativos_auditoria` | Mutações em `bd_caminhoes_equipamentos` e satélites | `fn_ativos_auditar_mutacao` | I/U/D | Padrão genérico | Sim (2) | Boa |
| `bd_os_auditoria` | Mutações em OS | `fn_auditar_os_mutacao` | I/U/D | Padrão genérico | Sim (2) | Boa |
| `bd_os_leituras_sensiveis` | Leituras de OS sensíveis | Função SECURITY DEFINER | INSERT | `os_id`, `usuario_id`, `colunas` | Sim (2) | Boa |
| `bd_logistica_auditoria` | Mutações em logística | `fn_auditar_logistica_mutacao` | I/U/D | Padrão genérico | Sim (1) | Boa |
| `bd_storage_auditoria` | Acessos a buckets sensíveis | `fn_storage_audit_access` | INSERT | `bucket`, `path`, `usuario_id`, `operacao` | Sim (2) | Parcial — depende de chamada explícita |
| `bd_diaria_relatorio_auditoria` | Geração de relatórios de diárias (PDF/XLSX) | `fn_auditar_relatorio_diarias` | INSERT | `tipo_relatorio`, `filtros`, `usuario_id` | Sim (3) | Boa |
| `bd_ponto_relatorio_auditoria` | Geração de relatórios de ponto | `fn_auditar_relatorio_ponto` | INSERT | Análogo | Sim (2) | Boa |
| `bd_bi_relatorios_auditoria` | Geração de dashboards BI | `fn_auditar_bi_relatorio` | INSERT | `relatorio`, `usuario_id`, `escopo` | Sim (2) | Boa |
| `bd_auditoria_sync_equipe_funcionario` | Sync apontamento ↔ equipe ↔ funcionário | Trigger dedicado | INSERT | Diferenças detectadas | Sim (1) | Boa |
| `bd_auditoria_correcao_registros_carga` | Correções manuais em cargas | Trigger | INSERT/UPDATE | Antes/depois | Sim (2) | Boa |
| `bd_auditoria_correcao_volume_formula` | Correções de fórmula de volume | Trigger | INSERT | Antes/depois | Sim (1) | Boa |
| `bd_auditoria_volume_correcao` | Auditoria adicional volume | Trigger | INSERT | Padrão | Sim (1) | Boa |
| `bd_diaria_logs` | Log operacional do módulo de diárias | RPCs do módulo | INSERT | `evento`, `payload`, `solicitacao_id` | Sim (2) | Boa |
| `bd_log_comunicacao` | E-mails/notificações enviadas | Edge / RPC | INSERT | `tipo`, `destinatario`, `status`, `payload` | Sim (2) | Boa |
| `bd_log_operacional_datas` | Marcos operacionais por CC | RPC | INSERT | `cc_id`, `evento`, `data` | Sim (2) | Boa |

## Matriz Módulo × Auditoria × Lacuna

| Módulo | Tabela principal | Auditoria de mutação | Auditoria de leitura | Lacuna | Recomendação para servidor próprio |
|---|---|---|---|---|---|
| RH — Funcionários | `bd_funcionarios` | ✅ `bd_auditoria_log` | ❌ | Não há log de quem visualiza ficha completa | Avaliar trigger SELECT via view + função wrapper |
| RH — Sensível | `bd_funcionarios_sensivel` | ✅ | ✅ `bd_auditoria_leitura_funcionario_sensivel` | Nenhuma significativa | Manter como padrão de referência |
| Biometria | `bd_funcionarios_biometria_facial` | ✅ `bd_auditoria_biometria` | Parcial | Leituras pelo edge totem não logadas estruturadamente | Forçar log em `cadastrar-biometria-facial` e `identificar-funcionario-por-face` |
| Diárias | `bd_diaria_solicitacoes` / `bd_diaria_presencas` | ✅ `bd_auditoria_log` + `bd_diaria_logs` | ❌ | Relatórios financeiros não rastreiam quem visualiza linha-a-linha | Habilitar `pgAudit` em views financeiras no servidor próprio |
| Ponto | `bd_ponto_batidas` | ✅ `bd_ponto_audit_log` | Parcial | Apenas via view RH limitada | Logar acesso a `vw_ponto_batidas_rh` |
| SSO Exames | `bd_agendamentos_exames` | ✅ `bd_auditoria_log` | ❌ | Anexos médicos sem log de leitura | Adicionar log via `fn_storage_audit_access` no bucket `exames_agendamentos` |
| Máquinas | `bd_caminhoes_equipamentos` | ✅ `bd_ativos_auditoria` | ❌ | OK | — |
| OS | `bd_ordens_servico` | ✅ `bd_os_auditoria` | ✅ parcial (`bd_os_leituras_sensiveis`) | OK | — |
| Logística | `bd_registro_cargas` / aplicações | ✅ `bd_logistica_auditoria` + correções | ❌ | OK | — |
| Licitações | `bd_pncp_contratacoes` | ✅ `bd_pncp_sync_log` | ❌ | Logs de classificação manual não detalhados | Trigger em mudança de status |
| RBAC | `bd_permissions` / `bd_user_roles` / overrides | ✅ `bd_permission_change_audit_logs` | ✅ `bd_permission_audit_logs` | OK | — |
| Storage | buckets | ✅ parcial `bd_storage_auditoria` | ✅ parcial | Dependência de chamada explícita; bypass via signed URL não loga | Em servidor próprio, usar **MinIO audit log nativo** |
| Edge Functions | — | ✅ `bd_backend_exec_auditoria` | — | Cobre apenas funções que chamam `fn_backend_audit_event` | Padronizar wrapper |

## Retenção atual

- Cron `arquivar-auditoria-diario` (03:15 UTC) chama `fn_arquivar_auditoria_log(50000)` → move registros > 12 meses para `bd_auditoria_log_archive`.
- View unificada `vw_auditoria_log_completo` com `security_invoker=true` permite consulta histórica.

## Riscos para servidor próprio

1. **Bypass de Storage por signed URL** — em Supabase a URL assinada não passa por RLS nem por `fn_storage_audit_access`. Em servidor próprio, mover para MinIO + bucket policy + audit log nativo.
2. **Auditoria de SELECT é exceção** — apenas `bd_funcionarios_sensivel` e `bd_os_leituras_sensiveis` têm. Considerar `pgAudit` (READ class) em tabelas críticas (PII, financeiro, médico).
3. **Particionamento ausente** — `bd_auditoria_log` cresce sem partição declarativa. No servidor próprio, particionar por mês (`PARTITION BY RANGE (created_at)`).
4. **Retenção 12 meses** pode ser insuficiente para fiscal/CLT (5 anos). Validar com jurídico antes da migração e estender política no archive.
5. **`bd_storage_auditoria` depende de chamada explícita** — facilmente esquecida em novas integrações. Padronizar via wrapper único.
