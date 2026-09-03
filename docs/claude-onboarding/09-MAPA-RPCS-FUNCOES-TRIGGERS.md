# 09 — MAPA DE RPCs, FUNÇÕES E TRIGGERS

> Auditoria READ-ONLY, estática (869 migrations + `types.ts`).

---

## 1. Números

| Elemento | Valor |
|---|---:|
| Funções expostas ao PostgREST (RPC) — `types.ts` | **452** |
| Definições `CREATE FUNCTION` distintas nas migrations | **593** |
| Destas, `SECURITY DEFINER` (última definição) | **499** (84%) |
| `SECURITY DEFINER` **sem** `SET search_path` | **15** |
| Triggers vivos (após replay `CREATE`/`DROP`) | **219** |
| Tabelas com trigger | **106** de 194 |

> A diferença 593 → 452 são funções internas (helpers de policy/trigger) não expostas como RPC, o que é o comportamento desejado.

---

## 2. `SECURITY DEFINER` — postura de segurança

**499 de 593 funções são `SECURITY DEFINER`.** Isso é coerente com a arquitetura: as funções precisam ler tabelas que o usuário chamador não enxerga por RLS (ex.: `bd_user_roles`, `bd_centros_custo`) para decidir a autorização. É o padrão recomendado pelo Supabase para evitar recursão de RLS.

**484 delas declaram `SET search_path`** — postura correta contra *search_path hijacking*.

### 2.1 As 15 sem `search_path` seguro

Todas são de **2025** (fase inicial do projeto) e nenhuma é do núcleo de RBAC atual:

| Função | Migration de origem | Risco |
|---|---|---|
| `delete_funcionario_with_admin_bypass` | `20250717181705` | 🔴 nome indica bypass administrativo de exclusão |
| `consolidar_funcionarios_duplicados` | `20250807175348` | 🔴 mutação em massa de funcionários |
| `can_delete_funcionario` | `20250717181705` | 🟠 predicado de exclusão |
| `user_has_permission_hybrid` | `20250716131917` | 🟠 predicado de permissão |
| `get_user_permissions_hybrid` | `20250716131917` | 🟠 |
| `get_user_permissions` | `20250716122628` | 🟠 |
| `get_current_user_role` | `20250722000000` | 🟠 |
| `get_user_allowed_teams`, `get_user_teams` | `20250701181802`, `20250717174853` | 🟡 |
| `atualizar_status_equipamentos_nao_apontados` | `20250625004043` | 🟡 job de status |
| `check_email_duplicate_normalized` | `20250912145157` | 🟡 |
| `listar_ghost_funcionarios` | `20250912145352` | 🟡 |
| `debug_user_access`, `debug_user_access_detailed`, `debug_user_authentication` | 2025 | ⚪ debug |

**`[VERIFICAR NO BANCO]`** — confirmar quais dessas ainda existem e se são chamáveis:
```sql
select p.proname,
       p.prosecdef                                as security_definer,
       coalesce(array_to_string(p.proconfig,','), '(sem SET)') as config,
       pg_get_function_identity_arguments(p.oid)  as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
  and (p.proconfig is null or not exists (
        select 1 from unnest(p.proconfig) c where c like 'search_path=%'))
order by 1;

-- Quem pode executar? (privilégio EXECUTE concedido a PUBLIC/anon/authenticated)
select p.proname, r.rolname as grantee
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
join pg_roles r on r.oid = a.grantee
where n.nspname='public' and a.privilege_type='EXECUTE'
  and p.proname in ('delete_funcionario_with_admin_bypass','consolidar_funcionarios_duplicados',
                    'can_delete_funcionario','get_user_permissions','get_current_user_role')
order by 1,2;
```

Várias migrations recentes fazem `REVOKE ALL ON FUNCTION ... FROM PUBLIC` (visto após `fn_has_action`) — boa prática já adotada em parte do código.

---

## 3. Famílias de funções

### 3.1 Predicados de autorização (o núcleo)

| Família | Qtd | Exemplos |
|---|---:|---|
| SuperAdmin | 9 | `is_super_admin` (estrita), `fn_is_super_admin` (ampla), `check_is_super_admin`, `check_is_super_admin_hybrid`, `check_is_super_admin_new`, `is_departmental_super_admin`, `is_ponto_superadmin`, `fn_ponto_is_superadmin`, `is_superadm_or_rh` |
| Permissão | 8 | `fn_has_permission`, `fn_has_action`, `fn_has_role`, `has_permission`, `has_role`, `user_has_permission`, `user_has_permission_action`, `fn_permission_aliases` |
| Ativos | 10 | `fn_ativos_can_access_{centro_custo,equipamento,solicitacao}`, `fn_ativos_has_{financial,logistics,operational,precise_location}_access`, `fn_ativos_user_centros_custo(_responsavel)`, `fn_ativos_profile_funcionario_id` |
| Logística | 9 | `fn_logistica_can_access_{apontamento_cam,centro_custo,entrega,programacao,requisicao}`, `fn_logistica_can_manage_entrega`, `fn_logistica_can_view_sensitive_exports`, `fn_logistica_current_funcionario_id`, `fn_logistica_is_privileged_user` |
| Diárias | 11 | `fn_diaria_can_{select,update,manage}_row`, `fn_diaria_can_create`, `fn_diaria_scope_centros_custo`, `fn_diaria_has_global_access`, `fn_can_access_diarias_{operacional,gerencial,financeiro}`, `fn_user_can_access_diaria_{financial,solicitacao}` |
| Ordens de Serviço | 10 | `fn_os_can_access_{chamado,ordem}`, `fn_os_can_manage_{chamado,ordem}`, `fn_os_has_{financial,maintenance,operational}_access`, `fn_os_is_admin_user`, `fn_os_current_funcionario_id`, `fn_os_storage_object_allowed` |
| Ponto | 12 | `fn_ponto_can_access_batida`, `fn_ponto_can_manage_{config,devices,vinculos}`, `fn_ponto_can_view_{gestao,rh,antifraude_logs}`, `fn_ponto_user_can_access_{cc,funcionario}`, `fn_ponto_has_permission`, `fn_ponto_get_funcionario_id`, `has_ponto_permission` |
| Chamados Internos | 8 | `fn_chamado_interno_can_{read,attend,operate,open_cc}`, `fn_chamado_interno_pode_resolver_operacional`, `fn_chamado_interno_dash_pode_ver` |
| SSO | 6 | `has_sso_permission`, `has_sso_full_access`, `check_is_admsso`, `get_sso_admin_users`, `fn_desvio_can_select_row`, `fn_pode_ver_agendamento_exame_por_cc` |
| PNCP | 6 | `fn_pncp_can_{view,manage,manage_orgaos,view_strategic}`, `fn_pncp_can_access_sync_log_row`, `has_pncp_access` |
| Storage | 6 | `fn_storage_can_access`, `fn_storage_can_upload`, `fn_storage_audit_access`, `fn_storage_entity_{id,type}`, `fn_storage_extract_uuid` |
| BI | 2 | `fn_bi_can_view_dashboard`, `fn_bi_can_export` |
| Funcionários | 4 | `fn_funcionarios_can_select_row`, `fn_can_access_funcionario_{operacional,sensitive}`, `fn_get_funcionario_sensitive` |
| Backend/Edge | 2 | `fn_backend_can_invoke`, `fn_backend_audit_event` |

### 3.2 Funções de negócio (cálculo)
`calcular_valor_diaria`, `fn_calcular_diaria_aplicada`, `fn_resolver_base_diaria`, `calcular_massa_remanescente` / `_aplicacao` / `_em_tempo_real`, `calcular_espessura_aplicacao`, `converter_kg_para_toneladas`, `calcular_distancia_haversine`, `fn_calcular_nota_checklist`, `fn_ct_distancia_operacional` / `_regra`, `fn_recalcula_total_os`, `fn_calc_valor_total_item`.

### 3.3 Funções de máquina de estado
`fn_ct_mobilizacao_{programar,cancelar,estado,nova_revisao,salvar_rascunho}`, `fn_ct_viagem_{iniciar,registrar_chegada}`, `fn_ct_puxada_{programar,cancelar,estado,salvar_rascunho}`, `fn_ct_mov_direta_{programar,cancelar,estado,listar,salvar_rascunho}`, `fn_ct_estado_efetivo_lote`, `fn_emitir_ordem_diaria` / `fn_cancelar_ordem_diaria`, `fn_pop_{criar,publicar_rascunho,iniciar_revisao,tornar_obsoleto,reativar,excluir}`, `fn_solic_equip_{criar,decidir,decidir_corporativa,pos_decisao}`, `fn_desmobilizacao_{solicitar,decidir,concluir,cancelar}`, `fn_transferencia_{emitir,decidir,resolver_aprovador}`.

### 3.4 Funções de manutenção de dados (⚠️ destrutivas)
| Função | Efeito |
|---|---|
| `merge_duplicate_funcionarios` | Mescla funcionários duplicados |
| `merge_duplicate_funcionarios_by_email_normalized` | idem, por e-mail normalizado |
| `merge_duplicate_funcionarios_normalized` | idem, por texto normalizado |
| `consolidar_funcionarios_duplicados` | **sem `search_path` seguro** |
| `delete_funcionario_with_admin_bypass` | **sem `search_path` seguro**; nome indica bypass |
| `fn_aplicar_saneamento_auto` / `fn_reverter_saneamento_auto` | Saneamento automático (Qualidade Cadastral) |
| `relatorio_correcao_status_massa` | Correção em massa de status |
| `force_update_all_delivery_statuses` | Atualiza **todas** as entregas |
| `sync_convocados_pre_valores`, `sync_presencas_valores_funcao` | Sincronização em massa (Diárias) |
| `fn_arquivar_auditoria_log` | Move auditoria para archive |
| `fn_backfill_lotes_dry_run` | Dry-run (seguro) |

> **Estas funções nunca devem ser executadas sem autorização explícita.** Ver `19-PONTOS-QUE-NAO-DEVEM-SER-ALTERADOS-SEM-AUTORIZACAO.md`.

---

## 4. Triggers (219 vivos, 106 tabelas)

### 4.1 Funções de trigger mais reutilizadas

| Usos | Função | Papel |
|---:|---|---|
| **56** | `update_updated_at_column` | `updated_at = now()` — padrão do projeto |
| 10 | `fn_auditar_logistica_mutacao` | auditoria → `bd_logistica_auditoria` |
| 7 | `fn_ativos_auditar_mutacao` | auditoria → `bd_ativos_auditoria` |
| 7 | `fn_auditar_os_mutacao` | auditoria → `bd_os_auditoria` |
| 6 | `fn_audit_permission_change` | auditoria → `bd_permission_change_audit_logs` |
| 5 | `fn_ponto_audit_trigger` | auditoria → `bd_ponto_audit_log` |
| 4 | `fn_calc_valor_total_item` | cálculo de total |
| 4 | `fn_recalcula_total_os_from_row` | recálculo de OS |
| 4 | `fn_proteger_geocoding_manual` | **impede sobrescrever geocoding ajustado à mão** |
| 4 | `fn_validar_geocoding_no_save` | validação de coordenadas |
| 4 | `_mark_mv_relatorio_diarias_dirty` | invalida a MV de Diárias |
| 4 | `fn_ct_touch_updated_at` | timestamp CT |
| 3 | `fn_ponto_registrar_auditoria_config` | |
| 3 | `fn_pop_bloquear_mutacao_destrutiva` | **guarda de integridade de POPs** |
| 3 | `atualizar_registro_principal_aplicacao` | |
| 2 | `fn_lock_itens_solicitacao_rh` | **congela itens após envio** |
| 2 | `fn_ordens_diarias_guard_emitida` | **impede alterar ordem já emitida** |
| 2 | `auto_set_created_by`, `fn_auditoria_log`, `calculate_tonelada_real`, `calculate_aplicacao_area`, `trigger_finalizar_hora_saida`, `trigger_atualizar_massa_remanescente_aplicacao_corrigido` | |

### 4.2 Tabelas com mais triggers

| Triggers | Tabela | Natureza |
|---:|---|---|
| 9 | `bd_registro_aplicacao_detalhes` | cálculos em cascata (massa, área, espessura) |
| 9 | `bd_funcionarios` | auditoria + geocoding + sincronização de profile |
| 8 | `bd_diaria_solicitacoes` | máquina de estado + invalidação de MV |
| 7 | `bd_os_materiais_utilizados`, `bd_os_mao_obra` | recálculo de custo de OS |
| 6 | `bd_diaria_presencas` | cálculo de valor + MV |
| 5 | `bd_registro_apontamento_cam_equipa`, `profiles`, `bd_registro_apontamento_aplicacao` | |
| 4 | `bd_caminhoes_equipamentos`, `bd_registro_cargas`, `bd_centros_custo`, `bd_ordens_servico`, `bd_ponto_dispositivos` | |
| 3 | `bd_user_permission_overrides` | auditoria de RBAC |

### 4.3 Triggers de guarda (bloqueiam operações)

São **regras de negócio implementadas no banco**. Alterá-las quebra invariantes:

- `fn_ordens_diarias_guard_emitida` — impede alteração de Ordem do Dia já emitida
- `fn_pop_bloquear_mutacao_destrutiva` — impede mutação destrutiva de POP publicado
- `fn_lock_itens_solicitacao_rh` — congela itens de solicitação de RH após envio
- `fn_proteger_geocoding_manual` — impede que geocoding automático sobrescreva ajuste manual
- `fn_validar_geocoding_no_save` — rejeita coordenadas inválidas

> ⚠️ **"Nunca remover trigger apenas porque está bloqueando operação"** — estes são exatamente os triggers que um desenvolvedor apressado removeria.

---

## 5. Superfície de RPC consumida pelo frontend

| Métrica | Valor |
|---|---:|
| Chamadas `.rpc(` em `src/` | **217** |
| Chamadas `supabase.from(` em `src/` | **180** |

O frontend usa **mais RPC do que acesso direto a tabela** — arquitetura deliberada de "banco como camada de serviço". Isso significa que **a maior parte da lógica de negócio do ERP está em PL/pgSQL, não em TypeScript**.

**Consequência prática para o desenvolvimento futuro:** corrigir um comportamento de negócio quase sempre significa alterar uma função PostgreSQL, não um componente React. Isso exige o protocolo de banco descrito em `18-REGRAS-PARA-DESENVOLVIMENTO-FUTURO.md`.

---

## 6. Verificações no banco

```sql
-- Inventário de funções
select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef as secdef,
       l.lanname   as linguagem,
       coalesce(array_to_string(p.proconfig,','),'') as config
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
join pg_language l on l.oid=p.prolang
where n.nspname='public'
order by 1;

-- Inventário de triggers
select c.relname as tabela, t.tgname as trigger,
       p.proname as funcao,
       pg_get_triggerdef(t.oid) as definicao
from pg_trigger t
join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace
join pg_proc p on p.oid=t.tgfoid
where not t.tgisinternal and n.nspname='public'
order by 1,2;

-- Funções com SQL dinâmico (EXECUTE format)
select p.proname
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and pg_get_functiondef(p.oid) ~* 'EXECUTE\s+(format|''|")'
order by 1;
```
