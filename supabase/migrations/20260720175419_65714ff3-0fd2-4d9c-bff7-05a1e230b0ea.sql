CREATE OR REPLACE FUNCTION public.fn_salvar_apontamento_ce_com_inspecao(p_apontamento_id uuid, p_cabecalho jsonb, p_inspecao jsonb)
 RETURNS TABLE(apontamento_id uuid, inspecao_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_uid              uuid := auth.uid();
  v_now_time         time := timezone('America/Sao_Paulo', clock_timestamp())::time;
  v_current_func     uuid;
  v_is_priv          boolean;
  v_caminhao_id      uuid;
  v_operador_id      uuid;
  v_cc_id            uuid;
  v_data             date;
  v_hora_inicial     time;
  v_hora_final       time;
  v_horim_inicial    numeric;
  v_horim_final      numeric;
  v_situacao         text;
  v_abastecimento    numeric;
  v_existing_cab     public.bd_registro_apontamento_cam_equipa%ROWTYPE;
  v_is_create        boolean;
  v_existing_finalizado boolean;
  v_modo             text;
  v_nivel_oleo             text;
  v_nivel_agua             text;
  v_nivel_combustivel      text;
  v_pressao_pneus          text;
  v_estado_pneus           text;
  v_luzes_funcionamento    text;
  v_freios_funcionamento   text;
  v_direcao_funcionamento  text;
  v_equipamentos_seguranca text;
  v_limpeza_veiculo        text;
  v_avarias                text;
  v_observacoes            text;
  v_fotos                  text[];
  v_possui_nao_ok          boolean;
  v_inspecao_aprovada      boolean;
  v_valid_values     constant text[] := ARRAY['OK','NAO_OK','NA'];
  v_checklist_codigo text;
  v_checklist_versao int;
  v_subcategoria_id  uuid;
  v_esperado_codigo  text;
  v_respostas_in     jsonb;
  v_snapshot         jsonb;
  v_template_nome    text;
  v_template_versao_srv int;
  v_fotos_gerais     text[];
  v_path             text;
  v_path_re_legacy   text;
  v_path_re_detail   text;
  v_existe_insp_id   uuid;
  v_out_apontamento  uuid;
  v_out_inspecao     uuid;
  v_ativo_id         uuid;
  v_ativo_frota      text;
  v_ativo_numfrota   text;
  v_ativo_placa      text;
  v_ativo_fab        text;
  v_ativo_ano        text;
  v_ativo_img        text;
  v_ativo_subnome    text;
  v_loc              jsonb;
  v_loc_lat          numeric;
  v_loc_lng          numeric;
  v_loc_precisao     numeric;
  v_loc_capturado_em timestamptz;
  v_cab_equip_id     uuid;
  v_cab_cc_id        uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE='28000'; END IF;
  IF p_apontamento_id IS NULL THEN RAISE EXCEPTION 'apontamento_id_obrigatorio' USING ERRCODE='22004'; END IF;
  IF p_cabecalho IS NULL OR jsonb_typeof(p_cabecalho)<>'object' THEN RAISE EXCEPTION 'cabecalho_invalido' USING ERRCODE='22023'; END IF;
  IF p_inspecao IS NULL OR jsonb_typeof(p_inspecao)<>'object' THEN RAISE EXCEPTION 'inspecao_invalida' USING ERRCODE='22023'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_apontamento_id::text, 0));

  v_caminhao_id   := NULLIF(p_cabecalho->>'caminhao_equipamento_id','')::uuid;
  v_operador_id   := NULLIF(p_cabecalho->>'operador_id','')::uuid;
  v_cc_id         := NULLIF(p_cabecalho->>'centro_custo_id','')::uuid;
  v_data          := NULLIF(p_cabecalho->>'data','')::date;
  v_hora_inicial  := NULLIF(p_cabecalho->>'hora_inicial','')::time;
  v_hora_final    := NULLIF(p_cabecalho->>'hora_final','')::time;
  v_horim_inicial := NULLIF(p_cabecalho->>'horimetro_inicial','')::numeric;
  v_horim_final   := NULLIF(p_cabecalho->>'horimetro_final','')::numeric;
  v_situacao      := NULLIF(p_cabecalho->>'situacao','');
  v_abastecimento := NULLIF(p_cabecalho->>'abastecimento','')::numeric;

  IF v_caminhao_id IS NULL OR v_operador_id IS NULL OR v_cc_id IS NULL OR v_data IS NULL OR v_situacao IS NULL THEN
    RAISE EXCEPTION 'cabecalho_campos_obrigatorios' USING ERRCODE='23502';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bd_caminhoes_equipamentos WHERE id=v_caminhao_id) THEN RAISE EXCEPTION 'caminhao_equipamento_inexistente' USING ERRCODE='23503'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bd_funcionarios WHERE id=v_operador_id AND status IN ('Ativo','Ativo sem Registro')) THEN RAISE EXCEPTION 'operador_invalido_ou_inativo' USING ERRCODE='23503'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bd_centros_custo WHERE id=v_cc_id) THEN RAISE EXCEPTION 'centro_custo_inexistente' USING ERRCODE='23503'; END IF;
  IF v_horim_inicial IS NOT NULL AND v_horim_inicial<0 THEN RAISE EXCEPTION 'horimetro_inicial_negativo' USING ERRCODE='23514'; END IF;
  IF v_horim_final IS NOT NULL AND v_horim_final<0 THEN RAISE EXCEPTION 'horimetro_final_negativo' USING ERRCODE='23514'; END IF;
  IF v_horim_inicial IS NOT NULL AND v_horim_final IS NOT NULL AND v_horim_final<v_horim_inicial THEN RAISE EXCEPTION 'horimetro_final_menor_que_inicial' USING ERRCODE='23514'; END IF;
  IF v_abastecimento IS NOT NULL AND v_abastecimento<0 THEN RAISE EXCEPTION 'abastecimento_negativo' USING ERRCODE='23514'; END IF;

  IF (v_hora_final IS NULL) <> (v_horim_final IS NULL) THEN
    RAISE EXCEPTION 'apontamento_finalizacao_parcial' USING ERRCODE='23514';
  END IF;

  v_is_priv      := public.fn_logistica_is_privileged_user();
  v_current_func := public.fn_logistica_current_funcionario_id();

  SELECT * INTO v_existing_cab FROM public.bd_registro_apontamento_cam_equipa WHERE id=p_apontamento_id FOR UPDATE;
  v_is_create := (v_existing_cab.id IS NULL);
  v_existing_finalizado := (NOT v_is_create)
    AND v_existing_cab.hora_final IS NOT NULL
    AND v_existing_cab.horimetro_final IS NOT NULL;

  IF v_is_create THEN
    IF NOT (v_is_priv OR v_operador_id=v_current_func OR public.fn_logistica_can_access_centro_custo(v_cc_id)) THEN
      RAISE EXCEPTION 'forbidden_scope' USING ERRCODE='42501';
    END IF;

    IF v_hora_final IS NOT NULL OR v_horim_final IS NOT NULL THEN
      RAISE EXCEPTION 'apontamento_create_nao_pode_ser_finalizado' USING ERRCODE='23514';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended('ce_ativo_' || v_caminhao_id::text, 0));
    IF EXISTS (
      SELECT 1 FROM public.bd_registro_apontamento_cam_equipa
       WHERE caminhao_equipamento_id = v_caminhao_id
         AND hora_final IS NULL
         AND horimetro_final IS NULL
    ) THEN
      RAISE EXCEPTION 'apontamento_ativo_existente' USING ERRCODE='23505';
    END IF;
  ELSE
    IF NOT public.fn_logistica_can_access_apontamento_cam(p_apontamento_id) THEN
      RAISE EXCEPTION 'forbidden_row' USING ERRCODE='42501';
    END IF;
    IF v_existing_cab.centro_custo_id IS DISTINCT FROM v_cc_id AND NOT (v_is_priv OR public.fn_logistica_can_access_centro_custo(v_cc_id)) THEN
      RAISE EXCEPTION 'forbidden_scope_novo_cc' USING ERRCODE='42501';
    END IF;

    IF v_existing_finalizado AND v_hora_final IS NULL AND v_horim_final IS NULL THEN
      RAISE EXCEPTION 'apontamento_finalizado_nao_pode_ser_reaberto' USING ERRCODE='23514';
    END IF;
  END IF;

  v_modo := p_inspecao->>'modo';

  IF v_modo = 'detalhado' THEN
    v_checklist_codigo := NULLIF(p_inspecao->>'checklist_codigo','');
    v_checklist_versao := NULLIF(p_inspecao->>'checklist_versao','')::int;
    IF v_checklist_codigo IS NULL OR v_checklist_versao IS NULL THEN
      RAISE EXCEPTION 'checklist_codigo_ou_versao_ausente' USING ERRCODE='22004';
    END IF;

    SELECT ce.subcategoria_ativo_id, ce.frota, ce.numero_frota, ce.placa, ce.fabricante, ce.ano_fabricacao, ce.imagem_url, sa.nome_subcategoria
      INTO v_subcategoria_id, v_ativo_frota, v_ativo_numfrota, v_ativo_placa, v_ativo_fab, v_ativo_ano, v_ativo_img, v_ativo_subnome
      FROM public.bd_caminhoes_equipamentos ce
      LEFT JOIN public.bd_subcategorias_ativos sa ON sa.id = ce.subcategoria_ativo_id
     WHERE ce.id = v_caminhao_id;
    v_ativo_id := v_caminhao_id;

    v_esperado_codigo := public.fn_checklist_ce_template_por_subcategoria(v_subcategoria_id);
    IF v_esperado_codigo IS NULL THEN RAISE EXCEPTION 'subcategoria_sem_template' USING ERRCODE='23514'; END IF;
    IF v_esperado_codigo <> v_checklist_codigo THEN RAISE EXCEPTION 'subcategoria_incompativel_com_checklist' USING ERRCODE='23514'; END IF;

    SELECT (public.fn_checklist_ce_catalog_raw() -> v_checklist_codigo ->> 'n'),
           (public.fn_checklist_ce_catalog_raw() -> v_checklist_codigo ->> 'v')::int
      INTO v_template_nome, v_template_versao_srv;
    IF v_template_nome IS NULL THEN RAISE EXCEPTION 'template_inexistente' USING ERRCODE='P0002'; END IF;

    v_respostas_in := COALESCE(p_inspecao->'respostas','[]'::jsonb);
    IF jsonb_typeof(v_respostas_in)<>'array' THEN RAISE EXCEPTION 'respostas_formato_invalido' USING ERRCODE='22023'; END IF;

    v_path_re_detail :=
      '^' || p_apontamento_id::text ||
      '/checklist/[a-z0-9_]+/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$';

    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_respostas_in) r
       WHERE (r->>'item_codigo') IS NULL OR (r->>'status') IS NULL
          OR NOT ((r->>'status') = ANY(v_valid_values))
    ) THEN RAISE EXCEPTION 'resposta_campos_obrigatorios' USING ERRCODE='23514'; END IF;

    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_respostas_in) r
       WHERE NOT EXISTS (SELECT 1 FROM public.fn_checklist_ce_catalog_flat(v_checklist_codigo) c WHERE c.item_codigo = r->>'item_codigo')
    ) THEN RAISE EXCEPTION 'item_codigo_desconhecido' USING ERRCODE='23514'; END IF;

    IF EXISTS (
      SELECT 1 FROM public.fn_checklist_ce_catalog_flat(v_checklist_codigo) c
       WHERE c.obrigatorio
         AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_respostas_in) r WHERE r->>'item_codigo' = c.item_codigo AND r->>'status' IS NOT NULL)
    ) THEN RAISE EXCEPTION 'obrigatorio_ausente' USING ERRCODE='23514'; END IF;

    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_respostas_in) r
       WHERE r->>'status' = 'NAO_OK' AND NULLIF(btrim(COALESCE(r->>'observacao','')),'') IS NULL
    ) THEN RAISE EXCEPTION 'nao_ok_sem_observacao' USING ERRCODE='23514'; END IF;

    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_respostas_in) r
       JOIN public.fn_checklist_ce_catalog_flat(v_checklist_codigo) c ON c.item_codigo = r->>'item_codigo'
       WHERE r->>'status' = 'NAO_OK' AND c.exige_foto_nao_ok
         AND COALESCE(jsonb_array_length(COALESCE(r->'fotos_paths','[]'::jsonb)),0) < 1
    ) THEN RAISE EXCEPTION 'nao_ok_sem_foto_obrigatoria' USING ERRCODE='23514'; END IF;

    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_respostas_in) r,
                   LATERAL jsonb_array_elements_text(COALESCE(r->'fotos_paths','[]'::jsonb)) p
       WHERE p IS NULL OR position('..' in p)>0 OR left(p,1)='/'
          OR position('apontamentos/' in p)>0 OR p !~ v_path_re_detail
          OR split_part(p,'/',3) <> (r->>'item_codigo')
    ) THEN RAISE EXCEPTION 'foto_path_invalido' USING ERRCODE='22023'; END IF;

    v_path_re_legacy := '^' || p_apontamento_id::text || '/[0-9a-fA-F-]{36}\.(jpg|jpeg|png|webp)$';
    IF jsonb_typeof(COALESCE(p_inspecao->'fotos_gerais','[]'::jsonb))<>'array' THEN
      RAISE EXCEPTION 'fotos_gerais_formato_invalido' USING ERRCODE='22023';
    END IF;
    v_fotos_gerais := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_inspecao->'fotos_gerais','[]'::jsonb)));
    IF v_fotos_gerais IS NOT NULL THEN
      FOREACH v_path IN ARRAY v_fotos_gerais LOOP
        IF v_path IS NULL OR length(v_path)=0 OR position('..' in v_path)>0 OR left(v_path,1)='/'
           OR position('apontamentos/' in v_path)>0 OR v_path !~ v_path_re_legacy THEN
          RAISE EXCEPTION 'fotos_gerais_path_invalido' USING ERRCODE='22023';
        END IF;
      END LOOP;
    END IF;

    WITH resp AS (
      SELECT r->>'item_codigo' AS item_codigo,
             r->>'status' AS status,
             NULLIF(btrim(COALESCE(r->>'observacao','')),'') AS observacao,
             ARRAY(SELECT jsonb_array_elements_text(COALESCE(r->'fotos_paths','[]'::jsonb))) AS fotos
        FROM jsonb_array_elements(v_respostas_in) r
    ),
    itens AS (
      SELECT c.grupo_codigo, c.grupo_titulo, c.grupo_ordem,
             c.item_codigo, c.item_descricao, c.item_ordem, c.criticidade, c.obrigatorio,
             r.status, r.observacao, r.fotos
        FROM public.fn_checklist_ce_catalog_flat(v_checklist_codigo) c
        LEFT JOIN resp r ON r.item_codigo = c.item_codigo
    ),
    grupos AS (
      SELECT grupo_codigo, grupo_titulo, grupo_ordem,
             jsonb_agg(
               jsonb_build_object(
                 'codigo', item_codigo, 'ordem', item_ordem,
                 'descricao', item_descricao, 'criticidade', criticidade,
                 'obrigatorio', obrigatorio, 'status', status,
                 'observacao', observacao,
                 'fotos', to_jsonb(COALESCE(fotos, ARRAY[]::text[]))
               ) ORDER BY item_ordem
             ) AS itens_agg
        FROM itens
       GROUP BY grupo_codigo, grupo_titulo, grupo_ordem
    ),
    grupos_json AS (
      SELECT jsonb_agg(
               jsonb_build_object('codigo', grupo_codigo, 'titulo', grupo_titulo, 'ordem', grupo_ordem, 'itens', itens_agg)
               ORDER BY grupo_ordem
             ) AS grupos_agg
        FROM grupos
    ),
    resumo AS (
      SELECT jsonb_build_object(
               'total_itens', count(*),
               'obrigatorios_total', count(*) FILTER (WHERE obrigatorio),
               'obrigatorios_respondidos', count(*) FILTER (WHERE obrigatorio AND status IS NOT NULL),
               'ok', count(*) FILTER (WHERE status='OK'),
               'nao_ok', count(*) FILTER (WHERE status='NAO_OK'),
               'na', count(*) FILTER (WHERE status='NA'),
               'aprovado', NOT COALESCE(bool_or(status='NAO_OK'), false)
             ) AS r
        FROM itens
    )
    SELECT jsonb_build_object(
      'schema_version', 1,
      'template_codigo', v_checklist_codigo,
      'template_versao', v_template_versao_srv,
      'template_nome', v_template_nome,
      'ativo', jsonb_build_object(
        'id', v_ativo_id, 'frota', v_ativo_frota, 'numero_frota', v_ativo_numfrota,
        'placa', v_ativo_placa, 'fabricante', v_ativo_fab, 'ano_fabricacao', v_ativo_ano,
        'imagem_url', v_ativo_img, 'subcategoria_id', v_subcategoria_id,
        'subcategoria_nome', v_ativo_subnome
      ),
      'grupos', (SELECT grupos_agg FROM grupos_json),
      'resumo', (SELECT r FROM resumo),
      'gerado_em', to_char(timezone('UTC', clock_timestamp()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    ) INTO v_snapshot;

    v_observacoes := NULLIF(btrim(COALESCE(p_inspecao->>'observacoes_gerais','')),'');
    v_inspecao_aprovada := (v_snapshot->'resumo'->>'aprovado')::boolean;

  ELSE
    v_nivel_oleo             := p_inspecao->>'nivel_oleo';
    v_nivel_agua             := p_inspecao->>'nivel_agua';
    v_nivel_combustivel      := p_inspecao->>'nivel_combustivel';
    v_pressao_pneus          := p_inspecao->>'pressao_pneus';
    v_estado_pneus           := p_inspecao->>'estado_pneus';
    v_luzes_funcionamento    := p_inspecao->>'luzes_funcionamento';
    v_freios_funcionamento   := p_inspecao->>'freios_funcionamento';
    v_direcao_funcionamento  := p_inspecao->>'direcao_funcionamento';
    v_equipamentos_seguranca := p_inspecao->>'equipamentos_seguranca';
    v_limpeza_veiculo        := p_inspecao->>'limpeza_veiculo';

    IF v_nivel_oleo IS NULL OR NOT (v_nivel_oleo = ANY(v_valid_values))
    OR v_nivel_agua IS NULL OR NOT (v_nivel_agua = ANY(v_valid_values))
    OR v_nivel_combustivel IS NULL OR NOT (v_nivel_combustivel = ANY(v_valid_values))
    OR v_pressao_pneus IS NULL OR NOT (v_pressao_pneus = ANY(v_valid_values))
    OR v_estado_pneus IS NULL OR NOT (v_estado_pneus = ANY(v_valid_values))
    OR v_luzes_funcionamento IS NULL OR NOT (v_luzes_funcionamento = ANY(v_valid_values))
    OR v_freios_funcionamento IS NULL OR NOT (v_freios_funcionamento = ANY(v_valid_values))
    OR v_direcao_funcionamento IS NULL OR NOT (v_direcao_funcionamento = ANY(v_valid_values))
    OR v_equipamentos_seguranca IS NULL OR NOT (v_equipamentos_seguranca = ANY(v_valid_values))
    OR v_limpeza_veiculo IS NULL OR NOT (v_limpeza_veiculo = ANY(v_valid_values)) THEN
      RAISE EXCEPTION 'inspecao_incompleta' USING ERRCODE='23514';
    END IF;

    v_possui_nao_ok := v_nivel_oleo='NAO_OK' OR v_nivel_agua='NAO_OK' OR v_nivel_combustivel='NAO_OK'
      OR v_pressao_pneus='NAO_OK' OR v_estado_pneus='NAO_OK'
      OR v_luzes_funcionamento='NAO_OK' OR v_freios_funcionamento='NAO_OK'
      OR v_direcao_funcionamento='NAO_OK' OR v_equipamentos_seguranca='NAO_OK' OR v_limpeza_veiculo='NAO_OK';

    v_avarias     := NULLIF(btrim(coalesce(p_inspecao->>'avarias_observadas','')),'');
    v_observacoes := NULLIF(btrim(coalesce(p_inspecao->>'observacoes_gerais','')),'');
    IF v_possui_nao_ok AND v_avarias IS NULL AND v_observacoes IS NULL THEN
      RAISE EXCEPTION 'nao_conformidade_sem_observacao' USING ERRCODE='23514';
    END IF;

    IF jsonb_typeof(coalesce(p_inspecao->'fotos_inspecao','[]'::jsonb))<>'array' THEN
      RAISE EXCEPTION 'fotos_formato_invalido' USING ERRCODE='22023';
    END IF;
    v_fotos := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_inspecao->'fotos_inspecao','[]'::jsonb)));
    v_path_re_legacy := '^' || p_apontamento_id::text || '/[0-9a-fA-F-]{36}\.(jpg|jpeg|png|webp)$';
    IF v_fotos IS NOT NULL THEN
      FOREACH v_path IN ARRAY v_fotos LOOP
        IF v_path IS NULL OR length(v_path)=0 OR position('..' in v_path)>0 OR left(v_path,1)='/'
           OR position('apontamentos/' in v_path)>0 OR v_path !~ v_path_re_legacy THEN
          RAISE EXCEPTION 'fotos_path_invalido' USING ERRCODE='22023';
        END IF;
      END LOOP;
    END IF;
    v_inspecao_aprovada := NOT v_possui_nao_ok;
  END IF;

  IF v_is_create THEN
    INSERT INTO public.bd_registro_apontamento_cam_equipa (
      id, caminhao_equipamento_id, operador_id, centro_custo_id,
      data, hora_inicial, hora_final, horimetro_inicial, horimetro_final,
      situacao, abastecimento, created_by, modificado_por
    ) VALUES (
      p_apontamento_id, v_caminhao_id, v_operador_id, v_cc_id,
      v_data, v_hora_inicial, v_hora_final, v_horim_inicial, v_horim_final,
      v_situacao, v_abastecimento, v_uid, NULL
    );
    v_out_apontamento := p_apontamento_id;
  ELSE
    UPDATE public.bd_registro_apontamento_cam_equipa SET
      caminhao_equipamento_id=v_caminhao_id, operador_id=v_operador_id,
      centro_custo_id=v_cc_id, data=v_data, hora_inicial=v_hora_inicial,
      hora_final=v_hora_final, horimetro_inicial=v_horim_inicial,
      horimetro_final=v_horim_final, situacao=v_situacao, abastecimento=v_abastecimento,
      updated_at=now(), modificado_por=v_uid
     WHERE id=p_apontamento_id;
    v_out_apontamento := p_apontamento_id;
  END IF;

  SELECT id INTO v_existe_insp_id
    FROM public.bd_registro_apontamento_inspecao
   WHERE apontamento_caminhao_equipamento_id = v_out_apontamento
   ORDER BY updated_at DESC NULLS LAST, created_at DESC, id DESC
   LIMIT 1 FOR UPDATE;

  IF v_modo = 'detalhado' THEN
    IF v_existe_insp_id IS NULL THEN
      INSERT INTO public.bd_registro_apontamento_inspecao (
        apontamento_caminhao_equipamento_id, data_inspecao, hora_inspecao,
        observacoes_gerais, fotos_inspecao, inspecao_aprovada,
        checklist_codigo, checklist_versao, checklist_respostas,
        created_by, modificado_por
      ) VALUES (
        v_out_apontamento, v_data, v_now_time,
        v_observacoes, v_fotos_gerais, v_inspecao_aprovada,
        v_checklist_codigo, v_checklist_versao, v_snapshot,
        v_uid, NULL
      ) RETURNING id INTO v_out_inspecao;
    ELSE
      UPDATE public.bd_registro_apontamento_inspecao SET
        data_inspecao=v_data,
        nivel_oleo=NULL, nivel_agua=NULL, nivel_combustivel=NULL,
        pressao_pneus=NULL, estado_pneus=NULL,
        luzes_funcionamento=NULL, freios_funcionamento=NULL, direcao_funcionamento=NULL,
        equipamentos_seguranca=NULL, limpeza_veiculo=NULL, avarias_observadas=NULL,
        observacoes_gerais=v_observacoes, fotos_inspecao=v_fotos_gerais,
        inspecao_aprovada=v_inspecao_aprovada,
        checklist_codigo=v_checklist_codigo, checklist_versao=v_checklist_versao,
        checklist_respostas=v_snapshot, modificado_por=v_uid
       WHERE id=v_existe_insp_id;
      v_out_inspecao := v_existe_insp_id;
    END IF;
  ELSE
    IF v_existe_insp_id IS NULL THEN
      INSERT INTO public.bd_registro_apontamento_inspecao (
        apontamento_caminhao_equipamento_id, data_inspecao, hora_inspecao,
        nivel_oleo, nivel_agua, nivel_combustivel, pressao_pneus, estado_pneus,
        luzes_funcionamento, freios_funcionamento, direcao_funcionamento,
        equipamentos_seguranca, limpeza_veiculo,
        avarias_observadas, observacoes_gerais, fotos_inspecao, inspecao_aprovada,
        created_by, modificado_por
      ) VALUES (
        v_out_apontamento, v_data, v_now_time,
        v_nivel_oleo, v_nivel_agua, v_nivel_combustivel, v_pressao_pneus, v_estado_pneus,
        v_luzes_funcionamento, v_freios_funcionamento, v_direcao_funcionamento,
        v_equipamentos_seguranca, v_limpeza_veiculo,
        v_avarias, v_observacoes, v_fotos, v_inspecao_aprovada,
        v_uid, NULL
      ) RETURNING id INTO v_out_inspecao;
    ELSE
      UPDATE public.bd_registro_apontamento_inspecao SET
        data_inspecao=v_data,
        nivel_oleo=v_nivel_oleo, nivel_agua=v_nivel_agua, nivel_combustivel=v_nivel_combustivel,
        pressao_pneus=v_pressao_pneus, estado_pneus=v_estado_pneus,
        luzes_funcionamento=v_luzes_funcionamento, freios_funcionamento=v_freios_funcionamento,
        direcao_funcionamento=v_direcao_funcionamento, equipamentos_seguranca=v_equipamentos_seguranca,
        limpeza_veiculo=v_limpeza_veiculo, avarias_observadas=v_avarias,
        observacoes_gerais=v_observacoes, fotos_inspecao=v_fotos,
        inspecao_aprovada=v_inspecao_aprovada, modificado_por=v_uid
       WHERE id=v_existe_insp_id;
      v_out_inspecao := v_existe_insp_id;
    END IF;
  END IF;

  -- ============ LOCALIZAÇÃO ============
  -- Autorização de escopo já validada acima pelo CC do próprio apontamento
  -- (forbidden_scope / forbidden_row / forbidden_scope_novo_cc). Não reaplicar
  -- fn_ativos_can_access_equipamento aqui: essa função usa o CC atual de
  -- disponibilidade do equipamento como dimensão de escopo, o que quebra
  -- Apontadores legítimos trabalhando em obras diferentes da sua lotação.
  v_loc := p_cabecalho->'localizacao';

  IF v_loc IS NULL OR jsonb_typeof(v_loc) = 'null' THEN
    IF v_is_create THEN
      RAISE EXCEPTION 'localizacao_obrigatoria' USING ERRCODE='22023';
    END IF;
  ELSE
    IF jsonb_typeof(v_loc) <> 'object' THEN
      RAISE EXCEPTION 'localizacao_payload_invalido' USING ERRCODE='22023';
    END IF;

    BEGIN
      v_loc_lat          := NULLIF(v_loc->>'latitude','')::numeric;
      v_loc_lng          := NULLIF(v_loc->>'longitude','')::numeric;
      v_loc_precisao     := NULLIF(v_loc->>'precisao_metros','')::numeric;
      v_loc_capturado_em := NULLIF(v_loc->>'capturado_em','')::timestamptz;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'localizacao_payload_invalido' USING ERRCODE='22023';
    END;

    IF v_loc_lat IS NULL OR v_loc_lng IS NULL OR v_loc_capturado_em IS NULL THEN
      RAISE EXCEPTION 'localizacao_payload_invalido' USING ERRCODE='22023';
    END IF;

    SELECT caminhao_equipamento_id, centro_custo_id
      INTO v_cab_equip_id, v_cab_cc_id
      FROM public.bd_registro_apontamento_cam_equipa
     WHERE id = v_out_apontamento;

    INSERT INTO public.bd_localizacao_equipamentos (
      apontamento_id, equipamento_id, centro_custo_id,
      latitude, longitude, precisao_gps, origem, data_registro
    ) VALUES (
      v_out_apontamento, v_cab_equip_id, v_cab_cc_id,
      v_loc_lat, v_loc_lng, v_loc_precisao, 'APONTAMENTO_CE', v_loc_capturado_em
    )
    ON CONFLICT ON CONSTRAINT uq_localizacao_apontamento DO UPDATE SET
      equipamento_id  = EXCLUDED.equipamento_id,
      centro_custo_id = EXCLUDED.centro_custo_id,
      latitude        = EXCLUDED.latitude,
      longitude       = EXCLUDED.longitude,
      precisao_gps    = EXCLUDED.precisao_gps,
      origem          = 'APONTAMENTO_CE',
      data_registro   = EXCLUDED.data_registro;
  END IF;

  apontamento_id := v_out_apontamento;
  inspecao_id    := v_out_inspecao;
  RETURN NEXT;
END;
$function$;