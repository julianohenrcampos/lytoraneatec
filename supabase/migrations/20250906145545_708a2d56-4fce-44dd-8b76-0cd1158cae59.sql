-- FKs e índices (corrigido - sem IF NOT EXISTS para constraints)
DO $$ 
BEGIN
    -- Adicionar FK para bd_os_materiais_utilizados se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_material_os' 
        AND table_name = 'bd_os_materiais_utilizados'
    ) THEN
        ALTER TABLE bd_os_materiais_utilizados
        ADD CONSTRAINT fk_material_os
        FOREIGN KEY (os_id) REFERENCES bd_ordens_servico(id) ON DELETE CASCADE;
    END IF;
    
    -- Adicionar FK para bd_os_mao_obra se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_mao_obra_os' 
        AND table_name = 'bd_os_mao_obra'
    ) THEN
        ALTER TABLE bd_os_mao_obra
        ADD CONSTRAINT fk_mao_obra_os
        FOREIGN KEY (os_id) REFERENCES bd_ordens_servico(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Índices
CREATE INDEX IF NOT EXISTS idx_material_os_id ON bd_os_materiais_utilizados(os_id);
CREATE INDEX IF NOT EXISTS idx_mao_obra_os_id ON bd_os_mao_obra(os_id);

-- Trigger para manter valor_total consistente
CREATE OR REPLACE FUNCTION calc_valor_total_item() RETURNS TRIGGER AS $$
BEGIN
  NEW.valor_total := COALESCE(NEW.quantidade,0) * COALESCE(NEW.valor_unitario,0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calc_total_materiais ON bd_os_materiais_utilizados;
CREATE TRIGGER trg_calc_total_materiais
BEFORE INSERT OR UPDATE ON bd_os_materiais_utilizados
FOR EACH ROW EXECUTE FUNCTION calc_valor_total_item();

DROP TRIGGER IF EXISTS trg_calc_total_mao_obra ON bd_os_mao_obra;
CREATE TRIGGER trg_calc_total_mao_obra
BEFORE INSERT OR UPDATE ON bd_os_mao_obra
FOR EACH ROW EXECUTE FUNCTION calc_valor_total_item();

-- View de resumo financeiro por OS
CREATE OR REPLACE VIEW vw_os_resumo_financeiro AS
WITH m AS (
  SELECT os_id, SUM(valor_total) AS total_materiais
  FROM bd_os_materiais_utilizados
  GROUP BY os_id
),
l AS (
  SELECT os_id, SUM(valor_total) AS total_mao_obra
  FROM bd_os_mao_obra
  GROUP BY os_id
)
SELECT
  os.id AS os_id,
  COALESCE(m.total_materiais, 0) AS total_materiais,
  COALESCE(l.total_mao_obra, 0) AS total_mao_obra,
  COALESCE(m.total_materiais, 0) + COALESCE(l.total_mao_obra, 0) AS total_geral
FROM bd_ordens_servico os
LEFT JOIN m ON m.os_id = os.id
LEFT JOIN l ON l.os_id = os.id;