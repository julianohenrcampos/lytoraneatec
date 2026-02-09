-- Adicionar coluna centro_custo_id para referência ao centro de custo
ALTER TABLE public.bd_sso_ver_agir 
ADD COLUMN centro_custo_id uuid REFERENCES public.bd_centros_custo(id);

-- Índice para performance
CREATE INDEX idx_ver_agir_centro_custo ON public.bd_sso_ver_agir(centro_custo_id);