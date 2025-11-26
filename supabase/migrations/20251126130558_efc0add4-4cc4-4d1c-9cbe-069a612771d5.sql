-- Remover permissão dashboard_view do TecSSO
UPDATE bd_funcoes_permissao
SET permissoes = ARRAY['d0e1ed14-a3f0-4a8c-9be8-985c27ad1b7b']::uuid[]  -- Apenas acesso_sso_checklists
WHERE nome_funcao = 'TecSSO';

-- Drop políticas duplicadas de SELECT em bd_sso_checklists
DROP POLICY IF EXISTS "SSO checklists: select for SSO users" ON public.bd_sso_checklists;
DROP POLICY IF EXISTS "sso_checklists_select" ON public.bd_sso_checklists;

-- Criar nova política de SELECT com níveis de acesso diferenciados por role
CREATE POLICY "sso_checklists_select_by_role" 
ON public.bd_sso_checklists FOR SELECT
TO authenticated
USING (
  -- SuperAdm ou AdmSSO: veem TODOS os checklists
  (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND (
      'SuperAdm' = ANY(p.funcoes) OR
      'AdmSSO' = ANY(p.funcoes)
    )
  ))
  OR
  -- TecSSO: vê APENAS os que criou
  (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND 'TecSSO' = ANY(p.funcoes)
    AND bd_sso_checklists.criado_por = auth.uid()
  ))
  OR
  -- Qualquer usuário pode ver seus próprios checklists
  (criado_por = auth.uid())
);