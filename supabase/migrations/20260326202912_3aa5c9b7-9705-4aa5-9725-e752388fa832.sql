
-- ENUM: status operacional
CREATE TYPE public.status_operacional_enum AS ENUM ('DISPONIVEL', 'ALOCADO', 'MANUTENCAO', 'INDISPONIVEL');

-- ENUM: confiabilidade previsão
CREATE TYPE public.confiabilidade_previsao_enum AS ENUM ('ALTA', 'MEDIA', 'BAIXA');

-- ENUM: origem localização
CREATE TYPE public.origem_localizacao_enum AS ENUM ('CENTRO_CUSTO', 'MANUAL', 'TELEMETRIA');

-- ENUM: prioridade solicitação
CREATE TYPE public.prioridade_solicitacao_enum AS ENUM ('NORMAL', 'ALTA', 'URGENTE');

-- ENUM: status solicitação
CREATE TYPE public.status_solicitacao_equip_enum AS ENUM ('ABERTO', 'EM_ANALISE', 'ATENDIDO', 'NEGADO');

-- TABELA 1: Disponibilidade de Equipamentos
CREATE TABLE public.bd_disponibilidade_equipamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipamento_id uuid NOT NULL REFERENCES public.bd_caminhoes_equipamentos(id) ON DELETE CASCADE,
  status_operacional status_operacional_enum NOT NULL DEFAULT 'DISPONIVEL',
  centro_custo_id uuid REFERENCES public.bd_centros_custo(id) ON DELETE SET NULL,
  data_inicio date,
  previsao_liberacao date,
  confiabilidade_previsao confiabilidade_previsao_enum DEFAULT 'MEDIA',
  motivo_risco text,
  observacao text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.bd_disponibilidade_equipamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read disponibilidade"
  ON public.bd_disponibilidade_equipamentos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert disponibilidade"
  ON public.bd_disponibilidade_equipamentos FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update disponibilidade"
  ON public.bd_disponibilidade_equipamentos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_disp_equipamento_id ON public.bd_disponibilidade_equipamentos(equipamento_id);
CREATE INDEX idx_disp_centro_custo_id ON public.bd_disponibilidade_equipamentos(centro_custo_id);
CREATE INDEX idx_disp_status ON public.bd_disponibilidade_equipamentos(status_operacional);

-- TABELA 2: Localização de Equipamentos
CREATE TABLE public.bd_localizacao_equipamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipamento_id uuid NOT NULL REFERENCES public.bd_caminhoes_equipamentos(id) ON DELETE CASCADE,
  centro_custo_id uuid REFERENCES public.bd_centros_custo(id) ON DELETE SET NULL,
  latitude numeric,
  longitude numeric,
  origem origem_localizacao_enum DEFAULT 'CENTRO_CUSTO',
  data_registro timestamptz DEFAULT now()
);

ALTER TABLE public.bd_localizacao_equipamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read localizacao"
  ON public.bd_localizacao_equipamentos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert localizacao"
  ON public.bd_localizacao_equipamentos FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update localizacao"
  ON public.bd_localizacao_equipamentos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_loc_equipamento_id ON public.bd_localizacao_equipamentos(equipamento_id);
CREATE INDEX idx_loc_centro_custo_id ON public.bd_localizacao_equipamentos(centro_custo_id);

-- TABELA 3: Solicitações de Equipamento
CREATE TABLE public.bd_solicitacoes_equipamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centro_custo_id uuid NOT NULL REFERENCES public.bd_centros_custo(id) ON DELETE RESTRICT,
  solicitante_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tipo_equipamento_id uuid REFERENCES public.bd_tipos_equipamento(id) ON DELETE SET NULL,
  quantidade integer NOT NULL DEFAULT 1,
  data_inicio date NOT NULL,
  tempo_previsto_dias integer,
  regime_trabalho text,
  com_operador boolean DEFAULT false,
  prioridade prioridade_solicitacao_enum NOT NULL DEFAULT 'NORMAL',
  justificativa text NOT NULL,
  status status_solicitacao_equip_enum NOT NULL DEFAULT 'ABERTO',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.bd_solicitacoes_equipamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read solicitacoes_equip"
  ON public.bd_solicitacoes_equipamento FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert solicitacoes_equip"
  ON public.bd_solicitacoes_equipamento FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update solicitacoes_equip"
  ON public.bd_solicitacoes_equipamento FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_solic_centro_custo_id ON public.bd_solicitacoes_equipamento(centro_custo_id);
CREATE INDEX idx_solic_tipo_equip_id ON public.bd_solicitacoes_equipamento(tipo_equipamento_id);
CREATE INDEX idx_solic_status ON public.bd_solicitacoes_equipamento(status);
CREATE INDEX idx_solic_prioridade ON public.bd_solicitacoes_equipamento(prioridade);
