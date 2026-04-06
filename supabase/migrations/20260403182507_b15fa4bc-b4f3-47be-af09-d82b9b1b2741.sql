
-- Tabela bd_movimentacoes
CREATE TABLE bd_movimentacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id uuid REFERENCES bd_solicitacoes_equipamento(id) ON DELETE CASCADE NOT NULL,
  solicitacao_planejamento_id uuid REFERENCES bd_solicitacoes_planejamento(id),
  equipamento_id uuid REFERENCES bd_caminhoes_equipamentos(id),
  origem_tipo text NOT NULL,
  origem_id uuid,
  destino_tipo text NOT NULL,
  destino_id uuid,
  tipo_deslocamento text,
  responsavel_transporte text,
  tipo_atendimento text,
  distancia_km numeric,
  valor_km numeric,
  custo_total numeric,
  prazo_estimado_horas numeric,
  status text DEFAULT 'PLANEJADA',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE bd_movimentacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users full access movimentacoes" ON bd_movimentacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tabela bd_movimentacao_transporte
CREATE TABLE bd_movimentacao_transporte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movimentacao_id uuid REFERENCES bd_movimentacoes(id) ON DELETE CASCADE NOT NULL,
  tipo_transporte text,
  caminhao_id uuid REFERENCES bd_caminhoes_equipamentos(id),
  motorista_id uuid,
  empresa_id uuid REFERENCES bd_empresas(id),
  motorista_nome text,
  motorista_cpf text,
  placa text,
  observacoes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE bd_movimentacao_transporte ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users full access mov_transporte" ON bd_movimentacao_transporte FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tabela bd_movimentacao_saida
CREATE TABLE bd_movimentacao_saida (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movimentacao_id uuid REFERENCES bd_movimentacoes(id) ON DELETE CASCADE NOT NULL,
  horimetro numeric,
  combustivel text,
  checklist_json jsonb,
  fotos_json jsonb,
  latitude numeric,
  longitude numeric,
  data_hora timestamptz DEFAULT now(),
  responsavel_id uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE bd_movimentacao_saida ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users full access mov_saida" ON bd_movimentacao_saida FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Indices
CREATE INDEX idx_movimentacoes_solicitacao ON bd_movimentacoes(solicitacao_id);
CREATE INDEX idx_movimentacoes_status ON bd_movimentacoes(status);
CREATE INDEX idx_mov_transporte_movimentacao ON bd_movimentacao_transporte(movimentacao_id);
CREATE INDEX idx_mov_saida_movimentacao ON bd_movimentacao_saida(movimentacao_id);
