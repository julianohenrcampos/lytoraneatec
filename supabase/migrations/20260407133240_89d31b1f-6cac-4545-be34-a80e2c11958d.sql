-- RPC para sincronizar valores de presencas com bd_funcoes + bd_feriados
CREATE OR REPLACE FUNCTION public.sync_presencas_valores_funcao()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  is_exclusivo BOOLEAN;
  valor_correto NUMERIC;
  total_checked INT := 0;
  total_updated INT := 0;
BEGIN
  FOR rec IN
    SELECT 
      p.id AS presenca_id,
      p.data,
      p.funcao_id,
      p.valor_diaria_aplicada,
      p.usar_diaria_exclusiva,
      p.tipo_diaria,
      f.valor_diaria AS func_valor_normal,
      f.valor_diaria_exclusiva AS func_valor_exclusiva
    FROM bd_diaria_presencas p
    JOIN bd_diaria_solicitacoes s ON s.id = p.solicitacao_id
    JOIN bd_funcoes f ON f.id = p.funcao_id
    WHERE s.status IN ('autorizada', 'em_andamento')
      AND p.presente = true
  LOOP
    total_checked := total_checked + 1;
    
    is_exclusivo := (EXTRACT(DOW FROM rec.data::date) IN (0, 6))
      OR EXISTS (SELECT 1 FROM bd_feriados WHERE data = rec.data);
    
    IF is_exclusivo THEN
      valor_correto := COALESCE(rec.func_valor_exclusiva, rec.func_valor_normal, 0);
    ELSE
      valor_correto := COALESCE(rec.func_valor_normal, 0);
    END IF;
    
    IF rec.tipo_diaria = 'meia' THEN
      valor_correto := valor_correto * 0.5;
    ELSIF rec.tipo_diaria = 'uma_e_meia' THEN
      valor_correto := valor_correto * 1.5;
    ELSIF rec.tipo_diaria = 'nenhuma' THEN
      valor_correto := 0;
    END IF;
    
    IF rec.valor_diaria_aplicada IS DISTINCT FROM valor_correto
       OR rec.usar_diaria_exclusiva IS DISTINCT FROM is_exclusivo
    THEN
      UPDATE bd_diaria_presencas
      SET valor_diaria_aplicada = valor_correto,
          usar_diaria_exclusiva = is_exclusivo,
          updated_at = now()
      WHERE id = rec.presenca_id;
      
      total_updated := total_updated + 1;
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'total_checked', total_checked,
    'total_updated', total_updated
  );
END;
$$;

SELECT public.sync_presencas_valores_funcao();