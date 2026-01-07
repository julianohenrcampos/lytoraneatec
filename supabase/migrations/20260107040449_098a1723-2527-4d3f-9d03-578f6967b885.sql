-- Adicionar user_id na tabela bd_pncp_perfis_busca
ALTER TABLE bd_pncp_perfis_busca 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Adicionar user_id na tabela bd_pncp_contratacoes
ALTER TABLE bd_pncp_contratacoes 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Dropar políticas antigas de bd_pncp_perfis_busca
DROP POLICY IF EXISTS "Permitir leitura de perfis para usuários com acesso PNCP" ON bd_pncp_perfis_busca;
DROP POLICY IF EXISTS "Permitir inserção de perfis para usuários com acesso PNCP" ON bd_pncp_perfis_busca;
DROP POLICY IF EXISTS "Permitir atualização de perfis para usuários com acesso PNCP" ON bd_pncp_perfis_busca;
DROP POLICY IF EXISTS "Permitir exclusão de perfis para usuários com acesso PNCP" ON bd_pncp_perfis_busca;

-- Novas políticas para perfis de busca (isoladas por usuário)
CREATE POLICY "Usuário vê seus perfis ou admin vê todos"
ON bd_pncp_perfis_busca FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR user_id IS NULL OR has_pncp_access());

CREATE POLICY "Usuário insere seus perfis"
ON bd_pncp_perfis_busca FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Usuário atualiza seus perfis"
ON bd_pncp_perfis_busca FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR has_pncp_access());

CREATE POLICY "Usuário exclui seus perfis"
ON bd_pncp_perfis_busca FOR DELETE
TO authenticated
USING (user_id = auth.uid() OR has_pncp_access());

-- Dropar políticas antigas de bd_pncp_contratacoes
DROP POLICY IF EXISTS "Permitir leitura de contratacoes para usuários com acesso PNCP" ON bd_pncp_contratacoes;
DROP POLICY IF EXISTS "Permitir inserção de contratacoes para usuários com acesso PNCP" ON bd_pncp_contratacoes;
DROP POLICY IF EXISTS "Permitir atualização de contratacoes para usuários com acesso PNCP" ON bd_pncp_contratacoes;
DROP POLICY IF EXISTS "Permitir exclusão de contratacoes para usuários com acesso PNCP" ON bd_pncp_contratacoes;

-- Novas políticas para contratações (isoladas por usuário)
CREATE POLICY "Usuário vê suas contratações ou admin vê todas"
ON bd_pncp_contratacoes FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR user_id IS NULL OR has_pncp_access());

CREATE POLICY "Usuário ou edge function insere contratações"
ON bd_pncp_contratacoes FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() OR user_id IS NOT NULL);

CREATE POLICY "Usuário atualiza suas contratações"
ON bd_pncp_contratacoes FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR has_pncp_access());

CREATE POLICY "Usuário exclui suas contratações"
ON bd_pncp_contratacoes FOR DELETE
TO authenticated
USING (user_id = auth.uid() OR has_pncp_access());

-- Política especial para service_role (edge functions)
CREATE POLICY "Service role tem acesso total a perfis"
ON bd_pncp_perfis_busca FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role tem acesso total a contratações"
ON bd_pncp_contratacoes FOR ALL
TO service_role
USING (true)
WITH CHECK (true);