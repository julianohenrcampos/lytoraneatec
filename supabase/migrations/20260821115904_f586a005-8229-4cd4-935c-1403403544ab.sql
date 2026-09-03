DO $$
DECLARE d text;
BEGIN
  SELECT pg_get_functiondef('public.fn_ct_mov_direta_salvar_rascunho(uuid,jsonb,uuid)'::regprocedure) INTO d;
  IF position('destino_cc_endereco_snapshot = c.endereco,' in d) = 0 THEN
    RAISE EXCEPTION 'PADRAO_NAO_ENCONTRADO';
  END IF;
  d := replace(d, 'destino_cc_endereco_snapshot = c.endereco,', 'destino_cc_endereco_snapshot = c.endereco_completo,');
  EXECUTE d;
END $$;