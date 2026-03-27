
-- TABELA: Portfólio de Empresas (capacidade de fornecimento)
CREATE TABLE public.bd_portfolio_empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.bd_empresas(id) ON DELETE CASCADE,
  tipo_equipamento_id uuid NOT NULL REFERENCES public.bd_tipos_equipamento(id) ON DELETE CASCADE,
  quantidade_estimada integer DEFAULT 0,
  fornece_com_operador boolean DEFAULT false,
  fornece_sem_operador boolean DEFAULT false,
  observacoes text,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(empresa_id, tipo_equipamento_id)
);

ALTER TABLE public.bd_portfolio_empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read bd_portfolio_empresas" ON public.bd_portfolio_empresas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert bd_portfolio_empresas" ON public.bd_portfolio_empresas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update bd_portfolio_empresas" ON public.bd_portfolio_empresas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_portfolio_empresa_id ON public.bd_portfolio_empresas(empresa_id);
CREATE INDEX idx_portfolio_tipo_equip_id ON public.bd_portfolio_empresas(tipo_equipamento_id);

-- CAMPOS EXTRAS na solicitação para resultado do matching
ALTER TABLE public.bd_solicitacoes_equipamento
  ADD COLUMN IF NOT EXISTS resultado_matching text DEFAULT 'NAO_ENCONTRADO',
  ADD COLUMN IF NOT EXISTS possui_disponibilidade_interna boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS quantidade_disponivel_encontrada integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sugestao_acao text;

-- FUNÇÃO: Buscar equipamentos disponíveis por tipo
CREATE OR REPLACE FUNCTION public.buscar_equipamentos_disponiveis(
  p_tipo_equipamento_id uuid
)
RETURNS TABLE(
  tipo_resultado text,
  equipamento_id uuid,
  empresa_id uuid,
  empresa_nome text,
  placa text,
  frota text,
  quantidade_disponivel integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Equipamentos próprios disponíveis
  RETURN QUERY
  SELECT
    'PROPRIO'::text,
    e.id,
    e.empresa_id,
    emp.nome_empresa,
    e.placa,
    e.frota,
    1::integer
  FROM public.bd_caminhoes_equipamentos e
  LEFT JOIN public.bd_empresas emp ON emp.id = e.empresa_id
  LEFT JOIN public.bd_disponibilidade_equipamentos d ON d.equipamento_id = e.id
  WHERE e.tipo_equipamento_id = p_tipo_equipamento_id
    AND e.situacao = 'Ativo'
    AND (d.status_operacional = 'DISPONIVEL' OR d.id IS NULL)
    AND (e.proprietario_tipo IS NULL OR e.proprietario_tipo = 'PROPRIO');

  -- 2. Equipamentos do grupo (locados internamente)
  RETURN QUERY
  SELECT
    'GRUPO'::text,
    e.id,
    e.empresa_id,
    emp.nome_empresa,
    e.placa,
    e.frota,
    1::integer
  FROM public.bd_caminhoes_equipamentos e
  LEFT JOIN public.bd_empresas emp ON emp.id = e.empresa_id
  LEFT JOIN public.bd_disponibilidade_equipamentos d ON d.equipamento_id = e.id
  WHERE e.tipo_equipamento_id = p_tipo_equipamento_id
    AND e.situacao = 'Ativo'
    AND (d.status_operacional = 'DISPONIVEL' OR d.id IS NULL)
    AND e.proprietario_tipo = 'GRUPO';

  -- 3. Fornecedores com portfólio
  RETURN QUERY
  SELECT
    'FORNECEDOR'::text,
    NULL::uuid,
    p.empresa_id,
    emp.nome_empresa,
    NULL::text,
    NULL::text,
    p.quantidade_estimada
  FROM public.bd_portfolio_empresas p
  JOIN public.bd_empresas emp ON emp.id = p.empresa_id
  WHERE p.tipo_equipamento_id = p_tipo_equipamento_id
    AND p.ativo = true;
END;
$$;
