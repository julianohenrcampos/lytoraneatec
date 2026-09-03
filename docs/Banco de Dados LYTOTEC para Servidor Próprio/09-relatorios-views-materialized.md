# 09 — Views e Materialized Views

## Totais

- **Views regulares:** 63
- **Materialized Views:** 2 (`mv_relatorio_diarias`, `mv_relatorio_diarias_legacy_20260514`)
- **Flag de invalidação:** `_mv_relatorio_diarias_dirty` (tabela 1-linha)
- **Refresh automático:** `pg_cron` a cada 10 minutos quando flag = true

## Views regulares (63) — agrupadas

### Auditoria
- `vw_auditoria_log_completo` — União `bd_auditoria_log` + `bd_auditoria_log_archive` com `security_invoker=true`.
- `vw_auditoria_sistema` — Catálogo de eventos do sistema (`security_invoker=true` + revoke direto a `anon`/`authenticated`).

### RBAC
- `vw_rbac_permissions_safe`, `vw_rbac_roles_safe` — leitura segura do catálogo.
- `vw_rbac_standard_funcao_permissoes` — padrão funcional.
- `vw_rbac_standard_permission_gaps` — gaps padrão × atribuído.
- `vw_rbac_legacy_map_drift` — drift legacy ↔ novo.

### Funcionários
- `vw_funcionarios_rh` — visão RH (PII parcial).
- `vw_funcionarios_operacional` — visão operacional (sem PII).
- `vw_funcoes_publicas` — funções públicas.
- `vw_profile_self_safe`, `vw_profiles_admin_safe` — espelhos seguros de `profiles`.

### Diárias
- `vw_diaria_relatorio_financeiro` — relatório financeiro.
- `vw_diaria_aprovacoes_efetivas` — aprovações efetivas.
- `vw_diarias_aprovacao_gerencial` — visão gerencial.
- `vw_diarias_operacional_campo` — visão campo.
- `vw_diarias_financeiro_dp` — visão DP.
- `vw_relatorio_diarias_folha` — folha de pagamento.
- `vw_bi_diarias_financeiro_indicadores`, `vw_bi_diarias_gerencial_indicadores`, `vw_bi_diarias_operacional_indicadores` — dashboards BI.

### Ponto Eletrônico
- `vw_ponto_batidas_pessoal` — visão do próprio.
- `vw_ponto_batidas_rh` — visão RH.
- `vw_ponto_batidas_gestao` — visão gestão.
- `vw_ponto_dispositivos_admin`, `vw_ponto_dispositivos_seguro` — dispositivos.
- `vw_ponto_logs_antifraude_seguro` — logs antifraude.
- `vw_ponto_diaria_shadow` — comparação shadow (ponto vs diária).

### Apontamento / Equipe
- `vw_apontamento_equipe`, `vw_apontamento_equipe_seguro`, `vw_apontamento_cam_equipa_seguro`.

### Logística / Aplicação
- `vw_registro_cargas_seguro`, `vw_registro_aplicacao_seguro`.
- `vw_lista_programacao_entrega_segura`, `vw_programacao_entrega_segura`.
- `vw_logistica_relatorio_gerencial_seguro`.

### Máquinas / Equipamentos / Solicitações
- `vw_ativos_logistica_manutencao`, `vw_ativos_operacional`.
- `vw_localizacao_equipamentos_controlada`.
- `vw_custos_equipamentos_seguro`.
- `vw_portfolio_tecnico_seguro`.
- `vw_solicitacoes_equipamento_financeiro`, `vw_solicitacoes_equipamento_operacional`.
- `vw_bi_maquinas_estrategico_indicadores`, `vw_bi_maquinas_operacional_indicadores`.

### OS / Cotações
- `vw_chamados_os_operacional_seguro`.
- `vw_ordens_servico_admin_seguro`, `vw_ordens_servico_operacional_seguro`.
- `vw_os_custos_resumido_seguro`, `vw_os_resumo_financeiro`.
- `vw_cotacoes_segura`.
- `vw_bi_os_estrategico_indicadores`, `vw_bi_os_operacional_indicadores`.

### Aprovações / Fluxos
- `vw_aprovacoes_excecao_segura`.
- `vw_documentos_fluxo_diarias_seguro`.

### SSO / Licitações / Requisições
- `vw_bi_sso_indicadores`.
- `vw_bi_rh_estrategico_indicadores`, `vw_bi_rh_operacional_indicadores`.
- `vw_pncp_contratacoes_estrategico`, `vw_pncp_contratacoes_operacional`.
- `vw_bi_licitacoes_indicadores`.
- `vw_requisicoes_operacional_segura`.

### Assinaturas
- `vw_assinaturas_diarias_seguro`.

## Materialized Views

| MV | Fonte | Tamanho relativo | Refresh | Uso |
|---|---|---|---|---|
| `mv_relatorio_diarias` | Vários joins (`bd_diaria_*`, `bd_funcionarios`, `bd_centros_custo`, `bd_funcoes`, `bd_empresas`) | Grande (milhares–dezenas de milhares de linhas) | Cron `*/10 * * * *` quando `_mv_relatorio_diarias_dirty.dirty=true` | Relatório financeiro de diárias |
| `mv_relatorio_diarias_legacy_20260514` | Snapshot legado | Snapshot histórico | Sem refresh (congelada) | Comparação histórica pós-migração |

## Cron jobs (pg_cron) — todos relacionados a views/auditoria

| Job | Schedule | Comando | Finalidade |
|---|---|---|---|
| `auto-finalizar-diarias-16h` | `0 19 * * *` (16h BRT) | `net.http_post → /functions/v1/auto-finalizar-diarias` | Auto-finalização de diárias do dia |
| `refresh-mv-relatorio-diarias` | `*/10 * * * *` | Verifica flag e `REFRESH MATERIALIZED VIEW` | Refresh condicional |
| `arquivar-auditoria-diario` | `15 3 * * *` | `SELECT fn_arquivar_auditoria_log(50000)` | Arquivamento mensal |

## Padrão de segurança das views

- Todas as views sensíveis usam `security_invoker=true`.
- Views BI usam dados agregados sem PII direta.
- Views `*_seguro` filtram colunas conforme `auth.uid()` e RBAC.

## Riscos para servidor próprio

| Risco | Detalhe | Mitigação |
|---|---|---|
| MV `mv_relatorio_diarias` pode ficar grande | Refresh full a cada 10 min se sujeira | Avaliar `REFRESH CONCURRENTLY` ou migrar para tabela populada por triggers incrementais |
| 63 views — manutenção | Cada mudança em tabela base pode quebrar views | Versionar definições via `pg_dump --schema-only` no repositório |
| `security_invoker=true` exige RLS bem definida | Já garantida (100%) | Manter invariante via CI |
| Dependência de `pg_cron` | Não disponível por padrão fora do Supabase | Habilitar `pg_cron` (extensão) no PG 17 do servidor próprio ou usar systemd timers / Airflow |
| Edge call dentro de cron (`net.http_post`) | `pg_net` está instalado | Em servidor próprio, manter `pg_net` ou substituir por agendador externo chamando a API |
| Snapshot histórico `mv_relatorio_diarias_legacy_20260514` | Congelada — não migrar como MV mas sim como tabela | Converter via `CREATE TABLE … AS SELECT … FROM mv…` |

## Estratégia recomendada de refresh on-prem

- Manter modelo "dirty flag + cron 10 min" — funciona bem para volumetria atual.
- Em horários de pico (fim de semana / fechamento de folha), considerar refresh manual após batch.
- Monitorar tempo de refresh via `pg_stat_statements`.
