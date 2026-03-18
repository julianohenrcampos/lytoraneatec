
-- Add address and geolocation columns to bd_centros_custo
ALTER TABLE bd_centros_custo
  ADD COLUMN IF NOT EXISTS endereco_rua TEXT,
  ADD COLUMN IF NOT EXISTS endereco_numero TEXT,
  ADD COLUMN IF NOT EXISTS endereco_bairro TEXT,
  ADD COLUMN IF NOT EXISTS endereco_cidade TEXT,
  ADD COLUMN IF NOT EXISTS endereco_estado TEXT,
  ADD COLUMN IF NOT EXISTS endereco_cep TEXT,
  ADD COLUMN IF NOT EXISTS endereco_completo TEXT,
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,8),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(11,8),
  ADD COLUMN IF NOT EXISTS geocoding_status TEXT DEFAULT 'pending';

-- Create address cache table
CREATE TABLE IF NOT EXISTS bd_cache_enderecos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endereco TEXT NOT NULL UNIQUE,
  latitude NUMERIC(10,8) NOT NULL,
  longitude NUMERIC(11,8) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on cache table
ALTER TABLE bd_cache_enderecos ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users
CREATE POLICY "auth_read_cache" ON bd_cache_enderecos FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_cache" ON bd_cache_enderecos FOR INSERT TO authenticated WITH CHECK (true);
