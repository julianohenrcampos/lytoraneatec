
-- =====================================================
-- Remover acesso global AdmSSO das políticas RLS de Diárias
-- Apenas SuperAdm terá acesso global
-- =====================================================

-- 1. bd_diaria_solicitacoes SELECT
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

-- 2. bd_diaria_apontamentos SELECT
DROP POLICY IF EXISTS "apontamentos_select" ON bd_diaria_apontamentos;
CREATE POLICY "apontamentos_select" ON bd_diaria_apontamentos
FOR SELECT TO authenticated
USING (
  check_is_super_admin(auth.uid())
  OR responsavel_campo_id = get_user_funcionario_id(auth.uid())
  OR EXISTS (
    SELECT 1 FROM bd_diaria_solicitacoes s WHERE s.id = solicitacao_id AND s.criado_por = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM bd_diaria_solicitacoes s
    JOIN bd_centros_custo cc ON cc.id = s.centro_custo_id
    WHERE s.id = solicitacao_id AND cc.aprovador_diarias_id = get_user_funcionario_id(auth.uid())
  )
);

-- 3. bd_diaria_apontamentos UPDATE
DROP POLICY IF EXISTS "apontamentos_update" ON bd_diaria_apontamentos;
CREATE POLICY "apontamentos_update" ON bd_diaria_apontamentos
FOR UPDATE TO authenticated
USING (
  check_is_super_admin(auth.uid())
  OR responsavel_campo_id = get_user_funcionario_id(auth.uid())
)
WITH CHECK (
  check_is_super_admin(auth.uid())
  OR responsavel_campo_id = get_user_funcionario_id(auth.uid())
);

-- 4. bd_diaria_presencas SELECT
DROP POLICY IF EXISTS "presencas_select" ON bd_diaria_presencas;
CREATE POLICY "presencas_select" ON bd_diaria_presencas
FOR SELECT TO authenticated
USING (
  check_is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM bd_diaria_solicitacoes s WHERE s.id = solicitacao_id AND s.criado_por = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM bd_diaria_solicitacoes s WHERE s.id = solicitacao_id AND s.responsavel_campo_id = get_user_funcionario_id(auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM bd_diaria_solicitacoes s
    JOIN bd_centros_custo cc ON cc.id = s.centro_custo_id
    WHERE s.id = solicitacao_id AND cc.aprovador_diarias_id = get_user_funcionario_id(auth.uid())
  )
);

-- 5. bd_diaria_presencas INSERT
DROP POLICY IF EXISTS "presencas_insert" ON bd_diaria_presencas;
CREATE POLICY "presencas_insert" ON bd_diaria_presencas
FOR INSERT TO authenticated
WITH CHECK (
  check_is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM bd_diaria_solicitacoes s WHERE s.id = solicitacao_id AND s.responsavel_campo_id = get_user_funcionario_id(auth.uid())
  )
);

-- 6. bd_diaria_presencas UPDATE
DROP POLICY IF EXISTS "presencas_update" ON bd_diaria_presencas;
CREATE POLICY "presencas_update" ON bd_diaria_presencas
FOR UPDATE TO authenticated
USING (
  check_is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM bd_diaria_solicitacoes s WHERE s.id = solicitacao_id AND s.responsavel_campo_id = get_user_funcionario_id(auth.uid())
  )
)
WITH CHECK (
  check_is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM bd_diaria_solicitacoes s WHERE s.id = solicitacao_id AND s.responsavel_campo_id = get_user_funcionario_id(auth.uid())
  )
);

-- 7. bd_diaria_presencas DELETE
DROP POLICY IF EXISTS "presencas_delete" ON bd_diaria_presencas;
CREATE POLICY "presencas_delete" ON bd_diaria_presencas
FOR DELETE TO authenticated
USING (
  check_is_super_admin(auth.uid())
);
