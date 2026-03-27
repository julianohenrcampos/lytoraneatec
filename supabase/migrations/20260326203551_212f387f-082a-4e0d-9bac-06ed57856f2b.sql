
-- TABELA: Custos de Equipamentos
CREATE TABLE public.bd_custos_equipamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_equipamento_id uuid REFERENCES public.bd_tipos_equipamento(id) ON DELETE CASCADE,
  equipamento_id uuid REFERENCES public.bd_caminhoes_equipamentos(id) ON DELETE CASCADE,
  valor_hora numeric DEFAULT 0,
  valor_diaria numeric DEFAULT 0,
  valor_mensal numeric DEFAULT 0,
  vigencia_inicio date NOT NULL,
  vigencia_fim date,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.bd_custos_equipamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read bd_custos_equipamentos" ON public.bd_custos_equipamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert bd_custos_equipamentos" ON public.bd_custos_equipamentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update bd_custos_equipamentos" ON public.bd_custos_equipamentos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_custos_tipo_equip ON public.bd_custos_equipamentos(tipo_equipamento_id);
CREATE INDEX idx_custos_equip ON public.bd_custos_equipamentos(equipamento_id);

-- TABELA: Cotações
CREATE TABLE public.bd_cotacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id uuid REFERENCES public.bd_solicitacoes_equipamento(id) ON DELETE CASCADE,
  data_abertura date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'ABERTA',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.bd_cotacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read bd_cotacoes" ON public.bd_cotacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert bd_cotacoes" ON public.bd_cotacoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update bd_cotacoes" ON public.bd_cotacoes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_cotacoes_solicitacao ON public.bd_cotacoes(solicitacao_id);

-- TABELA: Itens da Cotação
CREATE TABLE public.bd_cotacoes_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id uuid NOT NULL REFERENCES public.bd_cotacoes(id) ON DELETE CASCADE,
  tipo_equipamento_id uuid REFERENCES public.bd_tipos_equipamento(id) ON DELETE SET NULL,
  quantidade integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.bd_cotacoes_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read bd_cotacoes_itens" ON public.bd_cotacoes_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert bd_cotacoes_itens" ON public.bd_cotacoes_itens FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update bd_cotacoes_itens" ON public.bd_cotacoes_itens FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_cotacoes_itens_cotacao ON public.bd_cotacoes_itens(cotacao_id);

-- TABELA: Propostas da Cotação
CREATE TABLE public.bd_cotacoes_propostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_item_id uuid NOT NULL REFERENCES public.bd_cotacoes_itens(id) ON DELETE CASCADE,
  empresa_id uuid REFERENCES public.bd_empresas(id) ON DELETE SET NULL,
  fabricante_id uuid REFERENCES public.bd_fabricantes(id) ON DELETE SET NULL,
  modelo_id uuid REFERENCES public.bd_modelos(id) ON DELETE SET NULL,
  ano_fabricacao text,
  valor_unitario numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  com_operador boolean DEFAULT false,
  prazo_entrega text,
  observacoes text,
  status text NOT NULL DEFAULT 'PENDENTE',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.bd_cotacoes_propostas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read bd_cotacoes_propostas" ON public.bd_cotacoes_propostas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert bd_cotacoes_propostas" ON public.bd_cotacoes_propostas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update bd_cotacoes_propostas" ON public.bd_cotacoes_propostas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_propostas_item ON public.bd_cotacoes_propostas(cotacao_item_id);
CREATE INDEX idx_propostas_empresa ON public.bd_cotacoes_propostas(empresa_id);

-- TABELA: Aprovações de Exceção
CREATE TABLE public.bd_aprovacoes_excecao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id uuid REFERENCES public.bd_solicitacoes_equipamento(id) ON DELETE CASCADE,
  valor_referencia_interno numeric NOT NULL DEFAULT 0,
  valor_proposto numeric NOT NULL DEFAULT 0,
  percentual_acima numeric GENERATED ALWAYS AS (
    CASE WHEN valor_referencia_interno > 0
      THEN ROUND(((valor_proposto - valor_referencia_interno) / valor_referencia_interno) * 100, 2)
      ELSE 0
    END
  ) STORED,
  justificativa text NOT NULL,
  aprovado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  data_aprovacao timestamptz,
  status text NOT NULL DEFAULT 'PENDENTE',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.bd_aprovacoes_excecao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read bd_aprovacoes_excecao" ON public.bd_aprovacoes_excecao FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert bd_aprovacoes_excecao" ON public.bd_aprovacoes_excecao FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update bd_aprovacoes_excecao" ON public.bd_aprovacoes_excecao FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_excecao_solicitacao ON public.bd_aprovacoes_excecao(solicitacao_id);
