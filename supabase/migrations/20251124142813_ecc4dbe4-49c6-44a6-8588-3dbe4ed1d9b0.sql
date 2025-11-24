-- Remove política RLS restritiva que impedia registro de usuários não autenticados
DROP POLICY IF EXISTS "Permitir verificação de email para cadastro" ON bd_funcionarios;

-- Cria nova política que permite usuários anônimos (anon) verificarem emails durante registro
-- Necessário para validar se o email está autorizado ANTES do login
CREATE POLICY "Verificação de email público para registro"
  ON bd_funcionarios
  FOR SELECT
  TO anon
  USING (true);

-- NOTA: Esta política permite leitura pública de bd_funcionarios
-- É necessária para o fluxo de registro funcionar
-- O frontend limita a query apenas ao campo 'email'
-- Após implementação bem-sucedida, considerar migrar para Edge Function com service role key