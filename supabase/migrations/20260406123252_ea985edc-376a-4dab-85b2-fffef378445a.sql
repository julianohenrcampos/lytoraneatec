
-- ============================================
-- ETAPA 1: Criar tabela bd_catalogo_variacoes
-- ============================================
CREATE TABLE IF NOT EXISTS public.bd_catalogo_variacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subcategoria_id UUID NOT NULL REFERENCES public.bd_subcategorias_ativos(id),
  capacidade_valor NUMERIC,
  capacidade_unidade TEXT,
  descricao_padrao TEXT,
  origem TEXT NOT NULL DEFAULT 'SISTEMA',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Constraint de origem
ALTER TABLE public.bd_catalogo_variacoes
  ADD CONSTRAINT catalogo_variacoes_origem_check
  CHECK (origem IN ('SISTEMA','INTERNO','FORNECEDOR'));

-- Constraint de unicidade
ALTER TABLE public.bd_catalogo_variacoes
  ADD CONSTRAINT catalogo_variacoes_unique
  UNIQUE (subcategoria_id, capacidade_valor, capacidade_unidade);

-- Index de performance
CREATE INDEX IF NOT EXISTS idx_catalogo_variacoes_busca
  ON public.bd_catalogo_variacoes (subcategoria_id, capacidade_valor);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.update_catalogo_variacoes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_catalogo_variacoes_updated_at
  BEFORE UPDATE ON public.bd_catalogo_variacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_catalogo_variacoes_updated_at();

-- RLS
ALTER TABLE public.bd_catalogo_variacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read bd_catalogo_variacoes"
  ON public.bd_catalogo_variacoes FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert bd_catalogo_variacoes"
  ON public.bd_catalogo_variacoes FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update bd_catalogo_variacoes"
  ON public.bd_catalogo_variacoes FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- ETAPA 2: Alterar bd_portfolio_empresas
-- ============================================
ALTER TABLE public.bd_portfolio_empresas
  ADD COLUMN IF NOT EXISTS catalogo_variacao_id UUID REFERENCES public.bd_catalogo_variacoes(id);

-- Tornar tipo_equipamento_id nullable (pode já ser nullable)
ALTER TABLE public.bd_portfolio_empresas
  ALTER COLUMN tipo_equipamento_id DROP NOT NULL;

-- ============================================
-- ETAPA 3: Alterar bd_solicitacoes_itens
-- ============================================
ALTER TABLE public.bd_solicitacoes_itens
  ADD COLUMN IF NOT EXISTS subcategoria_id UUID REFERENCES public.bd_subcategorias_ativos(id);

ALTER TABLE public.bd_solicitacoes_itens
  ADD COLUMN IF NOT EXISTS capacidade_valor NUMERIC;

ALTER TABLE public.bd_solicitacoes_itens
  ADD COLUMN IF NOT EXISTS capacidade_unidade TEXT;

ALTER TABLE public.bd_solicitacoes_itens
  ADD COLUMN IF NOT EXISTS catalogo_variacao_id UUID REFERENCES public.bd_catalogo_variacoes(id);

-- ============================================
-- ETAPA 4: Populacao automatica a partir da frota
-- ============================================
INSERT INTO public.bd_catalogo_variacoes (subcategoria_id, capacidade_valor, capacidade_unidade, descricao_padrao, origem)
SELECT DISTINCT
  ce.subcategoria_ativo_id,
  CASE
    WHEN ce.capacidade ~ '^\s*\d' THEN (regexp_match(ce.capacidade, '(\d+\.?\d*)'))[1]::numeric
    ELSE NULL
  END,
  CASE
    WHEN ce.capacidade ~ '[a-zA-Zçãõ]' THEN trim((regexp_match(ce.capacidade, '\d*\.?\d*\s*(.+)'))[1])
    ELSE NULL
  END,
  ce.capacidade,
  'SISTEMA'
FROM public.bd_caminhoes_equipamentos ce
WHERE ce.subcategoria_ativo_id IS NOT NULL
  AND ce.capacidade IS NOT NULL
  AND trim(ce.capacidade) != ''
ON CONFLICT DO NOTHING;
