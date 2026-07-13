ALTER TABLE public.bd_atestados_medicos
  ADD COLUMN IF NOT EXISTS sistema_afetado_codigo text,
  ADD COLUMN IF NOT EXISTS sistema_afetado_descricao text,
  ADD COLUMN IF NOT EXISTS sistema_afetado_observacao text,
  ADD COLUMN IF NOT EXISTS alertas_gerados jsonb NOT NULL DEFAULT '[]'::jsonb;