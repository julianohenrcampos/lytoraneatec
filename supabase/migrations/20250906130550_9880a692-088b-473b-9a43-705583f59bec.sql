-- 1) Remover JSONB redundante
ALTER TABLE bd_ordens_servico
  DROP COLUMN IF EXISTS pecas_utilizadas;

-- 2) Garantir FKs e índices para materiais (idempotente)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_material_os' 
        AND table_name = 'bd_os_materiais_utilizados'
    ) THEN
        ALTER TABLE bd_os_materiais_utilizados
          ADD CONSTRAINT fk_material_os
          FOREIGN KEY (os_id) REFERENCES bd_ordens_servico(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_material_os_id
  ON bd_os_materiais_utilizados(os_id);

-- 3) Garantir FKs e índices para mão de obra (idempotente)
DO $$
BEGIN
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

CREATE INDEX IF NOT EXISTS idx_mao_obra_os_id
  ON bd_os_mao_obra(os_id);