-- Corrigir política RLS para aplicar filtro departamental a TODOS os perfis administrativos
-- Remove a política antiga que permite acesso total a administradores
DROP POLICY IF EXISTS "Funcionários: acesso baseado em departamento" ON public.bd_funcionarios;

-- Cria a nova política com filtro departamental para TODOS os perfis administrativos
CREATE POLICY "Funcionários: acesso baseado em departamento" 
ON public.bd_funcionarios FOR SELECT 
TO authenticated 
USING (
  -- 1. SuperAdm Global (sem departamento vinculado) vê tudo
  (public.check_is_super_admin() AND public.get_user_departamento_id() IS NULL)
  OR
  -- 2. SuperAdm Departamental (com departamento vinculado) vê apenas seu departamento
  (public.check_is_super_admin() AND departamento_id = public.get_user_departamento_id())
  OR
  -- 3. Administradores COM departamento veem apenas seu departamento
  --    Administradores SEM departamento veem tudo (acesso global)
  (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.funcao_sistema IN ('Administrador', 'AdmRH', 'AdmLogistica', 'AdmEquipamentos')
    AND (
      -- Se não tem departamento vinculado, vê tudo
      public.get_user_departamento_id() IS NULL
      OR
      -- Se tem departamento, vê apenas funcionários do mesmo departamento
      public.bd_funcionarios.departamento_id = public.get_user_departamento_id()
    )
  ))
  OR
  -- 4. Usuário comum vê apenas seu próprio registro
  (id IN (SELECT funcionario_id FROM public.profiles WHERE id = auth.uid()))
);