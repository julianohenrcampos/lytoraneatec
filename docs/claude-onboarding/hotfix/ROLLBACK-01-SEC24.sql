-- ============================================================================
-- ROLLBACK-01-SEC24 — Restaura EXATAMENTE o estado de grants anterior
-- ============================================================================
-- STATUS: PROPOSTA. **NÃO APLICADA.**
--
-- Reconstruído a partir do proacl vivo capturado em 2026-08-31:
--   Padrão A (16 funções): {=X/postgres, postgres=X/postgres, anon=X/postgres,
--                           authenticated=X/postgres, service_role=X/postgres}
--                          => PUBLIC + anon + authenticated + service_role
--   Padrão B (9 funções):  {postgres=X/postgres, anon=X/postgres,
--                           authenticated=X/postgres, service_role=X/postgres}
--                          => anon + authenticated + service_role (SEM PUBLIC)
--
-- `postgres` é o owner e mantém EXECUTE implicitamente — não é re-concedido.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- PADRÃO A — restaurar PUBLIC + anon + authenticated + service_role
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.update_profile_funcionario_id(uuid,uuid) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.liberar_proxima_etapa_dinamica(uuid) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.merge_duplicate_funcionarios() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_presencas_valores_funcao() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_convocados_pre_valores() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_profile_funcao_sistema(uuid) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_vistorias_sso_pendentes() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.garantir_registro_aplicacao_principal(uuid,uuid,date,time without time zone,uuid) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_backend_audit_event(uuid,text,text,text,text,text,text,text,text,boolean,boolean,integer,inet,text,jsonb,jsonb,text) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_calcular_nota_checklist(uuid) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finalizar_carga_aplicacao(uuid) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finalizar_carga_manual(uuid) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gerenciar_convocado_diaria(uuid,jsonb,text) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gerenciar_convocado_diaria_no_dia(uuid,jsonb,date,text) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rbac_auto_migrate_user(uuid) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sincronizar_hora_saida_aplicacao(uuid) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_configuracao_sistema(text,text) TO PUBLIC, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- PADRÃO B — restaurar anon + authenticated + service_role (sem PUBLIC)
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.fn_arquivar_auditoria_log(integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_ct_registrar_assinatura(uuid,uuid,text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_ponto_diaria_simular_batida(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_rate_limit_check(text,text,text,integer,integer,integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_registrar_nonce_atestado(uuid,uuid,inet) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_relatorio_aps_definir_carimbo_padrao(uuid,uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_relatorio_aps_desvincular_padrao(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_relatorio_aps_inativar_carimbo(uuid,timestamp with time zone) TO anon, authenticated, service_role;

COMMIT;

-- ============================================================================
-- CAPTURA DE ESTADO ANTES DE APLICAR O HOTFIX (executar e guardar a saída)
-- ============================================================================
-- select p.oid::regprocedure::text as assinatura, p.proacl::text as proacl_original
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' and p.proname in (
--   'update_profile_funcionario_id','liberar_proxima_etapa_dinamica','merge_duplicate_funcionarios',
--   'sync_presencas_valores_funcao','sync_convocados_pre_valores','sync_profile_funcao_sistema',
--   'check_vistorias_sso_pendentes','garantir_registro_aplicacao_principal','fn_backend_audit_event',
--   'fn_calcular_nota_checklist','finalizar_carga_aplicacao','finalizar_carga_manual',
--   'gerenciar_convocado_diaria','gerenciar_convocado_diaria_no_dia','rbac_auto_migrate_user',
--   'sincronizar_hora_saida_aplicacao','update_configuracao_sistema','fn_arquivar_auditoria_log',
--   'fn_ct_registrar_assinatura','fn_ponto_diaria_simular_batida','fn_rate_limit_check',
--   'fn_registrar_nonce_atestado','fn_relatorio_aps_definir_carimbo_padrao',
--   'fn_relatorio_aps_desvincular_padrao','fn_relatorio_aps_inativar_carimbo')
-- order by 1;
-- ============================================================================
