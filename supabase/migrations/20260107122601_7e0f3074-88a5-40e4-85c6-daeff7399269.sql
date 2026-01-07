-- Adicionar coluna user_id ao log de sincronização
ALTER TABLE bd_pncp_sync_log 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_pncp_sync_log_user_id ON bd_pncp_sync_log(user_id);

-- Habilitar RLS se ainda não estiver
ALTER TABLE bd_pncp_sync_log ENABLE ROW LEVEL SECURITY;

-- Remover política antiga se existir
DROP POLICY IF EXISTS "Acesso leitura sync log PNCP" ON bd_pncp_sync_log;
DROP POLICY IF EXISTS "Usuário vê seus logs ou admin vê todos" ON bd_pncp_sync_log;

-- Criar política RLS para filtrar por usuário (usuário vê seus logs OU admin vê todos)
CREATE POLICY "Usuário vê seus logs ou admin vê todos" 
ON bd_pncp_sync_log FOR SELECT 
TO authenticated 
USING (
  user_id = auth.uid() 
  OR has_pncp_access()
);

-- Política para inserção (qualquer autenticado pode criar seu próprio log)
DROP POLICY IF EXISTS "Usuário pode criar seus logs" ON bd_pncp_sync_log;
CREATE POLICY "Usuário pode criar seus logs" 
ON bd_pncp_sync_log FOR INSERT 
TO authenticated 
WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Política para update (service role pode atualizar qualquer log)
DROP POLICY IF EXISTS "Service role pode atualizar logs" ON bd_pncp_sync_log;
CREATE POLICY "Service role pode atualizar logs" 
ON bd_pncp_sync_log FOR UPDATE 
TO authenticated 
USING (user_id = auth.uid() OR has_pncp_access());