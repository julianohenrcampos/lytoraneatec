
-- ============================================
-- Fase 3: Ponto Eletrônico — Consolidação
-- ============================================

-- 1.1 Novos campos em bd_ponto_config
ALTER TABLE bd_ponto_config
  ADD COLUMN IF NOT EXISTS modo_geofence TEXT DEFAULT 'flexivel',
  ADD COLUMN IF NOT EXISTS permite_offline_pwa BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS intervalo_obrigatorio BOOLEAN DEFAULT true;

-- 1.2 Novos campos em bd_ponto_batidas
ALTER TABLE bd_ponto_batidas
  ADD COLUMN IF NOT EXISTS tipo_registro TEXT DEFAULT 'controle_jornada',
  ADD COLUMN IF NOT EXISTS score_risco INTEGER DEFAULT 0;

-- 1.3 Tabela bd_ponto_apontamento_integracao
CREATE TABLE IF NOT EXISTS bd_ponto_apontamento_integracao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batida_id UUID NOT NULL REFERENCES bd_ponto_batidas(id) ON DELETE CASCADE,
  apontamento_id UUID NOT NULL REFERENCES bd_apontamento_equipe(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(batida_id, apontamento_id)
);

ALTER TABLE bd_ponto_apontamento_integracao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ponto_apontamento_integracao_select"
  ON bd_ponto_apontamento_integracao FOR SELECT TO authenticated
  USING (
    is_ponto_superadmin()
    OR has_ponto_permission('ponto_visualizar_todos')
  );

-- 1.4 Tabela bd_ponto_diaria_integracao
CREATE TABLE IF NOT EXISTS bd_ponto_diaria_integracao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batida_id UUID NOT NULL REFERENCES bd_ponto_batidas(id) ON DELETE CASCADE,
  presenca_diaria_id UUID NOT NULL REFERENCES bd_diaria_presencas(id) ON DELETE CASCADE,
  solicitacao_id UUID NOT NULL REFERENCES bd_diaria_solicitacoes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(batida_id, presenca_diaria_id)
);

ALTER TABLE bd_ponto_diaria_integracao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ponto_diaria_integracao_select"
  ON bd_ponto_diaria_integracao FOR SELECT TO authenticated
  USING (
    is_ponto_superadmin()
    OR has_ponto_permission('ponto_visualizar_todos')
  );

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_ponto_apontamento_integracao_batida ON bd_ponto_apontamento_integracao(batida_id);
CREATE INDEX IF NOT EXISTS idx_ponto_diaria_integracao_batida ON bd_ponto_diaria_integracao(batida_id);
CREATE INDEX IF NOT EXISTS idx_ponto_batidas_tipo_registro ON bd_ponto_batidas(tipo_registro);
CREATE INDEX IF NOT EXISTS idx_ponto_batidas_score_risco ON bd_ponto_batidas(score_risco) WHERE score_risco >= 2;
