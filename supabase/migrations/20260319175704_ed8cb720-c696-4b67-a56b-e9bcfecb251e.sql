
-- Add structured address columns to bd_funcionarios
ALTER TABLE public.bd_funcionarios
  ADD COLUMN IF NOT EXISTS endereco_rua TEXT,
  ADD COLUMN IF NOT EXISTS endereco_numero TEXT,
  ADD COLUMN IF NOT EXISTS endereco_bairro TEXT,
  ADD COLUMN IF NOT EXISTS endereco_cidade TEXT,
  ADD COLUMN IF NOT EXISTS endereco_estado TEXT,
  ADD COLUMN IF NOT EXISTS endereco_cep TEXT;

-- Add structured address columns to bd_vale_transporte
ALTER TABLE public.bd_vale_transporte
  ADD COLUMN IF NOT EXISTS rua TEXT,
  ADD COLUMN IF NOT EXISTS numero TEXT,
  ADD COLUMN IF NOT EXISTS bairro TEXT,
  ADD COLUMN IF NOT EXISTS cidade TEXT,
  ADD COLUMN IF NOT EXISTS estado TEXT,
  ADD COLUMN IF NOT EXISTS cep TEXT;
