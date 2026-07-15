DO $$
DECLARE
  v_function_def text;
  v_old_fragment text := 'ON CONFLICT (apontamento_id) DO UPDATE SET';
  v_new_fragment text := 'ON CONFLICT ON CONSTRAINT uq_localizacao_apontamento DO UPDATE SET';
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = 'public'
       AND t.relname = 'bd_localizacao_equipamentos'
       AND c.conname = 'uq_localizacao_apontamento'
  ) THEN
    RAISE EXCEPTION 'constraint_uq_localizacao_apontamento_nao_encontrada' USING ERRCODE = '42704';
  END IF;

  SELECT pg_get_functiondef('public.fn_salvar_apontamento_ce_com_inspecao(uuid,jsonb,jsonb)'::regprocedure)
    INTO v_function_def;

  IF v_function_def IS NULL THEN
    RAISE EXCEPTION 'funcao_fn_salvar_apontamento_ce_com_inspecao_nao_encontrada' USING ERRCODE = '42704';
  END IF;

  IF position(v_new_fragment IN v_function_def) > 0 THEN
    RETURN;
  END IF;

  IF position(v_old_fragment IN v_function_def) = 0 THEN
    RAISE EXCEPTION 'fragmento_on_conflict_apontamento_id_nao_encontrado' USING ERRCODE = '42704';
  END IF;

  v_function_def := replace(v_function_def, v_old_fragment, v_new_fragment);
  EXECUTE v_function_def;
END;
$$;