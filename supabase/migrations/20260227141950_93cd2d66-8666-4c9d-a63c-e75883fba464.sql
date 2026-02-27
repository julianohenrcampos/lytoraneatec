
-- Update apontamentos_update to allow solicitation creator to update
DROP POLICY IF EXISTS "apontamentos_update" ON bd_diaria_apontamentos;
CREATE POLICY "apontamentos_update" ON bd_diaria_apontamentos
FOR UPDATE TO authenticated
USING (
  check_is_super_admin(auth.uid())
  OR (responsavel_campo_id = get_user_funcionario_id(auth.uid()))
  OR (EXISTS (
    SELECT 1 FROM bd_diaria_solicitacoes s
    WHERE s.id = bd_diaria_apontamentos.solicitacao_id
      AND s.criado_por = auth.uid()
  ))
)
WITH CHECK (
  check_is_super_admin(auth.uid())
  OR (responsavel_campo_id = get_user_funcionario_id(auth.uid()))
  OR (EXISTS (
    SELECT 1 FROM bd_diaria_solicitacoes s
    WHERE s.id = bd_diaria_apontamentos.solicitacao_id
      AND s.criado_por = auth.uid()
  ))
);

-- Update presencas_update to allow solicitation creator to update
DROP POLICY IF EXISTS "presencas_update" ON bd_diaria_presencas;
CREATE POLICY "presencas_update" ON bd_diaria_presencas
FOR UPDATE TO authenticated
USING (
  check_is_super_admin(auth.uid())
  OR (EXISTS (
    SELECT 1 FROM bd_diaria_solicitacoes s
    WHERE s.id = bd_diaria_presencas.solicitacao_id
      AND s.responsavel_campo_id = get_user_funcionario_id(auth.uid())
  ))
  OR (EXISTS (
    SELECT 1 FROM bd_diaria_solicitacoes s
    WHERE s.id = bd_diaria_presencas.solicitacao_id
      AND s.criado_por = auth.uid()
  ))
)
WITH CHECK (
  check_is_super_admin(auth.uid())
  OR (EXISTS (
    SELECT 1 FROM bd_diaria_solicitacoes s
    WHERE s.id = bd_diaria_presencas.solicitacao_id
      AND s.responsavel_campo_id = get_user_funcionario_id(auth.uid())
  ))
  OR (EXISTS (
    SELECT 1 FROM bd_diaria_solicitacoes s
    WHERE s.id = bd_diaria_presencas.solicitacao_id
      AND s.criado_por = auth.uid()
  ))
);
