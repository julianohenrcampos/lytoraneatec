
-- =====================================================================
-- Fase 2.1 — Integração Ativa Controlada (massa [FASE2-TEST])
-- =====================================================================

-- 1.1 tipo_registro em bd_ponto_diaria_integracao
ALTER TABLE bd_ponto_diaria_integracao
  ADD COLUMN IF NOT EXISTS tipo_registro text NOT NULL DEFAULT 'shadow';

ALTER TABLE bd_ponto_diaria_integracao
  DROP CONSTRAINT IF EXISTS chk_integracao_tipo_registro;
ALTER TABLE bd_ponto_diaria_integracao
  ADD CONSTRAINT chk_integracao_tipo_registro
  CHECK (tipo_registro IN ('shadow','real'));

CREATE UNIQUE INDEX IF NOT EXISTS ux_integracao_batida_real
  ON bd_ponto_diaria_integracao (batida_id)
  WHERE tipo_registro = 'real';

-- 1.2 origem em bd_diaria_presencas
ALTER TABLE bd_diaria_presencas
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS origem_batida_id uuid REFERENCES bd_ponto_batidas(id);

ALTER TABLE bd_diaria_presencas
  DROP CONSTRAINT IF EXISTS chk_presenca_origem;
ALTER TABLE bd_diaria_presencas
  ADD CONSTRAINT chk_presenca_origem
  CHECK (origem IN ('manual','auto_ponto'));

-- =====================================================================
-- 2. RPC fn_ponto_diaria_integrar_batida
-- =====================================================================
CREATE OR REPLACE FUNCTION public.fn_ponto_diaria_integrar_batida(p_batida_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_batida           bd_ponto_batidas%ROWTYPE;
  v_data_op          date;
  v_hora             time;
  v_status           text;
  v_motivo           text;
  v_solicitacao_id   uuid;
  v_candidatas       uuid[];
  v_match_count      int;
  v_convocado_match  boolean := false;
  v_dia_match        boolean := false;
  v_fallback_dias    text := 'legado_periodo';
  v_presenca_id      uuid;
  v_origem_existente text;
  v_aditivos_pend    int := 0;
  v_dentro_raio      boolean;
  v_dist             numeric;
  v_tem_dia_solic    boolean := false;
  v_detalhes         jsonb;
  v_tem_entrada_ant       boolean := false;
  v_tem_interv_ini_ant    boolean := false;
  v_qtd_ant_validas       int := 0;
  v_acao             text := 'none';
BEGIN
  -- Gate SuperAdm
  IF NOT public.has_role(auth.uid(),'SuperAdm') THEN
    RAISE EXCEPTION 'fase2.1_acesso_negado';
  END IF;

  -- Idempotência real
  IF EXISTS (
    SELECT 1 FROM bd_ponto_diaria_integracao
    WHERE batida_id = p_batida_id AND tipo_registro = 'real'
  ) THEN
    RETURN 'ja_integrada';
  END IF;

  SELECT * INTO v_batida FROM bd_ponto_batidas WHERE id = p_batida_id;
  IF NOT FOUND THEN
    RETURN 'batida_inexistente';
  END IF;

  v_data_op := COALESCE(
    v_batida.data_operacional,
    (v_batida.data_hora_considerada AT TIME ZONE 'America/Sao_Paulo')::date
  );
  v_hora := (v_batida.data_hora_considerada AT TIME ZONE 'America/Sao_Paulo')::time;
  v_dentro_raio := v_batida.dentro_raio;
  v_dist        := v_batida.distancia_centro_metros;

  <<decisao>>
  LOOP
    IF v_batida.status_validacao IS DISTINCT FROM 'valida' THEN
      v_status := 'batida_invalida';
      v_motivo := format('status_validacao=%s', COALESCE(v_batida.status_validacao::text,'null'));
      EXIT decisao;
    END IF;

    SELECT array_agg(s.id), count(*)
      INTO v_candidatas, v_match_count
    FROM bd_diaria_solicitacoes s
    WHERE s.centro_custo_id = v_batida.centro_custo_id
      AND s.status = 'autorizada'
      AND v_data_op BETWEEN s.data_inicio AND COALESCE(s.data_fim, s.data_inicio);

    IF COALESCE(v_match_count,0) = 0 THEN
      v_status := 'sem_solicitacao';
      v_motivo := 'nenhuma solicitação autorizada para CC/data';
      EXIT decisao;
    END IF;

    -- Gate [FASE2-TEST]
    SELECT array_agg(id) INTO v_candidatas
    FROM bd_diaria_solicitacoes
    WHERE id = ANY(v_candidatas)
      AND justificativa ILIKE '%[FASE2-TEST]%';

    IF COALESCE(array_length(v_candidatas,1),0) = 0 THEN
      v_status := 'fora_massa_teste';
      v_motivo := 'solicitação fora da massa [FASE2-TEST]';
      EXIT decisao;
    END IF;

    -- Match convocado / dia
    WITH cand AS (
      SELECT s.id AS solic_id,
             s.data_inicio,
             COALESCE(s.data_fim, s.data_inicio) AS d_fim,
             (c->>'funcionario_id')::uuid AS func_id,
             c->'dias_solicitados'        AS dias_arr,
             jsonb_typeof(c->'dias_solicitados') AS dias_tipo
        FROM bd_diaria_solicitacoes s
        LEFT JOIN LATERAL jsonb_array_elements(COALESCE(s.convocados_pre,'[]'::jsonb)) c ON TRUE
       WHERE s.id = ANY(v_candidatas)
    ),
    com_func AS (
      SELECT * FROM cand WHERE func_id = v_batida.funcionario_id
    ),
    match_dia AS (
      SELECT cf.solic_id,
             CASE
               WHEN cf.dias_tipo = 'array' AND jsonb_array_length(cf.dias_arr) > 0
                 THEN EXISTS (
                   SELECT 1 FROM jsonb_array_elements_text(cf.dias_arr) d
                   WHERE d = v_data_op::text
                 )
               ELSE v_data_op BETWEEN cf.data_inicio AND cf.d_fim
             END AS dia_ok,
             (cf.dias_tipo = 'array' AND jsonb_array_length(cf.dias_arr) > 0) AS tem_dia_solic
        FROM com_func cf
    )
    SELECT
      EXISTS (SELECT 1 FROM com_func),
      EXISTS (SELECT 1 FROM match_dia WHERE dia_ok),
      bool_or(tem_dia_solic),
      (SELECT array_agg(solic_id) FROM match_dia WHERE dia_ok)
      INTO v_convocado_match, v_dia_match, v_tem_dia_solic, v_candidatas
    FROM match_dia;

    v_fallback_dias := CASE WHEN COALESCE(v_tem_dia_solic,false) THEN 'campo' ELSE 'legado_periodo' END;

    IF NOT v_convocado_match THEN
      v_status := 'fora_convocacao';
      v_motivo := 'funcionário não está em convocados_pre';
      EXIT decisao;
    END IF;

    IF NOT v_dia_match THEN
      v_status := 'fora_dia_solicitado';
      v_motivo := format('data %s fora dos dias solicitados (origem=%s)', v_data_op, v_fallback_dias);
      EXIT decisao;
    END IF;

    -- Conflito CC diferente
    SELECT p.id INTO v_presenca_id
      FROM bd_diaria_presencas p
      JOIN bd_diaria_solicitacoes s2 ON s2.id = p.solicitacao_id
     WHERE p.funcionario_id = v_batida.funcionario_id
       AND p.data = v_data_op
       AND s2.centro_custo_id IS DISTINCT FROM v_batida.centro_custo_id
     LIMIT 1;
    IF v_presenca_id IS NOT NULL THEN
      v_status := 'conflito_cc';
      v_motivo := 'presença em CC diferente para a mesma data';
      v_presenca_id := NULL;
      EXIT decisao;
    END IF;

    -- Aditivos pendentes
    SELECT count(*) INTO v_aditivos_pend
      FROM bd_diaria_aditivos a
     WHERE a.solicitacao_id = ANY(v_candidatas)
       AND a.status = 'pendente'
       AND (a.funcionario_id = v_batida.funcionario_id OR a.data_ajustada = v_data_op);
    IF COALESCE(v_aditivos_pend,0) > 0 THEN
      v_status := 'aditivo_pendente';
      v_motivo := format('%s aditivo(s) pendente(s)', v_aditivos_pend);
      EXIT decisao;
    END IF;

    IF v_dentro_raio = false THEN
      v_status := 'fora_raio';
      v_motivo := format('batida fora do raio (dist=%sm)', COALESCE(v_dist::text,'?'));
      EXIT decisao;
    END IF;

    -- Ordem cronológica
    IF v_batida.tipo_batida IN ('saida','intervalo_inicio','intervalo_fim') THEN
      SELECT
        COUNT(*) FILTER (WHERE tipo_batida = 'entrada') > 0,
        COUNT(*) FILTER (WHERE tipo_batida = 'intervalo_inicio') > 0,
        COUNT(*)
        INTO v_tem_entrada_ant, v_tem_interv_ini_ant, v_qtd_ant_validas
      FROM bd_ponto_batidas
      WHERE funcionario_id  = v_batida.funcionario_id
        AND centro_custo_id = v_batida.centro_custo_id
        AND COALESCE(
              data_operacional,
              (data_hora_considerada AT TIME ZONE 'America/Sao_Paulo')::date
            ) = v_data_op
        AND status_validacao = 'valida'
        AND data_hora_considerada < v_batida.data_hora_considerada;

      IF v_batida.tipo_batida = 'saida' AND NOT v_tem_entrada_ant THEN
        v_status := 'ordem_invalida';
        v_motivo := 'saida sem entrada anterior';
        EXIT decisao;
      ELSIF v_batida.tipo_batida = 'intervalo_inicio' AND NOT v_tem_entrada_ant THEN
        v_status := 'ordem_invalida';
        v_motivo := 'intervalo_inicio sem entrada anterior';
        EXIT decisao;
      ELSIF v_batida.tipo_batida = 'intervalo_fim' AND NOT v_tem_interv_ini_ant THEN
        v_status := 'ordem_invalida';
        v_motivo := 'intervalo_fim sem intervalo_inicio anterior';
        EXIT decisao;
      END IF;
    END IF;

    IF COALESCE(array_length(v_candidatas,1),0) > 1 THEN
      v_status := 'ambiguo';
      v_motivo := format('%s solicitações elegíveis', array_length(v_candidatas,1));
      EXIT decisao;
    END IF;

    v_solicitacao_id := v_candidatas[1];
    v_status := 'auto_apontado';
    v_motivo := 'match único e elegível';
    EXIT decisao;
  END LOOP;

  -- =================================================================
  -- ESCRITA DE PRESENÇA: somente auto_apontado
  -- =================================================================
  IF v_status = 'auto_apontado' THEN
    SELECT id, origem INTO v_presenca_id, v_origem_existente
    FROM bd_diaria_presencas
    WHERE solicitacao_id = v_solicitacao_id
      AND funcionario_id = v_batida.funcionario_id
      AND data = v_data_op
    FOR UPDATE;

    IF FOUND AND v_origem_existente = 'manual' THEN
      v_status := 'presenca_manual_existente';
      v_motivo := 'presença manual existente, não sobrescrita';
      v_presenca_id := NULL;

    ELSIF FOUND AND v_origem_existente = 'auto_ponto' THEN
      UPDATE bd_diaria_presencas SET
        hora_entrada     = CASE WHEN v_batida.tipo_batida='entrada'          AND hora_entrada     IS NULL THEN v_hora ELSE hora_entrada END,
        intervalo_inicio = CASE WHEN v_batida.tipo_batida='intervalo_inicio' AND intervalo_inicio IS NULL THEN v_hora ELSE intervalo_inicio END,
        intervalo_fim    = CASE WHEN v_batida.tipo_batida='intervalo_fim'    AND intervalo_fim    IS NULL THEN v_hora ELSE intervalo_fim END,
        hora_saida       = CASE WHEN v_batida.tipo_batida='saida'            AND hora_saida       IS NULL THEN v_hora ELSE hora_saida END,
        presente         = true,
        updated_at       = now(),
        modificado_por   = auth.uid()
      WHERE id = v_presenca_id;
      v_acao := 'merge';

    ELSE
      INSERT INTO bd_diaria_presencas(
        solicitacao_id, funcionario_id, data, presente,
        hora_entrada, intervalo_inicio, intervalo_fim, hora_saida,
        origem, origem_batida_id, valor_diaria_aplicada, turno
      ) VALUES (
        v_solicitacao_id, v_batida.funcionario_id, v_data_op, true,
        CASE WHEN v_batida.tipo_batida='entrada'          THEN v_hora END,
        CASE WHEN v_batida.tipo_batida='intervalo_inicio' THEN v_hora END,
        CASE WHEN v_batida.tipo_batida='intervalo_fim'    THEN v_hora END,
        CASE WHEN v_batida.tipo_batida='saida'            THEN v_hora END,
        'auto_ponto', p_batida_id,
        0,  -- Pendência: valor real será calculado em Fase 2.2
        'diurno'
      ) RETURNING id INTO v_presenca_id;
      v_acao := 'insert';
    END IF;
  END IF;

  -- =================================================================
  -- DETALHES + INTEGRAÇÃO
  -- =================================================================
  v_detalhes := jsonb_build_object(
    'regra','v2.1',
    'batida_id', p_batida_id,
    'funcionario_id', v_batida.funcionario_id,
    'centro_custo_id', v_batida.centro_custo_id,
    'data_operacional', v_data_op,
    'tipo_batida', v_batida.tipo_batida,
    'candidatas', COALESCE(to_jsonb(v_candidatas), '[]'::jsonb),
    'solicitacao_id', v_solicitacao_id,
    'convocado_match', v_convocado_match,
    'dia_match', v_dia_match,
    'fallback_dias', v_fallback_dias,
    'raio', jsonb_build_object('dentro', v_dentro_raio, 'distancia_m', v_dist),
    'aditivos_pendentes', COALESCE(v_aditivos_pend,0),
    'origem_existente', v_origem_existente,
    'acao', v_acao,
    'ordem', jsonb_build_object(
       'tem_entrada_anterior', v_tem_entrada_ant,
       'tem_intervalo_inicio_anterior', v_tem_interv_ini_ant,
       'qtd_batidas_anteriores_validas', v_qtd_ant_validas
    ),
    'ts', now()
  );

  INSERT INTO bd_ponto_diaria_integracao(
    batida_id, presenca_diaria_id, solicitacao_id, funcionario_id,
    centro_custo_id, data_operacional, tipo_batida,
    status, motivo, detalhes, tipo_registro
  ) VALUES (
    p_batida_id,
    CASE WHEN v_status='auto_apontado' THEN v_presenca_id ELSE NULL END,
    v_solicitacao_id, v_batida.funcionario_id, v_batida.centro_custo_id,
    v_data_op, v_batida.tipo_batida::text,
    v_status, v_motivo, v_detalhes, 'real'
  )
  ON CONFLICT (batida_id) WHERE tipo_registro='real' DO NOTHING;

  -- Log apenas quando há efeito em presença
  IF v_status = 'auto_apontado' AND v_acao IN ('insert','merge') THEN
    INSERT INTO bd_diaria_logs(
      solicitacao_id, tipo_evento, usuario_id, justificativa, dados_extras
    ) VALUES (
      v_solicitacao_id,
      CASE WHEN v_acao='insert' THEN 'autoapontamento_insert' ELSE 'autoapontamento_merge' END,
      auth.uid(),
      '[FASE2-TEST] integração ativa controlada',
      jsonb_build_object(
        'batida_id', p_batida_id,
        'presenca_id', v_presenca_id,
        'tipo_batida', v_batida.tipo_batida,
        'data_operacional', v_data_op
      )
    );
  END IF;

  RETURN v_status;
END;
$function$;

-- =====================================================================
-- 3. RPC fn_ponto_diaria_integrar_lote
-- =====================================================================
CREATE OR REPLACE FUNCTION public.fn_ponto_diaria_integrar_lote(p_batida_ids uuid[])
RETURNS TABLE(batida_id uuid, status text, erro text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_status text;
BEGIN
  IF NOT public.has_role(auth.uid(),'SuperAdm') THEN
    RAISE EXCEPTION 'fase2.1_acesso_negado';
  END IF;

  FOREACH v_id IN ARRAY p_batida_ids LOOP
    BEGIN
      v_status := public.fn_ponto_diaria_integrar_batida(v_id);
      batida_id := v_id; status := v_status; erro := NULL;
      RETURN NEXT;
    EXCEPTION WHEN OTHERS THEN
      batida_id := v_id; status := NULL; erro := SQLERRM;
      RETURN NEXT;
    END;
  END LOOP;
END;
$function$;
