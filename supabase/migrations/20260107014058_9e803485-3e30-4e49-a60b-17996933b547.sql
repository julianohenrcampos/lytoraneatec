-- Adicionar colunas para palavras primárias e secundárias nos perfis de busca
ALTER TABLE public.bd_pncp_perfis_busca 
ADD COLUMN IF NOT EXISTS palavras_primarias TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS palavras_secundarias TEXT[] DEFAULT '{}';