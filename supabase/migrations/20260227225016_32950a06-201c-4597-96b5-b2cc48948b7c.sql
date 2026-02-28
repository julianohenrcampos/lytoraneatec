CREATE OR REPLACE FUNCTION public.generate_numero_solicitacao()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_year text := extract(year from now())::text;
  v_last text;
  v_seq int;
BEGIN
  SELECT numero_solicitacao INTO v_last
  FROM bd_diaria_solicitacoes
  WHERE numero_solicitacao LIKE v_year || '-%'
  ORDER BY numero_solicitacao DESC
  LIMIT 1;

  IF v_last IS NULL THEN
    RETURN v_year || '-001';
  END IF;

  v_seq := split_part(v_last, '-', 2)::int + 1;
  RETURN v_year || '-' || lpad(v_seq::text, 3, '0');
END;
$$;