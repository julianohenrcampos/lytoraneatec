-- Remover FK atual para auth.users (se existir)
ALTER TABLE bd_registro_desvios_sso 
  DROP CONSTRAINT IF EXISTS bd_registro_desvios_sso_criado_por_fkey;

-- Adicionar FK para profiles
ALTER TABLE bd_registro_desvios_sso
  ADD CONSTRAINT bd_registro_desvios_sso_criado_por_fkey 
  FOREIGN KEY (criado_por) REFERENCES profiles(id) ON DELETE SET NULL;