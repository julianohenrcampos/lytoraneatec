REVOKE ALL ON FUNCTION public.fn_aprovacao_resolver_fluxo(text,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_aprovacao_resolver_aprovador(text,uuid,jsonb,uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_aprovacao_corporativa_iniciar(text,uuid,uuid,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_aprovacao_corporativa_status(text,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_aprovacao_corporativa_decidir_core(text,uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.fn_aprovacao_resolver_fluxo(text,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_aprovacao_resolver_aprovador(text,uuid,jsonb,uuid,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_aprovacao_corporativa_iniciar(text,uuid,uuid,jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_aprovacao_corporativa_status(text,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_aprovacao_corporativa_decidir_core(text,uuid,uuid,text,text) TO service_role;