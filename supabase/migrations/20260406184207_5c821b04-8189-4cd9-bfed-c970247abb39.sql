CREATE UNIQUE INDEX IF NOT EXISTS idx_subcategorias_nome_unique
  ON bd_subcategorias_ativos (UPPER(TRIM(nome_subcategoria)));