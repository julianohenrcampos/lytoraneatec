# SEC-24 — SNAPSHOT DE ACL **ANTES** DA MIGRATION

> Capturado em **2026-08-31**, leitura pura de `pg_proc` / `has_function_privilege`.
> Projeto: `eexzgpmrousuxlkvqwkm`. **Nenhuma alteração foi feita no banco neste passo.**
>
> Escopo: **24 funções**. `update_configuracao_sistema(text,text)` foi **REMOVIDA do escopo**
> por decisão explícita — classificada FALSO POSITIVO (possui gate interno
> `fn_ponto_is_superadmin()`), sua ACL **não será tocada**.

---

## Consulta utilizada (read-only)

```sql
select p.oid::regprocedure::text as assinatura,
       pg_get_userbyid(p.proowner) as owner,
       coalesce(p.proacl::text,'(NULL)') as proacl,
       (coalesce(p.proacl::text,'') like '{=X/%') as public_execute,
       has_function_privilege('anon', p.oid, 'EXECUTE')          as anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE')  as service_role_execute
from pg_proc p
where p.pronamespace='public'::regnamespace and p.prokind='f' and p.proname in (
 'update_profile_funcionario_id','liberar_proxima_etapa_dinamica','merge_duplicate_funcionarios',
 'sync_presencas_valores_funcao','sync_convocados_pre_valores','fn_arquivar_auditoria_log',
 'fn_backend_audit_event','fn_ct_registrar_assinatura','fn_registrar_nonce_atestado',
 'fn_rate_limit_check','garantir_registro_aplicacao_principal','sync_profile_funcao_sistema',
 'fn_ponto_diaria_simular_batida','check_vistorias_sso_pendentes','gerenciar_convocado_diaria',
 'gerenciar_convocado_diaria_no_dia','rbac_auto_migrate_user','finalizar_carga_manual',
 'finalizar_carga_aplicacao','sincronizar_hora_saida_aplicacao','fn_calcular_nota_checklist',
 'fn_relatorio_aps_definir_carimbo_padrao','fn_relatorio_aps_desvincular_padrao',
 'fn_relatorio_aps_inativar_carimbo')
order by 1;
```

---

## Estado ANTES — 24 funções

Owner de **todas**: `postgres` (`rolbypassrls = true`).

| # | Assinatura | Modelo | PUBLIC | anon | authenticated | service_role |
|---:|---|:--:|:--:|:--:|:--:|:--:|
| 1 | `check_vistorias_sso_pendentes()` | A | ✔ | ✔ | ✔ | ✔ |
| 2 | `finalizar_carga_aplicacao(uuid)` | B | ✔ | ✔ | ✔ | ✔ |
| 3 | `finalizar_carga_manual(uuid)` | B | ✔ | ✔ | ✔ | ✔ |
| 4 | `fn_arquivar_auditoria_log(integer)` | A | ✘ | ✔ | ✔ | ✔ |
| 5 | `fn_backend_audit_event(uuid,text,text,text,text,text,text,text,text,boolean,boolean,integer,inet,text,jsonb,jsonb,text)` | A | ✔ | ✔ | ✔ | ✔ |
| 6 | `fn_calcular_nota_checklist(uuid)` | B | ✔ | ✔ | ✔ | ✔ |
| 7 | `fn_ct_registrar_assinatura(uuid,uuid,text)` | A | ✘ | ✔ | ✔ | ✔ |
| 8 | `fn_ponto_diaria_simular_batida(uuid)` | A | ✘ | ✔ | ✔ | ✔ |
| 9 | `fn_rate_limit_check(text,text,text,integer,integer,integer)` | A | ✘ | ✔ | ✔ | ✔ |
| 10 | `fn_registrar_nonce_atestado(uuid,uuid,inet)` | A | ✘ | ✔ | ✔ | ✔ |
| 11 | `fn_relatorio_aps_definir_carimbo_padrao(uuid,uuid)` | B | ✘ | ✔ | ✔ | ✔ |
| 12 | `fn_relatorio_aps_desvincular_padrao(uuid)` | B | ✘ | ✔ | ✔ | ✔ |
| 13 | `fn_relatorio_aps_inativar_carimbo(uuid,timestamp with time zone)` | B | ✘ | ✔ | ✔ | ✔ |
| 14 | `garantir_registro_aplicacao_principal(uuid,uuid,date,time without time zone,uuid)` | A | ✔ | ✔ | ✔ | ✔ |
| 15 | `gerenciar_convocado_diaria(uuid,jsonb,text)` | B | ✔ | ✔ | ✔ | ✔ |
| 16 | `gerenciar_convocado_diaria_no_dia(uuid,jsonb,date,text)` | B | ✔ | ✔ | ✔ | ✔ |
| 17 | `liberar_proxima_etapa_dinamica(uuid)` | A | ✔ | ✔ | ✔ | ✔ |
| 18 | `merge_duplicate_funcionarios()` | A | ✔ | ✔ | ✔ | ✔ |
| 19 | `rbac_auto_migrate_user(uuid)` | B | ✔ | ✔ | ✔ | ✔ |
| 20 | `sincronizar_hora_saida_aplicacao(uuid)` | B | ✔ | ✔ | ✔ | ✔ |
| 21 | `sync_convocados_pre_valores()` | A | ✔ | ✔ | ✔ | ✔ |
| 22 | `sync_presencas_valores_funcao()` | A | ✔ | ✔ | ✔ | ✔ |
| 23 | `sync_profile_funcao_sistema(uuid)` | A | ✔ | ✔ | ✔ | ✔ |
| 24 | `update_profile_funcionario_id(uuid,uuid)` | A | ✔ | ✔ | ✔ | ✔ |

**Resumo do estado ANTES:** 24/24 com `anon` = ✔ · 24/24 com `authenticated` = ✔ · **16/24 com `PUBLIC` = ✔**.

---

## `proacl` bruto (fonte para o rollback)

### Padrão A — 16 funções (PUBLIC + anon + authenticated + service_role)
`{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}`

`check_vistorias_sso_pendentes()` · `finalizar_carga_aplicacao(uuid)` · `finalizar_carga_manual(uuid)` · `fn_backend_audit_event(…17…)` · `fn_calcular_nota_checklist(uuid)` · `garantir_registro_aplicacao_principal(…)` · `gerenciar_convocado_diaria(uuid,jsonb,text)` · `gerenciar_convocado_diaria_no_dia(uuid,jsonb,date,text)` · `liberar_proxima_etapa_dinamica(uuid)` · `merge_duplicate_funcionarios()` · `rbac_auto_migrate_user(uuid)` · `sincronizar_hora_saida_aplicacao(uuid)` · `sync_convocados_pre_valores()` · `sync_presencas_valores_funcao()` · `sync_profile_funcao_sistema(uuid)` · `update_profile_funcionario_id(uuid,uuid)`

### Padrão B — 8 funções (anon + authenticated + service_role, SEM PUBLIC)
`{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}`

`fn_arquivar_auditoria_log(integer)` · `fn_ct_registrar_assinatura(uuid,uuid,text)` · `fn_ponto_diaria_simular_batida(uuid)` · `fn_rate_limit_check(text,text,text,integer,integer,integer)` · `fn_registrar_nonce_atestado(uuid,uuid,inet)` · `fn_relatorio_aps_definir_carimbo_padrao(uuid,uuid)` · `fn_relatorio_aps_desvincular_padrao(uuid)` · `fn_relatorio_aps_inativar_carimbo(uuid,timestamp with time zone)`

---

## PASSO 3 — Confirmação de chamadoras SQL internas (gate de parada)

Verificação obrigatória: se alguma função MODELO A fosse chamada por uma função
**`SECURITY INVOKER`** executada diretamente por `authenticated`, revogar o `EXECUTE`
quebraria o fluxo (a checagem ocorreria contra `authenticated`, não contra o owner).

| Função interna (MODELO A) | Owner interna | Chamadora | Chamadora `prosecdef` | Owner chamadora |
|---|---|---|:--:|---|
| `update_profile_funcionario_id` | postgres | `link_profile_from_funcionario_email` | **true** | postgres |
| `update_profile_funcionario_id` | postgres | `link_profile_to_funcionario_by_email` | **true** | postgres |
| `liberar_proxima_etapa_dinamica` | postgres | `aprovar_etapa_dinamica` | **true** | postgres |
| `fn_ct_registrar_assinatura` | postgres | `fn_ct_checklist_saida_salvar` | **true** | postgres |
| `garantir_registro_aplicacao_principal` | postgres | `criar_aplicacao_por_rua` | **true** | postgres |
| `sync_profile_funcao_sistema` | postgres | `trg_sync_funcao_sistema_profiles` | **true** | postgres |
| `sync_profile_funcao_sistema` | postgres | `trg_sync_funcao_sistema_bd_equipes` | **true** | postgres |
| `fn_ponto_diaria_simular_batida` | postgres | `fn_ponto_diaria_simular_lote` | **true** | postgres |

### Varredura exaustiva por chamadoras `SECURITY INVOKER`

```sql
-- retorna as chamadoras SECURITY INVOKER de qualquer função MODELO A
... where d.prosecdef = false
```
**Resultado: 0 linhas.**

✅ **GATE LIBERADO.** Nenhuma função MODELO A é chamada por função `SECURITY INVOKER`.
Todas as chamadoras são `SECURITY DEFINER` com owner `postgres` — o mesmo owner das
funções internas. A checagem de `EXECUTE` interno ocorre contra `postgres`, que sempre
possui o privilégio por ser o owner. **A revogação não quebra a cadeia SQL.**

---

## Rollback

`docs/claude-onboarding/hotfix/ROLLBACK-01-SEC24.sql` reconstrói exatamente os dois
padrões acima. **Atenção:** o arquivo de rollback foi escrito para 25 funções e inclui
`update_configuracao_sistema` — como esta **não** será alterada, aquela linha do rollback
é inócua (re-concede o que já existe), mas deve ser removida antes de um uso eventual
para manter fidelidade ao princípio de escopo mínimo.
