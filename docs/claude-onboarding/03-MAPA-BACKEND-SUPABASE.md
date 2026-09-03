# 03 — MAPA DO BACKEND (SUPABASE)

> Auditoria READ-ONLY. **Não houve acesso ao banco real.** Fonte: `supabase/migrations/*.sql` (869 arquivos) + `src/integrations/supabase/types.ts` (schema gerado).
> Consultas de validação estão marcadas com `[VERIFICAR NO BANCO]`.

---

## 1. Identificação do projeto

| Item | Valor |
|---|---|
| Project ID (ERP) | `eexzgpmrousuxlkvqwkm` |
| URL | `https://eexzgpmrousuxlkvqwkm.supabase.co` |
| Região / versão | Não determinável estaticamente |
| Declarado em | `supabase/config.toml`, `.env`, `src/integrations/supabase/client.ts` |

⚠️ **O MCP Supabase desta sessão aponta para outro projeto (`zoruxlcqkagcqrmevmrk`)** — um SaaS de licitações/PNCP não relacionado. Nenhuma consulta foi feita ao banco do ERP.

---

## 2. Números do backend

| Elemento | Quantidade | Fonte |
|---|---:|---|
| Migrations | **869** arquivos (6,8 MB) | `supabase/migrations/` |
| Tabelas (schema `public`) | **194** | `types.ts → Tables` |
| Views + Materialized Views | **70** | `types.ts → Views` |
| Funções expostas como RPC | **452** | `types.ts → Functions` |
| Enums | **22** | `types.ts → Enums` |
| Definições `CREATE FUNCTION` (distintas, migrations) | **593** | replay das migrations |
| Funções `SECURITY DEFINER` (última definição) | **499** | replay das migrations |
| Triggers criados | **228** distintos | migrations |
| Índices criados | **434** distintos (474 statements) | migrations |
| Policies RLS vivas | **618** | replay `CREATE`/`DROP POLICY` |
| Edge Functions | **36** | `supabase/functions/` |
| Buckets de Storage | **23** identificados | migrations + código |
| Extensões | 5 | migrations |

---

## 3. Extensões PostgreSQL

| Extensão | Uso identificado |
|---|---|
| `pgcrypto` | hashes, `gen_random_uuid` |
| `unaccent` | `normalize_text`, `unaccent_immutable`, busca sem acento |
| `btree_gist` | constraints de exclusão / ranges |
| `vector` | descritores faciais (biometria — `bd_funcionarios_biometria_facial`) |
| `pg_cron` | agendamento — **nenhum `cron.schedule(...)` encontrado nas migrations** ⇒ jobs configurados fora do versionamento |

**`[VERIFICAR NO BANCO]`**
```sql
select jobid, schedule, command, active from cron.job order by jobid;
select extname, extversion from pg_extension order by 1;
```

---

## 4. Materialized views

| MV | Observação |
|---|---|
| `mv_relatorio_diarias` | Ativa. Refresh via `refresh_relatorio_diarias(p_force boolean)`; controle de sujeira em `_mv_relatorio_diarias_dirty` |
| `mv_relatorio_diarias_v2` | Criada em migration; **não aparece em `types.ts`** ⇒ possivelmente descartada ou não exposta |
| `mv_relatorio_diarias_legacy_20260514` | Snapshot legado preservado |

---

## 5. Distribuição das 452 RPCs por domínio (prefixo)

| Domínio | RPCs | Exemplos |
|---|---:|---|
| Central do Transporte (`fn_ct_*`) | **60** | `fn_ct_mobilizacao_programar`, `fn_ct_viagem_iniciar`, `fn_ct_puxada_programar`, `fn_ct_mov_direta_*` |
| Chamados Internos (`fn_chamado_interno_*`) | **35** | `fn_chamado_interno_abrir`, `_assumir`, `_resolver`, `_dash_kpis` |
| Getters genéricos (`get_*`) | 22 | `get_relatorio_diarias`, `get_auditoria_sistema`, `get_funcionarios_para_diarias` |
| Ponto eletrônico (`*ponto*`) | 16 | `fn_ponto_diaria_integrar_batida`, `fn_ponto_can_access_batida` |
| Predicados de acesso (`fn_can_*` / `can_*`) | 12 | `fn_can_access_diarias_financeiro`, `fn_can_manage_permission_catalog` |
| POPs (`fn_pop_*`) | 11 | `fn_pop_criar`, `fn_pop_publicar_rascunho`, `fn_pop_excluir` |
| Diárias (`fn_diaria_*`) | 11 | `fn_diaria_can_select_row`, `fn_diaria_capacidades_aprovacao` |
| Solicitações de equipamento (`fn_solic_*`) | 10 | `fn_solic_equip_criar`, `fn_solic_equip_decidir` |
| Ordens de Serviço (`fn_os_*`) | 10 | `fn_os_can_access_ordem`, `fn_recalcula_total_os` |
| Predicados `has_*` / `fn_has_*` | 10 | `fn_has_permission`, `fn_has_action`, `fn_has_role` |
| Ativos (`fn_ativos_*`) | 10 | `fn_ativos_can_access_equipamento` |
| Logística (`fn_logistica_*`) | 9 | `fn_logistica_can_access_requisicao` |
| Cálculos de negócio (`calcular_*`) | 9 | `calcular_massa_remanescente`, `calcular_valor_diaria`, `calcular_espessura_aplicacao` |
| Storage (`fn_storage_*`) | 6 | `fn_storage_can_access`, `fn_storage_can_upload`, `fn_storage_audit_access` |
| Importador de ativos (`fn_importador*`) | 6 | `fn_importador_v2_abrir_execucao`, `fn_importador_ativos_inserir` |
| Aprovações (`aprovar_*` / `reprovar_*` / `fn_aprovacao_*`) | 17 | `aprovar_diretor_operacional`, `fn_aprovacao_corporativa_decidir_core` |
| PNCP | 5 | `fn_pncp_can_view`, `fn_pncp_can_manage_orgaos` |

### Padrão arquitetural identificado

O backend segue um padrão consistente de **"predicado de autorização por linha"**: para cada domínio existe um conjunto de funções `SECURITY DEFINER` `fn_<dominio>_can_<acao>_<entidade>(...)` que:
1. são chamadas dentro das policies RLS (`USING (...)`);
2. são também expostas como RPC para o frontend consultar capacidades antes de renderizar botões.

Exemplos: `fn_diaria_can_select_row`, `fn_ativos_can_access_equipamento`, `fn_os_can_manage_ordem`, `fn_chamado_interno_can_read`, `fn_ponto_can_access_batida`, `fn_funcionarios_can_select_row`.

**Este padrão é a espinha dorsal da segurança do ERP e não deve ser contornado.**

---

## 6. Views "seguras" (sufixo `_seguro` / `_segura` / `_safe`)

O sistema usa views como camada de **projeção de colunas por perfil**, além do RLS. Foram identificadas 30+ views com esse propósito:

`vw_apontamento_cam_equipa_seguro`, `vw_apontamento_equipe_seguro`, `vw_aprovacoes_excecao_segura`, `vw_assinaturas_diarias_seguro`, `vw_chamados_os_operacional_seguro`, `vw_cotacoes_segura`, `vw_custos_equipamentos_seguro`, `vw_documentos_fluxo_diarias_seguro`, `vw_lista_programacao_entrega_segura`, `vw_localizacao_equipamentos_controlada`, `vw_logistica_relatorio_gerencial_seguro`, `vw_ordens_servico_admin_seguro`, `vw_ordens_servico_operacional_seguro`, `vw_os_custos_resumido_seguro`, `vw_ponto_dispositivos_seguro`, `vw_ponto_logs_antifraude_seguro`, `vw_portfolio_tecnico_seguro`, `vw_profile_self_safe`, `vw_profiles_admin_safe`, `vw_programacao_entrega_segura`, `vw_rbac_permissions_safe`, `vw_rbac_roles_safe`, `vw_registro_aplicacao_seguro`, `vw_registro_cargas_seguro`, `vw_requisicoes_operacional_segura`, `vw_solicitacoes_equipamento_financeiro`, `vw_solicitacoes_equipamento_operacional`.

E o par **operacional / sensível** para funcionários:
- `bd_funcionarios` (dados gerais) + `bd_funcionarios_sensivel` (dados sensíveis segregados)
- `vw_funcionarios_operacional` × `vw_funcionarios_rh`
- Auditoria de leitura: `bd_auditoria_leitura_funcionario_sensivel`, `fn_get_funcionario_sensitive`, `fn_audit_sensitive_read`, `fn_log_sensitive_read`

Mesmo padrão para Ponto: `vw_ponto_batidas_pessoal` / `vw_ponto_batidas_gestao` / `vw_ponto_batidas_rh`.

E para BI: `vw_bi_*_indicadores` (11 views) com gate `fn_bi_can_view_dashboard` e `fn_bi_can_export`.

---

## 7. Camada de auditoria (13 tabelas)

| Tabela | Escopo |
|---|---|
| `bd_auditoria_log` | Log geral de alterações (tabela, operação, registro_id, usuario_id, dados_novos, campos_alterados) |
| `bd_auditoria_log_archive` | Arquivo (via `fn_arquivar_auditoria_log`) |
| `bd_security_audit_log` | Eventos de segurança |
| `bd_permission_audit_logs` | Telemetria de RBAC (inclusive eventos de fallback legado emitidos pelo frontend) |
| `bd_permission_change_audit_logs` | Mudanças de permissão (actor/target) |
| `bd_backend_exec_auditoria` | Invocações de Edge Functions (`fn_backend_audit_event`, `fn_backend_can_invoke`) |
| `bd_storage_auditoria` | Acessos a Storage (`fn_storage_audit_access`) |
| `bd_ativos_auditoria`, `bd_os_auditoria`, `bd_logistica_auditoria` | Auditoria por domínio |
| `bd_auditoria_leitura_funcionario_sensivel`, `bd_os_leituras_sensiveis` | Auditoria de **leitura** de dados sensíveis |
| `bd_auditoria_biometria` | Eventos de biometria facial |
| `bd_bi_relatorios_auditoria`, `bd_diaria_relatorio_auditoria`, `bd_ponto_relatorio_auditoria` | Auditoria de geração de relatórios |
| `bd_auditoria_correcao_*`, `bd_auditoria_volume_correcao`, `bd_auditoria_sync_equipe_funcionario` | Auditorias pontuais de correção de dados |

Views de consolidação: `vw_auditoria_log_completo`, `vw_auditoria_sistema`; RPC `get_auditoria_sistema`, `get_auditoria_alertas_24h`.

---

## 8. Camada de notificações

- `bd_notificacoes` + `bd_notificacoes_usuarios` (N:N)
- RPCs: `fn_notificacao_emitir_core`, `fn_notificacao_dest_profiles`, `fn_notificacao_dest_centros_custo`, `fn_notificacao_ct_viagem_evento`
- Frontend: `src/hooks/useNotifications.ts` (usa **Realtime** `postgres_changes`), `src/services/notifications/`
- `bd_log_comunicacao`, `bd_envios` (e-mail via Resend)

---

## 9. Motor de aprovação dinâmico

Conjunto de tabelas que implementa um workflow configurável:

| Tabela | Papel |
|---|---|
| `bd_fluxos_aprovacao` | Definição de fluxos |
| `bd_fluxo_etapas` | Etapas (com `permission_id` → `bd_permissions` ou `usuario_especifico_id` → `profiles`) |
| `bd_fluxo_centro_custo` | Vinculação de fluxo a CC |
| `bd_fluxo_aplicacoes` | Aplicação do fluxo a um domínio |
| `bd_fluxo_historico` | Histórico |
| `bd_aprovacoes_fluxo_exec` | Execução de aprovações |
| `bd_documentos_fluxo`, `bd_documentos_relacao` | Documentos anexos ao fluxo |

RPCs: `iniciar_fluxo_dinamico`, `aprovar_etapa_dinamica`, `rejeitar_etapa_dinamica`, `liberar_proxima_etapa_dinamica`, `verificar_etapa_disponivel`, `fn_aprovacao_resolver_fluxo`, `fn_aprovacao_resolver_aprovador`, `fn_motor_aprovacao_corporativo_disponivel`, `fn_aprovacao_corporativa_iniciar/_decidir_core/_status`.

**Coexiste com aprovações hardcoded por cargo**: `aprovar_gerente_adm`, `aprovar_diretor_adm`, `aprovar_diretor_operacional`, `reprovar_*` — ver `16-LEGADO-DUPLICIDADES.md`.

---

## 10. Rate limiting

- Tabela `bd_rate_limit_tentativas`
- RPCs `fn_rate_limit_check`, `fn_rate_limit_reset`

**`[VERIFICAR NO BANCO]`** — quais fluxos realmente consomem esse mecanismo:
```sql
select p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and pg_get_functiondef(p.oid) ilike '%fn_rate_limit_check%'
order by 1;
```

---

## 11. Migrations — características e riscos

- **Nomenclatura**: `YYYYMMDDHHMMSS_<uuid>.sql` (padrão Lovable). As mais antigas usam `-` no lugar de `_` após a data.
- **Janela temporal**: `20250405` → `20260830`.
- **Idempotência**: uso extensivo de `IF NOT EXISTS`, `DROP POLICY IF EXISTS`, `CREATE OR REPLACE`, `DO $$ ... IF NOT EXISTS (SELECT 1 FROM pg_policies ...) $$`.
- **Sem rollback**: **nenhuma migration contém seção de `down`/rollback**.
- **Objetos fora das migrations**: buckets `ct-checklists`, `chamados-internos-anexos`, `pops-documentos`, `atestados-medicos` e os jobs `pg_cron` **não têm `CREATE` versionado** — foram criados via dashboard/Lovable.

**`[VERIFICAR NO BANCO]`** — reconciliar migrations aplicadas × arquivos:
```sql
select version, name from supabase_migrations.schema_migrations order by version desc limit 20;
select count(*) from supabase_migrations.schema_migrations;
```

---

## 12. Consulta mestra de inventário (read-only) para validar este documento

```sql
-- Contagens gerais
select
  (select count(*) from information_schema.tables  where table_schema='public' and table_type='BASE TABLE') as tabelas,
  (select count(*) from information_schema.views   where table_schema='public')                              as views,
  (select count(*) from pg_matviews where schemaname='public')                                               as matviews,
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public')       as funcoes,
  (select count(*) from pg_trigger where not tgisinternal)                                                   as triggers,
  (select count(*) from pg_policies where schemaname='public')                                               as policies,
  (select count(*) from pg_indexes where schemaname='public')                                                as indices,
  (select count(*) from storage.buckets)                                                                     as buckets;
```
