-- Corrigir função calc_valor_total_item para ter search_path seguro
CREATE OR REPLACE FUNCTION calc_valor_total_item() RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.valor_total := COALESCE(NEW.quantidade,0) * COALESCE(NEW.valor_unitario,0);
  RETURN NEW;
END;
$$;