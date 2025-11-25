-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Funcionários: acesso baseado em departamento" ON public.bd_funcionarios;

-- Create new SELECT policy with separate conditions for different admin types
CREATE POLICY "Funcionários: acesso baseado em departamento" 
ON public.bd_funcionarios FOR SELECT
TO public
USING (
  -- 1. SuperAdmin global access
  (check_is_super_admin() AND (get_user_departamento_id() IS NULL)) 
  OR 
  -- 2. SuperAdmin department access
  (check_is_super_admin() AND (departamento_id = get_user_departamento_id())) 
  OR 
  -- 3. Users with acesso_global and admin funcao_sistema
  (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() 
    AND p.acesso_global = true 
    AND p.funcao_sistema = ANY (ARRAY['SuperAdm', 'Administrador', 'AdmRH', 'AdmLogistica', 'AdmEquipamentos'])
  )) 
  OR 
  -- 4. Users with admin funcao_sistema (department filtered)
  (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() 
    AND p.funcao_sistema = ANY (ARRAY['Administrador', 'AdmRH', 'AdmLogistica', 'AdmEquipamentos'])
    AND ((get_user_departamento_id() IS NULL) OR (bd_funcionarios.departamento_id = get_user_departamento_id()))
  )) 
  OR 
  -- 5. SuperAdm or AdmRH in funcoes[] array -> GLOBAL access (all employees)
  (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() 
    AND (
      'SuperAdm' = ANY(p.funcoes) OR
      'AdmRH' = ANY(p.funcoes)
    )
  ))
  OR 
  -- 6. AdmSSO in funcoes[] array -> DEPARTMENT-RESTRICTED access (only their department)
  (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() 
    AND 'AdmSSO' = ANY(p.funcoes)
    AND bd_funcionarios.departamento_id = get_user_departamento_id()
  ))
  OR 
  -- 7. Users can see their own employee record
  (id IN (SELECT profiles.funcionario_id FROM profiles WHERE profiles.id = auth.uid()))
);