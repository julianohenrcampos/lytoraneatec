-- Adicionar coluna acesso_global na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS acesso_global boolean DEFAULT false;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_profiles_acesso_global ON public.profiles(acesso_global);

-- Comentário para documentação
COMMENT ON COLUMN public.profiles.acesso_global IS 'Define se o usuário tem acesso global a todos os departamentos mesmo estando vinculado a um departamento específico';

-- Atualizar política RLS de bd_funcionarios para considerar acesso_global
DROP POLICY IF EXISTS "Funcionários: acesso baseado em departamento" ON public.bd_funcionarios;

CREATE POLICY "Funcionários: acesso baseado em departamento" ON public.bd_funcionarios
FOR SELECT USING (
  -- SuperAdmin Global (sem departamento) vê tudo
  (check_is_super_admin() AND (get_user_departamento_id() IS NULL))
  OR
  -- SuperAdmin Departamental vê apenas seu departamento
  (check_is_super_admin() AND (departamento_id = get_user_departamento_id()))
  OR
  -- Usuário com acesso_global vê todos os departamentos
  (EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.acesso_global = true
    AND p.funcao_sistema = ANY(ARRAY['SuperAdm', 'Administrador', 'AdmRH', 'AdmLogistica', 'AdmEquipamentos'])
  ))
  OR
  -- Administradores departamentais veem seu departamento
  (EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND p.funcao_sistema = ANY(ARRAY['Administrador', 'AdmRH', 'AdmLogistica', 'AdmEquipamentos'])
    AND (get_user_departamento_id() IS NULL OR bd_funcionarios.departamento_id = get_user_departamento_id())
  ))
  OR
  -- Usuário vê seu próprio registro
  (id IN (SELECT profiles.funcionario_id FROM profiles WHERE profiles.id = auth.uid()))
);