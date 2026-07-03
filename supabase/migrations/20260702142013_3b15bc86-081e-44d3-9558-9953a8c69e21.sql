DROP POLICY IF EXISTS "Agendamentos exames: update apenas admins"
  ON public.bd_agendamentos_exames;

CREATE POLICY "Agendamentos exames: update com visibilidade restrita"
ON public.bd_agendamentos_exames
FOR UPDATE
TO authenticated
USING (
  has_sso_full_access(auth.uid())
  OR criado_por = auth.uid()
  OR public.fn_pode_ver_agendamento_exame_por_cc(contrato)
)
WITH CHECK (
  has_sso_full_access(auth.uid())
  OR criado_por = auth.uid()
  OR public.fn_pode_ver_agendamento_exame_por_cc(contrato)
);