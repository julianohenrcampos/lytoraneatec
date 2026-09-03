GRANT EXECUTE ON FUNCTION public.fn_desmobilizacao_solicitar(uuid, uuid, uuid, date, time without time zone, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_desmobilizacao_decidir(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_desmobilizacao_cancelar(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_desmobilizacao_concluir(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_desmob_aplicar_previsao(uuid, date, text) TO service_role;