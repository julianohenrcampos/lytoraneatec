
-- Fix: remover check_is_admsso que persistiu nas políticas

-- bd_diaria_solicitacoes SELECT (ainda mostra check_is_admsso)
DROP POLICY IF EXISTS "diaria_solicitacoes_select" ON bd_diaria_solicitacoes;
CREATE POLICY "diaria_solicitacoes_select" ON bd_diaria_solicitacoes
FOR SELECT TO authenticated
USING (
  check_is_super_admin(auth.uid())
  OR criado_por = auth.uid()
  OR responsavel_campo_id = get_user_funcionario_id(auth.uid())
  OR EXISTS (
    SELECT 1 FROM bd_centros_custo cc
    WHERE cc.id = bd_diaria_solicitacoes.centro_custo_id
    AND cc.aprovador_diarias_id = get_user_funcionario_id(auth.uid())
  )
);

-- bd_diaria_presencas - recriar todas sem check_is_admsso
DROP POLICY IF EXISTS "presencas_select" ON bd_diaria_presencas;
CREATE POLICY "presencas_select" ON bd_diaria_presencas
FOR SELECT TO authenticated
USING (
  check_is_super_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM bd_diaria_solicitacoes s WHERE s.id = solicitacao_id AND s.criado_por = auth.uid())
  OR EXISTS (SELECT 1 FROM bd_diaria_solicitacoes s WHERE s.id = solicitacao_id AND s.responsavel_campo_id = get_user_funcionario_id(auth.uid()))
  OR EXISTS (
    SELECT 1 FROM bd_diaria_solicitacoes s
    JOIN bd_centros_custo cc ON cc.id = s.centro_custo_id
    WHERE s.id = solicitacao_id AND cc.aprovador_diarias_id = get_user_funcionario_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "presencas_insert" ON bd_diaria_presencas;
CREATE POLICY "presencas_insert" ON bd_diaria_presencas
FOR INSERT TO authenticated
WITH CHECK (
  check_is_super_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM bd_diaria_solicitacoes s WHERE s.id = solicitacao_id AND s.responsavel_campo_id = get_user_funcionario_id(auth.uid()))
  OR EXISTS (SELECT 1 FROM bd_diaria_solicitacoes s WHERE s.id = solicitacao_id AND s.criado_por = auth.uid())
);

DROP POLICY IF EXISTS "presencas_update" ON bd_diaria_presencas;
CREATE POLICY "presencas_update" ON bd_diaria_presencas
FOR UPDATE TO authenticated
USING (
  check_is_super_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM bd_diaria_solicitacoes s WHERE s.id = solicitacao_id AND s.responsavel_campo_id = get_user_funcionario_id(auth.uid()))
)
WITH CHECK (
  check_is_super_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM bd_diaria_solicitacoes s WHERE s.id = solicitacao_id AND s.responsavel_campo_id = get_user_funcionario_id(auth.uid()))
);

DROP POLICY IF EXISTS "presencas_delete" ON bd_diaria_presencas;
CREATE POLICY "presencas_delete" ON bd_diaria_presencas
FOR DELETE TO authenticated
USING (check_is_super_admin(auth.uid()));

-- bd_diaria_apontamentos SELECT (remover check_is_admsso se presente)
DROP POLICY IF EXISTS "apontamentos_select" ON bd_diaria_apontamentos;
CREATE POLICY "apontamentos_select" ON bd_diaria_apontamentos
FOR SELECT TO authenticated
USING (
  check_is_super_admin(auth.uid())
  OR responsavel_campo_id = get_user_funcionario_id(auth.uid())
  OR EXISTS (SELECT 1 FROM bd_diaria_solicitacoes s WHERE s.id = solicitacao_id AND s.criado_por = auth.uid())
  OR EXISTS (
    SELECT 1 FROM bd_diaria_solicitacoes s
    JOIN bd_centros_custo cc ON cc.id = s.centro_custo_id
    WHERE s.id = solicitacao_id AND cc.aprovador_diarias_id = get_user_funcionario_id(auth.uid())
  )
);
