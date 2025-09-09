-- Fix function search path security warnings
CREATE OR REPLACE FUNCTION public.fn_calc_valor_total_item()
RETURNS TRIGGER AS $$
BEGIN
  NEW.valor_total := COALESCE(NEW.quantidade,0) * COALESCE(NEW.valor_unitario,0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

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
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.fn_recalcula_total_os_from_row()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.fn_recalcula_total_os(COALESCE(NEW.os_id, OLD.os_id));
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SET search_path = public;