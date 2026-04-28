-- =========================================================================
-- Frente 3 — RLS de bd_diaria_presencas via RBAC centralizado (sem hardcode)
-- =========================================================================
-- Mantém policy DELETE legada intacta para evitar regressão.
-- =========================================================================

-- SELECT
DROP POLICY IF EXISTS presencas_select ON public.bd_diaria_presencas;
CREATE POLICY presencas_select
  ON public.bd_diaria_presencas
  FOR SELECT
  TO authenticated
  USING ( public.fn_diaria_can_select_row(solicitacao_id, auth.uid()) );

-- INSERT
DROP POLICY IF EXISTS presencas_insert ON public.bd_diaria_presencas;
CREATE POLICY presencas_insert
  ON public.bd_diaria_presencas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.fn_diaria_can_update_row(solicitacao_id, auth.uid())
    OR (
      public.fn_has_permission('diarias_apontamento_view', auth.uid())
      AND public.fn_diaria_can_select_row(solicitacao_id, auth.uid())
    )
  );

-- UPDATE
DROP POLICY IF EXISTS presencas_update ON public.bd_diaria_presencas;
CREATE POLICY presencas_update
  ON public.bd_diaria_presencas
  FOR UPDATE
  TO authenticated
  USING (
    public.fn_diaria_can_update_row(solicitacao_id, auth.uid())
    OR (
      public.fn_has_permission('diarias_apontamento_view', auth.uid())
      AND public.fn_diaria_can_select_row(solicitacao_id, auth.uid())
    )
  )
  WITH CHECK (
    public.fn_diaria_can_update_row(solicitacao_id, auth.uid())
    OR (
      public.fn_has_permission('diarias_apontamento_view', auth.uid())
      AND public.fn_diaria_can_select_row(solicitacao_id, auth.uid())
    )
  );

COMMENT ON POLICY presencas_select ON public.bd_diaria_presencas IS
  'Quem pode visualizar a solicitação pode ler suas presenças (via fn_diaria_can_select_row).';
COMMENT ON POLICY presencas_insert ON public.bd_diaria_presencas IS
  'Quem pode atualizar a solicitação OU tem permissão diarias_apontamento_view + acesso de leitura pode gravar presença. Sem hardcode de cargo.';
COMMENT ON POLICY presencas_update ON public.bd_diaria_presencas IS
  'Mesma regra do INSERT: usado para apontamento e finalização. Sem hardcode de cargo.';