CREATE OR REPLACE FUNCTION public.fn_check_email_autorizado(_email text)
RETURNS TABLE(autorizado boolean, motivo text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  IF _email IS NULL OR length(trim(both from _email)) = 0 THEN
    RETURN QUERY SELECT false, 'email_invalido'::text;
    RETURN;
  END IF;

  SELECT status
  INTO v_status
  FROM public.bd_funcionarios
  WHERE lower(trim(both from email)) = lower(trim(both from _email))
  ORDER BY created_at DESC NULLS LAST
  LIMIT 1;

  IF v_status IS NULL THEN
    RETURN QUERY SELECT false, 'email_nao_cadastrado'::text;
    RETURN;
  END IF;

  IF v_status NOT IN ('Ativo', 'Ativo sem Registro') THEN
    RETURN QUERY SELECT false, 'funcionario_inativo'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, NULL::text;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT false, 'erro_interno'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_check_email_autorizado(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_check_email_autorizado(text) TO anon, authenticated;