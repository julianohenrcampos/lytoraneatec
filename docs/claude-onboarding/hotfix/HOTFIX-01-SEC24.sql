-- ============================================================================
-- HOTFIX-01-SEC24 — Contenção de execução anônima de funções SECURITY DEFINER
-- ============================================================================
-- STATUS: PROPOSTA. **NÃO APLICADA.**
-- Gerado em 2026-08-31 a partir do catálogo vivo de eexzgpmrousuxlkvqwkm.
--
-- ESTE ARQUIVO NÃO ESTÁ EM supabase/migrations/ DE PROPÓSITO,
-- para que `supabase db push` não o aplique acidentalmente.
-- Mover para supabase/migrations/ SOMENTE após aprovação explícita.
--
-- ----------------------------------------------------------------------------
-- POR QUE ISTO É NECESSÁRIO
-- ----------------------------------------------------------------------------
-- Todas as funções abaixo são:
--   * SECURITY DEFINER
--   * owned by `postgres`, que tem rolbypassrls = true
--     => executam ignorando RLS, inclusive em tabelas com FORCE ROW LEVEL SECURITY
--   * VOLATILE (mutantes: INSERT/UPDATE/DELETE)
--   * expostas como RPC no PostgREST (retorno <> trigger)
--   * com EXECUTE efetivo para o role `anon`
--
-- ATENÇÃO — PUBLIC vs anon:
--   16 das 25 funções têm o grant `=X/postgres` no proacl, isto é,
--   **PUBLIC possui EXECUTE**. Nessas, `REVOKE ... FROM anon` sozinho
--   NÃO surte efeito, porque `anon` continua herdando de PUBLIC.
--   Por isso todo bloco abaixo revoga de PUBLIC **e** de anon.
--
-- ----------------------------------------------------------------------------
-- ESCOPO DESTE HOTFIX (mínimo e reversível)
-- ----------------------------------------------------------------------------
-- FAZ:      remove EXECUTE de PUBLIC e de anon; garante EXECUTE explícito
--           para os consumidores legítimos já mapeados.
-- NÃO FAZ:  não altera corpo de função, retorno, parâmetros ou regra funcional.
--           não altera RLS, policies, tabelas ou dados.
--           não toca nas outras ~333 funções SECURITY DEFINER com grant a anon
--           (majoritariamente predicados STABLE de leitura — fase posterior).
--
-- POR QUE NÃO HÁ GATE INTERNO AQUI:
--   adicionar verificação de autorização dentro do corpo muda comportamento
--   e exige janela de validação. Foi separado em HOTFIX-04 (proposto à parte).
--   Este hotfix fecha o vetor ANÔNIMO, que é o P0, com risco operacional ~zero.
--
-- ----------------------------------------------------------------------------
-- POR QUE É SEGURO PARA OS FLUXOS ATUAIS (verificado, não presumido)
-- ----------------------------------------------------------------------------
--  * Chamadas SQL entre funções: uma função SECURITY DEFINER executa como
--    `postgres`; a checagem de EXECUTE da função interna é feita contra
--    `postgres`, não contra anon/authenticated. Revogar não quebra a cadeia.
--  * Triggers: o PostgreSQL valida EXECUTE da função de trigger em
--    CREATE TRIGGER, não a cada disparo. Revogar não quebra triggers.
--  * pg_cron: os 3 jobs rodam como `postgres`. Não afetados.
--  * Edge Functions: as que chamam estas RPCs usam client `service_role`
--    (verificado em _shared/backend-security.ts, atestado-submeter,
--    atestado-validar-matricula). service_role mantém o grant.
--  * Frontend autenticado: mantém `authenticated` nas 11 funções do MODELO B.
--  * Fluxo público (atestados): o browser chama apenas Edge Functions
--    (src/services/atestadosService.ts), nunca as RPCs. Verificado.
-- ============================================================================

BEGIN;

-- ############################################################################
-- MODELO A — FUNÇÕES INTERNAS (service_role apenas)
-- Sem caller no frontend e sem caller anônimo. Chamadas por outras funções SQL,
-- triggers, pg_cron ou Edge Functions com service_role.
-- ############################################################################

-- A1. update_profile_funcionario_id — CRÍTICO
--     Revincula qualquer profile a qualquer funcionário, sem verificação.
--     Callers: link_profile_from_funcionario_email, link_profile_to_funcionario_by_email (SQL).
--     Frontend: nenhum. Edge: nenhuma.
REVOKE ALL ON FUNCTION public.update_profile_funcionario_id(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_profile_funcionario_id(uuid,uuid) FROM anon;
REVOKE ALL ON FUNCTION public.update_profile_funcionario_id(uuid,uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.update_profile_funcionario_id(uuid,uuid) TO service_role;

-- A2. liberar_proxima_etapa_dinamica — CRÍTICO
--     Avança etapa do fluxo de aprovação e grava status_fluxo em bd_diaria_solicitacoes.
--     Caller: aprovar_etapa_dinamica (SQL). Frontend: nenhum.
REVOKE ALL ON FUNCTION public.liberar_proxima_etapa_dinamica(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.liberar_proxima_etapa_dinamica(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.liberar_proxima_etapa_dinamica(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.liberar_proxima_etapa_dinamica(uuid) TO service_role;

-- A3. merge_duplicate_funcionarios — CRÍTICO
--     Mescla funcionários; escreve em 7 tabelas incluindo bd_funcionarios e profiles.
--     Nenhum caller em lugar algum. Manutenção administrativa.
REVOKE ALL ON FUNCTION public.merge_duplicate_funcionarios() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merge_duplicate_funcionarios() FROM anon;
REVOKE ALL ON FUNCTION public.merge_duplicate_funcionarios() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.merge_duplicate_funcionarios() TO service_role;

-- A4. sync_presencas_valores_funcao — ALTO (financeiro em massa)
REVOKE ALL ON FUNCTION public.sync_presencas_valores_funcao() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_presencas_valores_funcao() FROM anon;
REVOKE ALL ON FUNCTION public.sync_presencas_valores_funcao() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sync_presencas_valores_funcao() TO service_role;

-- A5. sync_convocados_pre_valores — ALTO (financeiro em massa)
REVOKE ALL ON FUNCTION public.sync_convocados_pre_valores() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_convocados_pre_valores() FROM anon;
REVOKE ALL ON FUNCTION public.sync_convocados_pre_valores() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sync_convocados_pre_valores() TO service_role;

-- A6. fn_arquivar_auditoria_log — ALTO (integridade de auditoria)
--     Caller real: pg_cron jobid=3 'arquivar-auditoria-diario' → roda como postgres.
--     NOTA: proacl NÃO tem PUBLIC; o REVOKE de PUBLIC é defensivo/idempotente.
REVOKE ALL ON FUNCTION public.fn_arquivar_auditoria_log(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_arquivar_auditoria_log(integer) FROM anon;
REVOKE ALL ON FUNCTION public.fn_arquivar_auditoria_log(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_arquivar_auditoria_log(integer) TO service_role;

-- A7. fn_backend_audit_event — ALTO (injeção de auditoria falsa)
--     Caller: supabase/functions/_shared/backend-security.ts → supabaseAdmin (service_role).
REVOKE ALL ON FUNCTION public.fn_backend_audit_event(uuid,text,text,text,text,text,text,text,text,boolean,boolean,integer,inet,text,jsonb,jsonb,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_backend_audit_event(uuid,text,text,text,text,text,text,text,text,boolean,boolean,integer,inet,text,jsonb,jsonb,text) FROM anon;
REVOKE ALL ON FUNCTION public.fn_backend_audit_event(uuid,text,text,text,text,text,text,text,text,boolean,boolean,integer,inet,text,jsonb,jsonb,text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_backend_audit_event(uuid,text,text,text,text,text,text,text,text,boolean,boolean,integer,inet,text,jsonb,jsonb,text) TO service_role;

-- A8. fn_ct_registrar_assinatura — ALTO (assina em nome de qualquer usuário: p_user uuid)
--     Caller: fn_ct_checklist_saida_salvar (SQL).
REVOKE ALL ON FUNCTION public.fn_ct_registrar_assinatura(uuid,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_ct_registrar_assinatura(uuid,uuid,text) FROM anon;
REVOKE ALL ON FUNCTION public.fn_ct_registrar_assinatura(uuid,uuid,text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ct_registrar_assinatura(uuid,uuid,text) TO service_role;

-- A9. fn_registrar_nonce_atestado — ALTO (queima de nonce = DoS do fluxo público)
--     RESPOSTA AO PASSO 8: o browser NÃO chama esta RPC.
--     src/services/atestadosService.ts invoca apenas Edge Functions.
--     supabase/functions/atestado-submeter/index.ts:193 usa createClient(URL, SERVICE_ROLE).
--     Logo, MODELO A não quebra o fluxo público.
REVOKE ALL ON FUNCTION public.fn_registrar_nonce_atestado(uuid,uuid,inet) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_registrar_nonce_atestado(uuid,uuid,inet) FROM anon;
REVOKE ALL ON FUNCTION public.fn_registrar_nonce_atestado(uuid,uuid,inet) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_registrar_nonce_atestado(uuid,uuid,inet) TO service_role;

-- A10. fn_rate_limit_check — ALTO (manipular contadores anula o rate limit)
--      Caller: supabase/functions/atestado-validar-matricula/index.ts:57 (SERVICE_ROLE).
REVOKE ALL ON FUNCTION public.fn_rate_limit_check(text,text,text,integer,integer,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_rate_limit_check(text,text,text,integer,integer,integer) FROM anon;
REVOKE ALL ON FUNCTION public.fn_rate_limit_check(text,text,text,integer,integer,integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_rate_limit_check(text,text,text,integer,integer,integer) TO service_role;

-- A11. garantir_registro_aplicacao_principal — MÉDIO
--      Caller: criar_aplicacao_por_rua (SQL). Frontend: nenhum direto.
REVOKE ALL ON FUNCTION public.garantir_registro_aplicacao_principal(uuid,uuid,date,time without time zone,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.garantir_registro_aplicacao_principal(uuid,uuid,date,time without time zone,uuid) FROM anon;
REVOKE ALL ON FUNCTION public.garantir_registro_aplicacao_principal(uuid,uuid,date,time without time zone,uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.garantir_registro_aplicacao_principal(uuid,uuid,date,time without time zone,uuid) TO service_role;

-- A12. sync_profile_funcao_sistema — MÉDIO
--      Usada por trg_sync_funcao_sistema_profiles e trg_sync_funcao_sistema_bd_equipes.
REVOKE ALL ON FUNCTION public.sync_profile_funcao_sistema(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_profile_funcao_sistema(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.sync_profile_funcao_sistema(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sync_profile_funcao_sistema(uuid) TO service_role;

-- A13. fn_ponto_diaria_simular_batida — MÉDIO
--      Caller: fn_ponto_diaria_simular_lote (SQL). Modo shadow.
REVOKE ALL ON FUNCTION public.fn_ponto_diaria_simular_batida(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_ponto_diaria_simular_batida(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.fn_ponto_diaria_simular_batida(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ponto_diaria_simular_batida(uuid) TO service_role;

-- A14. check_vistorias_sso_pendentes — MÉDIO (escreve notificações)
--      Nenhum caller identificado (frontend, Edge, SQL, cron).
REVOKE ALL ON FUNCTION public.check_vistorias_sso_pendentes() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_vistorias_sso_pendentes() FROM anon;
REVOKE ALL ON FUNCTION public.check_vistorias_sso_pendentes() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.check_vistorias_sso_pendentes() TO service_role;


-- ############################################################################
-- MODELO B — FUNÇÕES DE USUÁRIO AUTENTICADO
-- Possuem caller real no frontend autenticado. Remove-se apenas PUBLIC e anon.
-- O gate interno (auth.uid() + permissão) está proposto em HOTFIX-04, à parte,
-- por alterar comportamento e exigir janela de validação.
-- ############################################################################

-- B1. gerenciar_convocado_diaria — caller: src/services/diarias/solicitacoesService.ts
REVOKE ALL ON FUNCTION public.gerenciar_convocado_diaria(uuid,jsonb,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gerenciar_convocado_diaria(uuid,jsonb,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.gerenciar_convocado_diaria(uuid,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gerenciar_convocado_diaria(uuid,jsonb,text) TO service_role;

-- B2. gerenciar_convocado_diaria_no_dia — caller: src/services/diarias/solicitacoesService.ts
REVOKE ALL ON FUNCTION public.gerenciar_convocado_diaria_no_dia(uuid,jsonb,date,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gerenciar_convocado_diaria_no_dia(uuid,jsonb,date,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.gerenciar_convocado_diaria_no_dia(uuid,jsonb,date,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gerenciar_convocado_diaria_no_dia(uuid,jsonb,date,text) TO service_role;

-- B3. rbac_auto_migrate_user — caller: src/services/accessControl/autoMigrationService.ts
REVOKE ALL ON FUNCTION public.rbac_auto_migrate_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rbac_auto_migrate_user(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.rbac_auto_migrate_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rbac_auto_migrate_user(uuid) TO service_role;

-- B4. finalizar_carga_manual — caller: src/services/registro-aplicacao/manualFinalizationService.ts
REVOKE ALL ON FUNCTION public.finalizar_carga_manual(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalizar_carga_manual(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.finalizar_carga_manual(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalizar_carga_manual(uuid) TO service_role;

-- B5. finalizar_carga_aplicacao — callers: useAplicacoesMultiplas.ts,
--     registroAplicacaoDetalhesService.ts e triggers de massa remanescente
REVOKE ALL ON FUNCTION public.finalizar_carga_aplicacao(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalizar_carga_aplicacao(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.finalizar_carga_aplicacao(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalizar_carga_aplicacao(uuid) TO service_role;

-- B6. sincronizar_hora_saida_aplicacao — caller: useNovoRegistroForm.ts + SQL
REVOKE ALL ON FUNCTION public.sincronizar_hora_saida_aplicacao(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sincronizar_hora_saida_aplicacao(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.sincronizar_hora_saida_aplicacao(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sincronizar_hora_saida_aplicacao(uuid) TO service_role;

-- B7. fn_calcular_nota_checklist — caller: src/services/sso/ssoChecklistService.ts + trigger
REVOKE ALL ON FUNCTION public.fn_calcular_nota_checklist(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_calcular_nota_checklist(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_calcular_nota_checklist(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_calcular_nota_checklist(uuid) TO service_role;

-- B8. fn_relatorio_aps_definir_carimbo_padrao — caller: relatorioApsCarimbosService.ts
REVOKE ALL ON FUNCTION public.fn_relatorio_aps_definir_carimbo_padrao(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_relatorio_aps_definir_carimbo_padrao(uuid,uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_relatorio_aps_definir_carimbo_padrao(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_relatorio_aps_definir_carimbo_padrao(uuid,uuid) TO service_role;

-- B9. fn_relatorio_aps_desvincular_padrao — caller: relatorioApsCarimbosService.ts
REVOKE ALL ON FUNCTION public.fn_relatorio_aps_desvincular_padrao(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_relatorio_aps_desvincular_padrao(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_relatorio_aps_desvincular_padrao(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_relatorio_aps_desvincular_padrao(uuid) TO service_role;

-- B10. fn_relatorio_aps_inativar_carimbo — caller: relatorioApsCarimbosService.ts
REVOKE ALL ON FUNCTION public.fn_relatorio_aps_inativar_carimbo(uuid,timestamp with time zone) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_relatorio_aps_inativar_carimbo(uuid,timestamp with time zone) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_relatorio_aps_inativar_carimbo(uuid,timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_relatorio_aps_inativar_carimbo(uuid,timestamp with time zone) TO service_role;

-- B11. update_configuracao_sistema — FALSO POSITIVO de guarda (já valida
--      fn_ponto_is_superadmin() internamente), mas mantinha EXECUTE para
--      PUBLIC/anon. Defesa em profundidade: remover o alcance anônimo.
REVOKE ALL ON FUNCTION public.update_configuracao_sistema(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_configuracao_sistema(text,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_configuracao_sistema(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_configuracao_sistema(text,text) TO service_role;

COMMIT;

-- ============================================================================
-- VERIFICAÇÃO PÓS-APLICAÇÃO (read-only) — deve retornar 0 linhas
-- ============================================================================
-- select p.oid::regprocedure::text as assinatura,
--        has_function_privilege('anon', p.oid, 'EXECUTE') as anon_ainda_executa
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.oid::regprocedure::text in (
--     'update_profile_funcionario_id(uuid,uuid)','liberar_proxima_etapa_dinamica(uuid)',
--     'merge_duplicate_funcionarios()','sync_presencas_valores_funcao()',
--     'sync_convocados_pre_valores()','fn_arquivar_auditoria_log(integer)',
--     'fn_ct_registrar_assinatura(uuid,uuid,text)','fn_registrar_nonce_atestado(uuid,uuid,inet)',
--     'fn_rate_limit_check(text,text,text,integer,integer,integer)',
--     'garantir_registro_aplicacao_principal(uuid,uuid,date,time without time zone,uuid)',
--     'sync_profile_funcao_sistema(uuid)','fn_ponto_diaria_simular_batida(uuid)',
--     'check_vistorias_sso_pendentes()','gerenciar_convocado_diaria(uuid,jsonb,text)',
--     'gerenciar_convocado_diaria_no_dia(uuid,jsonb,date,text)','rbac_auto_migrate_user(uuid)',
--     'finalizar_carga_manual(uuid)','finalizar_carga_aplicacao(uuid)',
--     'sincronizar_hora_saida_aplicacao(uuid)','fn_calcular_nota_checklist(uuid)',
--     'fn_relatorio_aps_definir_carimbo_padrao(uuid,uuid)',
--     'fn_relatorio_aps_desvincular_padrao(uuid)',
--     'fn_relatorio_aps_inativar_carimbo(uuid,timestamp with time zone)',
--     'update_configuracao_sistema(text,text)')
--   and has_function_privilege('anon', p.oid, 'EXECUTE');
-- ============================================================================
