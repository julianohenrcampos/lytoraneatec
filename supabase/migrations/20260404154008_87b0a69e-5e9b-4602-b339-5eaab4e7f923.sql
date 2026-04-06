
-- FASE 1: Criar tabela bd_solicitacoes_itens
CREATE TABLE public.bd_solicitacoes_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  solicitacao_id UUID NOT NULL REFERENCES public.bd_solicitacoes_equipamento(id) ON DELETE CASCADE,
  tipo_item TEXT NOT NULL CHECK (tipo_item IN ('VEICULO', 'EQUIPAMENTO')),
  catalogo_equipamento_id UUID REFERENCES public.bd_catalogo_equipamentos(id),
  item_nao_catalogado BOOLEAN NOT NULL DEFAULT false,
  descricao_livre TEXT,
  capacidade_descricao TEXT,
  quantidade INTEGER NOT NULL DEFAULT 1,
  com_operador BOOLEAN NOT NULL DEFAULT false,
  regime_trabalho TEXT CHECK (regime_trabalho IN ('SEGUNDA_SEXTA', 'SEGUNDA_SABADO', 'TODOS_DIAS', 'PERSONALIZADO')),
  regime_personalizado TEXT,
  tempo_previsto_dias INTEGER,
  observacoes TEXT,
  status_item TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status_item IN ('PENDENTE', 'EM_ANALISE', 'PLANEJADO', 'EM_COTACAO', 'ATENDIDO')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger de updated_at
CREATE TRIGGER set_updated_at_solicitacoes_itens
  BEFORE UPDATE ON public.bd_solicitacoes_itens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger de validação: catalogo obrigatório se não for item não catalogado
CREATE OR REPLACE FUNCTION public.validate_solicitacao_item()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.item_nao_catalogado = false AND NEW.catalogo_equipamento_id IS NULL THEN
    RAISE EXCEPTION 'catalogo_equipamento_id é obrigatório quando item_nao_catalogado = false';
  END IF;
  IF NEW.item_nao_catalogado = true AND (NEW.descricao_livre IS NULL OR NEW.descricao_livre = '') THEN
    RAISE EXCEPTION 'descricao_livre é obrigatória quando item_nao_catalogado = true';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_solicitacao_item
  BEFORE INSERT OR UPDATE ON public.bd_solicitacoes_itens
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_solicitacao_item();

-- RLS
ALTER TABLE public.bd_solicitacoes_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read solicitacoes_itens"
  ON public.bd_solicitacoes_itens FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert solicitacoes_itens"
  ON public.bd_solicitacoes_itens FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update solicitacoes_itens"
  ON public.bd_solicitacoes_itens FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- FASE 4: Adicionar imagem_url ao catálogo
ALTER TABLE public.bd_catalogo_equipamentos ADD COLUMN IF NOT EXISTS imagem_url TEXT;
