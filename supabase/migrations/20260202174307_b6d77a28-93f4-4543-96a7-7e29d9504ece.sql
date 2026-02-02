-- Simplificar política RLS de bd_funcionarios para garantir acesso correto
-- Remove as políticas existentes
DROP POLICY IF EXISTS "Funcionários: acesso baseado em departamento" ON bd_funcionarios;
DROP POLICY IF EXISTS "Verificação de email público para registro" ON bd_funcionarios;

-- Nova política simplificada e robusta
CREATE POLICY "Funcionários: acesso global ou departamental" 
ON bd_funcionarios FOR SELECT TO authenticated
USING (
  -- SuperAdmin sempre tem acesso (sem depender de departamento)
  public.check_is_super_admin()
  OR
  -- Usuários com acesso_global = true
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.acesso_global = true
  )
  OR
  -- AdmRH tem acesso global a todos os funcionários
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND 'AdmRH' = ANY(p.funcoes)
  )
  OR
  -- Usuário vê seu próprio registro vinculado
  id = (SELECT funcionario_id FROM profiles WHERE id = auth.uid())
  OR
  -- Admins departamentais veem funcionários do seu departamento (quando têm departamento definido)
  (
    departamento_id = public.get_user_departamento_id()
    AND public.get_user_departamento_id() IS NOT NULL
  )
  OR
  -- TecSSO veem funcionários do seu departamento
  (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND 'TecSSO' = ANY(p.funcoes)
    )
    AND departamento_id = public.get_user_departamento_id()
    AND public.get_user_departamento_id() IS NOT NULL
  )
);

-- Manter política de verificação para casos públicos
CREATE POLICY "Verificação de email para registro" 
ON bd_funcionarios FOR SELECT
USING (true);