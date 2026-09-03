
-- =====================================================================
-- Fase 0 — RPCs transacionais para Apontamento C&E + Inspeção
-- Aditivo: não altera tabelas, colunas, RLS, triggers, buckets ou grants
-- =====================================================================

CREATE OR REPLACE FUNCTION public.fn_salvar_apontamento_ce_com_inspecao(
  p_apontamento_id uuid,
  p_cabecalho      jsonb,
  p_inspecao       jsonb
)
RETURNS TABLE (apontamento_id uuid, inspecao_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
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
  v_path             text;
  v_path_re          text;
  v_existe_insp_id   uuid;
  v_out_apontamento  uuid;
  v_out_inspecao     uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '28000';
  END IF;
  IF p_apontamento_id IS NULL THEN
    RAISE EXCEPTION 'apontamento_id_obrigatorio' USING ERRCODE = '22004';
  END IF;
  IF p_cabecalho IS NULL OR jsonb_typeof(p_cabecalho) <> 'object' THEN
    RAISE EXCEPTION 'cabecalho_invalido' USING ERRCODE = '22023';
  END IF;
  IF p_inspecao IS NULL OR jsonb_typeof(p_inspecao) <> 'object' THEN
    RAISE EXCEPTION 'inspecao_invalida' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_apontamento_id::text, 0));

  -- Extração do cabeçalho
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

  IF v_caminhao_id IS NULL OR v_operador_id IS NULL
     OR v_cc_id IS NULL OR v_data IS NULL OR v_situacao IS NULL THEN
    RAISE EXCEPTION 'cabecalho_campos_obrigatorios' USING ERRCODE = '23502';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.bd_caminhoes_equipamentos WHERE id = v_caminhao_id) THEN
    RAISE EXCEPTION 'caminhao_equipamento_inexistente' USING ERRCODE = '23503';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.bd_funcionarios
     WHERE id = v_operador_id AND status IN ('Ativo','Ativo sem Registro')
  ) THEN
    RAISE EXCEPTION 'operador_invalido_ou_inativo' USING ERRCODE = '23503';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bd_centros_custo WHERE id = v_cc_id) THEN
    RAISE EXCEPTION 'centro_custo_inexistente' USING ERRCODE = '23503';
  END IF;

  IF v_horim_inicial IS NOT NULL AND v_horim_inicial < 0 THEN
    RAISE EXCEPTION 'horimetro_inicial_negativo' USING ERRCODE = '23514';
  END IF;
  IF v_horim_final IS NOT NULL AND v_horim_final < 0 THEN
    RAISE EXCEPTION 'horimetro_final_negativo' USING ERRCODE = '23514';
  END IF;
  IF v_horim_inicial IS NOT NULL AND v_horim_final IS NOT NULL
     AND v_horim_final < v_horim_inicial THEN
    RAISE EXCEPTION 'horimetro_final_menor_que_inicial' USING ERRCODE = '23514';
  END IF;
  IF v_abastecimento IS NOT NULL AND v_abastecimento < 0 THEN
    RAISE EXCEPTION 'abastecimento_negativo' USING ERRCODE = '23514';
  END IF;

  -- Autorização
  v_is_priv      := public.fn_logistica_is_privileged_user();
  v_current_func := public.fn_logistica_current_funcionario_id();

  SELECT * INTO v_existing_cab
    FROM public.bd_registro_apontamento_cam_equipa
   WHERE id = p_apontamento_id
   FOR UPDATE;

  IF v_existing_cab.id IS NULL THEN
    IF NOT (
      v_is_priv
      OR v_operador_id = v_current_func
      OR public.fn_logistica_can_access_centro_custo(v_cc_id)
    ) THEN
      RAISE EXCEPTION 'forbidden_scope' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF NOT public.fn_logistica_can_access_apontamento_cam(p_apontamento_id) THEN
      RAISE EXCEPTION 'forbidden_row' USING ERRCODE = '42501';
    END IF;
    IF v_existing_cab.centro_custo_id IS DISTINCT FROM v_cc_id
       AND NOT (v_is_priv OR public.fn_logistica_can_access_centro_custo(v_cc_id)) THEN
      RAISE EXCEPTION 'forbidden_scope_novo_cc' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Checklist server-side
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

  IF v_nivel_oleo             IS NULL OR NOT (v_nivel_oleo             = ANY(v_valid_values))
  OR v_nivel_agua             IS NULL OR NOT (v_nivel_agua             = ANY(v_valid_values))
  OR v_nivel_combustivel      IS NULL OR NOT (v_nivel_combustivel      = ANY(v_valid_values))
  OR v_pressao_pneus          IS NULL OR NOT (v_pressao_pneus          = ANY(v_valid_values))
  OR v_estado_pneus           IS NULL OR NOT (v_estado_pneus           = ANY(v_valid_values))
  OR v_luzes_funcionamento    IS NULL OR NOT (v_luzes_funcionamento    = ANY(v_valid_values))
  OR v_freios_funcionamento   IS NULL OR NOT (v_freios_funcionamento   = ANY(v_valid_values))
  OR v_direcao_funcionamento  IS NULL OR NOT (v_direcao_funcionamento  = ANY(v_valid_values))
  OR v_equipamentos_seguranca IS NULL OR NOT (v_equipamentos_seguranca = ANY(v_valid_values))
  OR v_limpeza_veiculo        IS NULL OR NOT (v_limpeza_veiculo        = ANY(v_valid_values))
  THEN
    RAISE EXCEPTION 'inspecao_incompleta' USING ERRCODE = '23514';
  END IF;

  v_possui_nao_ok :=
       v_nivel_oleo='NAO_OK' OR v_nivel_agua='NAO_OK' OR v_nivel_combustivel='NAO_OK'
    OR v_pressao_pneus='NAO_OK' OR v_estado_pneus='NAO_OK'
    OR v_luzes_funcionamento='NAO_OK' OR v_freios_funcionamento='NAO_OK'
    OR v_direcao_funcionamento='NAO_OK' OR v_equipamentos_seguranca='NAO_OK'
    OR v_limpeza_veiculo='NAO_OK';

  v_avarias     := NULLIF(btrim(coalesce(p_inspecao->>'avarias_observadas','')),'');
  v_observacoes := NULLIF(btrim(coalesce(p_inspecao->>'observacoes_gerais','')),'');

  IF v_possui_nao_ok AND v_avarias IS NULL AND v_observacoes IS NULL THEN
    RAISE EXCEPTION 'nao_conformidade_sem_observacao' USING ERRCODE = '23514';
  END IF;

  -- Fotos: validar array e cada path
  IF jsonb_typeof(coalesce(p_inspecao->'fotos_inspecao','[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'fotos_formato_invalido' USING ERRCODE = '22023';
  END IF;
  v_fotos := ARRAY(
    SELECT jsonb_array_elements_text(
      COALESCE(p_inspecao->'fotos_inspecao','[]'::jsonb)
    )
  );

  v_path_re := '^' || p_apontamento_id::text ||
               '/[0-9a-fA-F-]{36}\.(jpg|jpeg|png|webp)$';
  IF v_fotos IS NOT NULL THEN
    FOREACH v_path IN ARRAY v_fotos LOOP
      IF v_path IS NULL
         OR length(v_path) = 0
         OR position('..' in v_path) > 0
         OR left(v_path,1) = '/'
         OR position('apontamentos/' in v_path) > 0
         OR v_path !~ v_path_re
      THEN
        RAISE EXCEPTION 'fotos_path_invalido' USING ERRCODE = '22023';
      END IF;
    END LOOP;
  END IF;

  v_inspecao_aprovada := NOT v_possui_nao_ok;

  -- Cabeçalho: INSERT ou UPDATE
  IF v_existing_cab.id IS NULL THEN
    INSERT INTO public.bd_registro_apontamento_cam_equipa (
      id, caminhao_equipamento_id, operador_id, centro_custo_id,
      data, hora_inicial, hora_final,
      horimetro_inicial, horimetro_final,
      situacao, abastecimento,
      created_by, modificado_por
    ) VALUES (
      p_apontamento_id, v_caminhao_id, v_operador_id, v_cc_id,
      v_data, v_hora_inicial, v_hora_final,
      v_horim_inicial, v_horim_final,
      v_situacao, v_abastecimento,
      v_uid, NULL
    );
    v_out_apontamento := p_apontamento_id;
  ELSE
    UPDATE public.bd_registro_apontamento_cam_equipa SET
      caminhao_equipamento_id = v_caminhao_id,
      operador_id             = v_operador_id,
      centro_custo_id         = v_cc_id,
      data                    = v_data,
      hora_inicial            = v_hora_inicial,
      hora_final              = v_hora_final,
      horimetro_inicial       = v_horim_inicial,
      horimetro_final         = v_horim_final,
      situacao                = v_situacao,
      abastecimento           = v_abastecimento,
      updated_at              = now(),
      modificado_por          = v_uid
    WHERE id = p_apontamento_id;
    v_out_apontamento := p_apontamento_id;
  END IF;

  -- Inspeção: buscar linha atual (com ORDER determinístico) FOR UPDATE
  SELECT id INTO v_existe_insp_id
    FROM public.bd_registro_apontamento_inspecao
   WHERE apontamento_caminhao_equipamento_id = v_out_apontamento
   ORDER BY updated_at DESC NULLS LAST, created_at DESC, id DESC
   LIMIT 1
   FOR UPDATE;

  IF v_existe_insp_id IS NULL THEN
    -- Nova inspeção (inclui 1ª inspeção de cabeçalho antigo)
    INSERT INTO public.bd_registro_apontamento_inspecao (
      apontamento_caminhao_equipamento_id,
      data_inspecao, hora_inspecao,
      nivel_oleo, nivel_agua, nivel_combustivel,
      pressao_pneus, estado_pneus,
      luzes_funcionamento, freios_funcionamento, direcao_funcionamento,
      equipamentos_seguranca, limpeza_veiculo,
      avarias_observadas, observacoes_gerais,
      fotos_inspecao, inspecao_aprovada,
      created_by, modificado_por
    ) VALUES (
      v_out_apontamento,
      v_data, v_now_time,
      v_nivel_oleo, v_nivel_agua, v_nivel_combustivel,
      v_pressao_pneus, v_estado_pneus,
      v_luzes_funcionamento, v_freios_funcionamento, v_direcao_funcionamento,
      v_equipamentos_seguranca, v_limpeza_veiculo,
      v_avarias, v_observacoes,
      v_fotos, v_inspecao_aprovada,
      v_uid, NULL
    )
    RETURNING id INTO v_out_inspecao;
  ELSE
    -- UPDATE: preserva hora_inspecao original
    UPDATE public.bd_registro_apontamento_inspecao SET
      data_inspecao          = v_data,
      nivel_oleo             = v_nivel_oleo,
      nivel_agua             = v_nivel_agua,
      nivel_combustivel      = v_nivel_combustivel,
      pressao_pneus          = v_pressao_pneus,
      estado_pneus           = v_estado_pneus,
      luzes_funcionamento    = v_luzes_funcionamento,
      freios_funcionamento   = v_freios_funcionamento,
      direcao_funcionamento  = v_direcao_funcionamento,
      equipamentos_seguranca = v_equipamentos_seguranca,
      limpeza_veiculo        = v_limpeza_veiculo,
      avarias_observadas     = v_avarias,
      observacoes_gerais     = v_observacoes,
      fotos_inspecao         = v_fotos,
      inspecao_aprovada      = v_inspecao_aprovada,
      modificado_por         = v_uid
    WHERE id = v_existe_insp_id;
    v_out_inspecao := v_existe_insp_id;
  END IF;

  apontamento_id := v_out_apontamento;
  inspecao_id    := v_out_inspecao;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.fn_salvar_apontamento_ce_com_inspecao(uuid, jsonb, jsonb) IS
'Fase 0 — Salvamento atômico (INSERT/UPDATE idempotente) de apontamento C&E + inspeção 1:1. Advisory lock por apontamento_id. Checklist server-side (10 campos OK|NAO_OK|NA). inspecao_aprovada derivada. Fotos validadas por path com prefixo <apontamento_id>/. SECURITY DEFINER com search_path fixo; EXECUTE apenas para authenticated.';

REVOKE ALL ON FUNCTION public.fn_salvar_apontamento_ce_com_inspecao(uuid, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_salvar_apontamento_ce_com_inspecao(uuid, jsonb, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_salvar_apontamento_ce_com_inspecao(uuid, jsonb, jsonb) TO authenticated;

-- =====================================================================
CREATE OR REPLACE FUNCTION public.fn_excluir_apontamento_ce_com_inspecao(
  p_apontamento_id uuid
)
RETURNS TABLE (apontamento_id uuid, inspecoes_removidas integer, fotos_paths text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_exists    boolean;
  v_paths     text[] := ARRAY[]::text[];
  v_removidas integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '28000';
  END IF;
  IF p_apontamento_id IS NULL THEN
    RAISE EXCEPTION 'apontamento_id_obrigatorio' USING ERRCODE = '22004';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_apontamento_id::text, 0));

  SELECT EXISTS(
    SELECT 1 FROM public.bd_registro_apontamento_cam_equipa WHERE id = p_apontamento_id
  ) INTO v_exists;

  IF NOT v_exists THEN
    RAISE EXCEPTION 'apontamento_inexistente' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.fn_logistica_can_access_apontamento_cam(p_apontamento_id) THEN
    RAISE EXCEPTION 'forbidden_row' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(array_agg(f), ARRAY[]::text[])
    INTO v_paths
    FROM public.bd_registro_apontamento_inspecao i,
         LATERAL unnest(COALESCE(i.fotos_inspecao, ARRAY[]::text[])) AS f
   WHERE i.apontamento_caminhao_equipamento_id = p_apontamento_id;

  WITH d AS (
    DELETE FROM public.bd_registro_apontamento_inspecao
     WHERE apontamento_caminhao_equipamento_id = p_apontamento_id
     RETURNING 1
  )
  SELECT count(*)::integer INTO v_removidas FROM d;

  DELETE FROM public.bd_registro_apontamento_cam_equipa
   WHERE id = p_apontamento_id;

  apontamento_id      := p_apontamento_id;
  inspecoes_removidas := v_removidas;
  fotos_paths         := v_paths;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.fn_excluir_apontamento_ce_com_inspecao(uuid) IS
'Fase 0 — Exclusão atômica de apontamento C&E + inspeções. Advisory lock por apontamento_id. Retorna paths de fotos para cleanup best-effort no cliente. SECURITY DEFINER com search_path fixo; EXECUTE apenas para authenticated.';

REVOKE ALL ON FUNCTION public.fn_excluir_apontamento_ce_com_inspecao(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_excluir_apontamento_ce_com_inspecao(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_excluir_apontamento_ce_com_inspecao(uuid) TO authenticated;
