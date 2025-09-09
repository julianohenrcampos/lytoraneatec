-- 1) Habilitar RLS e criar políticas temporárias permissivas
-- Tabela: bd_ordens_servico
ALTER TABLE public.bd_ordens_servico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "OS: select authenticated" ON public.bd_ordens_servico;
DROP POLICY IF EXISTS "OS: insert authenticated" ON public.bd_ordens_servico;
DROP POLICY IF EXISTS "OS: update authenticated" ON public.bd_ordens_servico;
DROP POLICY IF EXISTS "OS: delete authenticated" ON public.bd_ordens_servico;

CREATE POLICY "OS: select authenticated"
  ON public.bd_ordens_servico
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "OS: insert authenticated"
  ON public.bd_ordens_servico
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "OS: update authenticated"
  ON public.bd_ordens_servico
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "OS: delete authenticated"
  ON public.bd_ordens_servico
  FOR DELETE
  TO authenticated
  USING (true);

-- Tabela: bd_os_materiais_utilizados
ALTER TABLE public.bd_os_materiais_utilizados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "OS Materiais: select authenticated" ON public.bd_os_materiais_utilizados;
DROP POLICY IF EXISTS "OS Materiais: insert authenticated" ON public.bd_os_materiais_utilizados;
DROP POLICY IF EXISTS "OS Materiais: update authenticated" ON public.bd_os_materiais_utilizados;
DROP POLICY IF EXISTS "OS Materiais: delete authenticated" ON public.bd_os_materiais_utilizados;

CREATE POLICY "OS Materiais: select authenticated"
  ON public.bd_os_materiais_utilizados
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "OS Materiais: insert authenticated"
  ON public.bd_os_materiais_utilizados
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "OS Materiais: update authenticated"
  ON public.bd_os_materiais_utilizados
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "OS Materiais: delete authenticated"
  ON public.bd_os_materiais_utilizados
  FOR DELETE
  TO authenticated
  USING (true);

-- Tabela: bd_os_mao_obra
ALTER TABLE public.bd_os_mao_obra ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "OS Mão de Obra: select authenticated" ON public.bd_os_mao_obra;
DROP POLICY IF EXISTS "OS Mão de Obra: insert authenticated" ON public.bd_os_mao_obra;
DROP POLICY IF EXISTS "OS Mão de Obra: update authenticated" ON public.bd_os_mao_obra;
DROP POLICY IF EXISTS "OS Mão de Obra: delete authenticated" ON public.bd_os_mao_obra;

CREATE POLICY "OS Mão de Obra: select authenticated"
  ON public.bd_os_mao_obra
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "OS Mão de Obra: insert authenticated"
  ON public.bd_os_mao_obra
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "OS Mão de Obra: update authenticated"
  ON public.bd_os_mao_obra
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "OS Mão de Obra: delete authenticated"
  ON public.bd_os_mao_obra
  FOR DELETE
  TO authenticated
  USING (true);

-- 2) Garantir triggers de cálculo de valor_total e atualização de total da OS
-- Materiais: valor_total = quantidade * valor_unitario
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'tgr_calc_valor_total_os_materiais'
  ) THEN
    CREATE TRIGGER tgr_calc_valor_total_os_materiais
    BEFORE INSERT OR UPDATE ON public.bd_os_materiais_utilizados
    FOR EACH ROW EXECUTE FUNCTION public.fn_calc_valor_total_item();
  END IF;
END$$;

-- Mão de obra: valor_total = quantidade * valor_unitario
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'tgr_calc_valor_total_os_mao_obra'
  ) THEN
    CREATE TRIGGER tgr_calc_valor_total_os_mao_obra
    BEFORE INSERT OR UPDATE ON public.bd_os_mao_obra
    FOR EACH ROW EXECUTE FUNCTION public.fn_calc_valor_total_item();
  END IF;
END$$;

-- Recalcular valor total da OS ao mexer em materiais
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'tgr_recalc_total_os_mat'
  ) THEN
    CREATE TRIGGER tgr_recalc_total_os_mat
    AFTER INSERT OR UPDATE OR DELETE ON public.bd_os_materiais_utilizados
    FOR EACH ROW EXECUTE FUNCTION public.fn_recalcula_total_os_from_row();
  END IF;
END$$;

-- Recalcular valor total da OS ao mexer em mão de obra
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'tgr_recalc_total_os_mo'
  ) THEN
    CREATE TRIGGER tgr_recalc_total_os_mo
    AFTER INSERT OR UPDATE OR DELETE ON public.bd_os_mao_obra
    FOR EACH ROW EXECUTE FUNCTION public.fn_recalcula_total_os_from_row();
  END IF;
END$$;

-- 3) Garantir triggers de updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tgr_set_updated_at_bd_ordens_servico') THEN
    CREATE TRIGGER tgr_set_updated_at_bd_ordens_servico
    BEFORE UPDATE ON public.bd_ordens_servico
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tgr_set_updated_at_bd_os_materiais_utilizados') THEN
    CREATE TRIGGER tgr_set_updated_at_bd_os_materiais_utilizados
    BEFORE UPDATE ON public.bd_os_materiais_utilizados
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tgr_set_updated_at_bd_os_mao_obra') THEN
    CREATE TRIGGER tgr_set_updated_at_bd_os_mao_obra
    BEFORE UPDATE ON public.bd_os_mao_obra
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;
