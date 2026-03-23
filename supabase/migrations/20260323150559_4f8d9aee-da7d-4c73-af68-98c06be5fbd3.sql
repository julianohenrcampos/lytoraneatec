
-- 1. Create RPC to get AdmSede managed cost centers
CREATE OR REPLACE FUNCTION public.get_admsede_centros_custo(p_user_id UUID DEFAULT auth.uid())
RETURNS SETOF UUID AS $$
  SELECT cc.id
  FROM bd_centros_custo cc
  JOIN profiles p ON p.funcionario_id = cc.adm_sede_funcionario_id
  WHERE p.id = p_user_id AND cc.situacao = 'Ativo';
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- 2. Helper function: check if user is AdmSede for a given centro_custo_id
CREATE OR REPLACE FUNCTION public.is_admsede_for_cc(p_user_id UUID, p_cc_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM bd_centros_custo cc
    JOIN profiles p ON p.funcionario_id = cc.adm_sede_funcionario_id
    WHERE p.id = p_user_id AND cc.id = p_cc_id AND cc.situacao = 'Ativo'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- 3. Update has_sso_permission to include AdmSede
CREATE OR REPLACE FUNCTION public.has_sso_permission(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = p_user_id
    AND (
      'SuperAdm' = ANY(p.funcoes) OR
      'AdmSSO' = ANY(p.funcoes) OR
      'AdmOBRA' = ANY(p.funcoes) OR
      'TecSSO' = ANY(p.funcoes) OR
      'EnferAdm' = ANY(p.funcoes) OR
      'TecEnferSSO' = ANY(p.funcoes) OR
      'JovemAdm' = ANY(p.funcoes) OR
      'AdmTec' = ANY(p.funcoes) OR
      'ConsultaExames' = ANY(p.funcoes) OR
      'AdmtreinoSSO' = ANY(p.funcoes) OR
      'AdmSede' = ANY(p.funcoes)
    )
  );
$$;

-- 4. Update bd_funcionarios SELECT policy to include AdmSede (CC-scoped)
DROP POLICY IF EXISTS "Funcionários: acesso por papel e departamento" ON bd_funcionarios;

CREATE POLICY "Funcionários: acesso por papel e departamento" ON bd_funcionarios
FOR SELECT TO authenticated
USING (
  check_is_super_admin()
  OR (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.acesso_global = true))
  OR (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND 'AdmRH' = ANY(p.funcoes)))
  OR (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND ('AdmSSO' = ANY(p.funcoes) OR 'AdmOBRA' = ANY(p.funcoes))))
  OR (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND ('TecEnferSSO' = ANY(p.funcoes) OR 'ConsultaExames' = ANY(p.funcoes) OR 'AdmtreinoSSO' = ANY(p.funcoes))))
  OR (id = (SELECT profiles.funcionario_id FROM profiles WHERE profiles.id = auth.uid()))
  OR (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND 'AdmSede' = ANY(p.funcoes))
    AND centro_custo_id IN (SELECT get_admsede_centros_custo(auth.uid()))
  )
  OR (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid()
      AND ('TecSSO' = ANY(p.funcoes) OR 'AdmLogistica' = ANY(p.funcoes) OR 'AdmEquipamentos' = ANY(p.funcoes)
        OR 'Encarregado' = ANY(p.funcoes) OR 'Apontador' = ANY(p.funcoes) OR 'GerenteRegional' = ANY(p.funcoes)
        OR 'AdmTec' = ANY(p.funcoes) OR 'JovemAdm' = ANY(p.funcoes) OR 'EnferAdm' = ANY(p.funcoes))
    )
    AND departamento_id = get_user_departamento_id()
    AND get_user_departamento_id() IS NOT NULL
  )
);
