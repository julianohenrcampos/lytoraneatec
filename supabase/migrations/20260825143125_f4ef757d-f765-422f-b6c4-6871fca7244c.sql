
ALTER VIEW public.vw_qc_cc_ctx SET (security_invoker = true);
ALTER VIEW public.vw_qc_registros SET (security_invoker = true);
ALTER VIEW public.vw_qc_pendencias_raw SET (security_invoker = true);
ALTER VIEW public.vw_qc_pendencias SET (security_invoker = true);

REVOKE ALL ON public.vw_qc_cc_ctx FROM anon, authenticated;
REVOKE ALL ON public.vw_qc_registros FROM anon, authenticated;
REVOKE ALL ON public.vw_qc_pendencias_raw FROM anon, authenticated;
REVOKE ALL ON public.vw_qc_pendencias FROM anon, authenticated;
