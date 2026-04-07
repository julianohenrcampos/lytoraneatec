
-- Portfolio: adicionar fabricante, modelo, ano
ALTER TABLE bd_portfolio_empresas
  ADD COLUMN IF NOT EXISTS fabricante_id uuid REFERENCES bd_fabricantes(id),
  ADD COLUMN IF NOT EXISTS modelo_id uuid REFERENCES bd_modelos(id),
  ADD COLUMN IF NOT EXISTS ano_fabricacao text;

-- Equipamentos: capacidade estruturada
ALTER TABLE bd_caminhoes_equipamentos
  ADD COLUMN IF NOT EXISTS capacidade_valor numeric,
  ADD COLUMN IF NOT EXISTS capacidade_unidade text;
