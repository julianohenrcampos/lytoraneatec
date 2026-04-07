
-- 1. Mover referencias do inativo para o ativo (IDs corretos)
UPDATE bd_funcionarios SET centro_custo_id = '3af7cc29-de49-4bbd-b5f9-088461937440'
WHERE centro_custo_id = 'fccb8e1f-fcd8-4b7a-b79f-c8f2c69d3f6a';

-- 2. Excluir o duplicado inativo
DELETE FROM bd_centros_custo WHERE id = 'fccb8e1f-fcd8-4b7a-b79f-c8f2c69d3f6a';

-- 3. Normalizar todos os codigos
UPDATE bd_centros_custo SET codigo_centro_custo = TRIM(codigo_centro_custo)
WHERE codigo_centro_custo != TRIM(codigo_centro_custo);

-- 4. Remover constraint antiga e criar indice UNIQUE case-insensitive
ALTER TABLE bd_centros_custo DROP CONSTRAINT IF EXISTS bd_centros_custo_codigo_centro_custo_key;
CREATE UNIQUE INDEX idx_centros_custo_codigo_unique ON bd_centros_custo (UPPER(TRIM(codigo_centro_custo)));
