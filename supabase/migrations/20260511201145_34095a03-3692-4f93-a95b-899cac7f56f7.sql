
REVOKE EXECUTE ON FUNCTION public.fn_calcular_hash_lote(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_solicitacao_tem_lote_pendente(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.enviar_lote_para_aprovacao(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.aprovar_lote_diaria(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rejeitar_lote_diaria(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancelar_lote_diaria(uuid, text) FROM anon;
