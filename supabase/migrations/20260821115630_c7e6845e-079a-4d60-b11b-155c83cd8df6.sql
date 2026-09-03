DO $$
DECLARE d text;
BEGIN
  SELECT pg_get_functiondef('public.fn_ct_mov_direta_salvar_rascunho(uuid,jsonb,uuid)'::regprocedure) INTO d;
  IF position('nome_centro_custo, endereco, latitude' in d) = 0 THEN
    RAISE EXCEPTION 'PADRAO_NAO_ENCONTRADO';
  END IF;
  d := replace(d, 'nome_centro_custo, endereco, latitude', 'nome_centro_custo, endereco_completo AS endereco, latitude');
  EXECUTE d;
END $$;