
ALTER TABLE bd_portfolio_empresas
  DROP COLUMN IF EXISTS fabricante_id,
  DROP COLUMN IF EXISTS modelo_id,
  ADD COLUMN IF NOT EXISTS fabricante text,
  ADD COLUMN IF NOT EXISTS modelo text;
