
-- Add responsibility columns to bd_solicitacoes_equipamento
ALTER TABLE bd_solicitacoes_equipamento
  ADD COLUMN IF NOT EXISTS engenheiro_solicitante_id uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS apontador_responsavel_id uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS aprovador_centro_custo_id uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS status_fluxo text DEFAULT 'RASCUNHO';

CREATE INDEX IF NOT EXISTS idx_solicitacao_equip_status_fluxo ON bd_solicitacoes_equipamento(status_fluxo);
CREATE INDEX IF NOT EXISTS idx_solicitacao_equip_engenheiro ON bd_solicitacoes_equipamento(engenheiro_solicitante_id);
CREATE INDEX IF NOT EXISTS idx_solicitacao_equip_apontador ON bd_solicitacoes_equipamento(apontador_responsavel_id);
CREATE INDEX IF NOT EXISTS idx_solicitacao_equip_aprovador ON bd_solicitacoes_equipamento(aprovador_centro_custo_id);

-- Create approvals table
CREATE TABLE bd_solicitacoes_equip_aprovacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id uuid REFERENCES bd_solicitacoes_equipamento(id) ON DELETE CASCADE NOT NULL,
  etapa_aprovacao text NOT NULL,
  aprovador_id uuid REFERENCES profiles(id),
  status text DEFAULT 'PENDENTE',
  comentario text,
  data_decisao timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_solicitacao_equip_aprov_solicitacao ON bd_solicitacoes_equip_aprovacoes(solicitacao_id);
CREATE INDEX IF NOT EXISTS idx_solicitacao_equip_aprov_aprovador ON bd_solicitacoes_equip_aprovacoes(aprovador_id);

ALTER TABLE bd_solicitacoes_equip_aprovacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read approvals"
  ON bd_solicitacoes_equip_aprovacoes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert approvals"
  ON bd_solicitacoes_equip_aprovacoes FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update approvals"
  ON bd_solicitacoes_equip_aprovacoes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Create transport planning table
CREATE TABLE bd_solicitacoes_planejamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id uuid REFERENCES bd_solicitacoes_equipamento(id) ON DELETE CASCADE NOT NULL,
  responsavel_transporte_id uuid REFERENCES profiles(id),
  data_prevista_entrega date,
  observacoes text,
  status text DEFAULT 'PENDENTE',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_solicitacao_planej_solicitacao ON bd_solicitacoes_planejamento(solicitacao_id);

ALTER TABLE bd_solicitacoes_planejamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read planning"
  ON bd_solicitacoes_planejamento FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert planning"
  ON bd_solicitacoes_planejamento FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update planning"
  ON bd_solicitacoes_planejamento FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
