-- Adicionar coluna aprovador_diarias_id na tabela bd_centros_custo
ALTER TABLE public.bd_centros_custo
ADD COLUMN IF NOT EXISTS aprovador_diarias_id UUID REFERENCES auth.users(id);