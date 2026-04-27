-- Fase 2: Hardening da view central de auditoria
-- 1) Aplicar security_invoker para que a view respeite RLS das tabelas-fonte
ALTER VIEW public.vw_auditoria_sistema SET (security_invoker = true);

-- 2) Revogar acesso direto: front-end consome via RPC get_auditoria_sistema*
REVOKE ALL ON public.vw_auditoria_sistema FROM PUBLIC;
REVOKE ALL ON public.vw_auditoria_sistema FROM anon;
REVOKE ALL ON public.vw_auditoria_sistema FROM authenticated;

-- 3) Manter acesso para service_role (RPCs SECURITY DEFINER continuam funcionando)
GRANT SELECT ON public.vw_auditoria_sistema TO service_role;

-- 4) Documentar mudança
COMMENT ON VIEW public.vw_auditoria_sistema IS
  'Central de auditoria. Acesso direto revogado em 2026-04-26 (Fase 2 hardening). security_invoker=true. Consumir via RPCs get_auditoria_sistema_* (SECURITY DEFINER).';