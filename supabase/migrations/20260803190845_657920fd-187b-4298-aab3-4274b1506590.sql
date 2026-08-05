-- ============================================================
-- CT-2.3 — TESTES DE BANCO (assertivos, sem efeito colateral)
-- ============================================================
DO $tests$
DECLARE
  v_eq   uuid;
  v_ini  date := (timezone('America/Sao_Paulo', now())::date + 30);
  v_r    jsonb;
  v_src  text;
  v_actor uuid;
BEGIN
  -- Ator tecnico apenas para satisfazer os triggers de auditoria durante o teste.
  SELECT p.id INTO v_actor FROM public.profiles p
   WHERE coalesce(p.acesso_global, false) IS TRUE ORDER BY p.created_at ASC LIMIT 1;
  IF v_actor IS NULL THEN
    SELECT p.id INTO v_actor FROM public.profiles p ORDER BY p.created_at ASC LIMIT 1;
  END IF;
  IF v_actor IS NULL THEN RAISE EXCEPTION 'CT23_TESTE_SEM_ATOR'; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_actor::text)::text, true);

  -- fixture descartavel: equipamento real qualquer + linha de disponibilidade temporaria
  SELECT e.id INTO v_eq FROM public.bd_caminhoes_equipamentos e LIMIT 1;
  IF v_eq IS NULL THEN RAISE EXCEPTION 'CT23_TESTE_SEM_FIXTURE'; END IF;

  CREATE TEMP TABLE ct23_bkp AS
    SELECT * FROM public.bd_disponibilidade_equipamentos WHERE equipamento_id = v_eq;
  DELETE FROM public.bd_disponibilidade_equipamentos WHERE equipamento_id = v_eq;

  -- TESTE 3: data_inicio futura bloqueia periodo anterior
  INSERT INTO public.bd_disponibilidade_equipamentos (equipamento_id, status_operacional, data_inicio)
  VALUES (v_eq, 'DISPONIVEL', v_ini);

  v_r := public.fn_ct_avaliar_disponibilidade(v_eq, 'INTERNO', v_ini - 5);
  IF (v_r->>'ok')::boolean IS NOT FALSE THEN
    RAISE EXCEPTION 'CT23_T3_FALHOU: ok deveria ser false (%)', v_r;
  END IF;
  IF v_r->>'motivo_codigo' <> 'CT2_ATIVO_AINDA_NAO_DISPONIVEL' THEN
    RAISE EXCEPTION 'CT23_T3_FALHOU: motivo_codigo inesperado (%)', v_r;
  END IF;
  IF (v_r->>'disponivel_a_partir_de')::date <> v_ini THEN
    RAISE EXCEPTION 'CT23_T3_FALHOU: disponivel_a_partir_de inesperado (%)', v_r;
  END IF;

  -- TESTE 5: o novo bloqueio nao admite override
  IF (v_r->>'override')::boolean IS NOT FALSE THEN
    RAISE EXCEPTION 'CT23_T5_FALHOU: override deveria ser false (%)', v_r;
  END IF;

  -- TESTE 4: data compativel permite (igual e posterior)
  v_r := public.fn_ct_avaliar_disponibilidade(v_eq, 'INTERNO', v_ini);
  IF (v_r->>'ok')::boolean IS NOT TRUE OR v_r ? 'motivo_codigo' THEN
    RAISE EXCEPTION 'CT23_T4_FALHOU (data igual): %', v_r;
  END IF;
  v_r := public.fn_ct_avaliar_disponibilidade(v_eq, 'INTERNO', v_ini + 10);
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'CT23_T4_FALHOU (data posterior): %', v_r;
  END IF;

  -- data_inicio NULL preserva comportamento permitido
  UPDATE public.bd_disponibilidade_equipamentos SET data_inicio = NULL WHERE equipamento_id = v_eq;
  v_r := public.fn_ct_avaliar_disponibilidade(v_eq, 'INTERNO', v_ini - 5);
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'CT23_T4B_FALHOU (data_inicio nula): %', v_r;
  END IF;

  -- SEM_REGISTRO preservado
  DELETE FROM public.bd_disponibilidade_equipamentos WHERE equipamento_id = v_eq;
  v_r := public.fn_ct_avaliar_disponibilidade(v_eq, 'INTERNO', v_ini);
  IF v_r->>'status' <> 'SEM_REGISTRO' OR (v_r->>'override')::boolean IS NOT FALSE THEN
    RAISE EXCEPTION 'CT23_SEM_REGISTRO_FALHOU: %', v_r;
  END IF;

  -- MANUTENCAO preservado (override permitido)
  INSERT INTO public.bd_disponibilidade_equipamentos (equipamento_id, status_operacional, previsao_liberacao)
  VALUES (v_eq, 'MANUTENCAO', v_ini);
  v_r := public.fn_ct_avaliar_disponibilidade(v_eq, 'INTERNO', v_ini - 5);
  IF (v_r->>'override')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'CT23_MANUTENCAO_FALHOU: %', v_r;
  END IF;
  -- RESERVA_FUTURA coberta por previsao_liberacao preservada
  v_r := public.fn_ct_avaliar_disponibilidade(v_eq, 'RESERVA_FUTURA', v_ini);
  IF (v_r->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'CT23_RESERVA_FUTURA_FALHOU: %', v_r;
  END IF;

  -- restaura estado original do fixture
  DELETE FROM public.bd_disponibilidade_equipamentos WHERE equipamento_id = v_eq;
  INSERT INTO public.bd_disponibilidade_equipamentos SELECT * FROM ct23_bkp;
  DROP TABLE ct23_bkp;

  -- TESTES 6/7: chamadores propagam o novo erro estruturado
  FOREACH v_src IN ARRAY ARRAY['fn_ct_atendimento_atribuir','fn_ct_atendimento_substituir'] LOOP
    DECLARE v_body text; BEGIN
      SELECT p.prosrc INTO v_body FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='public' AND p.proname=v_src;
      IF position('MESSAGE = ''CT2_ATIVO_AINDA_NAO_DISPONIVEL''' in v_body) = 0 THEN
        RAISE EXCEPTION 'CT23_T67_FALHOU: % nao propaga MESSAGE estruturada', v_src;
      END IF;
      IF position('disponivel_a_partir_de' in v_body) = 0 THEN
        RAISE EXCEPTION 'CT23_T67_FALHOU: % nao envia DETAIL com a data', v_src;
      END IF;
      -- TESTES 8/9/10: invariantes CT-2.2 preservadas
      IF position('pg_advisory_xact_lock' in v_body) = 0 THEN
        RAISE EXCEPTION 'CT23_T9_FALHOU: % perdeu advisory lock', v_src;
      END IF;
      IF position('CT2_IDEMPOTENCY_KEY_REUSED' in v_body) = 0
         OR position('''replay'', true' in v_body) = 0 THEN
        RAISE EXCEPTION 'CT23_T8_FALHOU: % perdeu replay idempotente', v_src;
      END IF;
      IF position('excl_sia_equip_periodo_ativo' in v_body) = 0
         OR position('exclusion_violation' in v_body) = 0 THEN
        RAISE EXCEPTION 'CT23_T10_FALHOU: % perdeu tratamento 23P01', v_src;
      END IF;
      IF position('CT2_DISPONIBILIDADE_SEM_REGISTRO' in v_body) = 0 THEN
        RAISE EXCEPTION 'CT23_G0_FALHOU: % perdeu gate SEM_REGISTRO', v_src;
      END IF;
    END;
  END LOOP;

  RAISE NOTICE 'CT23_TESTES_OK';
END
$tests$;