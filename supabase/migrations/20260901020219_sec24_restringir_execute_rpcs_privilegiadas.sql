-- SEC-24 — Restringe EXECUTE de RPCs privilegiadas (SECURITY DEFINER, mutantes)
--
-- Contexto: as funções abaixo são SECURITY DEFINER com owner `postgres`
-- (rolbypassrls = true), portanto contornam RLS inclusive em tabelas com
-- FORCE ROW LEVEL SECURITY. Todas estavam com EXECUTE efetivo para `anon`.
--
-- 16 delas tinham EXECUTE para PUBLIC; nessas, revogar apenas de `anon` não
-- surtiria efeito, pois `anon` herda de PUBLIC. Por isso revoga-se de PUBLIC e anon.
--
-- MODELO A (14 funções): sem caller no frontend. Somente service_role.
-- MODELO B (10 funções): com caller no frontend autenticado. Mantém authenticated.
--
-- Cadeia SQL preservada: todas as chamadoras internas são SECURITY DEFINER com
-- owner `postgres` (verificado em pg_proc; zero chamadoras SECURITY INVOKER),
-- e triggers têm EXECUTE validado em CREATE TRIGGER, não a cada disparo.
--
-- Rollback: docs/claude-onboarding/hotfix/ROLLBACK-01-SEC24.sql
-- Snapshot ACL anterior: docs/claude-onboarding/hotfix/SEC24-ACL-ANTES.md
--
-- NAO altera: corpo de função, retorno, parâmetros, tabelas, colunas, RLS,
-- policies, triggers, permissões do RBAC. Somente ACL de EXECUTE.
--
-- update_configuracao_sistema(text,text) NAO é alterada: possui gate interno
-- fn_ponto_is_superadmin() e foi classificada FALSO POSITIVO.

-- ===========================================================================
-- MODELO A — apenas service_role
-- ===========================================================================

-- A1 update_profile_funcionario_id — CRÍTICO
REVOKE EXECUTE ON FUNCTION public.update_profile_funcionario_id(uuid,uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_profile_funcionario_id(uuid,uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_profile_funcionario_id(uuid,uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.update_profile_funcionario_id(uuid,uuid) TO service_role;

-- A2 liberar_proxima_etapa_dinamica — CRÍTICO
REVOKE EXECUTE ON FUNCTION public.liberar_proxima_etapa_dinamica(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.liberar_proxima_etapa_dinamica(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.liberar_proxima_etapa_dinamica(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.liberar_proxima_etapa_dinamica(uuid) TO service_role;

-- A3 merge_duplicate_funcionarios — CRÍTICO
REVOKE EXECUTE ON FUNCTION public.merge_duplicate_funcionarios() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.merge_duplicate_funcionarios() FROM anon;
REVOKE EXECUTE ON FUNCTION public.merge_duplicate_funcionarios() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.merge_duplicate_funcionarios() TO service_role;

-- A4 sync_presencas_valores_funcao — ALTO
REVOKE EXECUTE ON FUNCTION public.sync_presencas_valores_funcao() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_presencas_valores_funcao() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_presencas_valores_funcao() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sync_presencas_valores_funcao() TO service_role;

-- A5 sync_convocados_pre_valores — ALTO
REVOKE EXECUTE ON FUNCTION public.sync_convocados_pre_valores() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_convocados_pre_valores() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_convocados_pre_valores() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sync_convocados_pre_valores() TO service_role;

-- A6 fn_arquivar_auditoria_log — ALTO (caller: pg_cron jobid=3, roda como postgres)
REVOKE EXECUTE ON FUNCTION public.fn_arquivar_auditoria_log(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_arquivar_auditoria_log(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_arquivar_auditoria_log(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_arquivar_auditoria_log(integer) TO service_role;

-- A7 fn_backend_audit_event — ALTO (caller: _shared/backend-security.ts, service_role)
REVOKE EXECUTE ON FUNCTION public.fn_backend_audit_event(uuid,text,text,text,text,text,text,text,text,boolean,boolean,integer,inet,text,jsonb,jsonb,text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_backend_audit_event(uuid,text,text,text,text,text,text,text,text,boolean,boolean,integer,inet,text,jsonb,jsonb,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_backend_audit_event(uuid,text,text,text,text,text,text,text,text,boolean,boolean,integer,inet,text,jsonb,jsonb,text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_backend_audit_event(uuid,text,text,text,text,text,text,text,text,boolean,boolean,integer,inet,text,jsonb,jsonb,text) TO service_role;

-- A8 fn_ct_registrar_assinatura — ALTO (caller: fn_ct_checklist_saida_salvar, SECURITY DEFINER)
REVOKE EXECUTE ON FUNCTION public.fn_ct_registrar_assinatura(uuid,uuid,text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_ct_registrar_assinatura(uuid,uuid,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_ct_registrar_assinatura(uuid,uuid,text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ct_registrar_assinatura(uuid,uuid,text) TO service_role;

-- A9 fn_registrar_nonce_atestado — ALTO (caller: Edge atestado-submeter, service_role)
REVOKE EXECUTE ON FUNCTION public.fn_registrar_nonce_atestado(uuid,uuid,inet) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_registrar_nonce_atestado(uuid,uuid,inet) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_registrar_nonce_atestado(uuid,uuid,inet) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_registrar_nonce_atestado(uuid,uuid,inet) TO service_role;

-- A10 fn_rate_limit_check — ALTO (caller: Edge atestado-validar-matricula, service_role)
REVOKE EXECUTE ON FUNCTION public.fn_rate_limit_check(text,text,text,integer,integer,integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_rate_limit_check(text,text,text,integer,integer,integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_rate_limit_check(text,text,text,integer,integer,integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_rate_limit_check(text,text,text,integer,integer,integer) TO service_role;

-- A11 garantir_registro_aplicacao_principal — MÉDIO (caller: criar_aplicacao_por_rua, SECURITY DEFINER)
REVOKE EXECUTE ON FUNCTION public.garantir_registro_aplicacao_principal(uuid,uuid,date,time without time zone,uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.garantir_registro_aplicacao_principal(uuid,uuid,date,time without time zone,uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.garantir_registro_aplicacao_principal(uuid,uuid,date,time without time zone,uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.garantir_registro_aplicacao_principal(uuid,uuid,date,time without time zone,uuid) TO service_role;

-- A12 sync_profile_funcao_sistema — MÉDIO (usada por 2 triggers SECURITY DEFINER)
REVOKE EXECUTE ON FUNCTION public.sync_profile_funcao_sistema(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_profile_funcao_sistema(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_profile_funcao_sistema(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sync_profile_funcao_sistema(uuid) TO service_role;

-- A13 fn_ponto_diaria_simular_batida — MÉDIO (caller: fn_ponto_diaria_simular_lote, SECURITY DEFINER)
REVOKE EXECUTE ON FUNCTION public.fn_ponto_diaria_simular_batida(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_ponto_diaria_simular_batida(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_ponto_diaria_simular_batida(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ponto_diaria_simular_batida(uuid) TO service_role;

-- A14 check_vistorias_sso_pendentes — MÉDIO (sem caller identificado)
REVOKE EXECUTE ON FUNCTION public.check_vistorias_sso_pendentes() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_vistorias_sso_pendentes() FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_vistorias_sso_pendentes() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.check_vistorias_sso_pendentes() TO service_role;

-- ===========================================================================
-- MODELO B — authenticated + service_role
-- ===========================================================================

-- B1 gerenciar_convocado_diaria — caller: src/services/diarias/solicitacoesService.ts
REVOKE EXECUTE ON FUNCTION public.gerenciar_convocado_diaria(uuid,jsonb,text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.gerenciar_convocado_diaria(uuid,jsonb,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.gerenciar_convocado_diaria(uuid,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gerenciar_convocado_diaria(uuid,jsonb,text) TO service_role;

-- B2 gerenciar_convocado_diaria_no_dia — caller: src/services/diarias/solicitacoesService.ts
REVOKE EXECUTE ON FUNCTION public.gerenciar_convocado_diaria_no_dia(uuid,jsonb,date,text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.gerenciar_convocado_diaria_no_dia(uuid,jsonb,date,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.gerenciar_convocado_diaria_no_dia(uuid,jsonb,date,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gerenciar_convocado_diaria_no_dia(uuid,jsonb,date,text) TO service_role;

-- B3 rbac_auto_migrate_user — caller: src/services/accessControl/autoMigrationService.ts
REVOKE EXECUTE ON FUNCTION public.rbac_auto_migrate_user(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rbac_auto_migrate_user(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.rbac_auto_migrate_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rbac_auto_migrate_user(uuid) TO service_role;

-- B4 finalizar_carga_manual — caller: src/services/registro-aplicacao/manualFinalizationService.ts
REVOKE EXECUTE ON FUNCTION public.finalizar_carga_manual(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.finalizar_carga_manual(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.finalizar_carga_manual(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalizar_carga_manual(uuid) TO service_role;

-- B5 finalizar_carga_aplicacao — callers: useAplicacoesMultiplas.ts, registroAplicacaoDetalhesService.ts
REVOKE EXECUTE ON FUNCTION public.finalizar_carga_aplicacao(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.finalizar_carga_aplicacao(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.finalizar_carga_aplicacao(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalizar_carga_aplicacao(uuid) TO service_role;

-- B6 sincronizar_hora_saida_aplicacao — caller: src/hooks/registro-aplicacao/useNovoRegistroForm.ts
REVOKE EXECUTE ON FUNCTION public.sincronizar_hora_saida_aplicacao(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sincronizar_hora_saida_aplicacao(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.sincronizar_hora_saida_aplicacao(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sincronizar_hora_saida_aplicacao(uuid) TO service_role;

-- B7 fn_calcular_nota_checklist — caller: src/services/sso/ssoChecklistService.ts
REVOKE EXECUTE ON FUNCTION public.fn_calcular_nota_checklist(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_calcular_nota_checklist(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_calcular_nota_checklist(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_calcular_nota_checklist(uuid) TO service_role;

-- B8 fn_relatorio_aps_definir_carimbo_padrao — caller: relatorioApsCarimbosService.ts
REVOKE EXECUTE ON FUNCTION public.fn_relatorio_aps_definir_carimbo_padrao(uuid,uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_relatorio_aps_definir_carimbo_padrao(uuid,uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_relatorio_aps_definir_carimbo_padrao(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_relatorio_aps_definir_carimbo_padrao(uuid,uuid) TO service_role;

-- B9 fn_relatorio_aps_desvincular_padrao — caller: relatorioApsCarimbosService.ts
REVOKE EXECUTE ON FUNCTION public.fn_relatorio_aps_desvincular_padrao(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_relatorio_aps_desvincular_padrao(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_relatorio_aps_desvincular_padrao(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_relatorio_aps_desvincular_padrao(uuid) TO service_role;

-- B10 fn_relatorio_aps_inativar_carimbo — caller: relatorioApsCarimbosService.ts
REVOKE EXECUTE ON FUNCTION public.fn_relatorio_aps_inativar_carimbo(uuid,timestamp with time zone) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_relatorio_aps_inativar_carimbo(uuid,timestamp with time zone) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_relatorio_aps_inativar_carimbo(uuid,timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_relatorio_aps_inativar_carimbo(uuid,timestamp with time zone) TO service_role;
