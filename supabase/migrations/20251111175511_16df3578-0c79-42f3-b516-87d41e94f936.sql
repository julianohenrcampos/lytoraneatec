-- PASSO 1: Criar função para buscar departamento do usuário logado
CREATE OR REPLACE FUNCTION public.get_user_departamento_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
  SELECT f.departamento_id 
  FROM public.profiles p
  INNER JOIN public.bd_funcionarios f ON f.id = p.funcionario_id
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

-- PASSO 2: Criar função para verificar se é SuperAdm Departamental
CREATE OR REPLACE FUNCTION public.is_departmental_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND 'SuperAdm' = ANY(funcoes)
    AND funcionario_id IS NOT NULL
    AND public.get_user_departamento_id() IS NOT NULL
  );
$$;

-- PASSO 3: Atualizar política RLS da tabela bd_funcionarios
DROP POLICY IF EXISTS "Usuários autenticados podem acessar funcionários" ON public.bd_funcionarios;
DROP POLICY IF EXISTS "Permitir verificação de email para cadastro" ON public.bd_funcionarios;

-- Política para SELECT com filtro departamental
CREATE POLICY "Funcionários: acesso baseado em departamento" 
ON public.bd_funcionarios FOR SELECT 
TO authenticated 
USING (
  -- SuperAdm Global (sem departamento vinculado) vê tudo
  (public.check_is_super_admin() AND public.get_user_departamento_id() IS NULL)
  OR
  -- SuperAdm Departamental vê apenas seu departamento
  (public.check_is_super_admin() AND departamento_id = public.get_user_departamento_id())
  OR
  -- Administradores veem tudo
  (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.funcao_sistema IN ('Administrador', 'AdmRH', 'AdmLogistica', 'AdmEquipamentos')
  ))
  OR
  -- Usuários veem seu próprio registro
  (id IN (SELECT funcionario_id FROM public.profiles WHERE id = auth.uid()))
);

-- Recriar política de verificação de email (necessária para cadastro)
CREATE POLICY "Permitir verificação de email para cadastro" 
ON public.bd_funcionarios FOR SELECT 
TO authenticated 
USING (true);

-- Políticas para INSERT, UPDATE, DELETE (mantém permissões existentes)
CREATE POLICY "Funcionários: inserção autenticada" 
ON public.bd_funcionarios FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Funcionários: atualização autenticada" 
ON public.bd_funcionarios FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);

CREATE POLICY "Funcionários: exclusão autenticada" 
ON public.bd_funcionarios FOR DELETE 
TO authenticated 
USING (true);