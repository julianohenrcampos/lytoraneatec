# 22 — PLANO EXECUTÁVEL DE CONTENÇÃO DE SEGURANÇA (FASE 0.2)

> **Nada foi executado.** Nenhuma migration aplicada, nenhuma função alterada, nenhuma Edge Function deployada, nenhuma RPC invocada, nenhum pentest.
> Todos os dados vêm de leitura de catálogo (`pg_proc`, `pg_class`, `pg_policy`, `cron.job`, `extensions.pg_stat_statements`) e de leitura de código.
>
> Escopo: **P0 = SEC-24 · P1 = SEC-02 · P1 = SEC-03 · P2 = SEC-05 (matriz apenas)**.
> Fora de escopo nesta fase: SEC-10, hardening de Auth, órfãos, RBAC legado, higiene técnica.

---

## 0. Correção conceitual — quando `SECURITY DEFINER` realmente contorna RLS

A afirmação genérica *"SECURITY DEFINER ignora RLS"* é falsa. O que determina o resultado é a combinação abaixo, verificada neste banco:

| Fator | Valor real em `eexzgpmrousuxlkvqwkm` | Efeito |
|---|---|---|
| Owner das funções | **`postgres`** (100% das 483 funções `SECURITY DEFINER`) | — |
| `rolsuper` do owner | `false` | não é superusuário |
| **`rolbypassrls` do owner** | **`true`** | **contorna RLS em todas as tabelas** |
| `FORCE ROW LEVEL SECURITY` na tabela alvo | 26 tabelas têm | **irrelevante**: `BYPASSRLS` prevalece sobre `FORCE RLS` |
| `SET row_security` nas funções | não usado | — |
| `SECURITY DEFINER` | sim | executa com privilégios do owner |

**Conclusão para este projeto específico:** como o owner é `postgres` **com `BYPASSRLS`**, uma função `SECURITY DEFINER` mutante **de fato ignora RLS**, inclusive nas tabelas com `FORCE RLS` (`bd_diaria_solicitacoes`, `bd_apontamento_equipe`, `bd_registro_apontamento_aplicacao`, `bd_lista_programacao_entrega`, `bd_registro_apontamento_cam_equipa`). A severidade do SEC-24 se sustenta — mas agora por evidência, não por generalização.

### `EXECUTE` direto para `anon` × herdado de `PUBLIC`

Distinção obrigatória, com consequência prática direta no patch:

| Padrão de `proacl` | Significado | `REVOKE ... FROM anon` resolve? |
|---|---|---|
| `{=X/postgres, postgres=X/…, anon=X/…, …}` | O `=X/postgres` inicial é **`PUBLIC` com EXECUTE** | ❌ **NÃO** — `anon` continua herdando de `PUBLIC` |
| `{postgres=X/…, anon=X/…, …}` | Sem entrada `PUBLIC` | ✔ sim |

**Distribuição medida (483 funções `SECURITY DEFINER`):**

| Situação | Qtd |
|---|---:|
| Com `EXECUTE` para **`PUBLIC`** | **272** |
| Com `EXECUTE` **direto** para `anon`, sem `PUBLIC` | 93 |
| Com `proacl` NULL (default = `PUBLIC`) | 0 |
| **Mutantes (VOLATILE) com `PUBLIC`** | **127** |
| `EXECUTE` efetivo para `anon` (qualquer via) | **358** |

Por isso **todo bloco do HOTFIX-01 revoga de `PUBLIC` e de `anon`**, nessa ordem.

---

## 1. PASSO 1+2 — Matriz exata das candidatas SEC-24

25 funções: `SECURITY DEFINER` · owner `postgres` (BYPASSRLS) · `VOLATILE` · escrevem dados · expostas como RPC (retorno ≠ `trigger`) · `EXECUTE` efetivo para `anon`.

Colunas comuns a todas as 25 (não repetidas por linha): **schema** = `public` · **owner** = `postgres` · **security_definer** = `true` · **volatility** = `VOLATILE` · **search_path** = `search_path=public` (todas corretas) · **EXECUTE direto authenticated** = sim · **EXECUTE direto service_role** = sim · **has_function_privilege(anon)** = `true` · **has_function_privilege(authenticated)** = `true`.

### 1.1 Bloco CRÍTICO

| # | Assinatura (`regprocedure`) | PUBLIC EXECUTE | Tabelas modificadas | FORCE RLS alvo | auth.uid() | JWT | perm helper | superadmin | HMAC | Caller frontend | Caller Edge | Caller SQL | Trigger | Acesso anônimo legítimo? | Consequência de abuso | Classificação |
|---|---|:--:|---|:--:|:--:|:--:|:--:|:--:|:--:|---|---|---|:--:|:--:|---|---|
| 1 | `update_profile_funcionario_id(uuid,uuid)` | **SIM** | `profiles` | não | ❌ | ❌ | ❌ | ❌ | ❌ | **nenhum** | nenhuma | `link_profile_from_funcionario_email`, `link_profile_to_funcionario_by_email` | não | **NÃO** | Revincula qualquer usuário a qualquer funcionário ⇒ altera escopo operacional resolvido por `fn_*_current_funcionario_id`, `fn_ativos_profile_funcionario_id`, `get_user_funcionario_id`. Manipulação de identidade. | **CRÍTICO** |
| 2 | `liberar_proxima_etapa_dinamica(uuid)` | **SIM** | `bd_aprovacoes_fluxo_exec`, `bd_diaria_solicitacoes` | **SIM** (`bd_diaria_solicitacoes`) | ❌ | ❌ | ❌ | ❌ | ❌ | **nenhum** | nenhuma | `aprovar_etapa_dinamica` | não | **NÃO** | Avança etapa do fluxo e grava `status_fluxo`/`etapa_atual`, podendo levar a `finalizado`. **Impacto financeiro** (aprovação de diárias sem aprovador). | **CRÍTICO** |
| 3 | `merge_duplicate_funcionarios()` | **SIM** | `bd_funcionarios`, `profiles`, `bd_equipes`, `bd_apontamento_equipe`, `bd_avaliacao_equipe`, `bd_lista_programacao_entrega`, `bd_registro_apontamento_cam_equipa` | **SIM** (3 das 7) | ❌ | ❌ | ❌ | ❌ | ❌ | **nenhum** | nenhuma | **nenhum** | não | **NÃO** | Mescla registros em 7 tabelas, sem argumentos ⇒ chamada anônima trivial. **Destrutiva e irreversível** sobre 2.398 funcionários. | **CRÍTICO** |

### 1.2 Bloco ALTO

| # | Assinatura | PUBLIC | Tabelas modificadas | FORCE RLS | guards | Caller frontend | Caller Edge | Caller SQL | Anônimo legítimo? | Consequência | Classe |
|---|---|:--:|---|:--:|:--:|---|---|---|:--:|---|---|
| 4 | `sync_presencas_valores_funcao()` | SIM | `bd_diaria_presencas` | não | nenhum | nenhum | nenhuma | nenhum | NÃO | Recalcula **em massa** valores de presença de diária. Financeiro. | **ALTO** |
| 5 | `sync_convocados_pre_valores()` | SIM | `bd_diaria_solicitacoes` | **SIM** | nenhum | nenhum | nenhuma | nenhum | NÃO | Sincroniza valores de convocados em massa. Financeiro. | **ALTO** |
| 6 | `fn_arquivar_auditoria_log(integer)` | não | `bd_auditoria_log`, `bd_auditoria_log_archive` | não | nenhum | nenhum | nenhuma | nenhum | NÃO | Move auditoria para archive. Chamada repetida esvazia a trilha ativa. **Integridade de auditoria.** | **ALTO** |
| 7 | `fn_backend_audit_event(17 params)` | SIM | `bd_backend_exec_auditoria` | não | nenhum | nenhum | `_shared/backend-security.ts` (service_role) | nenhum | NÃO | **Injeta registros arbitrários de auditoria de backend** — inclusive `permitido=true`, `actor_user_id` e `origem_ip` forjados. Contamina a evidência forense. | **ALTO** |
| 8 | `fn_ct_registrar_assinatura(uuid,uuid,text)` | não | `bd_assinaturas` | não | `digest`/`encode` presentes, mas **`p_user` vem por parâmetro** | nenhum | nenhuma | `fn_ct_checklist_saida_salvar` | NÃO | Registra assinatura **em nome de qualquer usuário** (`p_user` não é derivado de `auth.uid()`). Não repúdio comprometido. | **ALTO** |
| 9 | `fn_registrar_nonce_atestado(uuid,uuid,inet)` | não | `bd_atestados_nonces_utilizados` | não | nenhum | nenhum | **`atestado-submeter` (service_role)** | nenhum | **NÃO** (ver §5) | Queima nonces ⇒ **DoS do fluxo público de atestados** (647 objetos, 2.040 funcionários). | **ALTO** |
| 10 | `fn_rate_limit_check(text,text,text,int,int,int)` | não | `bd_rate_limit_tentativas` | não | nenhum | nenhum | **`atestado-validar-matricula` (service_role)** | nenhum | NÃO | Manipula contadores ⇒ **anula o rate limit** do único fluxo que o usa hoje (422 registros, 100% escopo `atestado_validar`). | **ALTO** |
| 11 | `rbac_auto_migrate_user(uuid)` | SIM | `bd_user_roles`, `bd_roles`, `bd_permissions`, `bd_role_permissions` | não | nenhum | `src/services/accessControl/autoMigrationService.ts` | nenhuma | nenhum | NÃO | Escreve nas **4 tabelas centrais do RBAC novo** para um `p_user_id` arbitrário. | **ALTO** |

### 1.3 Bloco MÉDIO

| # | Assinatura | PUBLIC | Tabelas modificadas | Caller frontend | Caller SQL / trigger | Consequência | Classe |
|---|---|:--:|---|---|---|---|---|
| 12 | `gerenciar_convocado_diaria(uuid,jsonb,text)` | SIM | `bd_diaria_presencas`, `bd_diaria_solicitacoes` (**FORCE RLS**) | `src/services/diarias/solicitacoesService.ts` | nenhum | Adiciona/remove convocado de diária | **MÉDIO** |
| 13 | `gerenciar_convocado_diaria_no_dia(uuid,jsonb,date,text)` | SIM | `bd_diaria_solicitacoes` (**FORCE RLS**) | `src/services/diarias/solicitacoesService.ts` | nenhum | idem, por dia | **MÉDIO** |
| 14 | `finalizar_carga_manual(uuid)` | SIM | `bd_registro_apontamento_aplicacao` (**FORCE RLS**) | `manualFinalizationService.ts` | nenhum | Finaliza carga fora do fluxo | **MÉDIO** |
| 15 | `finalizar_carga_aplicacao(uuid)` | SIM | `bd_registro_apontamento_aplicacao` (**FORCE RLS**) | `useAplicacoesMultiplas.ts`, `registroAplicacaoDetalhesService.ts` | `trigger_atualizar_massa_remanescente_aplicacao(_corrigido)` | idem | **MÉDIO** |
| 16 | `sincronizar_hora_saida_aplicacao(uuid)` | SIM | `bd_registro_apontamento_aplicacao` (**FORCE RLS**) | `useNovoRegistroForm.ts` | `criar_aplicacao_por_rua`, `trigger_sincronizar_hora_saida` | Altera hora de saída | **MÉDIO** |
| 17 | `garantir_registro_aplicacao_principal(uuid,uuid,date,time,uuid)` | SIM | `bd_registro_apontamento_aplicacao` (**FORCE RLS**) | nenhum | `criar_aplicacao_por_rua` | Cria registro principal com `p_created_by` arbitrário | **MÉDIO** |
| 18 | `fn_calcular_nota_checklist(uuid)` | SIM | `bd_sso_checklists` | `src/services/sso/ssoChecklistService.ts` | `trg_recalcular_nota_checklist` | Recalcula nota de checklist NR-18 | **MÉDIO** |
| 19 | `fn_relatorio_aps_definir_carimbo_padrao(uuid,uuid)` | não | `bd_relatorio_aps_carimbos` | `relatorioApsCarimbosService.ts` | `fn_relatorio_aps_criar_carimbo` | Redefine carimbo padrão por CC | **MÉDIO** |
| 20 | `fn_relatorio_aps_desvincular_padrao(uuid)` | não | `bd_relatorio_aps_carimbos` | `relatorioApsCarimbosService.ts` | nenhum | Desvincula carimbo padrão | **MÉDIO** |
| 21 | `fn_relatorio_aps_inativar_carimbo(uuid,timestamptz)` | não | `bd_relatorio_aps_carimbos` | `relatorioApsCarimbosService.ts` | nenhum | Inativa carimbo | **MÉDIO** |
| 22 | `sync_profile_funcao_sistema(uuid)` | SIM | `profiles` | nenhum | `trg_sync_funcao_sistema_profiles`, `trg_sync_funcao_sistema_bd_equipes` | Recalcula `funcao_sistema` (**atributo de autoridade**, lido por `is_super_admin`) | **MÉDIO** |
| 23 | `fn_ponto_diaria_simular_batida(uuid)` | não | `bd_ponto_diaria_integracao` | nenhum | `fn_ponto_diaria_simular_lote` | Escreve no shadow de integração Ponto→Diárias | **MÉDIO** |
| 24 | `check_vistorias_sso_pendentes()` | SIM | `bd_notificacoes`, `bd_notificacoes_usuarios` | nenhum | nenhum | Gera notificações em massa (spam interno) | **MÉDIO** |

### 1.4 Falso positivo

| # | Assinatura | Por quê |
|---|---|---|
| 25 | `update_configuracao_sistema(text,text)` | **Possui gate interno**: `IF NOT public.fn_ponto_is_superadmin() THEN RAISE EXCEPTION`. A varredura automática não o detectou porque o helper se chama `fn_ponto_is_superadmin` e o padrão buscava `is_super_admin(`. **Classificação: FALSO POSITIVO** quanto à ausência de guarda. Mantido no HOTFIX-01 apenas por **defesa em profundidade** (não há razão para `anon` alcançar essa RPC). |

### 1.5 Placar

| Classificação | Qtd |
|---|---:|
| CRÍTICO | **3** |
| ALTO | **8** |
| MÉDIO | **13** |
| LEGÍTIMO (acesso anônimo necessário) | **0** |
| FALSO POSITIVO | **1** |
| **Total de candidatas** | **25** |

> As demais ~333 funções `SECURITY DEFINER` com `EXECUTE` para `anon` são majoritariamente **`STABLE` de leitura** (predicados como `fn_is_super_admin`, `fn_has_permission`), que retornam `false`/vazio para `auth.uid() IS NULL`. Ficam para fase posterior, fora do escopo P0.

---

## 2. PASSO 3 — Dependências mapeadas antes de qualquer REVOKE

| Tipo de caller | Funções | Revogar `anon`/`PUBLIC` quebra? |
|---|---|---|
| **Frontend autenticado** | 12, 13, 14, 15, 16, 18, 19, 20, 21, 11 | **Não** — mantêm `authenticated` (MODELO B) |
| **Frontend público (anônimo)** | **nenhuma** | — |
| **Edge Function (service_role)** | 7, 9, 10 | **Não** — `service_role` mantém o grant |
| **pg_cron** | 6 (`fn_arquivar_auditoria_log`, jobid=3) | **Não** — cron roda como `postgres` |
| **Trigger** | 15, 16, 18, 22 | **Não** — `EXECUTE` de trigger é checado em `CREATE TRIGGER`, não a cada disparo |
| **Outra função SQL** | 1, 2, 8, 17, 23 | **Não** — em contexto `SECURITY DEFINER` o chamador efetivo é `postgres` |
| **Manutenção administrativa** | 3, 4, 5, 24 | **Não** — sem caller automatizado |
| **Nenhum caller encontrado** | 3, 4, 5, 6, 24 | — |

### Fundamentação das três premissas que sustentam o "não quebra"
1. **Cadeia SQL**: função `SECURITY DEFINER` executa como owner; a verificação de `EXECUTE` da função interna é feita contra `postgres`, não contra `anon`/`authenticated`.
2. **Triggers**: PostgreSQL valida `EXECUTE` da função de trigger no `CREATE TRIGGER`; o disparo não revalida.
3. **`pg_cron`**: os 3 jobs vivos rodam com identidade `postgres`.

---

## 3. PASSO 4 — Plano de grants, função por função

| Modelo | Definição | Funções |
|---|---|---|
| **A — interna** | `REVOKE ALL FROM PUBLIC, anon, authenticated` + `GRANT EXECUTE TO service_role` | 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 17, 22, 23, 24 → **14 funções** |
| **B — autenticado** | `REVOKE ALL FROM PUBLIC, anon` + `GRANT EXECUTE TO authenticated, service_role` | 11, 12, 13, 14, 15, 16, 18, 19, 20, 21, 25 → **11 funções** |
| **C — público legítimo** | manter `anon` com proteção interna (HMAC/nonce/token/rate limit) | **0 funções** |

**Nenhuma função exige MODELO C.** O único fluxo público do sistema (atestados médicos) chama exclusivamente Edge Functions, que usam `service_role` — verificado em `src/services/atestadosService.ts` e em `atestado-submeter/index.ts:193`.

SQL completo: **`hotfix/HOTFIX-01-SEC24.sql`** · Rollback: **`hotfix/ROLLBACK-01-SEC24.sql`**.

### Por que o HOTFIX-01 é só de grants
Adicionar gate interno (`auth.uid()` + permissão) nas 11 funções do MODELO B **altera comportamento** e exige janela de validação com usuários reais. Foi separado em **HOTFIX-04** (§6), não incluído nesta entrega. O HOTFIX-01 fecha o vetor **anônimo** — que é o P0 — com risco operacional próximo de zero.

---

## 4. PASSO 5 — `update_profile_funcionario_id` (análise profunda)

```sql
CREATE OR REPLACE FUNCTION public.update_profile_funcionario_id(_profile_id uuid, _funcionario_id uuid)
 RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
  update public.profiles
     set funcionario_id = _funcionario_id, updated_at = now()
   where id = _profile_id
$function$
```

| Pergunta | Resposta verificada |
|---|---|
| Existe caller legítimo? | **Sim, apenas em SQL**: `link_profile_from_funcionario_email` e `link_profile_to_funcionario_by_email` |
| Caller no frontend? | **Não** (`grep` em `src/` = 0) |
| Caller em Edge Function? | **Não** |
| É usada como trigger? | **Não** |
| Chamada por cron? | **Não** |
| Quem deveria poder revincular profile↔funcionário? | Operação de RH. Já existe a permission key **`gestao_rh_funcionarios_edit`** ("Editar Funcionários") em `bd_permissions`, usada pelas policies `funcionarios_insert_restrito` / `funcionarios_update_restrito`. **Nenhuma permission key nova é necessária.** |
| SuperAdm? | Coberto: `fn_has_permission` retorna `true` para SuperAdm via `fn_is_super_admin` |
| AdmRH? | Coberto: as policies de `bd_funcionarios` já usam `fn_has_role('AdmRH')` |
| Processo automático? | Sim — os dois `link_profile_*`, que continuam funcionando (contexto definer) |

**Decisão: MODELO A.** Como não há caller humano direto, a forma mínima e segura é remover `PUBLIC`/`anon`/`authenticated` e manter `service_role`. Os wrappers `link_profile_*` seguem operando.

Se, em validação, aparecer necessidade de chamada por usuário autenticado, o gate proposto (HOTFIX-04) reutiliza o RBAC existente, **sem criar permission key**:

```sql
IF NOT (public.fn_is_super_admin(auth.uid())
        OR public.fn_has_role('AdmRH')
        OR public.fn_has_permission('gestao_rh_funcionarios_edit', auth.uid())) THEN
  RAISE EXCEPTION 'Sem permissão para vincular profile a funcionário';
END IF;
```

---

## 5. PASSO 6 — `liberar_proxima_etapa_dinamica`

| Pergunta | Resposta verificada |
|---|---|
| Callers | **Apenas** `aprovar_etapa_dinamica` (SQL). Nenhum no frontend, Edge, cron ou trigger. |
| O que faz | Seleciona a próxima etapa `pendente` em `bd_aprovacoes_fluxo_exec` (ordem ASC), marca `pode_aprovar = true`, resolve o `status_fluxo` via `bd_fluxo_etapas.status_fluxo_nome` ou `_map_tipo_aprovador_to_status`, e atualiza `bd_diaria_solicitacoes.status_fluxo` / `etapa_atual`. Se não houver etapa pendente, marca `status_fluxo = 'finalizado'`. |
| É um motor paralelo? | **Não.** É uma sub-rotina do motor dinâmico existente (`iniciar_fluxo_dinamico` → `aprovar_etapa_dinamica` → `liberar_proxima_etapa_dinamica`), governado pela flag runtime `fluxo_aprovacao_dinamico` em `bd_configuracoes_sistema`. |
| Quem legitimamente avança etapa? | Quem passa pelo gate de `aprovar_etapa_dinamica`. As permission keys já existem: `diarias_aprovar`, `diarias_aprovar_gerente_adm`, `diarias_aprovar_diretor_adm`, `diarias_aprovar_diretor_operacional`, `acesso_gestao_aprovacoes`, `central_aprovacoes_view`. |

**Decisão: MODELO A.** O gate correto pertence a `aprovar_etapa_dinamica` (a porta de entrada), não a esta sub-rotina. Restringir esta função a `service_role` **impede a execução direta sem autorização sem alterar o workflow**, que é exatamente o objetivo declarado.

> **Não é alterado**: ordem das etapas, mapeamento de status, regra de finalização, integração com a Central de Aprovações.

---

## 6. PASSO 7 — `fn_backend_audit_event`

| Pergunta | Resposta verificada |
|---|---|
| Permite escrita arbitrária de auditoria? | **Sim.** 17 parâmetros incluindo `p_actor_user_id`, `p_auth_email`, `p_permitido`, `p_sucesso`, `p_origem_ip`, `p_status_http` — todos fornecidos pelo chamador, nenhum derivado do servidor. |
| Callers legítimos | **Apenas** `supabase/functions/_shared/backend-security.ts:157` → `supabaseAdmin.rpc(...)`, onde `supabaseAdmin = createServiceClient()` (**service_role**). Usado por `delete-user`, `admin-confirm-email`, `auto-finalizar-diarias`, `process-desligamentos`, `ponto-diaria-shadow`, `sync-subcategorias-site`, `guardian-web-proxy`. |
| Algum usuário de frontend precisa chamar? | **Não.** Zero referências em `src/`. |

**Decisão: MODELO A — função interna.** Nenhum usuário de frontend deve conseguir escrever na auditoria de backend.
**O sistema de auditoria não é removido nem alterado** — apenas deixa de ser alcançável por `anon`/`authenticated`.

---

## 7. PASSO 8 — `fn_registrar_nonce_atestado` (fluxo público)

Instrução explícita: *"NÃO revogar anon automaticamente."* Mapeamento realizado antes de decidir:

```
Browser (rota pública /atestados-medicos, sem sessão)
   │  src/services/atestadosService.ts:91,105,168 → supabase.functions.invoke(...)
   ▼
Edge atestado-validar-matricula  (verify_jwt=false, HMAC)
   │   index.ts:57 → createClient(SUPABASE_URL, SERVICE_ROLE)
   │   index.ts:79,102 → supabase.rpc("fn_rate_limit_check", …)
   ▼
Edge atestado-criar-upload-url → signed upload URL
   ▼
Edge atestado-submeter  (verify_jwt=false, HMAC + nonce)
   │   index.ts:193 → createClient(SUPABASE_URL, SERVICE_ROLE)
   │   index.ts:315 → supabase.rpc("fn_registrar_nonce_atestado", …)
   ▼
bd_atestados_nonces_utilizados   (RLS on, 0 policies ⇒ só service_role)
```

| Pergunta | Resposta |
|---|---|
| O browser chama a RPC diretamente? | **Não.** `grep -rIn "\.rpc(" src/components/atestados src/pages/AtestadosMedicos.tsx` → **vazio**. O browser só invoca Edge Functions. |
| Somente a Edge Function deveria chamá-la? | **Sim**, e é o que já acontece. |
| A Edge usa qual client? | **`SERVICE_ROLE`** (verificado na linha 193). |

**Decisão: MODELO A é seguro.** Retirar `EXECUTE` de `anon`/`authenticated` e manter `service_role` **não quebra o fluxo público**, porque o público nunca chega à RPC — chega à Edge Function, que já se autentica por HMAC + nonce e opera com `service_role`.

O mesmo raciocínio e a mesma conclusão valem para **`fn_rate_limit_check`** (caller: `atestado-validar-matricula/index.ts:57`, também `SERVICE_ROLE`).

> Consequência positiva: hoje um anônimo pode **queimar nonces** e **manipular contadores de rate limit** — exatamente as duas defesas do fluxo público. O MODELO A fecha isso **fortalecendo** o fluxo público, não o quebrando.

---

## 8. PASSO 9 — Indícios de abuso (últimos 30 dias)

### Telemetria disponível

| Fonte | Estado |
|---|---|
| `extensions.pg_stat_statements` | **instalada** (schema `extensions`) |
| `track_functions` | **`none`** ⇒ `pg_stat_user_functions` **vazio** (0 linhas) |
| `bd_backend_exec_auditoria` | 21 registros no total, **2 nos últimos 30 dias** — cobre apenas Edge Functions |
| `bd_auditoria_log` | 45.025 registros em 30 dias |
| `bd_permission_change_audit_logs` | 21.334 no total, 2.410 em 30 dias |

### Resultado por função solicitada

| Função | Chamadas observáveis | Origem identificável | Autenticada? | Anomalia aparente |
|---|---|---|---|---|
| `update_profile_funcionario_id` | **NÃO VERIFICÁVEL** | — | — | — |
| `liberar_proxima_etapa_dinamica` | **NÃO VERIFICÁVEL** | — | — | — |
| `merge_duplicate_funcionarios` | **NÃO VERIFICÁVEL** | — | — | — |
| `rbac_auto_migrate_user` | **NÃO VERIFICÁVEL** | — | — | — |
| `fn_backend_audit_event` | **NÃO VERIFICÁVEL** | — | — | — |
| `fn_arquivar_auditoria_log` | **42 chamadas** | `SELECT public.fn_arquivar_auditoria_log($1)` — forma de chamada **direta em SQL**, compatível com o job `pg_cron` jobid=3 (diário, `15 3 * * *`) | Sistema (`postgres`) | **Nenhuma** — 42 execuções ≈ 42 dias de cron |

**Por que "NÃO VERIFICÁVEL":** chamadas RPC via PostgREST são normalizadas por `pg_stat_statements` em um único texto genérico (`WITH pgrst_source AS (SELECT pgrst_call.pgrst_scalar FROM (SELECT $1 AS json_dat…`, 1.430 chamadas agregadas). **Não é possível atribuir chamadas por função** a partir dessa fonte, e `track_functions = none` elimina a alternativa.

### Indicadores agregados de integridade (nenhum sinal de anomalia)

| Indicador | 30 dias | Leitura |
|---|---:|---|
| `profiles` alterados | 32 (de 203) | compatível com operação normal |
| `bd_auditoria_log` em `profiles` | 162 | consistente |
| `bd_aprovacoes_fluxo_exec` criadas | 1 | baixo, sem pico |
| `bd_user_roles` criados | 24 | compatível com onboarding |
| `bd_diaria_presencas` alteradas | 756 | compatível com volume operacional |
| `bd_pncp_sync_log` sem `user_id` | 32 de 115 (histórico) | esperado para chamadas `source=cron`; **indistinguível** de chamada anônima de terceiro |

**Conclusão: NÃO HÁ EVIDÊNCIA DE INVASÃO.** Também **não há evidência de ausência de invasão** — a telemetria por função não existe. Nenhuma inferência de comprometimento é feita.

**Recomendação (fora do escopo desta fase, para decisão):** avaliar `track_functions = 'pl'` para habilitar `pg_stat_user_functions`. Tem custo de overhead e exige reinício de parâmetro — **não proposto agora**.

---

## 9. PASSO 10 — SEC-02 `pncp-sync`

Documento completo: **`hotfix/HOTFIX-02-PNCP-SYNC.md`**.

**Achado que muda o plano:** `cron.job` tem exatamente **3 jobs** (`auto-finalizar-diarias-16h`, `refresh-mv-relatorio-diarias`, `arquivar-auditoria-diario`). **Nenhum chama `pncp-sync`.** O ramo `body.source === "cron"` **não tem consumidor legítimo**. O único caller real é `src/services/pncpService.ts:138` (frontend autenticado, envia `{ salvarTodas, user_id }`).

| Caminho | Proposta |
|---|---|
| **HUMANO** | `Authorization: Bearer <jwt>` validado via `auth.getUser()` + `fn_pncp_can_manage(p_user_id)` (RPC **já existente**). `userId` passa a vir do **token**, nunca do corpo. |
| **CRON** | Header `x-cron-key` com segredo dedicado, comparação de tempo constante. **Nome proposto: `PNCP_SYNC_CRON_KEY`** — não criado, valor não gerado. Consumidor previsto: um futuro job `pg_cron`. |

**Não reutilizar `LYTOTEC_API_KEY`** conforme instruído: hoje ela autentica 5 fluxos distintos e está distribuída em totens físicos.

**Recomendação:** como não existe cron algum hoje, adotar a **alternativa mínima** (§4 do HOTFIX-02) — só o caminho humano, sem secret novo. O caminho cron entra junto com o job, se e quando existir.

---

## 10. PASSO 11 — SEC-03 `geocode-proxy`

Documento completo: **`hotfix/HOTFIX-03-GEOCODE-PROXY.md`**.

**Callers: exclusivamente frontend autenticado** (`src/hooks/useGeocoding.ts:66,92,126`), consumido por 12 telas, todas atrás de `SimpleAuthGuard`. **Nenhuma rota pública** usa geocoding — verificado em `/atestados-medicos`, `/ponto-totem`, `/ponto-totem-login`, `/register`, `/login`.

| Item | Proposta |
|---|---|
| Autenticação | JWT válido obrigatório (`auth.getUser()`) |
| Autorização | **Nenhuma permission key** — geocoding é utilitário transversal a 6 módulos; exigir permissão quebraria telas legítimas. JWT + rate limit é o gate proporcional. |
| Rate limiting | `fn_rate_limit_check` (**mecanismo já existente**), escopo `geocode_proxy`, chave `user_id`, 120/60s, bloqueio 300s |
| Validação de payload | `action` ∈ {`autocomplete`,`geocode`,`reverse`}; corpo ≤ 4096 bytes |
| CORS | Allowlist **já existente** em `_shared/pops-cors.ts` |
| Mapbox | **inalterado** |
| Cache | **inalterado** (`bd_cache_enderecos`, `onConflict: "endereco"`) |

---

## 11. PASSO 12 — SEC-05: matriz das 7 policies (sem correção)

> **Nenhuma policy é alterada nesta fase.** Matriz apenas.

Estado vivo — todas `PERMISSIVE`, `TO authenticated`, `FOR ALL`, `USING (true)`, `WITH CHECK = null` (herda `USING` ⇒ INSERT/UPDATE/DELETE liberados):

| # | Tabela | Policy | Cmd | Roles | USING | WITH CHECK | Outras policies na tabela | Frontend caller | RPC caller | Operações legítimas | Permission key existente | RLS correta proposta |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **`bd_centros_custo`** | `Usuários autenticados podem acessar centros de custo` | ALL | authenticated | `true` | (null) | **NENHUMA** ⚠️ | `GestaoCentrosCusto`, `centrosCusto/*`, escopo de 40 tabelas | `fn_*_scope_centros_custo`, `get_admsede_centros_custo`, `is_admsede_for_cc` | SELECT: todos (escopo); INSERT/UPDATE/DELETE: RH/Admin | **`gestao_rh_centros_custo_view`** | SELECT amplo p/ authenticated + write via `fn_is_super_admin() OR fn_has_role('AdmRH') OR fn_has_permission('gestao_rh_centros_custo_view')` |
| 2 | **`bd_caminhoes_equipamentos`** | `Usuários autenticados podem acessar veículos` | ALL | authenticated | `true` | (null) | ✅ **`ativos_equipamentos_read`** (`fn_ativos_can_access_equipamento(id, auth.uid())`) e **`ativos_equipamentos_write`** (`fn_ativos_has_logistics_access(auth.uid())`) | `GestaoCaminhoes`, CT, OS | `fn_ativos_*` | já cobertas pelas duas policies corretas | **`gestao_maquinas_caminhoes_view`** | **Apenas DROP da policy permissiva** — as corretas já existem. **Menor risco dos 7.** |
| 3 | **`bd_equipes`** | `Usuários autenticados podem acessar equipes` | ALL | authenticated | `true` | (null) | **NENHUMA** ⚠️ | `GestaoEquipes`, apontamento | `usuario_acessa_equipe` (**14 policies dependem**) | SELECT: escopo; write: RH/Apontador | **`gestao_rh_equipes_view`** | SELECT via `usuario_acessa_equipe(auth.uid(), id)` OR escopo CC; write via `fn_has_role('AdmRH') OR fn_has_permission('gestao_rh_equipes_view')` |
| 4 | **`bd_empresas`** | `Usuários autenticados podem acessar empresas` | ALL | authenticated | `true` | (null) | **NENHUMA** ⚠️ | `GestaoEmpresas`, portfólio, CT | — | SELECT: catálogo amplo; write: RH/Admin | **`gestao_rh_empresas_view`** | SELECT amplo + write por permissão |
| 5 | **`bd_departamentos`** | `Usuários autenticados podem acessar departamentos` | ALL | authenticated | `true` | (null) | **NENHUMA** ⚠️ | `GestaoDepartamentos`, POPs (`setor_id`) | `get_user_departamento_id` (13 policies) | SELECT: catálogo amplo; write: RH/Admin | **`gestao_rh_departamentos_view`** | SELECT amplo + write por permissão |
| 6 | **`bd_usinas`** | `Usuários autenticados podem acessar usinas` | ALL | authenticated | `true` | (null) | **NENHUMA** ⚠️ | `GestaoUsinas`, programação | — | SELECT: catálogo amplo; write: Admin Máquinas | **`gestao_maquinas_usinas_view`** | SELECT amplo + write por permissão |
| 7 | **`bd_registro_apontamento_inspecao`** | `Usuários autenticados podem acessar inspeções` | ALL | authenticated | `true` | (null) | **NENHUMA** ⚠️ | apontamento de caminhões | — | escopo por equipe/CC | **`requisicoes_apontamento_caminhoes_view`** | SELECT/write via `fn_logistica_can_access_apontamento_cam` |

### Conclusão da matriz
- **Nenhuma permission key nova é necessária** — as 7 já existem em `bd_permissions`.
- **`bd_caminhoes_equipamentos` é caso isolado e simples**: já possui o par de policies correto (`ativos_equipamentos_read`/`_write`); a permissiva é um resíduo que as neutraliza. Um `DROP POLICY` resolve.
- **As outras 6 têm a policy permissiva como ÚNICA policy.** Remover sem substituta **derruba o acesso de todos os usuários** a essas tabelas — incluindo `bd_centros_custo`, que é o eixo de escopo de RLS de 40 tabelas. Exige policy substituta escrita, testada e aprovada antes.

---

## 12. Ordem de execução proposta (após aprovação)

| Passo | Ação | Risco | Reversível |
|---|---|---|---|
| 1 | Capturar `proacl` original (query no rodapé do `ROLLBACK-01`) | nenhum | — |
| 2 | Aplicar **HOTFIX-01-SEC24** em janela de baixo movimento | baixo | sim, `ROLLBACK-01` |
| 3 | Rodar testes T1–T4 do §13 | nenhum | — |
| 4 | Observar 24–48 h (`bd_backend_exec_auditoria`, erros 42501 nos logs) | — | — |
| 5 | Aplicar **HOTFIX-03** (`geocode-proxy`) | baixo-médio (hidratação de sessão) | sim, redeploy |
| 6 | Aplicar **HOTFIX-02** (`pncp-sync`, alternativa mínima) | baixo | sim, redeploy |
| 7 | **Só então** iniciar SEC-05, tabela por tabela, começando por `bd_caminhoes_equipamentos` | médio-alto | sim |
| 8 | HOTFIX-04 (gates internos MODELO B) — proposta separada | médio | sim |

---

## 13. PASSO 15 — Testes do HOTFIX-01

> **Nenhum executado.** Nenhum teste realiza exploração real: T1/T2 usam funções cujo efeito é nulo ou idempotente e devem falhar por permissão **antes** de qualquer escrita.

### T1 — NEGATIVO / ANÔNIMO (o teste central do P0)
```bash
curl -i -X POST "https://eexzgpmrousuxlkvqwkm.supabase.co/rest/v1/rpc/check_vistorias_sso_pendentes" \
  -H "apikey: $ANON_KEY" -H "content-type: application/json" -d '{}'
```
- **Antes do hotfix:** `200` (função executa).
- **Esperado depois:** `404` ou `401/403` com `PGRST202`/`42501` — PostgREST deixa de expor a função a `anon`.

### T2 — NEGATIVO / ANÔNIMO em função crítica
```bash
curl -i -X POST "https://eexzgpmrousuxlkvqwkm.supabase.co/rest/v1/rpc/update_profile_funcionario_id" \
  -H "apikey: $ANON_KEY" -H "content-type: application/json" \
  -d '{"_profile_id":"00000000-0000-0000-0000-000000000000","_funcionario_id":"00000000-0000-0000-0000-000000000000"}'
```
> UUIDs zerados: não existem em `profiles`, portanto o `UPDATE ... WHERE id = ...` afeta **0 linhas** mesmo se executar. Não é exploração.
- **Esperado depois:** `404`/`401`/`403`. **Nunca `200`.**

### T3 — NEGATIVO / AUTENTICADO em função MODELO A
```bash
curl -i -X POST "https://eexzgpmrousuxlkvqwkm.supabase.co/rest/v1/rpc/update_profile_funcionario_id" \
  -H "apikey: $ANON_KEY" -H "authorization: Bearer $JWT_USUARIO_COMUM" \
  -H "content-type: application/json" \
  -d '{"_profile_id":"00000000-0000-0000-0000-000000000000","_funcionario_id":"00000000-0000-0000-0000-000000000000"}'
```
- **Esperado:** bloqueado (`42501` / `PGRST202`).

### T4 — Verificação de catálogo (read-only, definitiva)
```sql
select p.oid::regprocedure::text as assinatura,
       has_function_privilege('anon', p.oid, 'EXECUTE')          as anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated,
       has_function_privilege('service_role', p.oid, 'EXECUTE')  as service_role
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public' and p.proname in (
  'update_profile_funcionario_id','liberar_proxima_etapa_dinamica','merge_duplicate_funcionarios',
  'sync_presencas_valores_funcao','sync_convocados_pre_valores','fn_arquivar_auditoria_log',
  'fn_backend_audit_event','fn_ct_registrar_assinatura','fn_registrar_nonce_atestado',
  'fn_rate_limit_check','garantir_registro_aplicacao_principal','sync_profile_funcao_sistema',
  'fn_ponto_diaria_simular_batida','check_vistorias_sso_pendentes','gerenciar_convocado_diaria',
  'gerenciar_convocado_diaria_no_dia','rbac_auto_migrate_user','finalizar_carga_manual',
  'finalizar_carga_aplicacao','sincronizar_hora_saida_aplicacao','fn_calcular_nota_checklist',
  'fn_relatorio_aps_definir_carimbo_padrao','fn_relatorio_aps_desvincular_padrao',
  'fn_relatorio_aps_inativar_carimbo','update_configuracao_sistema')
order by 1;
```
**Esperado:** `anon = false` nas **25**; `authenticated = false` nas **14 do MODELO A**; `authenticated = true` nas **11 do MODELO B**; `service_role = true` em **todas**.

### T5 — POSITIVO / AUTENTICADO COM PERMISSÃO (fluxo preservado)
| Fluxo | Onde | Esperado |
|---|---|---|
| Diárias — adicionar/remover convocado | `/requisicoes/diarias/solicitacoes` | funciona (B1/B2) |
| Registro de Aplicação — finalizar carga | `/registro-aplicacao` | funciona (B4/B5/B6) |
| SSO — salvar checklist (recalcula nota) | `/sso/checklists` | funciona (B7) |
| Relatório APS — carimbo padrão | Relatório APS | funciona (B8/B9/B10) |
| Admin — migração automática de RBAC | `/admin/permissoes` | funciona (B3) |

### T6 — POSITIVO / SERVICE_ROLE E CRON (fluxo preservado)
| Fluxo | Verificação | Esperado |
|---|---|---|
| Atestado público ponta a ponta | `/atestados-medicos` → validar matrícula → upload → submeter | funciona; `bd_atestados_nonces_utilizados` recebe nova linha |
| Rate limit de atestado | 6 tentativas de matrícula inválida | `429` na 6ª; `bd_rate_limit_tentativas` cresce |
| Cron de auditoria | aguardar `15 3 * * *` (jobid=3) | `select count(*) from bd_auditoria_log_archive` cresce |
| Auditoria de Edge Function | invocar `delete-user` sem permissão | `403` **e** nova linha em `bd_backend_exec_auditoria` |
| Central do Transporte — checklist de saída | salvar checklist | assinatura gravada (A8 via `fn_ct_checklist_saida_salvar`) |
| Trigger de massa remanescente | editar detalhe de aplicação | recálculo ocorre (A/B via trigger) |

### T7 — POSITIVO / CADEIA SQL INTERNA (a premissa mais importante)
```sql
-- Deve continuar funcionando: wrapper (definer) chama função agora restrita.
-- Executar em transação e desfazer.
BEGIN;
  SELECT public.link_profile_to_funcionario_by_email('<email-de-teste-existente>');
ROLLBACK;
```
**Esperado:** sucesso. Se falhar com `permission denied for function update_profile_funcionario_id`, a premissa "contexto definer preserva a cadeia" está errada e o **rollback deve ser acionado imediatamente**.

> Este é o teste que decide se o HOTFIX-01 pode permanecer. Deve ser o **primeiro** executado após a aplicação.

---

# 14. HOTFIX-01 — EXECUTADO

> Registro de execução. Autorização limitada concedida em 2026-09-01.
> **Somente HOTFIX-01.** HOTFIX-02, HOTFIX-03, SEC-05 e HOTFIX-04 **não** foram executados.

## 14.1 Identificação

| Item | Valor |
|---|---|
| **Status** | ✅ **EXECUTADO COM SUCESSO** |
| Timestamp (aplicação) | **2026-09-01 02:02:19 UTC** |
| Migration (banco) | `schema_migrations` → version `20260901020219`, name `sec24_restringir_execute_rpcs_privilegiadas` |
| Migration (arquivo) | `supabase/migrations/20260901020219_sec24_restringir_execute_rpcs_privilegiadas.sql` |
| Projeto | `eexzgpmrousuxlkvqwkm` |
| Funções auditadas | 25 candidatas |
| **Funções alteradas** | **24** (14 MODELO A + 10 MODELO B) |
| Falso positivo intocado | **1** — `update_configuracao_sistema(text,text)` |
| Rollback | `docs/claude-onboarding/hotfix/ROLLBACK-01-SEC24.sql` |
| Snapshot ACL anterior | `docs/claude-onboarding/hotfix/SEC24-ACL-ANTES.md` |

## 14.2 Ajustes obrigatórios aplicados antes da execução

1. **Falso positivo removido do escopo.** `update_configuracao_sistema(text,text)` não teve ACL alterada. Verificado após a migration: `proacl` permanece `{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}` — **idêntico ao snapshot anterior**.
2. **Alteração versionada.** Migration criada em `supabase/migrations/`, não apenas no staging. Total do projeto: 869 → **870**.
3. **Conteúdo restrito.** Verificação automatizada: **0 statements executáveis fora de REVOKE/GRANT EXECUTE ON FUNCTION**. 62 REVOKE + 34 GRANT, 24 funções distintas, assinatura completa, sem loop dinâmico.
4. **Nome do arquivo alinhado** à version registrada pelo banco (`20260901020219`), mantendo `schema_migrations` e repositório coerentes.

## 14.3 Gate do Passo 3 — chamadoras SQL internas

| Função interna (MODELO A) | Chamadora | `prosecdef` | Owner chamadora |
|---|---|:--:|---|
| `update_profile_funcionario_id` | `link_profile_from_funcionario_email` | true | postgres |
| `update_profile_funcionario_id` | `link_profile_to_funcionario_by_email` | true | postgres |
| `liberar_proxima_etapa_dinamica` | `aprovar_etapa_dinamica` | true | postgres |
| `fn_ct_registrar_assinatura` | `fn_ct_checklist_saida_salvar` | true | postgres |
| `garantir_registro_aplicacao_principal` | `criar_aplicacao_por_rua` | true | postgres |
| `sync_profile_funcao_sistema` | `trg_sync_funcao_sistema_profiles` | true | postgres |
| `sync_profile_funcao_sistema` | `trg_sync_funcao_sistema_bd_equipes` | true | postgres |
| `fn_ponto_diaria_simular_batida` | `fn_ponto_diaria_simular_lote` | true | postgres |

Varredura exaustiva por chamadoras `SECURITY INVOKER` de qualquer função MODELO A: **0 linhas**.
✅ **GATE LIBERADO** — cadeia SQL preservada (checagem de EXECUTE interno ocorre contra `postgres`, o owner).

## 14.4 Resultado ACL — 24/24 `OK`

Consulta real utilizada: `has_function_privilege` por role + detecção de `PUBLIC` via `proacl like '{=X/%'`, com coluna `status` calculada por modelo. Reproduzível no §14.4 do arquivo de migration e em `SEC24-ACL-ANTES.md`.

| Modelo | Função | public | anon | authenticated | service_role | postgres | status |
|:--:|---|:--:|:--:|:--:|:--:|:--:|:--:|
| A | `check_vistorias_sso_pendentes()` | false | false | false | true | true | **OK** |
| A | `fn_arquivar_auditoria_log(integer)` | false | false | false | true | true | **OK** |
| A | `fn_backend_audit_event(uuid,text,…,text)` | false | false | false | true | true | **OK** |
| A | `fn_ct_registrar_assinatura(uuid,uuid,text)` | false | false | false | true | true | **OK** |
| A | `fn_ponto_diaria_simular_batida(uuid)` | false | false | false | true | true | **OK** |
| A | `fn_rate_limit_check(text,text,text,integer,integer,integer)` | false | false | false | true | true | **OK** |
| A | `fn_registrar_nonce_atestado(uuid,uuid,inet)` | false | false | false | true | true | **OK** |
| A | `garantir_registro_aplicacao_principal(uuid,uuid,date,time,uuid)` | false | false | false | true | true | **OK** |
| A | `liberar_proxima_etapa_dinamica(uuid)` | false | false | false | true | true | **OK** |
| A | `merge_duplicate_funcionarios()` | false | false | false | true | true | **OK** |
| A | `sync_convocados_pre_valores()` | false | false | false | true | true | **OK** |
| A | `sync_presencas_valores_funcao()` | false | false | false | true | true | **OK** |
| A | `sync_profile_funcao_sistema(uuid)` | false | false | false | true | true | **OK** |
| A | `update_profile_funcionario_id(uuid,uuid)` | false | false | false | true | true | **OK** |
| B | `finalizar_carga_aplicacao(uuid)` | false | false | **true** | true | true | **OK** |
| B | `finalizar_carga_manual(uuid)` | false | false | **true** | true | true | **OK** |
| B | `fn_calcular_nota_checklist(uuid)` | false | false | **true** | true | true | **OK** |
| B | `fn_relatorio_aps_definir_carimbo_padrao(uuid,uuid)` | false | false | **true** | true | true | **OK** |
| B | `fn_relatorio_aps_desvincular_padrao(uuid)` | false | false | **true** | true | true | **OK** |
| B | `fn_relatorio_aps_inativar_carimbo(uuid,timestamptz)` | false | false | **true** | true | true | **OK** |
| B | `gerenciar_convocado_diaria(uuid,jsonb,text)` | false | false | **true** | true | true | **OK** |
| B | `gerenciar_convocado_diaria_no_dia(uuid,jsonb,date,text)` | false | false | **true** | true | true | **OK** |
| B | `rbac_auto_migrate_user(uuid)` | false | false | **true** | true | true | **OK** |
| B | `sincronizar_hora_saida_aplicacao(uuid)` | false | false | **true** | true | true | **OK** |

**Owner `postgres` funcional em 24/24.** Nenhuma sobrecarga exposta — `pg_proc` retorna exatamente 24 linhas, uma por função.

## 14.5 Efeito global no SEC-24

| Métrica | Antes | Depois | Δ |
|---|---:|---:|---:|
| `SECURITY DEFINER` com **grant explícito** de `anon` | 358 | **334** | **−24** (exato) |
| `SECURITY DEFINER` com **privilégio efetivo** de `anon` | — | 341 | — |
| Mutantes com privilégio efetivo de `anon` | — | 160 | — |
| Das 24 alteradas, quantas mantêm `anon` | 24 | **0** | **−24** |

> Nota metodológica: "grant explícito" (`aclexplode`) e "privilégio efetivo" (`has_function_privilege`, inclui herança de `PUBLIC`) são métricas distintas. A diferença de 7 entre 334 e 341 são funções sem entrada `anon` no `proacl` mas alcançáveis via `PUBLIC` — escopo remanescente.

## 14.6 Integridade estrutural — nada além de ACL

| Objeto | Antes (Fase 0.1) | Depois | Δ |
|---|---:|---:|---:|
| Tabelas `public` | 194 | **194** | 0 |
| Policies `public` | 490 | **490** | 0 |
| Funções `public` | 868 | **868** | 0 |
| Triggers `public` | 249 | **249** | 0 |
| Tabelas sem RLS | 0 | **0** | 0 |
| Corpos de função alterados | — | **0** | — |
| Edge Functions alteradas | — | **0** | — |

## 14.7 Smoke tests

| # | Teste | Resultado | Evidência |
|---|---|---|---|
| **H** | Nenhuma MODELO A com `EXECUTE` para `anon`/`authenticated` | ✅ **OK** | catálogo 24/24 `OK`; `alteradas_com_anon_restante = 0` |
| — | Falso positivo intocado | ✅ **OK** | `proacl` idêntico ao snapshot |
| — | Owner funcional | ✅ **OK** | `postgres_execute = true` em 24/24 |
| — | Aplicação pública responde | ✅ **OK** | `https://lytotec.com.br` → HTTP 200 |
| — | Auth do Supabase saudável | ✅ **OK** | `/auth/v1/health` → HTTP 200 |
| A–G | Login, Portal, Funcionários, Diárias, Central do Transporte, Atestados, fluxo MODELO B | ⏳ **PENDENTE — não executados** | exigem sessão autenticada; sem credenciais, e senha não deve ser inserida |

### Teste via OpenAPI — descartado
Tentei confirmar a remoção das RPCs do schema exposto a `anon` via `GET /rest/v1/`. O endpoint retornou **HTTP 401 — "Only the `service_role` API key can be used for this endpoint"**. O resultado inicial (0 RPCs) era artefato do 401, não evidência: o controle (`update_configuracao_sistema`, que **deveria** aparecer) também retornou 0. **Resultado descartado.**
A evidência autoritativa é o catálogo — `has_function_privilege` é a fonte de verdade do que o PostgreSQL autoriza, e o PostgREST não concede além disso.

### Ausência de tráfego pós-migration
Nenhuma atividade de produção após 02:02:19 UTC (último `bd_auditoria_log` = 01:33:30; último `bd_rate_limit_tentativas` = 2026-08-31 23:33; último nonce = 2026-08-31 23:36). **Sem validação orgânica ainda.**

## 14.8 Testes que o usuário precisa executar

| # | Fluxo | Por que importa | Esperado |
|---|---|---|---|
| **1** | **Atestado médico público** (`/atestados-medicos`) ponta a ponta | Depende de **2 funções MODELO A** (`fn_rate_limit_check`, `fn_registrar_nonce_atestado`) via Edge com `service_role`. **Maior risco de regressão.** | fluxo completo; nova linha em `bd_atestados_nonces_utilizados` |
| 2 | Login + Portal | base | carregam |
| 3 | `/gestao-rh/funcionarios` | leitura | abre |
| 4 | `/requisicoes/diarias/solicitacoes` — ajustar convocados | MODELO B `gerenciar_convocado_diaria` | funciona |
| 5 | Central do Transporte — salvar checklist de saída | MODELO A `fn_ct_registrar_assinatura` via cadeia definer | funciona |
| 6 | `/registro-aplicacao` — finalizar carga | MODELO B `finalizar_carga_aplicacao` | funciona |
| 7 | Cron `arquivar-auditoria-diario` (03:15 UTC) | MODELO A `fn_arquivar_auditoria_log` como `postgres` | `bd_auditoria_log_archive` cresce |
| 8 | Vínculo profile↔funcionário no cadastro | cadeia `link_profile_*` → `update_profile_funcionario_id` | funciona |

**Se qualquer um falhar com `permission denied for function ...`:** aplicar `ROLLBACK-01-SEC24.sql` imediatamente e reportar função + fluxo.

## 14.9 Observações

1. **Version atribuída pelo banco (`20260901020219`) diferiu do timestamp do nome do arquivo** (`20260831230016`). Arquivo renomeado para coincidir, mantendo `schema_migrations` e repositório coerentes.
2. **`ROLLBACK-01-SEC24.sql` cobre 25 funções**, incluindo `update_configuracao_sistema`. Como essa não foi alterada, a linha é inócua (re-concede o que já existe), mas deve ser removida antes de um uso eventual, por fidelidade ao escopo.
3. **Escopo remanescente do SEC-24:** 334 funções com grant explícito de `anon` (majoritariamente predicados `STABLE` de leitura, que retornam falso para `auth.uid() IS NULL`) e 160 mutantes com privilégio efetivo. **Fora desta autorização.**
4. **Nenhum commit foi feito**, conforme instrução.
