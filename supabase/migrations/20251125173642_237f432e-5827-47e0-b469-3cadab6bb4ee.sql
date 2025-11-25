-- Drop the existing restrictive SELECT policy
DROP POLICY IF EXISTS "Funcionários: acesso baseado em departamento" ON public.bd_funcionarios;

-- Create new SELECT policy that includes users with admin roles in funcoes[]
CREATE POLICY "Funcionários: acesso baseado em departamento" 
ON public.bd_funcionarios FOR SELECT
TO public
USING (
  -- SuperAdmin global access
  (check_is_super_admin() AND (get_user_departamento_id() IS NULL)) 
  OR 
  -- SuperAdmin department access
  (check_is_super_admin() AND (departamento_id = get_user_departamento_id())) 
  OR 
  -- Users with acesso_global and admin funcao_sistema
  (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() 
    AND p.acesso_global = true 
    AND p.funcao_sistema = ANY (ARRAY['SuperAdm', 'Administrador', 'AdmRH', 'AdmLogistica', 'AdmEquipamentos'])
  )) 
  OR 
  -- Users with admin funcao_sistema (department restricted or not)
  (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() 
    AND p.funcao_sistema = ANY (ARRAY['Administrador', 'AdmRH', 'AdmLogistica', 'AdmEquipamentos'])
    AND ((get_user_departamento_id() IS NULL) OR (bd_funcionarios.departamento_id = get_user_departamento_id()))
  )) 
  OR 
  -- NOVO: Users with admin roles in funcoes[] array (AdmSSO, AdmRH, etc.)
  (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() 
    AND (
      'SuperAdm' = ANY(p.funcoes) OR
      'AdmSSO' = ANY(p.funcoes) OR
      'AdmRH' = ANY(p.funcoes)
    )
  ))
  OR 
  -- Users can see their own employee record
  (id IN (SELECT profiles.funcionario_id FROM profiles WHERE profiles.id = auth.uid()))
);