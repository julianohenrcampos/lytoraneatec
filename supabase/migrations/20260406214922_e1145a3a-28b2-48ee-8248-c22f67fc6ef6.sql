
-- A) Colunas de integração em bd_empresas
ALTER TABLE bd_empresas
  ADD COLUMN IF NOT EXISTS origem_cadastro TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS aprovado_compliance BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_integracao TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS atualizado_via_integracao BOOLEAN DEFAULT false;

-- B) Tabela de log de integração
CREATE TABLE IF NOT EXISTS bd_integracao_fornecedores_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origem TEXT DEFAULT 'site',
  fornecedor_externo_id TEXT,
  cnpj TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  status_processamento TEXT DEFAULT 'pendente'
    CHECK (status_processamento IN ('pendente','sucesso','erro','duplicado')),
  mensagem TEXT,
  empresa_id_gerada UUID REFERENCES bd_empresas(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

ALTER TABLE bd_integracao_fornecedores_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read logs"
  ON bd_integracao_fornecedores_log FOR SELECT
  TO authenticated USING (true);
