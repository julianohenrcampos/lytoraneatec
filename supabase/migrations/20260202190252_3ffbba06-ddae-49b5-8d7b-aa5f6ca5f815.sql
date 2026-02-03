-- =====================================================
-- MIGRAÇÃO: Extensão da Solicitação de Diária
-- Período, Toggle e Estimativa
-- =====================================================

-- 1. Criar tabela de feriados
CREATE TABLE IF NOT EXISTS bd_feriados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  tipo TEXT DEFAULT 'nacional' CHECK (tipo IN ('nacional', 'estadual', 'municipal')),
  uf TEXT,
  municipio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para busca rápida por período
CREATE INDEX IF NOT EXISTS idx_feriados_data ON bd_feriados(data);

-- RLS para feriados
ALTER TABLE bd_feriados ENABLE ROW LEVEL SECURITY;

-- Política de leitura pública para feriados
CREATE POLICY "Feriados são públicos para leitura"
  ON bd_feriados FOR SELECT
  TO authenticated
  USING (true);

-- Inserir feriados nacionais de 2025 e 2026
INSERT INTO bd_feriados (data, nome, tipo) VALUES
  -- 2025
  ('2025-01-01', 'Confraternização Universal', 'nacional'),
  ('2025-03-03', 'Carnaval', 'nacional'),
  ('2025-03-04', 'Carnaval', 'nacional'),
  ('2025-04-18', 'Sexta-feira Santa', 'nacional'),
  ('2025-04-21', 'Tiradentes', 'nacional'),
  ('2025-05-01', 'Dia do Trabalho', 'nacional'),
  ('2025-06-19', 'Corpus Christi', 'nacional'),
  ('2025-09-07', 'Independência do Brasil', 'nacional'),
  ('2025-10-12', 'Nossa Senhora Aparecida', 'nacional'),
  ('2025-11-02', 'Finados', 'nacional'),
  ('2025-11-15', 'Proclamação da República', 'nacional'),
  ('2025-12-25', 'Natal', 'nacional'),
  -- 2026
  ('2026-01-01', 'Confraternização Universal', 'nacional'),
  ('2026-02-16', 'Carnaval', 'nacional'),
  ('2026-02-17', 'Carnaval', 'nacional'),
  ('2026-04-03', 'Sexta-feira Santa', 'nacional'),
  ('2026-04-21', 'Tiradentes', 'nacional'),
  ('2026-05-01', 'Dia do Trabalho', 'nacional'),
  ('2026-06-04', 'Corpus Christi', 'nacional'),
  ('2026-09-07', 'Independência do Brasil', 'nacional'),
  ('2026-10-12', 'Nossa Senhora Aparecida', 'nacional'),
  ('2026-11-02', 'Finados', 'nacional'),
  ('2026-11-15', 'Proclamação da República', 'nacional'),
  ('2026-12-25', 'Natal', 'nacional')
ON CONFLICT (data) DO NOTHING;

-- 2. Alterar tabela bd_diaria_solicitacoes
-- Renomear 'data' para 'data_inicio'
ALTER TABLE bd_diaria_solicitacoes RENAME COLUMN data TO data_inicio;

-- Adicionar coluna data_fim
ALTER TABLE bd_diaria_solicitacoes ADD COLUMN data_fim DATE;

-- Atualizar registros existentes (data_fim = data_inicio para manter compatibilidade)
UPDATE bd_diaria_solicitacoes SET data_fim = data_inicio WHERE data_fim IS NULL;

-- Tornar data_fim obrigatório
ALTER TABLE bd_diaria_solicitacoes ALTER COLUMN data_fim SET NOT NULL;

-- Adicionar campos de estimativa
ALTER TABLE bd_diaria_solicitacoes ADD COLUMN considera_fds_feriado BOOLEAN DEFAULT FALSE;
ALTER TABLE bd_diaria_solicitacoes ADD COLUMN qtde_dias_uteis_estimado INTEGER DEFAULT 0;
ALTER TABLE bd_diaria_solicitacoes ADD COLUMN qtde_fds_estimado INTEGER DEFAULT 0;
ALTER TABLE bd_diaria_solicitacoes ADD COLUMN qtde_feriados_estimado INTEGER DEFAULT 0;
ALTER TABLE bd_diaria_solicitacoes ADD COLUMN valor_estimado_total NUMERIC(12,2) DEFAULT 0;

-- Adicionar coluna convocados_pre (JSONB) se não existir
ALTER TABLE bd_diaria_solicitacoes ADD COLUMN IF NOT EXISTS convocados_pre JSONB DEFAULT '[]'::jsonb;