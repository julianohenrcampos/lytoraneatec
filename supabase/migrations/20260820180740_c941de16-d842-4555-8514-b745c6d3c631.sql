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

  RETURN QUERY_PLACEHOLDER;
END;
$function$;
