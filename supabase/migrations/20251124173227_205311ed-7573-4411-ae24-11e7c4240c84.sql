-- Criar função helper para verificar permissões SSO
-- Esta função evita recursão RLS usando SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.has_sso_permission(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = p_user_id
    AND (
      'SuperAdm' = ANY(p.funcoes) OR
      'AdmSSO' = ANY(p.funcoes) OR
      'TecSSO' = ANY(p.funcoes)
    )
  );
$$;

-- ========================================
-- ATUALIZAR POLÍTICAS RLS: bd_sso_checklists
-- ========================================

-- Remover políticas antigas
DROP POLICY IF EXISTS "SSO checklists: select for admins" ON bd_sso_checklists;
DROP POLICY IF EXISTS "SSO checklists: insert for admins" ON bd_sso_checklists;
DROP POLICY IF EXISTS "SSO checklists: update for admins or creator" ON bd_sso_checklists;
DROP POLICY IF EXISTS "SSO checklists: delete for admins or creator" ON bd_sso_checklists;

-- SELECT: Usuários com permissão SSO podem visualizar todos os checklists
CREATE POLICY "SSO checklists: select for SSO users"
ON bd_sso_checklists
FOR SELECT
TO authenticated
USING (public.has_sso_permission(auth.uid()));

-- INSERT: Usuários com permissão SSO podem criar checklists
CREATE POLICY "SSO checklists: insert for SSO users"
ON bd_sso_checklists
FOR INSERT
TO authenticated
WITH CHECK (public.has_sso_permission(auth.uid()));

-- UPDATE: Criador ou usuários com permissão SSO podem atualizar
CREATE POLICY "SSO checklists: update for SSO users or creator"
ON bd_sso_checklists
FOR UPDATE
TO authenticated
USING (
  criado_por = auth.uid() OR 
  public.has_sso_permission(auth.uid())
)
WITH CHECK (
  criado_por = auth.uid() OR 
  public.has_sso_permission(auth.uid())
);

-- DELETE: Apenas criador ou SuperAdmin podem deletar (manter restritivo)
CREATE POLICY "SSO checklists: delete for creator or superadmin"
ON bd_sso_checklists
FOR DELETE
TO authenticated
USING (
  criado_por = auth.uid() OR 
  public.check_is_super_admin(auth.uid())
);

-- ========================================
-- ATUALIZAR POLÍTICAS RLS: bd_sso_checklist_itens
-- ========================================

-- Remover políticas antigas
DROP POLICY IF EXISTS "SSO checklist itens: select for admins" ON bd_sso_checklist_itens;
DROP POLICY IF EXISTS "SSO checklist itens: insert for admins" ON bd_sso_checklist_itens;
DROP POLICY IF EXISTS "SSO checklist itens: update for admins" ON bd_sso_checklist_itens;
DROP POLICY IF EXISTS "SSO checklist itens: delete for admins" ON bd_sso_checklist_itens;

-- SELECT: Usuários com permissão SSO podem visualizar itens
CREATE POLICY "SSO checklist itens: select for SSO users"
ON bd_sso_checklist_itens
FOR SELECT
TO authenticated
USING (public.has_sso_permission(auth.uid()));

-- INSERT: Usuários com permissão SSO podem criar itens
CREATE POLICY "SSO checklist itens: insert for SSO users"
ON bd_sso_checklist_itens
FOR INSERT
TO authenticated
WITH CHECK (public.has_sso_permission(auth.uid()));

-- UPDATE: Usuários com permissão SSO podem atualizar itens
CREATE POLICY "SSO checklist itens: update for SSO users"
ON bd_sso_checklist_itens
FOR UPDATE
TO authenticated
USING (public.has_sso_permission(auth.uid()))
WITH CHECK (public.has_sso_permission(auth.uid()));

-- DELETE: Usuários com permissão SSO ou criador do checklist pai podem deletar
CREATE POLICY "SSO checklist itens: delete for SSO users"
ON bd_sso_checklist_itens
FOR DELETE
TO authenticated
USING (
  public.has_sso_permission(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM bd_sso_checklists c
    WHERE c.id = bd_sso_checklist_itens.checklist_id
    AND c.criado_por = auth.uid()
  )
);