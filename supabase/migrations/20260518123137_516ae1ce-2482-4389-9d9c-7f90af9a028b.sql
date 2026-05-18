REVOKE EXECUTE ON FUNCTION public.fn_ponto_diaria_integrar_batida(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_ponto_diaria_integrar_batida(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_ponto_diaria_integrar_batida(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ponto_diaria_integrar_batida(uuid) TO service_role;