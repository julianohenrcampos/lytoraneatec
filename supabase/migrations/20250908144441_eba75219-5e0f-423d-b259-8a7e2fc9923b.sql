-- ============ CHAVES E ÍNDICES ============

-- Materiais
ALTER TABLE public.bd_os_materiais_utilizados
  ALTER COLUMN os_id SET NOT NULL;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_material_os') THEN
    ALTER TABLE public.bd_os_materiais_utilizados
      ADD CONSTRAINT fk_material_os
      FOREIGN KEY (os_id) REFERENCES public.bd_ordens_servico(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_material_os_id
  ON public.bd_os_materiais_utilizados(os_id);

-- Mão de Obra
ALTER TABLE public.bd_os_mao_obra
  ALTER COLUMN os_id SET NOT NULL;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_mao_obra_os') THEN
    ALTER TABLE public.bd_os_mao_obra
      ADD CONSTRAINT fk_mao_obra_os
      FOREIGN KEY (os_id) REFERENCES public.bd_ordens_servico(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mao_obra_os_id
  ON public.bd_os_mao_obra(os_id);

-- ============ TRIGGERS DE CÁLCULO POR ITEM ============
-- valor_total = quantidade * valor_unitario

CREATE OR REPLACE FUNCTION public.fn_calc_valor_total_item()
RETURNS TRIGGER AS $$
BEGIN
  NEW.valor_total := COALESCE(NEW.quantidade,0) * COALESCE(NEW.valor_unitario,0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calc_total_materiais ON public.bd_os_materiais_utilizados;
CREATE TRIGGER trg_calc_total_materiais
BEFORE INSERT OR UPDATE ON public.bd_os_materiais_utilizados
FOR EACH ROW EXECUTE FUNCTION public.fn_calc_valor_total_item();

DROP TRIGGER IF EXISTS trg_calc_total_mao_obra ON public.bd_os_mao_obra;
CREATE TRIGGER trg_calc_total_mao_obra
BEFORE INSERT OR UPDATE ON public.bd_os_mao_obra
FOR EACH ROW EXECUTE FUNCTION public.fn_calc_valor_total_item();

-- ============ TRIGGER DE AGREGAÇÃO NA OS ============
-- Mantém bd_ordens_servico.valor_servico = total_materiais + total_mao_obra

CREATE OR REPLACE FUNCTION public.fn_recalcula_total_os(p_os_id uuid)
RETURNS void AS $$
DECLARE
  v_mat numeric := 0;
  v_mo  numeric := 0;
BEGIN
  SELECT COALESCE(SUM(valor_total),0) INTO v_mat
  FROM public.bd_os_materiais_utilizados WHERE os_id = p_os_id;

  SELECT COALESCE(SUM(valor_total),0) INTO v_mo
  FROM public.bd_os_mao_obra WHERE os_id = p_os_id;

  UPDATE public.bd_ordens_servico
     SET valor_servico = COALESCE(v_mat,0) + COALESCE(v_mo,0),
         updated_at    = NOW()
   WHERE id = p_os_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.fn_recalcula_total_os_from_row()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.fn_recalcula_total_os(COALESCE(NEW.os_id, OLD.os_id));
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Aciona após mudanças nas tabelas filhas
DROP TRIGGER IF EXISTS trg_recalc_total_materiais ON public.bd_os_materiais_utilizados;
CREATE TRIGGER trg_recalc_total_materiais
AFTER INSERT OR UPDATE OR DELETE ON public.bd_os_materiais_utilizados
FOR EACH ROW EXECUTE FUNCTION public.fn_recalcula_total_os_from_row();

DROP TRIGGER IF EXISTS trg_recalc_total_mao_obra ON public.bd_os_mao_obra;
CREATE TRIGGER trg_recalc_total_mao_obra
AFTER INSERT OR UPDATE OR DELETE ON public.bd_os_mao_obra
FOR EACH ROW EXECUTE FUNCTION public.fn_recalcula_total_os_from_row();