CREATE OR REPLACE FUNCTION public.fn_criar_registro_aplicacao_manual_v2(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_cab  jsonb;
  v_ruas jsonb;
  v_ctx  jsonb;
  v_cc   uuid;
  v_ativ text;
  v_data date;
  v_total_carga numeric;
  v_ton_total   numeric := 0;
  v_reg_id uuid;

  v_rua        jsonb;
  v_rua_id     uuid;
  v_ordem      int;
  v_chave      text;
  v_gps        jsonb;
  v_bgps       jsonb;

  v_seq_apl_seen int[] := ARRAY[]::int[];
  v_max_apl      int   := 0;
  v_seq_rua_seen int[];
  v_max_rua      int;

  v_ordem_seen   int[] := ARRAY[]::int[];
  v_max_ordem    int   := 0;

  v_chaves_ruas  text[] := ARRAY[]::text[];
  v_rua_idx      int := 0;

  v_obs_final    text;
  v_ret_ruas     jsonb := '[]'::jsonb;
  v_ret_det      jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado' USING ERRCODE='28000';
  END IF;

  IF NOT public.user_has_permission_action(
       v_uid, 'requisicoes_registro_aplicacao_view', 'criar') THEN
    RAISE EXCEPTION 'RBAC: sem acao criar em requisicoes_registro_aplicacao_view'
      USING ERRCODE='42501';
  END IF;

  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'payload deve ser object' USING ERRCODE='22023';
  END IF;

  v_cab  := p_payload->'cabecalho';
  v_ruas := p_payload->'ruas';

  IF v_cab IS NULL OR jsonb_typeof(v_cab) <> 'object' THEN
    RAISE EXCEPTION 'cabecalho obrigatorio (object)' USING ERRCODE='22023';
  END IF;
  IF v_ruas IS NULL OR jsonb_typeof(v_ruas) <> 'array' THEN
    RAISE EXCEPTION 'ruas obrigatorio (array)' USING ERRCODE='22023';
  END IF;
  IF jsonb_array_length(v_ruas) = 0 THEN
    RAISE EXCEPTION 'ruas nao pode ser vazio' USING ERRCODE='22023';
  END IF;

  v_cc          := NULLIF(v_cab->>'centro_custo_id','')::uuid;
  v_ativ        := lower(NULLIF(v_cab->>'atividade',''));
  v_data        := COALESCE(NULLIF(v_cab->>'data_aplicacao','')::date, CURRENT_DATE);
  v_total_carga := NULLIF(v_cab->>'total_carga_t','')::numeric;

  IF v_cc IS NULL THEN
    RAISE EXCEPTION 'centro_custo_id obrigatorio' USING ERRCODE='22023';
  END IF;
  IF v_ativ IS NULL
     OR v_ativ NOT IN ('tapa_buraco','pavimentacao_mecanizada','fresagem') THEN
    RAISE EXCEPTION 'atividade invalida (recebi %)', v_ativ USING ERRCODE='22023';
  END IF;
  IF v_total_carga IS NULL OR v_total_carga <= 0 THEN
    RAISE EXCEPTION 'total_carga_t obrigatorio e > 0' USING ERRCODE='22023';
  END IF;

  -- [FIX escopo apontador] usar a função de escopo do módulo Logística
  -- (mesma usada em cargas/ruas). Cobre vínculos por equipe, programação de
  -- entrega, apontamento cam/equipa e requisição. fn_logistica_is_privileged_user
  -- já é considerada internamente.
  IF NOT public.fn_logistica_can_access_centro_custo(v_cc) THEN
    RAISE EXCEPTION 'Escopo: CC % fora do escopo do usuario', v_cc
      USING ERRCODE='42501';
  END IF;

  v_ctx := COALESCE(v_cab->'contexto_operacional', '{}'::jsonb);
  v_obs_final :=
       COALESCE(NULLIF(v_cab->>'observacoes_gerais',''), '')
    || CASE WHEN v_ctx <> '{}'::jsonb
            THEN E'\n[CONTEXTO_OPERACIONAL]\n' || v_ctx::text
              || E'\n[/CONTEXTO_OPERACIONAL]'
            ELSE '' END;

  INSERT INTO public.bd_registro_apontamento_aplicacao (
    data_aplicacao, hora_chegada_local, hora_aplicacao, hora_saida_caminhao,
    temperatura_chegada, temperatura_aplicacao,
    logradouro_aplicado, anotacoes_apontador, observacoes_gerais, bordo,
    centro_custo_id, atividade, origem_registro,
    tonelada_aplicada, carga_total_aplicada, status_aplicacao, created_by
  ) VALUES (
    v_data,
    COALESCE(NULLIF(v_cab->>'hora_chegada_local','')::time, CURRENT_TIME),
    NULLIF(v_cab->>'hora_aplicacao','')::time,
    NULLIF(v_cab->>'hora_saida_caminhao','')::time,
    NULLIF(v_cab->>'temperatura_chegada','')::numeric,
    NULLIF(v_cab->>'temperatura_aplicacao','')::numeric,
    CASE WHEN jsonb_array_length(v_ruas) = 1
         THEN v_ruas->0->>'logradouro'
         ELSE 'Multiplas ruas' END,
    NULLIF(v_cab->>'anotacoes_apontador',''),
    NULLIF(v_obs_final,''),
    NULLIF(v_cab->>'bordo',''),
    v_cc, v_ativ, 'manual',
    v_total_carga, v_total_carga,
    'Concluído', v_uid
  ) RETURNING id INTO v_reg_id;

  FOR v_rua_idx IN 0 .. jsonb_array_length(v_ruas)-1 LOOP
    v_rua := v_ruas -> v_rua_idx;

    IF jsonb_typeof(v_rua) <> 'object' THEN
      RAISE EXCEPTION 'rua idx %: nao eh object', v_rua_idx+1 USING ERRCODE='22023';
    END IF;

    v_ordem := COALESCE(NULLIF(v_rua->>'ordem_rua','')::int, v_rua_idx+1);

    IF v_ordem < 1 THEN
      RAISE EXCEPTION 'ordem_rua deve ser >= 1 (recebi %)', v_ordem USING ERRCODE='22023';
    END IF;
    IF v_ordem = ANY(v_ordem_seen) THEN
      RAISE EXCEPTION 'ordem_rua % duplicada', v_ordem USING ERRCODE='22023';
    END IF;
    v_ordem_seen := v_ordem_seen || v_ordem;
    IF v_ordem > v_max_ordem THEN v_max_ordem := v_ordem; END IF;

    IF NULLIF(v_rua->>'logradouro','') IS NULL THEN
      RAISE EXCEPTION 'rua % sem logradouro', v_ordem USING ERRCODE='22023';
    END IF;
    IF NULLIF(v_rua->>'bairro','') IS NULL THEN
      RAISE EXCEPTION 'rua % sem bairro', v_ordem USING ERRCODE='22023';
    END IF;

    v_chave := public.fn_normalizar_chave_rua(
                 v_rua->>'logradouro', v_rua->>'bairro',
                 v_rua->>'cidade',     v_rua->>'uf');
    IF v_chave = ANY(v_chaves_ruas) THEN
      RAISE EXCEPTION 'rua duplicada por chave_normalizada: %', v_chave
        USING ERRCODE='22023';
    END IF;
    v_chaves_ruas := v_chaves_ruas || v_chave;

    v_gps := public._validar_gps(v_rua->'gps');

    INSERT INTO public.bd_registro_aplicacao_ruas (
      registro_aplicacao_id, ordem_rua, chave_normalizada,
      logradouro_nome, bairro, cidade, uf,
      latitude, longitude, geo_accuracy, origem_localizacao, created_by
    ) VALUES (
      v_reg_id, v_ordem, v_chave,
      v_rua->>'logradouro', v_rua->>'bairro',
      NULLIF(v_rua->>'cidade',''), NULLIF(v_rua->>'uf',''),
      (v_gps->>'lat')::numeric, (v_gps->>'lng')::numeric, (v_gps->>'acc')::numeric,
      'rpc_v2', v_uid
    ) RETURNING id INTO v_rua_id;

    v_ret_ruas := v_ret_ruas || jsonb_build_object(
      'idLocal',           v_rua->>'idLocal',
      'rua_aplicacao_id',  v_rua_id,
      'ordem_rua',         v_ordem,
      'chave_normalizada', v_chave);

    IF v_rua->'buracos' IS NULL
       OR jsonb_typeof(v_rua->'buracos') <> 'array' THEN
      RAISE EXCEPTION 'rua % sem buracos (array)', v_ordem USING ERRCODE='22023';
    END IF;
    IF jsonb_array_length(v_rua->'buracos') = 0 THEN
      RAISE EXCEPTION 'rua % com buracos vazio', v_ordem USING ERRCODE='22023';
    END IF;

    v_seq_rua_seen := ARRAY[]::int[];
    v_max_rua := 0;

    DECLARE v_buraco jsonb;
    BEGIN
    FOR v_buraco IN SELECT * FROM jsonb_array_elements(v_rua->'buracos') LOOP
      IF jsonb_typeof(v_buraco) <> 'object' THEN
        RAISE EXCEPTION 'rua %: buraco nao eh object', v_ordem USING ERRCODE='22023';
      END IF;

      DECLARE
        s_apl int    := NULLIF(v_buraco->>'sequencia_aplicacao','')::int;
        s_rua int    := NULLIF(v_buraco->>'sequencia_rua','')::int;
        v_comp numeric := NULLIF(v_buraco->>'comprimento','')::numeric;
        v_larg numeric := NULLIF(v_buraco->>'largura_media','')::numeric;
        v_area numeric := NULLIF(v_buraco->>'area_aplicada','')::numeric;
        v_ton  numeric := NULLIF(v_buraco->>'tonelada_aplicada','')::numeric;
        v_tap  numeric := NULLIF(v_buraco->>'temperatura_aplicacao','')::numeric;
        v_det_id uuid;
      BEGIN
        IF s_apl IS NULL OR s_rua IS NULL THEN
          RAISE EXCEPTION 'buraco requer sequencia_aplicacao e sequencia_rua'
            USING ERRCODE='22023';
        END IF;
        IF s_apl < 1 OR s_rua < 1 THEN
          RAISE EXCEPTION 'sequencias devem ser >= 1' USING ERRCODE='22023';
        END IF;
        IF s_apl = ANY(v_seq_apl_seen) THEN
          RAISE EXCEPTION 'sequencia_aplicacao % duplicada', s_apl USING ERRCODE='22023';
        END IF;
        IF s_rua = ANY(v_seq_rua_seen) THEN
          RAISE EXCEPTION 'sequencia_rua % duplicada na rua %', s_rua, v_ordem
            USING ERRCODE='22023';
        END IF;
        v_seq_apl_seen := v_seq_apl_seen || s_apl;
        v_seq_rua_seen := v_seq_rua_seen || s_rua;
        IF s_apl > v_max_apl THEN v_max_apl := s_apl; END IF;
        IF s_rua > v_max_rua THEN v_max_rua := s_rua; END IF;

        IF v_comp IS NULL OR v_comp <= 0 THEN
          RAISE EXCEPTION 'buraco (apl=%) sem comprimento valido', s_apl
            USING ERRCODE='22023';
        END IF;
        IF v_larg IS NULL OR v_larg <= 0 THEN
          RAISE EXCEPTION 'buraco (apl=%) sem largura_media valida', s_apl
            USING ERRCODE='22023';
        END IF;
        IF v_area IS NULL OR v_area <= 0 THEN
          v_area := round((v_comp * v_larg)::numeric, 4);
        END IF;

        IF v_ton IS NULL OR v_ton <= 0 THEN
          RAISE EXCEPTION 'buraco (apl=%) sem tonelada_aplicada > 0', s_apl
            USING ERRCODE='22023';
        END IF;

        v_bgps := public._validar_gps(v_buraco->'gps');
        v_ton_total := v_ton_total + v_ton;

        INSERT INTO public.bd_registro_aplicacao_detalhes (
          registro_aplicacao_id, sequencia_aplicacao, data_aplicacao, logradouro_nome,
          comprimento, largura_media, area_aplicada, tonelada_aplicada,
          bordo, tipo_item, rua_aplicacao_id, sequencia_rua,
          latitude, longitude, geo_accuracy, geo_captured_at,
          observacao_apontamento, temperatura_aplicacao, created_by
        ) VALUES (
          v_reg_id, s_apl, v_data, v_rua->>'logradouro',
          v_comp, v_larg, v_area, v_ton,
          NULLIF(v_buraco->>'bordo',''),
          COALESCE(NULLIF(v_buraco->>'tipo_item',''), 'buraco'),
          v_rua_id, s_rua,
          (v_bgps->>'lat')::numeric, (v_bgps->>'lng')::numeric,
          (v_bgps->>'acc')::numeric, (v_bgps->>'captured_at')::timestamptz,
          NULLIF(v_buraco->>'observacao',''),
          v_tap, v_uid
        ) RETURNING id INTO v_det_id;

        v_ret_det := v_ret_det || jsonb_build_object(
          'idLocal',             v_buraco->>'idLocal',
          'detalhe_id',          v_det_id,
          'rua_aplicacao_id',    v_rua_id,
          'sequencia_aplicacao', s_apl,
          'sequencia_rua',       s_rua);
      END;
    END LOOP;
    END;

    IF v_max_rua <> COALESCE(array_length(v_seq_rua_seen,1),0) THEN
      RAISE EXCEPTION 'sequencia_rua nao contigua na rua % (max=%, count=%)',
        v_ordem, v_max_rua, COALESCE(array_length(v_seq_rua_seen,1),0)
        USING ERRCODE='22023';
    END IF;
  END LOOP;

  IF v_max_ordem <> COALESCE(array_length(v_ordem_seen,1),0) THEN
    RAISE EXCEPTION 'ordem_rua nao contigua (max=%, count=%)',
      v_max_ordem, COALESCE(array_length(v_ordem_seen,1),0)
      USING ERRCODE='22023';
  END IF;
  IF v_max_apl <> COALESCE(array_length(v_seq_apl_seen,1),0) THEN
    RAISE EXCEPTION 'sequencia_aplicacao nao contigua (max=%, count=%)',
      v_max_apl, COALESCE(array_length(v_seq_apl_seen,1),0)
      USING ERRCODE='22023';
  END IF;

  IF round(v_ton_total, 3) <> round(v_total_carga, 3) THEN
    RAISE EXCEPTION 'soma toneladas buracos (%) difere de total_carga_t (%)',
      round(v_ton_total,3), round(v_total_carga,3) USING ERRCODE='22023';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'registro_aplicacao_id', v_reg_id,
    'numero_registro', NULL,
    'ruas', v_ret_ruas,
    'detalhes', v_ret_det
  );
END;
$function$;