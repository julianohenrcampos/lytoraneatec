
-- Bloco A: Catálogo Técnico de Equipamentos
CREATE TABLE bd_catalogo_equipamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_equipamento_id uuid REFERENCES bd_tipos_equipamento(id),
  categoria_id uuid REFERENCES bd_categorias_ativos(id),
  subcategoria_id uuid REFERENCES bd_subcategorias_ativos(id),
  fabricante_id uuid REFERENCES bd_fabricantes(id),
  modelo_id uuid REFERENCES bd_modelos(id),
  ano_fabricacao_padrao integer,
  capacidade text,
  potencia text,
  combustivel text,
  cor_padrao text,
  motor_padrao text,
  descricao_padrao text,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE bd_catalogo_equipamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read catalogo" ON bd_catalogo_equipamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write catalogo" ON bd_catalogo_equipamentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update catalogo" ON bd_catalogo_equipamentos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete catalogo" ON bd_catalogo_equipamentos FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_catalogo_tipo ON bd_catalogo_equipamentos(tipo_equipamento_id);
CREATE INDEX idx_catalogo_categoria ON bd_catalogo_equipamentos(categoria_id);
CREATE INDEX idx_catalogo_fabricante ON bd_catalogo_equipamentos(fabricante_id);

-- Bloco B1: Evoluir bd_portfolio_empresas
ALTER TABLE bd_portfolio_empresas
  ADD COLUMN IF NOT EXISTS catalogo_equipamento_id uuid REFERENCES bd_catalogo_equipamentos(id),
  ADD COLUMN IF NOT EXISTS valor_ref_com_operador numeric,
  ADD COLUMN IF NOT EXISTS valor_ref_sem_operador numeric;

CREATE UNIQUE INDEX IF NOT EXISTS idx_portfolio_empresa_catalogo
  ON bd_portfolio_empresas(empresa_id, catalogo_equipamento_id)
  WHERE catalogo_equipamento_id IS NOT NULL;

-- Bloco C1: Vincular equipamento real ao catálogo
ALTER TABLE bd_caminhoes_equipamentos
  ADD COLUMN IF NOT EXISTS catalogo_equipamento_id uuid REFERENCES bd_catalogo_equipamentos(id);

CREATE INDEX IF NOT EXISTS idx_equip_catalogo ON bd_caminhoes_equipamentos(catalogo_equipamento_id);
