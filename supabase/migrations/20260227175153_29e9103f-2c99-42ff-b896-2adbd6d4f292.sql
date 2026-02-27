-- Update has_sso_permission to include AdmOBRA
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
      'ConsultaExames' = ANY(p.funcoes)
    )
  );
$$;

-- Update has_sso_full_access to include AdmOBRA
CREATE OR REPLACE FUNCTION public.has_sso_full_access(p_user_id uuid DEFAULT auth.uid())
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
      'AdmOBRA' = ANY(p.funcoes)
    )
  );
$$;

-- Update can_delete_agendamento_exame to include AdmOBRA
CREATE OR REPLACE FUNCTION public.can_delete_agendamento_exame(p_user_id uuid DEFAULT auth.uid())
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
      'AdmOBRA' = ANY(p.funcoes)
    )
  );
$$;

-- Update check_is_admsso to also check AdmOBRA
CREATE OR REPLACE FUNCTION public.check_is_admsso(user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = user_id
    AND ('AdmSSO' = ANY(p.funcoes) OR 'AdmOBRA' = ANY(p.funcoes))
  );
$$;

-- Update get_sso_admin_users to include AdmOBRA
CREATE OR REPLACE FUNCTION public.get_sso_admin_users()
RETURNS TABLE(user_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT p.id
  FROM profiles p
  WHERE 
    'SuperAdm' = ANY(p.funcoes)
    OR 'AdmSSO' = ANY(p.funcoes)
    OR 'AdmOBRA' = ANY(p.funcoes);
$$;

-- Update bd_funcionarios SELECT policy to include AdmOBRA
DROP POLICY IF EXISTS "Funcionários: acesso por papel e departamento" ON bd_funcionarios;
CREATE POLICY "Funcionários: acesso por papel e departamento" ON bd_funcionarios
FOR SELECT TO authenticated
USING (
  check_is_super_admin()
  OR (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.acesso_global = true))
  OR (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND 'AdmRH' = ANY(p.funcoes)))
  OR (id = (SELECT profiles.funcionario_id FROM profiles WHERE profiles.id = auth.uid()))
  OR (
    (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND ('AdmSSO' = ANY(p.funcoes) OR 'AdmOBRA' = ANY(p.funcoes))))
    AND departamento_id = get_user_departamento_id()
    AND get_user_departamento_id() IS NOT NULL
  )
  OR (
    (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND (
      'TecSSO' = ANY(p.funcoes) OR 'AdmLogistica' = ANY(p.funcoes) OR 'AdmEquipamentos' = ANY(p.funcoes)
      OR 'Encarregado' = ANY(p.funcoes) OR 'Apontador' = ANY(p.funcoes) OR 'GerenteRegional' = ANY(p.funcoes)
    )))
    AND departamento_id = get_user_departamento_id()
    AND get_user_departamento_id() IS NOT NULL
  )
);

-- Update diaria_solicitacoes_delete to include AdmOBRA
DROP POLICY IF EXISTS "diaria_solicitacoes_delete" ON bd_diaria_solicitacoes;
CREATE POLICY "diaria_solicitacoes_delete" ON bd_diaria_solicitacoes
FOR DELETE TO authenticated
USING (
  check_is_super_admin(auth.uid())
  OR (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND ('AdmSSO' = ANY(p.funcoes) OR 'AdmOBRA' = ANY(p.funcoes))))
  OR (criado_por = auth.uid() AND status = 'rascunho')
);