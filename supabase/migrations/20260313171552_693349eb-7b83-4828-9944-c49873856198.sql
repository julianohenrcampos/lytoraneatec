
-- Remover tabelas de alias
DROP TABLE IF EXISTS bd_centros_custo_alias CASCADE;
DROP TABLE IF EXISTS bd_funcoes_alias CASCADE;
DROP TABLE IF EXISTS bd_empresas_alias CASCADE;

-- Garantir unicidade do código do centro de custo
ALTER TABLE bd_centros_custo
ADD CONSTRAINT unique_codigo_centro_custo UNIQUE (codigo_centro_custo);
