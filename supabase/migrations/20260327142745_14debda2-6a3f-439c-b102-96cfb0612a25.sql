
-- 1. Add empresa_id to bd_frotas
ALTER TABLE public.bd_frotas 
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.bd_empresas(id);

-- 2. Add new columns to bd_empresas
ALTER TABLE public.bd_empresas
  ADD COLUMN IF NOT EXISTS tipo_empresa text DEFAULT 'PROPRIA',
  ADD COLUMN IF NOT EXISTS pertence_ao_grupo boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS fornece_equipamento boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS status_homologacao text DEFAULT 'PENDENTE',
  ADD COLUMN IF NOT EXISTS endereco_completo text,
  ADD COLUMN IF NOT EXISTS endereco_cep text,
  ADD COLUMN IF NOT EXISTS endereco_cidade text,
  ADD COLUMN IF NOT EXISTS endereco_estado text;
