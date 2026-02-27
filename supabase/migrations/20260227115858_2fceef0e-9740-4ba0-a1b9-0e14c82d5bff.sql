
-- =====================================================
-- MIGRAÇÃO: Restringir RLS de Diárias por papel do usuário
-- =====================================================

-- Helper function to check if user is AdmSSO
CREATE OR REPLACE FUNCTION public.check_is_admsso(user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = user_id
    AND 'AdmSSO' = ANY(p.funcoes)
  );
$$;

-- Helper: get funcionario_id for current user
CREATE OR REPLACE FUNCTION public.get_user_funcionario_id(user_id uuid DEFAULT auth.uid())
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.funcionario_id FROM profiles p WHERE p.id = user_id LIMIT 1;
$$;

-- =====================================================
-- 1. bd_diaria_solicitacoes - SELECT
-- =====================================================
DROP POLICY IF EXISTS "diaria_solicitacoes_select" ON bd_diaria_solicitacoes;
CREATE POLICY "diaria_solicitacoes_select" ON bd_diaria_solicitacoes
FOR SELECT TO authenticated
USING (
  -- SuperAdm: tudo
  check_is_super_admin(auth.uid())
  -- AdmSSO: tudo
  OR check_is_admsso(auth.uid())
  -- Criador: suas próprias
  OR criado_por = auth.uid()
  -- Apontador: solicitações onde é responsável_campo
  OR responsavel_campo_id = get_user_funcionario_id(auth.uid())
  -- GerenteRegional: centros de custo sob sua gestão
  OR EXISTS (
    SELECT 1 FROM bd_centros_custo cc
    WHERE cc.id = bd_diaria_solicitacoes.centro_custo_id
    AND cc.aprovador_diarias_id = get_user_funcionario_id(auth.uid())
  )
);

-- =====================================================
-- 2. bd_diaria_apontamentos - SELECT
-- =====================================================
DROP POLICY IF EXISTS "apontamentos_select" ON bd_diaria_apontamentos;
CREATE POLICY "apontamentos_select" ON bd_diaria_apontamentos
FOR SELECT TO authenticated
USING (
  check_is_super_admin(auth.uid())
  OR check_is_admsso(auth.uid())
  -- Responsável campo
  OR responsavel_campo_id = get_user_funcionario_id(auth.uid())
  -- Criador da solicitação
  OR EXISTS (
    SELECT 1 FROM bd_diaria_solicitacoes s
    WHERE s.id = bd_diaria_apontamentos.solicitacao_id AND s.criado_por = auth.uid()
  )
  -- GerenteRegional: centro de custo aprovador
  OR EXISTS (
    SELECT 1 FROM bd_diaria_solicitacoes s
    JOIN bd_centros_custo cc ON cc.id = s.centro_custo_id
    WHERE s.id = bd_diaria_apontamentos.solicitacao_id
    AND cc.aprovador_diarias_id = get_user_funcionario_id(auth.uid())
  )
);

-- =====================================================
-- 3. bd_diaria_apontamentos - UPDATE (restringir)
-- =====================================================
DROP POLICY IF EXISTS "apontamentos_update" ON bd_diaria_apontamentos;
CREATE POLICY "apontamentos_update" ON bd_diaria_apontamentos
FOR UPDATE TO authenticated
USING (
  check_is_super_admin(auth.uid())
  -- Responsável campo pode atualizar seus apontamentos
  OR responsavel_campo_id = get_user_funcionario_id(auth.uid())
);

-- =====================================================
-- 4. bd_diaria_presencas - DROP ALL e recriar
-- =====================================================
DROP POLICY IF EXISTS "Usuários autenticados podem ver presenças" ON bd_diaria_presencas;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir presenças" ON bd_diaria_presencas;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar presenças" ON bd_diaria_presencas;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar presenças" ON bd_diaria_presencas;

-- SELECT: mesma lógica de escopo
CREATE POLICY "presencas_select" ON bd_diaria_presencas
FOR SELECT TO authenticated
USING (
  check_is_super_admin(auth.uid())
  OR check_is_admsso(auth.uid())
  -- Criador da solicitação
  OR EXISTS (
    SELECT 1 FROM bd_diaria_solicitacoes s
    WHERE s.id = bd_diaria_presencas.solicitacao_id AND s.criado_por = auth.uid()
  )
  -- Responsável campo da solicitação
  OR EXISTS (
    SELECT 1 FROM bd_diaria_solicitacoes s
    WHERE s.id = bd_diaria_presencas.solicitacao_id
    AND s.responsavel_campo_id = get_user_funcionario_id(auth.uid())
  )
  -- GerenteRegional
  OR EXISTS (
    SELECT 1 FROM bd_diaria_solicitacoes s
    JOIN bd_centros_custo cc ON cc.id = s.centro_custo_id
    WHERE s.id = bd_diaria_presencas.solicitacao_id
    AND cc.aprovador_diarias_id = get_user_funcionario_id(auth.uid())
  )
);

-- INSERT: responsável campo ou admin
CREATE POLICY "presencas_insert" ON bd_diaria_presencas
FOR INSERT TO authenticated
WITH CHECK (
  check_is_super_admin(auth.uid())
  OR check_is_admsso(auth.uid())
  -- Responsável campo da solicitação
  OR EXISTS (
    SELECT 1 FROM bd_diaria_solicitacoes s
    WHERE s.id = bd_diaria_presencas.solicitacao_id
    AND s.responsavel_campo_id = get_user_funcionario_id(auth.uid())
  )
  -- Criador da solicitação
  OR EXISTS (
    SELECT 1 FROM bd_diaria_solicitacoes s
    WHERE s.id = bd_diaria_presencas.solicitacao_id AND s.criado_por = auth.uid()
  )
);

-- UPDATE: responsável campo ou admin
CREATE POLICY "presencas_update" ON bd_diaria_presencas
FOR UPDATE TO authenticated
USING (
  check_is_super_admin(auth.uid())
  OR check_is_admsso(auth.uid())
  -- Responsável campo
  OR EXISTS (
    SELECT 1 FROM bd_diaria_solicitacoes s
    WHERE s.id = bd_diaria_presencas.solicitacao_id
    AND s.responsavel_campo_id = get_user_funcionario_id(auth.uid())
  )
);

-- DELETE: apenas admin
CREATE POLICY "presencas_delete" ON bd_diaria_presencas
FOR DELETE TO authenticated
USING (
  check_is_super_admin(auth.uid())
  OR check_is_admsso(auth.uid())
);
