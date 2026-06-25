
-- ============================================================
-- Fase 1 — Ponto × Diárias em modo SHADOW (observabilidade)
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_pdi_shadow_por_batida
  ON public.bd_ponto_diaria_integracao(batida_id)
  WHERE presenca_diaria_id IS NULL;

CREATE OR REPLACE FUNCTION public.fn_ponto_diaria_simular_batida(p_batida_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- SHADOW PHASE 1 GUARD: proibido escrever em bd_diaria_presencas,
  -- bd_diaria_apontamentos, pagamento ou assinatura.
  v_batida           bd_ponto_batidas%ROWTYPE;
  v_data_op          date;
  v_status           text;
  v_motivo           text;
  v_solicitacao_id   uuid;
  v_candidatas       uuid[];
  v_match_count      int;
  v_convocado_match  boolean := false;
  v_dia_match        boolean := false;
  v_fallback_dias    text := 'legado_periodo';
  v_presenca_exist   uuid;
  v_aditivos_pend    int := 0;
  v_dentro_raio      boolean;
  v_dist             numeric;
  v_tem_dia_solic    boolean := false;
  v_detalhes         jsonb;
BEGIN
  IF EXISTS (
    SELECT 1 FROM bd_ponto_diaria_integracao
    WHERE batida_id = p_batida_id AND presenca_diaria_id IS NULL
  ) THEN
    RETURN 'ja_simulada';
  END IF;

  SELECT * INTO v_batida FROM bd_ponto_batidas WHERE id = p_batida_id;
  IF NOT FOUND THEN
    RETURN 'batida_inexistente';
  END IF;

  v_data_op := COALESCE(
    v_batida.data_operacional,
    (v_batida.data_hora_considerada AT TIME ZONE 'America/Sao_Paulo')::date
  );
  v_dentro_raio := v_batida.dentro_raio;
  v_dist        := v_batida.distancia_centro_metros;

  <<decisao>>
  LOOP
    IF v_batida.status_validacao IS DISTINCT FROM 'valida' THEN
      v_status := 'batida_invalida_simulado';
      v_motivo := format('status_validacao=%s', COALESCE(v_batida.status_validacao,'null'));
      EXIT decisao;
    END IF;

    SELECT array_agg(s.id), count(*)
      INTO v_candidatas, v_match_count
    FROM bd_diaria_solicitacoes s
    WHERE s.centro_custo_id = v_batida.centro_custo_id
      AND s.status = 'autorizada'
      AND v_data_op BETWEEN s.data_inicio AND COALESCE(s.data_fim, s.data_inicio);

    IF COALESCE(v_match_count,0) = 0 THEN
      v_status := 'sem_solicitacao_simulado';
      v_motivo := 'nenhuma solicitação autorizada para CC/data';
      EXIT decisao;
    END IF;

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
      v_status := 'fora_convocacao_simulado';
      v_motivo := 'funcionário não está em convocados_pre';
      EXIT decisao;
    END IF;

    IF NOT v_dia_match THEN
      v_status := 'fora_dia_solicitado_simulado';
      v_motivo := format('data %s fora dos dias solicitados (origem=%s)', v_data_op, v_fallback_dias);
      EXIT decisao;
    END IF;

    SELECT p.id INTO v_presenca_exist
      FROM bd_diaria_presencas p
      JOIN bd_diaria_solicitacoes s2 ON s2.id = p.solicitacao_id
     WHERE p.funcionario_id = v_batida.funcionario_id
       AND p.data = v_data_op
       AND s2.centro_custo_id IS DISTINCT FROM v_batida.centro_custo_id
     LIMIT 1;
    IF v_presenca_exist IS NOT NULL THEN
      v_status := 'conflito_cc_simulado';
      v_motivo := 'presença em CC diferente para a mesma data';
      EXIT decisao;
    END IF;

    SELECT p.id INTO v_presenca_exist
      FROM bd_diaria_presencas p
      JOIN bd_diaria_solicitacoes s3 ON s3.id = p.solicitacao_id
     WHERE p.funcionario_id = v_batida.funcionario_id
       AND p.data = v_data_op
       AND s3.centro_custo_id = v_batida.centro_custo_id
     LIMIT 1;
    IF v_presenca_exist IS NOT NULL THEN
      v_status := 'presenca_ja_existente_simulado';
      v_motivo := 'já existe presença para funcionário/CC/data';
      EXIT decisao;
    END IF;

    SELECT count(*) INTO v_aditivos_pend
      FROM bd_diaria_aditivos a
     WHERE a.solicitacao_id = ANY(v_candidatas)
       AND a.status = 'pendente'
       AND (a.funcionario_id = v_batida.funcionario_id OR a.data_ajustada = v_data_op);
    IF COALESCE(v_aditivos_pend,0) > 0 THEN
      v_status := 'aditivo_pendente_simulado';
      v_motivo := format('%s aditivo(s) pendente(s)', v_aditivos_pend);
      EXIT decisao;
    END IF;

    IF v_dentro_raio = false THEN
      v_status := 'fora_raio_simulado';
      v_motivo := format('batida fora do raio (dist=%sm)', COALESCE(v_dist::text,'?'));
      EXIT decisao;
    END IF;

    IF COALESCE(array_length(v_candidatas,1),0) > 1 THEN
      v_status := 'ambiguo_simulado';
      v_motivo := format('%s solicitações elegíveis', array_length(v_candidatas,1));
      EXIT decisao;
    END IF;

    v_solicitacao_id := v_candidatas[1];
    v_status := 'auto_apontado_simulado';
    v_motivo := 'match único e elegível';
    EXIT decisao;
  END LOOP;

  v_detalhes := jsonb_build_object(
    'regra','v1',
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
    'presenca_existente_id', v_presenca_exist,
    'ts', now()
  );

  INSERT INTO bd_ponto_diaria_integracao(
    batida_id, presenca_diaria_id, solicitacao_id, funcionario_id,
    centro_custo_id, data_operacional, tipo_batida, status, motivo, detalhes
  ) VALUES (
    p_batida_id, NULL, v_solicitacao_id, v_batida.funcionario_id,
    v_batida.centro_custo_id, v_data_op, v_batida.tipo_batida::text, v_status, v_motivo, v_detalhes
  )
  ON CONFLICT (batida_id) WHERE (presenca_diaria_id IS NULL) DO NOTHING;

  RETURN v_status;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_ponto_diaria_simular_batida(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_ponto_diaria_simular_batida(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.fn_ponto_diaria_simular_batida(uuid)
IS 'Fase 1 Shadow: simula matching ponto×diária. Apenas insere em bd_ponto_diaria_integracao (presenca_diaria_id NULL). Nunca escreve em presenças/apontamentos/pagamento/assinatura.';


CREATE OR REPLACE FUNCTION public.fn_ponto_diaria_simular_lote(
  p_desde timestamptz,
  p_ate   timestamptz,
  p_limit int DEFAULT 500
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ini timestamptz := clock_timestamp();
  v_id  uuid;
  v_st  text;
  v_proc int := 0;
  v_por_status jsonb := '{}'::jsonb;
BEGIN
  FOR v_id IN
    SELECT b.id
      FROM bd_ponto_batidas b
      LEFT JOIN bd_ponto_diaria_integracao i
        ON i.batida_id = b.id AND i.presenca_diaria_id IS NULL
     WHERE i.id IS NULL
       AND b.status_validacao = 'valida'
       AND b.data_hora_considerada >= p_desde
       AND b.data_hora_considerada <  p_ate
     ORDER BY b.data_hora_considerada
     LIMIT GREATEST(COALESCE(p_limit,500), 1)
  LOOP
    BEGIN
      v_st := public.fn_ponto_diaria_simular_batida(v_id);
      v_proc := v_proc + 1;
      v_por_status := jsonb_set(
        v_por_status, ARRAY[v_st],
        to_jsonb(COALESCE((v_por_status->>v_st)::int,0) + 1), true
      );
    EXCEPTION WHEN OTHERS THEN
      v_por_status := jsonb_set(
        v_por_status, ARRAY['erro'],
        to_jsonb(COALESCE((v_por_status->>'erro')::int,0) + 1), true
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'processadas', v_proc,
    'por_status',  v_por_status,
    'duracao_ms',  (extract(epoch from (clock_timestamp() - v_ini)) * 1000)::int,
    'desde', p_desde,
    'ate',   p_ate,
    'limit', p_limit
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_ponto_diaria_simular_lote(timestamptz, timestamptz, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_ponto_diaria_simular_lote(timestamptz, timestamptz, int) TO authenticated, service_role;

COMMENT ON FUNCTION public.fn_ponto_diaria_simular_lote(timestamptz, timestamptz, int)
IS 'Fase 1 Shadow: processa batidas válidas em modo shadow. Retorna {processadas, por_status, duracao_ms}.';


CREATE OR REPLACE VIEW public.vw_ponto_diaria_shadow
WITH (security_invoker = true)
AS
SELECT
  i.id,
  i.batida_id,
  i.solicitacao_id,
  i.funcionario_id,
  i.centro_custo_id,
  i.data_operacional,
  i.tipo_batida,
  i.status,
  i.motivo,
  i.detalhes,
  i.created_at,
  cc.codigo_centro_custo,
  cc.nome_centro_custo,
  f.nome_completo AS funcionario_nome
FROM bd_ponto_diaria_integracao i
LEFT JOIN bd_centros_custo cc ON cc.id = i.centro_custo_id
LEFT JOIN bd_funcionarios   f  ON f.id  = i.funcionario_id
WHERE i.presenca_diaria_id IS NULL;

COMMENT ON VIEW public.vw_ponto_diaria_shadow
IS 'Fase 1 Shadow: registros simulados (presenca_diaria_id IS NULL) para auditoria.';

-- CRON: NÃO HABILITAR NESTA FASE. Mantido como referência apenas.
-- SELECT cron.schedule(
--   'ponto_diaria_shadow_loop',
--   '*/10 * * * *',
--   $$ SELECT net.http_post(
--        url := 'https://eexzgpmrousuxlkvqwkm.functions.supabase.co/ponto-diaria-shadow',
--        headers := jsonb_build_object('x-api-key','<LYTOTEC_API_KEY>'),
--        body := jsonb_build_object(
--          'desde', (now() - interval '1 hour')::text,
--          'ate',   now()::text,
--          'limit', 500
--        )
--      ); $$
-- );
