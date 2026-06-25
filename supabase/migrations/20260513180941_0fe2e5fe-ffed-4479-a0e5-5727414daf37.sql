
CREATE OR REPLACE FUNCTION public.__test_2d3e(p_case text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_msg text;
  v_state text;
  v_count int;
  v_rows jsonb;
BEGIN
  IF p_case = 'T3' THEN
    BEGIN
      PERFORM * FROM public.fn_aplicar_saneamento_auto(
        '0920853d-44ab-4753-9f95-eea52153245a',
        'Teste oficial T3 gate fisico fase 2D-3e',
        false, NULL, NULL);
      RETURN jsonb_build_object('ok', false, 'reason', 'no_exception');
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT, v_state = RETURNED_SQLSTATE;
      RETURN jsonb_build_object('ok', v_msg='execucao_real_bloqueada_na_fase_2d_3e', 'msg', v_msg, 'sqlstate', v_state);
    END;

  ELSIF p_case = 'T4' THEN
    BEGIN
      PERFORM * FROM public.fn_reverter_saneamento_auto(
        gen_random_uuid(),
        '0920853d-44ab-4753-9f95-eea52153245a',
        'Teste oficial T4 gate fisico reverter 2D-3e',
        false);
      RETURN jsonb_build_object('ok', false, 'reason', 'no_exception');
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
      RETURN jsonb_build_object('ok', v_msg='reversao_real_bloqueada_na_fase_2d_3e', 'msg', v_msg);
    END;

  ELSIF p_case = 'T5' THEN
    BEGIN
      PERFORM * FROM public.fn_aplicar_saneamento_auto(
        gen_random_uuid(),
        'Teste oficial T5 aprovador invalido fase 2D-3e',
        true, NULL, NULL);
      RETURN jsonb_build_object('ok', false, 'reason', 'no_exception');
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
      RETURN jsonb_build_object('ok', v_msg='aprovador_formal_invalido_ou_sem_acesso_global', 'msg', v_msg);
    END;

  ELSIF p_case = 'T6' THEN
    BEGIN
      PERFORM * FROM public.fn_aplicar_saneamento_auto(
        '0920853d-44ab-4753-9f95-eea52153245a',
        'curto',
        true, NULL, NULL);
      RETURN jsonb_build_object('ok', false, 'reason', 'no_exception');
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
      RETURN jsonb_build_object('ok', v_msg='motivo_execucao_minimo_20_caracteres', 'msg', v_msg);
    END;

  ELSIF p_case = 'T7' THEN
    SELECT jsonb_build_object(
      'total_rows',          count(*),
      'a1_count',            count(*) FILTER (WHERE tipo_correcao='A1'),
      'a2_count',            count(*) FILTER (WHERE tipo_correcao='A2'),
      'a3_count',            count(*) FILTER (WHERE tipo_correcao='A3'),
      'all_alta',            bool_and(confianca='ALTA'),
      'all_aplicado_false',  bool_and(aplicado=false),
      'all_dry_run_true',    bool_and(dry_run=true),
      'distinct_exec_ids',   count(DISTINCT execution_id),
      'sample',              (jsonb_agg(jsonb_build_object('tipo',tipo_correcao,'sol',solicitacao_id,'idx',item_idx_jsonb,'criterio',criterio_match,'fonte',fonte_sugestao)))->0
    )
    INTO v_rows
    FROM public.fn_aplicar_saneamento_auto(
      '0920853d-44ab-4753-9f95-eea52153245a',
      'Dry-run oficial Fase 2D-3e — saneamento AUTO sem aplicar',
      true, NULL, NULL);
    RETURN v_rows;
  END IF;

  RETURN jsonb_build_object('ok', false, 'reason', 'unknown_case');
END;
$$;

REVOKE ALL ON FUNCTION public.__test_2d3e(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.__test_2d3e(text) TO anon, authenticated, service_role;
