-- ============================================================
-- CT-2.3 / MIGRATION 2 — data_inicio respeitada no servidor
-- ============================================================

DO $guard$
DECLARE
  v_a text; v_b text; v_c text;
BEGIN
  SELECT md5(p.prosrc) INTO v_a FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='fn_ct_avaliar_disponibilidade'
     AND pg_catalog.oidvectortypes(p.proargtypes)='uuid, text, date';
  SELECT md5(p.prosrc) INTO v_b FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='fn_ct_atendimento_atribuir'
     AND pg_catalog.oidvectortypes(p.proargtypes)='uuid, uuid, text, uuid, date, date, text';
  SELECT md5(p.prosrc) INTO v_c FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='fn_ct_atendimento_substituir'
     AND pg_catalog.oidvectortypes(p.proargtypes)='uuid, uuid, text, text, uuid, text';

  IF v_a IS DISTINCT FROM 'ea739d349e4fa76a54bc9ff0575d831d' THEN
    RAISE EXCEPTION 'CT23_GUARD_AVALIAR: hash inesperado (%)', v_a;
  END IF;
  IF v_b IS DISTINCT FROM '19ee64cda57a0cede3f4f8bdfa742d89' THEN
    RAISE EXCEPTION 'CT23_GUARD_ATRIBUIR: hash inesperado (%)', v_b;
  END IF;
  IF v_c IS DISTINCT FROM '9aaee5050c509837c3abb64f2ff48953' THEN
    RAISE EXCEPTION 'CT23_GUARD_SUBSTITUIR: hash inesperado (%)', v_c;
  END IF;
END
$guard$;

-- ------------------------------------------------------------
-- 1) fn_ct_avaliar_disponibilidade: carrega data_inicio
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_ct_avaliar_disponibilidade(p_equipamento_id uuid, p_modalidade text, p_periodo_inicio date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_d record;
BEGIN
  SELECT d.id, d.status_operacional::text AS status_operacional, d.previsao_liberacao,
         d.centro_custo_id, d.confiabilidade_previsao::text AS confiabilidade_previsao,
         d.data_inicio
    INTO v_d
    FROM public.bd_disponibilidade_equipamentos d
   WHERE d.equipamento_id = p_equipamento_id
   ORDER BY d.updated_at DESC NULLS LAST,
            d.created_at DESC NULLS LAST,
            d.id DESC
   LIMIT 1;

  -- Reconciliacao CT-1: ausencia de linha nao descarta o ativo.
  IF v_d.id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'SEM_REGISTRO',
      'ok', false,
      'override', false,
      'reconciliado', false,
      'previsao_liberacao', NULL,
      'confiabilidade', NULL,
      'centro_custo_id', NULL,
      'motivo', 'O ativo nao possui disponibilidade operacional confirmada.'
    );
  END IF;

  IF v_d.status_operacional = 'DISPONIVEL' THEN
    -- CT-2.3: disponibilidade so vale a partir de data_inicio (sem override).
    IF v_d.data_inicio IS NOT NULL
       AND p_periodo_inicio IS NOT NULL
       AND v_d.data_inicio > p_periodo_inicio THEN
      RETURN jsonb_build_object(
        'status', v_d.status_operacional,
        'ok', false,
        'override', false,
        'reconciliado', false,
        'previsao_liberacao', v_d.previsao_liberacao,
        'confiabilidade', v_d.confiabilidade_previsao,
        'centro_custo_id', v_d.centro_custo_id,
        'motivo_codigo', 'CT2_ATIVO_AINDA_NAO_DISPONIVEL',
        'disponivel_a_partir_de', v_d.data_inicio,
        'motivo', 'Ativo disponivel somente a partir da data de inicio da disponibilidade.'
      );
    END IF;

    RETURN jsonb_build_object(
      'status', v_d.status_operacional,
      'ok', true,
      'override', false,
      'reconciliado', false,
      'previsao_liberacao', v_d.previsao_liberacao,
      'confiabilidade', v_d.confiabilidade_previsao,
      'centro_custo_id', v_d.centro_custo_id,
      'motivo', 'Ativo disponivel.'
    );
  END IF;

  IF p_modalidade = 'RESERVA_FUTURA'
     AND v_d.previsao_liberacao IS NOT NULL
     AND p_periodo_inicio IS NOT NULL
     AND v_d.previsao_liberacao <= p_periodo_inicio THEN
    RETURN jsonb_build_object(
      'status', v_d.status_operacional,
      'ok', true,
      'override', false,
      'reconciliado', false,
      'previsao_liberacao', v_d.previsao_liberacao,
      'confiabilidade', v_d.confiabilidade_previsao,
      'centro_custo_id', v_d.centro_custo_id,
      'motivo', 'Reserva futura coberta pela previsao de liberacao.'
    );
  END IF;

  RETURN jsonb_build_object(
    'status', v_d.status_operacional,
    'ok', false,
    'override', true,
    'reconciliado', false,
    'previsao_liberacao', v_d.previsao_liberacao,
    'confiabilidade', v_d.confiabilidade_previsao,
    'centro_custo_id', v_d.centro_custo_id,
    'motivo', 'Ativo indisponivel para o periodo solicitado.'
  );
END;
$function$;

-- ------------------------------------------------------------
-- 2) Chamadores: insercao cirurgica do gate CT-2.3 apos o gate SEM_REGISTRO.
--    Reaplica a definicao viva, preservando todo o restante do corpo.
-- ------------------------------------------------------------
DO $callers$
DECLARE
  v_fn      text;
  v_def     text;
  v_novo    text;
  v_anchor  text := '  -- G0/CT2: ativo sem linha operacional nunca e reservavel (fail-closed, sem override).
  IF coalesce(v_disp->>''status'', ''SEM_REGISTRO'') = ''SEM_REGISTRO'' THEN
    RAISE EXCEPTION ''CT2_DISPONIBILIDADE_SEM_REGISTRO'' USING ERRCODE = ''P0001'',
      HINT = ''Regularize a disponibilidade operacional do ativo antes de continuar.'';
  END IF;
';
  v_gate    text := '
  -- CT-2.3: data de inicio da disponibilidade e trava rigida (nunca override).
  IF coalesce(v_disp->>''motivo_codigo'', '''') = ''CT2_ATIVO_AINDA_NAO_DISPONIVEL'' THEN
    RAISE EXCEPTION USING ERRCODE = ''P0001'',
      MESSAGE = ''CT2_ATIVO_AINDA_NAO_DISPONIVEL'',
      DETAIL  = jsonb_build_object(
        ''disponivel_a_partir_de'', v_disp->>''disponivel_a_partir_de''
      )::text,
      HINT = ''O equipamento ainda nao esta disponivel para o periodo informado.'';
  END IF;
';
BEGIN
  FOREACH v_fn IN ARRAY ARRAY['fn_ct_atendimento_atribuir','fn_ct_atendimento_substituir'] LOOP
    SELECT pg_get_functiondef(p.oid) INTO v_def
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = v_fn;

    IF v_def IS NULL THEN
      RAISE EXCEPTION 'CT23_CALLER_NAO_ENCONTRADO: %', v_fn;
    END IF;

    IF position(v_anchor in v_def) = 0 THEN
      RAISE EXCEPTION 'CT23_ANCHOR_NAO_ENCONTRADA: % (bloco SEM_REGISTRO divergente)', v_fn;
    END IF;

    v_novo := replace(v_def, v_anchor, v_anchor || v_gate);

    IF v_novo = v_def THEN
      RAISE EXCEPTION 'CT23_PATCH_SEM_EFEITO: %', v_fn;
    END IF;

    EXECUTE v_novo;

    IF position('CT2_ATIVO_AINDA_NAO_DISPONIVEL' in
        (SELECT p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = v_fn)) = 0 THEN
      RAISE EXCEPTION 'CT23_POSCHECK_FALHOU: %', v_fn;
    END IF;
  END LOOP;
END
$callers$;

COMMENT ON FUNCTION public.fn_ct_avaliar_disponibilidade(uuid, text, date) IS
'CT2: avalia disponibilidade operacional para atendimento. CT-2.3: status DISPONIVEL com data_inicio > periodo_inicio retorna ok=false, override=false, motivo_codigo=CT2_ATIVO_AINDA_NAO_DISPONIVEL e disponivel_a_partir_de.';