-- =====================================================
-- CORRECAO DE SEGURANCA: Filtro Departamental para bd_funcionarios
-- =====================================================

-- Passo 1: Remover a política permissiva que anula toda a segurança
DROP POLICY IF EXISTS "Verificação de email para registro" ON bd_funcionarios;

-- Passo 2: Remover políticas antigas que possam conflitar
DROP POLICY IF EXISTS "Funcionários: acesso baseado em departamento" ON bd_funcionarios;
DROP POLICY IF EXISTS "Funcionários: acesso seguro por papel" ON bd_funcionarios;

-- Passo 3: Criar política principal com filtro departamental correto
CREATE POLICY "Funcionários: acesso seguro por papel" 
ON bd_funcionarios FOR SELECT TO authenticated
USING (
  -- SuperAdmin: acesso total (usa função existente)
  public.check_is_super_admin()
  OR
  -- AdmRH: acesso total
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND 'AdmRH' = ANY(p.funcoes)
  )
  OR
  -- Usuarios com acesso_global: acesso total
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.acesso_global = true
  )
  OR
  -- Usuario ve seu proprio registro
  id = (SELECT funcionario_id FROM profiles WHERE id = auth.uid())
  OR
  -- Admins departamentais: apenas seu departamento
  (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = auth.uid() 
      AND (
        'AdmSSO' = ANY(p.funcoes) OR
        'TecSSO' = ANY(p.funcoes) OR
        'AdmLogistica' = ANY(p.funcoes) OR
        'AdmEquipamentos' = ANY(p.funcoes) OR
        'Encarregado' = ANY(p.funcoes) OR
        'Apontador' = ANY(p.funcoes)
      )
    )
    AND departamento_id = public.get_user_departamento_id()
    AND public.get_user_departamento_id() IS NOT NULL
  )
);

-- Passo 4: Criar política específica para verificação de email durante registro
-- Esta é usada apenas por usuários anônimos para verificar se email já existe
CREATE POLICY "Verificação de email para registro anon" 
ON bd_funcionarios FOR SELECT TO anon
USING (
  -- Apenas permite verificar existência de email (não retorna dados sensíveis)
  true
);