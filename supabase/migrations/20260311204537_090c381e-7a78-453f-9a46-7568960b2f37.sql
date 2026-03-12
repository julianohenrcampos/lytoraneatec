
-- Criar função check_is_admsso para verificar se usuário tem papel AdmSSO ou AdmOBRA
CREATE OR REPLACE FUNCTION public.check_is_admsso(user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = user_id
      AND (
        'AdmSSO' = ANY(p.funcoes)
        OR 'AdmOBRA' = ANY(p.funcoes)
      )
  );
$$;

-- Atualizar policy SELECT de bd_diaria_presencas para incluir AdmSSO/AdmOBRA
DROP POLICY IF EXISTS "presencas_select" ON bd_diaria_presencas;
CREATE POLICY "presencas_select" ON bd_diaria_presencas
FOR SELECT TO authenticated
USING (
  check_is_super_admin(auth.uid())
  OR check_is_admsso(auth.uid())
  OR (EXISTS (
    SELECT 1 FROM bd_diaria_solicitacoes s
    WHERE s.id = bd_diaria_presencas.solicitacao_id AND s.criado_por = auth.uid()
  ))
  OR (EXISTS (
    SELECT 1 FROM bd_diaria_solicitacoes s
    WHERE s.id = bd_diaria_presencas.solicitacao_id AND s.responsavel_campo_id = get_user_funcionario_id(auth.uid())
  ))
  OR (EXISTS (
    SELECT 1 FROM bd_diaria_solicitacoes s
    JOIN bd_centros_custo cc ON cc.id = s.centro_custo_id
    WHERE s.id = bd_diaria_presencas.solicitacao_id AND cc.aprovador_diarias_id = get_user_funcionario_id(auth.uid())
  ))
);

-- Atualizar policy UPDATE de bd_diaria_presencas para incluir AdmSSO/AdmOBRA
DROP POLICY IF EXISTS "presencas_update" ON bd_diaria_presencas;
CREATE POLICY "presencas_update" ON bd_diaria_presencas
FOR UPDATE TO authenticated
USING (
  check_is_super_admin(auth.uid())
  OR check_is_admsso(auth.uid())
  OR (EXISTS (
    SELECT 1 FROM bd_diaria_solicitacoes s
    WHERE s.id = bd_diaria_presencas.solicitacao_id AND s.responsavel_campo_id = get_user_funcionario_id(auth.uid())
  ))
  OR (EXISTS (
    SELECT 1 FROM bd_diaria_solicitacoes s
    WHERE s.id = bd_diaria_presencas.solicitacao_id AND s.criado_por = auth.uid()
  ))
)
WITH CHECK (
  check_is_super_admin(auth.uid())
  OR check_is_admsso(auth.uid())
  OR (EXISTS (
    SELECT 1 FROM bd_diaria_solicitacoes s
    WHERE s.id = bd_diaria_presencas.solicitacao_id AND s.responsavel_campo_id = get_user_funcionario_id(auth.uid())
  ))
  OR (EXISTS (
    SELECT 1 FROM bd_diaria_solicitacoes s
    WHERE s.id = bd_diaria_presencas.solicitacao_id AND s.criado_por = auth.uid()
  ))
);

-- Atualizar policy INSERT de bd_diaria_presencas para incluir AdmSSO/AdmOBRA
DROP POLICY IF EXISTS "presencas_insert" ON bd_diaria_presencas;
CREATE POLICY "presencas_insert" ON bd_diaria_presencas
FOR INSERT TO authenticated
WITH CHECK (
  check_is_super_admin(auth.uid())
  OR check_is_admsso(auth.uid())
  OR (EXISTS (
    SELECT 1 FROM bd_diaria_solicitacoes s
    WHERE s.id = bd_diaria_presencas.solicitacao_id AND s.responsavel_campo_id = get_user_funcionario_id(auth.uid())
  ))
  OR (EXISTS (
    SELECT 1 FROM bd_diaria_solicitacoes s
    WHERE s.id = bd_diaria_presencas.solicitacao_id AND s.criado_por = auth.uid()
  ))
);
