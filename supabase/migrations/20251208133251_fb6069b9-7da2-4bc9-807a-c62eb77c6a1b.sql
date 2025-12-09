-- Remover as duas políticas conflitantes de DELETE
DROP POLICY IF EXISTS "SSO checklists: delete for creator or superadmin" ON bd_sso_checklists;
DROP POLICY IF EXISTS "sso_checklists_delete" ON bd_sso_checklists;

-- Nova política: Apenas SuperAdm e AdmSSO podem deletar
-- TecSSO NÃO pode deletar (nem seus próprios checklists)
CREATE POLICY "SSO checklists: delete for superadmin or admsso only"
ON bd_sso_checklists
FOR DELETE
TO authenticated
USING (
  -- SuperAdm pode deletar qualquer checklist
  public.check_is_super_admin(auth.uid()) 
  OR
  -- AdmSSO pode deletar qualquer checklist
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND 'AdmSSO' = ANY(p.funcoes)
  )
);