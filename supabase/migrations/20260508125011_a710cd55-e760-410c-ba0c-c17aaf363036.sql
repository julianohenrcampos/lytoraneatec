DROP POLICY IF EXISTS "Authenticated read logs" ON public.bd_integracao_fornecedores_log;

CREATE POLICY "Restricted read integration logs"
ON public.bd_integracao_fornecedores_log
FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.has_role('SuperAdm', auth.uid())
  OR public.has_role('AdmLogistica', auth.uid())
  OR public.has_role('Financeiro', auth.uid())
);