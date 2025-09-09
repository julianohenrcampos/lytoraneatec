-- Criar FKs e índices para garantir integridade relacional
-- FK e índice materiais
ALTER TABLE bd_os_materiais_utilizados
  ADD CONSTRAINT IF NOT EXISTS fk_material_os
  FOREIGN KEY (os_id) REFERENCES bd_ordens_servico(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_material_os_id
  ON bd_os_materiais_utilizados(os_id);

-- FK e índice mão de obra
ALTER TABLE bd_os_mao_obra
  ADD CONSTRAINT IF NOT EXISTS fk_mao_obra_os
  FOREIGN KEY (os_id) REFERENCES bd_ordens_servico(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_mao_obra_os_id
  ON bd_os_mao_obra(os_id);

-- Trigger para manter valor_total consistente nos itens
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