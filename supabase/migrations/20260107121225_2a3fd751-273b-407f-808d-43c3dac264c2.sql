-- Migrar dados existentes para o usuário admin (Juliano)
UPDATE bd_pncp_perfis_busca 
SET user_id = (SELECT id FROM auth.users WHERE email = 'julianohcampos@yahoo.com.br' LIMIT 1)
WHERE user_id IS NULL;

UPDATE bd_pncp_contratacoes 
SET user_id = (SELECT id FROM auth.users WHERE email = 'julianohcampos@yahoo.com.br' LIMIT 1)
WHERE user_id IS NULL;

-- Corrigir política RLS para perfis de busca (remover condição user_id IS NULL)
DROP POLICY IF EXISTS "Usuário vê seus perfis ou admin vê todos" ON public.bd_pncp_perfis_busca;

CREATE POLICY "Usuário vê seus perfis ou admin vê todos" 
ON public.bd_pncp_perfis_busca FOR SELECT 
TO authenticated 
USING (
  user_id = auth.uid() 
  OR has_pncp_access()
);

-- Corrigir política RLS para contratações (remover condição user_id IS NULL)
DROP POLICY IF EXISTS "Usuário vê suas contratações ou admin vê todas" ON public.bd_pncp_contratacoes;

CREATE POLICY "Usuário vê suas contratações ou admin vê todas" 
ON public.bd_pncp_contratacoes FOR SELECT 
TO authenticated 
USING (
  user_id = auth.uid() 
  OR has_pncp_access()
);