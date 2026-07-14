
CREATE OR REPLACE FUNCTION public.fn_mapa_operacional_ultimas_localizacoes(p_filtros jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_can_precise boolean;
  v_is_super boolean;
  v_limite_horas int := COALESCE((p_filtros->>'limite_desatualizado_horas')::int, 24);
  v_periodo text := COALESCE(p_filtros->>'periodo_localizacao','TODAS');
  v_periodo_inicio timestamptz := NULL;
  v_periodo_fim timestamptz := NULL;
  v_busca text := NULLIF(trim(coalesce(p_filtros->>'busca','')),'');
  v_cc_ids uuid[] := NULL;
  v_cat_ids uuid[] := NULL;
  v_sub_ids uuid[] := NULL;
  v_op_ids uuid[] := NULL;
  v_status_list text[] := NULL;
  v_situacao_list text[] := NULL;
  v_somente_nc boolean := COALESCE((p_filtros->>'somente_nao_conformes')::boolean, false);
  v_now timestamptz := now();
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '28000';
  END IF;

  IF NOT public.has_permission('veiculos_equipamentos_mapa_operacional_view', v_uid) THEN
    RAISE EXCEPTION 'forbidden_permission' USING ERRCODE = '42501';
  END IF;

  v_is_super := public.fn_is_super_admin(v_uid);
  v_can_precise := public.fn_ativos_has_precise_location_access(v_uid);

  IF jsonb_typeof(p_filtros->'centro_custo_ids') = 'array' THEN
    SELECT array_agg((x)::uuid) INTO v_cc_ids FROM jsonb_array_elements_text(p_filtros->'centro_custo_ids') x;
  END IF;
  IF jsonb_typeof(p_filtros->'categoria_ids') = 'array' THEN
    SELECT array_agg((x)::uuid) INTO v_cat_ids FROM jsonb_array_elements_text(p_filtros->'categoria_ids') x;
  END IF;
  IF jsonb_typeof(p_filtros->'subcategoria_ids') = 'array' THEN
    SELECT array_agg((x)::uuid) INTO v_sub_ids FROM jsonb_array_elements_text(p_filtros->'subcategoria_ids') x;
  END IF;
  IF jsonb_typeof(p_filtros->'operador_ids') = 'array' THEN
    SELECT array_agg((x)::uuid) INTO v_op_ids FROM jsonb_array_elements_text(p_filtros->'operador_ids') x;
  END IF;
  IF jsonb_typeof(p_filtros->'status_mapa') = 'array' THEN
    SELECT array_agg(x) INTO v_status_list FROM jsonb_array_elements_text(p_filtros->'status_mapa') x;
  END IF;
  IF jsonb_typeof(p_filtros->'situacao') = 'array' THEN
    SELECT array_agg(x) INTO v_situacao_list FROM jsonb_array_elements_text(p_filtros->'situacao') x;
  END IF;

  IF v_periodo = '2H' THEN v_periodo_inicio := v_now - interval '2 hours';
  ELSIF v_periodo = '24H' THEN v_periodo_inicio := v_now - interval '24 hours';
  ELSIF v_periodo = '7D' THEN v_periodo_inicio := v_now - interval '7 days';
  ELSIF v_periodo = 'PERSONALIZADO' THEN
    BEGIN
      v_periodo_inicio := NULLIF(p_filtros->>'periodo_inicio','')::timestamptz;
      v_periodo_fim := NULLIF(p_filtros->>'periodo_fim','')::timestamptz;
    EXCEPTION WHEN OTHERS THEN
      v_periodo_inicio := NULL; v_periodo_fim := NULL;
    END;
  END IF;

  WITH ultima_loc AS (
    SELECT DISTINCT ON (l.equipamento_id)
      l.id AS localizacao_id,
      l.equipamento_id,
      l.apontamento_id,
      l.latitude,
      l.longitude,
      l.precisao_gps,
      l.data_registro,
      l.origem::text AS origem,
      l.centro_custo_id AS loc_centro_custo_id
    FROM public.bd_localizacao_equipamentos l
    WHERE l.origem::text = 'APONTAMENTO_CE'
      AND l.apontamento_id IS NOT NULL
      AND l.latitude IS NOT NULL AND l.longitude IS NOT NULL
      AND l.latitude BETWEEN -90 AND 90
      AND l.longitude BETWEEN -180 AND 180
      AND NOT (l.latitude = 0 AND l.longitude = 0)
    ORDER BY l.equipamento_id, l.data_registro DESC, l.id DESC
  ),
  enriched AS (
    SELECT
      ul.*,
      c.frota, c.numero_frota, c.placa, c.imagem_url,
      c.categoria_ativo_id, c.subcategoria_ativo_id, c.situacao AS situacao_veiculo,
      cat.nome_categoria, sub.nome_subcategoria,
      ap.operador_id, ap.data AS data_apontamento, ap.hora_inicial,
      ap.horimetro_final,
      COALESCE(ap.centro_custo_id, ul.loc_centro_custo_id) AS effective_cc_id,
      cc.nome_centro_custo, cc.codigo_centro_custo,
      f.nome_completo AS operador_nome,
      insp.checklist_codigo, insp.checklist_respostas,
      (
        CASE WHEN insp.checklist_respostas IS NOT NULL
             AND jsonb_typeof(insp.checklist_respostas->'itens') = 'array' THEN
          (SELECT count(*) FROM jsonb_array_elements(insp.checklist_respostas->'itens') e
           WHERE e->>'status' = 'NAO_OK')
        ELSE
          (CASE WHEN insp.nivel_oleo = 'NAO_OK' THEN 1 ELSE 0 END
          + CASE WHEN insp.nivel_agua = 'NAO_OK' THEN 1 ELSE 0 END
          + CASE WHEN insp.nivel_combustivel = 'NAO_OK' THEN 1 ELSE 0 END
          + CASE WHEN insp.pressao_pneus = 'NAO_OK' THEN 1 ELSE 0 END
          + CASE WHEN insp.estado_pneus = 'NAO_OK' THEN 1 ELSE 0 END
          + CASE WHEN insp.luzes_funcionamento = 'NAO_OK' THEN 1 ELSE 0 END
          + CASE WHEN insp.freios_funcionamento = 'NAO_OK' THEN 1 ELSE 0 END
          + CASE WHEN insp.direcao_funcionamento = 'NAO_OK' THEN 1 ELSE 0 END
          + CASE WHEN insp.equipamentos_seguranca = 'NAO_OK' THEN 1 ELSE 0 END
          + CASE WHEN insp.limpeza_veiculo = 'NAO_OK' THEN 1 ELSE 0 END)
        END
      )::int AS qtd_nao_ok,
      (
        CASE WHEN insp.checklist_respostas IS NOT NULL
             AND jsonb_typeof(insp.checklist_respostas->'itens') = 'array' THEN
          jsonb_array_length(insp.checklist_respostas->'itens')
        ELSE 10 END
      )::int AS total_checklist
    FROM ultima_loc ul
    JOIN public.bd_caminhoes_equipamentos c ON c.id = ul.equipamento_id
    LEFT JOIN public.bd_registro_apontamento_cam_equipa ap ON ap.id = ul.apontamento_id
    LEFT JOIN public.bd_registro_apontamento_inspecao insp ON insp.apontamento_caminhao_equipamento_id = ul.apontamento_id
    LEFT JOIN public.bd_categorias_ativos cat ON cat.id = c.categoria_ativo_id
    LEFT JOIN public.bd_subcategorias_ativos sub ON sub.id = c.subcategoria_ativo_id
    LEFT JOIN public.bd_centros_custo cc ON cc.id = COALESCE(ap.centro_custo_id, ul.loc_centro_custo_id)
    LEFT JOIN public.bd_funcionarios f ON f.id = ap.operador_id
    WHERE public.fn_ativos_can_access_equipamento(ul.equipamento_id, v_uid)
  ),
  classified AS (
    SELECT
      e.*,
      CASE
        WHEN e.qtd_nao_ok > 0 THEN 'NAO_CONFORME'
        WHEN e.situacao_veiculo IN ('Em Manutenção','Intempérie') THEN 'PARADO'
        WHEN e.data_registro < (v_now - make_interval(hours => v_limite_horas)) THEN 'DESATUALIZADO'
        WHEN e.situacao_veiculo = 'Operando' THEN 'OPERACIONAL'
        ELSE 'SEM_STATUS'
      END AS status_mapa
    FROM enriched e
  ),
  filtered AS (
    SELECT * FROM classified c
    WHERE
      (v_busca IS NULL OR (
        coalesce(c.frota,'') || ' ' || coalesce(c.numero_frota,'') || ' ' ||
        coalesce(c.placa,'') || ' ' || coalesce(c.nome_categoria,'') || ' ' ||
        coalesce(c.nome_subcategoria,'') || ' ' || coalesce(c.operador_nome,'')
        ) ILIKE '%' || v_busca || '%')
      AND (v_cc_ids IS NULL OR c.effective_cc_id = ANY(v_cc_ids))
      AND (v_cat_ids IS NULL OR c.categoria_ativo_id = ANY(v_cat_ids))
      AND (v_sub_ids IS NULL OR c.subcategoria_ativo_id = ANY(v_sub_ids))
      AND (v_op_ids IS NULL OR c.operador_id = ANY(v_op_ids))
      AND (v_status_list IS NULL OR c.status_mapa = ANY(v_status_list))
      AND (v_situacao_list IS NULL OR c.situacao_veiculo = ANY(v_situacao_list))
      AND (NOT v_somente_nc OR c.qtd_nao_ok > 0)
      AND (v_periodo_inicio IS NULL OR c.data_registro >= v_periodo_inicio)
      AND (v_periodo_fim IS NULL OR c.data_registro <= v_periodo_fim)
  ),
  total_acessiveis AS (
    SELECT count(*) AS n FROM public.bd_caminhoes_equipamentos c
    WHERE public.fn_ativos_can_access_equipamento(c.id, v_uid)
  ),
  ativos_json AS (
    SELECT COALESCE(jsonb_agg(payload ORDER BY status_prio, data_registro DESC), '[]'::jsonb) AS ativos
    FROM (
      SELECT
        CASE f.status_mapa WHEN 'NAO_CONFORME' THEN 1 WHEN 'PARADO' THEN 2
                            WHEN 'DESATUALIZADO' THEN 3 WHEN 'OPERACIONAL' THEN 4 ELSE 5 END AS status_prio,
        f.data_registro,
        jsonb_build_object(
          'localizacao_id', f.localizacao_id,
          'apontamento_id', f.apontamento_id,
          'equipamento_id', f.equipamento_id,
          'latitude', CASE WHEN v_can_precise OR v_is_super THEN f.latitude ELSE round(f.latitude::numeric, 3) END,
          'longitude', CASE WHEN v_can_precise OR v_is_super THEN f.longitude ELSE round(f.longitude::numeric, 3) END,
          'precisao_gps', CASE WHEN v_can_precise OR v_is_super THEN f.precisao_gps ELSE NULL END,
          'data_registro', f.data_registro,
          'origem', f.origem,
          'frota', f.frota,
          'numero_frota', f.numero_frota,
          'placa', f.placa,
          'imagem_url', f.imagem_url,
          'categoria_id', f.categoria_ativo_id,
          'categoria_nome', f.nome_categoria,
          'subcategoria_id', f.subcategoria_ativo_id,
          'subcategoria_nome', f.nome_subcategoria,
          'centro_custo_id', f.effective_cc_id,
          'centro_custo_nome', f.nome_centro_custo,
          'centro_custo_codigo', f.codigo_centro_custo,
          'operador_id', f.operador_id,
          'operador_nome', f.operador_nome,
          'data_apontamento', f.data_apontamento,
          'hora_apontamento', f.hora_inicial,
          'horimetro_final', f.horimetro_final,
          'situacao_veiculo', f.situacao_veiculo,
          'checklist_codigo', f.checklist_codigo,
          'total_checklist', f.total_checklist,
          'qtd_nao_ok', f.qtd_nao_ok,
          'status_mapa', f.status_mapa,
          'status_label', CASE f.status_mapa
                           WHEN 'NAO_CONFORME' THEN 'Não conforme'
                           WHEN 'PARADO' THEN 'Parado'
                           WHEN 'DESATUALIZADO' THEN 'Desatualizado'
                           WHEN 'OPERACIONAL' THEN 'Operacional'
                           ELSE 'Sem status' END,
          'status_prioridade', CASE f.status_mapa
                                 WHEN 'NAO_CONFORME' THEN 1
                                 WHEN 'PARADO' THEN 2
                                 WHEN 'DESATUALIZADO' THEN 3
                                 WHEN 'OPERACIONAL' THEN 4 ELSE 5 END,
          'coordenada_precisa', v_can_precise OR v_is_super
        ) AS payload
      FROM filtered f
    ) t
  ),
  resumo AS (
    SELECT jsonb_build_object(
      'total_ativos_acessiveis', (SELECT n FROM total_acessiveis),
      'localizados', (SELECT count(*) FROM filtered),
      'sem_localizacao', GREATEST(0, (SELECT n FROM total_acessiveis) - (SELECT count(*) FROM filtered)),
      'operacionais', (SELECT count(*) FROM filtered WHERE status_mapa = 'OPERACIONAL'),
      'nao_conformes', (SELECT count(*) FROM filtered WHERE status_mapa = 'NAO_CONFORME'),
      'parados', (SELECT count(*) FROM filtered WHERE status_mapa = 'PARADO'),
      'desatualizados', (SELECT count(*) FROM filtered WHERE status_mapa = 'DESATUALIZADO'),
      'sem_status', (SELECT count(*) FROM filtered WHERE status_mapa = 'SEM_STATUS')
    ) AS r
  )
  SELECT jsonb_build_object(
    'ativos', (SELECT ativos FROM ativos_json),
    'resumo', (SELECT r FROM resumo),
    'gerado_em', v_now,
    'coordenada_precisa', v_can_precise OR v_is_super
  ) INTO v_result;

  RETURN v_result;
END;
$function$;
