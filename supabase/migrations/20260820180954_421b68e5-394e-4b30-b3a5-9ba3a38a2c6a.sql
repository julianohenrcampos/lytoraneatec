CREATE OR REPLACE FUNCTION public.fn_mapa_operacional_ultimas_localizacoes(p_filtros jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_can_precise boolean;
  v_is_super boolean;
  v_limite_horas int := COALESCE((p_filtros->>'limite_desatualizado_horas')::int, 24);
  v_periodo text := COALESCE(NULLIF(p_filtros->>'periodo_localizacao',''),'HOJE');
  v_periodo_inicio timestamptz := NULL;
  v_periodo_fim timestamptz := NULL;
  v_somente_hoje boolean := false;
  v_data_hoje date;
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
  v_data_hoje := (v_now AT TIME ZONE 'America/Sao_Paulo')::date;

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

  IF v_periodo = 'HOJE' THEN v_somente_hoje := true;
  ELSIF v_periodo = '2H' THEN v_periodo_inicio := v_now - interval '2 hours';
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

  WITH
  aloc AS (
    SELECT * FROM public.fn_veiculos_alocacao_atual(NULL)
  ),
  loc_periodo AS (
    SELECT
      l.id            AS localizacao_id,
      l.equipamento_id,
      l.apontamento_id,
      l.latitude,
      l.longitude,
      l.precisao_gps,
      l.data_registro,
      l.origem::text  AS origem
    FROM public.bd_localizacao_equipamentos l
    LEFT JOIN public.bd_registro_apontamento_cam_equipa apx ON apx.id = l.apontamento_id
    WHERE l.origem::text = 'APONTAMENTO_CE'
      AND l.latitude IS NOT NULL AND l.longitude IS NOT NULL
      AND l.latitude BETWEEN -90 AND 90
      AND l.longitude BETWEEN -180 AND 180
      AND NOT (l.latitude = 0 AND l.longitude = 0)
      AND (
        NOT v_somente_hoje
        OR COALESCE(apx.data, (l.data_registro AT TIME ZONE 'America/Sao_Paulo')::date) = v_data_hoje
      )
      AND (v_periodo_inicio IS NULL OR l.data_registro >= v_periodo_inicio)
      AND (v_periodo_fim IS NULL OR l.data_registro <= v_periodo_fim)
      AND (v_is_super OR public.fn_ativos_can_access_equipamento(l.equipamento_id, v_uid))
  ),
  ultima_loc AS (
    SELECT DISTINCT ON (lp.equipamento_id)
      lp.localizacao_id, lp.equipamento_id, lp.apontamento_id,
      lp.latitude, lp.longitude, lp.precisao_gps, lp.data_registro, lp.origem
    FROM loc_periodo lp
    ORDER BY lp.equipamento_id, lp.data_registro DESC, lp.localizacao_id DESC
  ),
  enriched AS (
    SELECT
      ul.*,
      c.frota, c.numero_frota, c.placa, c.imagem_url,
      c.categoria_ativo_id, c.subcategoria_ativo_id, c.situacao AS situacao_veiculo,
      cat.nome_categoria, sub.nome_subcategoria,
      ap.operador_id, ap.data AS data_apontamento, ap.hora_inicial,
      ap.horimetro_final,
      COALESCE(a.centro_custo_atual_id, ap.centro_custo_id)              AS effective_cc_id,
      COALESCE(a.centro_custo_atual_nome, cc_ap.nome_centro_custo)       AS nome_centro_custo,
      COALESCE(a.centro_custo_atual_codigo, cc_ap.codigo_centro_custo)   AS codigo_centro_custo,
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
    LEFT JOIN aloc a ON a.equipamento_id = ul.equipamento_id
    JOIN public.bd_caminhoes_equipamentos c ON c.id = ul.equipamento_id
    LEFT JOIN public.bd_registro_apontamento_cam_equipa ap ON ap.id = ul.apontamento_id
    LEFT JOIN public.bd_centros_custo cc_ap ON cc_ap.id = ap.centro_custo_id
    LEFT JOIN public.bd_registro_apontamento_inspecao insp ON insp.apontamento_caminhao_equipamento_id = ul.apontamento_id
    LEFT JOIN public.bd_categorias_ativos cat ON cat.id = c.categoria_ativo_id
    LEFT JOIN public.bd_subcategorias_ativos sub ON sub.id = c.subcategoria_ativo_id
    LEFT JOIN public.bd_funcionarios f ON f.id = ap.operador_id
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
  ),
  apontamentos_dia AS (
    SELECT count(*)::int AS n
    FROM public.bd_registro_apontamento_cam_equipa ap
    JOIN public.bd_caminhoes_equipamentos c ON c.id = ap.caminhao_equipamento_id
    LEFT JOIN public.bd_categorias_ativos cat ON cat.id = c.categoria_ativo_id
    LEFT JOIN public.bd_subcategorias_ativos sub ON sub.id = c.subcategoria_ativo_id
    LEFT JOIN public.bd_funcionarios f ON f.id = ap.operador_id
    LEFT JOIN aloc a ON a.equipamento_id = c.id
    WHERE ap.data = v_data_hoje
      AND (v_is_super OR public.fn_ativos_can_access_equipamento(c.id, v_uid))
      AND (v_busca IS NULL OR (
        coalesce(c.frota,'') || ' ' || coalesce(c.numero_frota,'') || ' ' ||
        coalesce(c.placa,'') || ' ' || coalesce(cat.nome_categoria,'') || ' ' ||
        coalesce(sub.nome_subcategoria,'') || ' ' || coalesce(f.nome_completo,'')
        ) ILIKE '%' || v_busca || '%')
      AND (v_cc_ids IS NULL OR COALESCE(a.centro_custo_atual_id, ap.centro_custo_id) = ANY(v_cc_ids))
      AND (v_cat_ids IS NULL OR c.categoria_ativo_id = ANY(v_cat_ids))
      AND (v_sub_ids IS NULL OR c.subcategoria_ativo_id = ANY(v_sub_ids))
      AND (v_op_ids IS NULL OR ap.operador_id = ANY(v_op_ids))
      AND (v_situacao_list IS NULL OR c.situacao = ANY(v_situacao_list))
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
      'sem_status', (SELECT count(*) FROM filtered WHERE status_mapa = 'SEM_STATUS'),
      'apontamentos_dia', (SELECT n FROM apontamentos_dia)
    ) AS r
  ),
  aloc_valida AS (
    SELECT a.*
    FROM aloc a
    WHERE a.centro_custo_atual_id IS NOT NULL
  ),
  cc_ids_com_alocacao AS (
    SELECT DISTINCT centro_custo_atual_id AS id FROM aloc_valida
  ),
  cc_responsavel AS (
    SELECT scope_cc.centro_custo_id
    FROM public.fn_ativos_user_centros_custo_responsavel(v_uid) AS scope_cc
  ),
  cc_base AS (
    SELECT cc.*
    FROM public.bd_centros_custo cc
    WHERE cc.situacao = 'Ativo'
      AND cc.latitude IS NOT NULL
      AND cc.longitude IS NOT NULL
      AND cc.latitude BETWEEN -90 AND 90
      AND cc.longitude BETWEEN -180 AND 180
      AND NOT (cc.latitude = 0 AND cc.longitude = 0)
      AND (
        v_is_super
        OR public.fn_ativos_can_access_centro_custo(cc.id, v_uid)
        OR cc.id IN (
          SELECT responsavel.centro_custo_id
          FROM cc_responsavel AS responsavel
        )
        OR cc.id IN (SELECT id FROM cc_ids_com_alocacao)
      )
      AND (v_cc_ids IS NULL OR cc.id = ANY(v_cc_ids))
  ),
  cc_equipamentos AS (
    SELECT
      cc.id AS centro_custo_id,
      a.equipamento_id,
      ce.frota,
      ce.numero_frota,
      ce.placa,
      ce.imagem_url,
      ce.situacao AS situacao,
      EXISTS (
        SELECT 1 FROM ultima_loc ul WHERE ul.equipamento_id = a.equipamento_id
      ) AS tem_gps
    FROM cc_base cc
    JOIN aloc_valida a  ON a.centro_custo_atual_id = cc.id
    JOIN public.bd_caminhoes_equipamentos ce ON ce.id = a.equipamento_id
  ),
  cc_agg AS (
    SELECT
      cc.id AS centro_custo_id,
      cc.codigo_centro_custo AS codigo,
      cc.nome_centro_custo   AS nome,
      cc.endereco_completo   AS endereco,
      cc.latitude::float8    AS latitude,
      cc.longitude::float8   AS longitude,
      COALESCE((SELECT count(*) FROM cc_equipamentos e WHERE e.centro_custo_id = cc.id), 0)::int AS total_alocados,
      COALESCE((SELECT count(*) FROM cc_equipamentos e WHERE e.centro_custo_id = cc.id AND e.tem_gps), 0)::int AS total_com_gps,
      COALESCE(
        (SELECT jsonb_agg(
          jsonb_build_object(
            'equipamento_id', e.equipamento_id,
            'frota', e.frota,
            'numero_frota', e.numero_frota,
            'placa', e.placa,
            'imagem_url', e.imagem_url,
            'situacao', e.situacao,
            'tem_gps', e.tem_gps
          )
          ORDER BY e.tem_gps DESC,
                   coalesce(e.frota,'') || coalesce(e.numero_frota,''),
                   coalesce(e.placa,'')
        )
        FROM cc_equipamentos e WHERE e.centro_custo_id = cc.id),
        '[]'::jsonb
      ) AS equipamentos
    FROM cc_base cc
  ),
  centros_custo_json AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'centro_custo_id', centro_custo_id,
        'codigo', codigo,
        'nome', nome,
        'endereco', endereco,
        'latitude', latitude,
        'longitude', longitude,
        'total_alocados', total_alocados,
        'total_com_gps', total_com_gps,
        'total_sem_gps', GREATEST(total_alocados - total_com_gps, 0),
        'equipamentos', equipamentos
      )
      ORDER BY total_alocados DESC, nome
    ), '[]'::jsonb) AS centros_custo
    FROM cc_agg
  )
  SELECT jsonb_build_object(
    'ativos', (SELECT ativos FROM ativos_json),
    'centros_custo', (SELECT centros_custo FROM centros_custo_json),
    'resumo', (SELECT r FROM resumo),
    'gerado_em', v_now,
    'coordenada_precisa', v_can_precise OR v_is_super
  ) INTO v_result;

  RETURN v_result;
END;
$function$;
