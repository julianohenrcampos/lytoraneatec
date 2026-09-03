DO $mig$
DECLARE v_md5 text;
BEGIN
  SELECT md5(p.prosrc) INTO v_md5
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'fn_ct_estado_efetivo_lote';
  IF v_md5 IS DISTINCT FROM '415cef4c4c3e78b193fc5d2c676a1331' THEN
    RAISE EXCEPTION 'CT22_PRECHECK_HASH_DIVERGENTE: %', coalesce(v_md5, 'FUNCAO_AUSENTE');
  END IF;
END
$mig$;

CREATE OR REPLACE FUNCTION public.fn_ct_estado_efetivo_lote(
  p_equipamento_ids uuid[],
  p_centro_custo_ids uuid[] DEFAULT NULL,
  p_periodo_inicio date DEFAULT NULL,
  p_periodo_fim date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid   uuid;
  v_sa    boolean;
  v_ids   uuid[];
  v_out   jsonb;
  v_ref   date;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT2_AUTH_REQUIRED' USING ERRCODE = 'P0001',
      HINT = 'Sessao expirada. Entre novamente para continuar.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_uid) THEN
    RAISE EXCEPTION 'CT2_PROFILE_NOT_FOUND' USING ERRCODE = 'P0001',
      HINT = 'Perfil de usuario inexistente.';
  END IF;

  v_sa := public.fn_is_super_admin(v_uid);

  -- CT-2.2: data de referencia do negocio (nunca CURRENT_DATE implicito).
  v_ref := timezone('America/Sao_Paulo', clock_timestamp())::date;

  SELECT array_agg(DISTINCT x) INTO v_ids
    FROM unnest(coalesce(p_equipamento_ids, ARRAY[]::uuid[])) x
   WHERE x IS NOT NULL;

  IF v_ids IS NULL OR array_length(v_ids, 1) IS NULL OR array_length(v_ids, 1) < 1 THEN
    RAISE EXCEPTION 'CT2_PARAMETROS_INVALIDOS' USING ERRCODE = 'P0001',
      HINT = 'Informe de 1 a 500 ativos para consultar o estado efetivo.';
  END IF;

  IF array_length(v_ids, 1) > 500 THEN
    RAISE EXCEPTION 'CT2_PARAMETROS_INVALIDOS' USING ERRCODE = 'P0001',
      HINT = 'Informe de 1 a 500 ativos para consultar o estado efetivo.';
  END IF;

  IF (p_periodo_inicio IS NULL) <> (p_periodo_fim IS NULL) THEN
    RAISE EXCEPTION 'CT2_PARAMETROS_INVALIDOS' USING ERRCODE = 'P0001',
      HINT = 'Informe as duas datas da janela ou nenhuma delas.';
  END IF;

  IF p_periodo_inicio IS NOT NULL AND p_periodo_fim < p_periodo_inicio THEN
    RAISE EXCEPTION 'CT2_PARAMETROS_INVALIDOS' USING ERRCODE = 'P0001',
      HINT = 'A data final nao pode ser anterior a inicial.';
  END IF;

  WITH escopo AS (
    SELECT e.id AS equipamento_id, e.centro_custo_id
      FROM public.bd_caminhoes_equipamentos e
     WHERE e.id = ANY(v_ids)
       AND (v_sa OR public.fn_ativos_can_access_equipamento(e.id, v_uid))
       AND (p_centro_custo_ids IS NULL OR e.centro_custo_id = ANY(p_centro_custo_ids))
  ),
  disp AS (
    SELECT DISTINCT ON (d.equipamento_id)
           d.equipamento_id,
           d.status_operacional::text AS status_operacional,
           d.previsao_liberacao,
           d.centro_custo_id
      FROM public.bd_disponibilidade_equipamentos d
     WHERE d.equipamento_id IN (SELECT equipamento_id FROM escopo)
     ORDER BY d.equipamento_id,
              d.updated_at DESC NULLS LAST,
              d.created_at DESC NULLS LAST,
              d.id DESC
  ),
  ativos AS (
    SELECT a.id, a.equipamento_id, a.status, a.periodo_inicio, a.periodo_fim,
           a.solicitacao_item_id, i.solicitacao_id, a.encerrado_em,
           (v_sa OR public.fn_ativos_can_access_solicitacao(i.solicitacao_id, v_uid)) AS pode_ver
      FROM public.bd_solicitacao_item_atendimentos a
      JOIN public.bd_solicitacoes_itens i ON i.id = a.solicitacao_item_id
     WHERE a.equipamento_id IN (SELECT equipamento_id FROM escopo)
       AND a.status IN ('RESERVADO','EM_TRANSPORTE','ENTREGUE')
  ),
  anomalia AS (
    SELECT DISTINCT a.equipamento_id
      FROM ativos a
      JOIN ativos b
        ON b.equipamento_id = a.equipamento_id
       AND b.id > a.id
       AND daterange(a.periodo_inicio, a.periodo_fim, '[]')
        && daterange(b.periodo_inicio, b.periodo_fim, '[]')
  ),
  vencidos AS (
    SELECT a.equipamento_id, count(*)::integer AS qtd
      FROM ativos a
     WHERE a.periodo_fim < v_ref
       AND a.encerrado_em IS NULL
     GROUP BY a.equipamento_id
  ),
  janela AS (
    SELECT a.*
      FROM ativos a
     WHERE p_periodo_inicio IS NOT NULL
       AND a.periodo_inicio <= p_periodo_fim
       AND a.periodo_fim >= p_periodo_inicio
  ),
  agg_janela AS (
    SELECT j.equipamento_id,
           count(*)::integer AS qtd,
           jsonb_agg(
             CASE WHEN j.pode_ver THEN jsonb_build_object(
               'atendimento_id', j.id,
               'status', j.status,
               'periodo_inicio', j.periodo_inicio,
               'periodo_fim', j.periodo_fim,
               'solicitacao_id', j.solicitacao_id,
               'solicitacao_item_id', j.solicitacao_item_id,
               'detalhes_restritos', false
             ) ELSE jsonb_build_object(
               'atendimento_id', NULL,
               'status', j.status,
               'periodo_inicio', j.periodo_inicio,
               'periodo_fim', j.periodo_fim,
               'solicitacao_id', NULL,
               'solicitacao_item_id', NULL,
               'detalhes_restritos', true
             ) END ORDER BY j.periodo_inicio, j.id) AS itens
      FROM janela j
     GROUP BY j.equipamento_id
  ),
  atual AS (
    SELECT DISTINCT ON (a.equipamento_id) a.*
      FROM ativos a
     WHERE v_ref BETWEEN a.periodo_inicio AND a.periodo_fim
     ORDER BY a.equipamento_id, a.periodo_inicio ASC, a.id ASC
  ),
  futuro AS (
    SELECT DISTINCT ON (a.equipamento_id) a.*
      FROM ativos a
     WHERE a.periodo_inicio > v_ref
     ORDER BY a.equipamento_id, a.periodo_inicio ASC, a.id ASC
  ),
  futuro_qtd AS (
    SELECT a.equipamento_id, count(*)::integer AS qtd
      FROM ativos a
     WHERE a.periodo_inicio > v_ref
     GROUP BY a.equipamento_id
  ),
  base AS (
    SELECT
      e.equipamento_id,
      coalesce(d.status_operacional, 'SEM_STATUS')          AS condicao_operacional,
      (d.equipamento_id IS NOT NULL)                        AS possui_registro_operacional,
      d.previsao_liberacao,
      coalesce(d.centro_custo_id, e.centro_custo_id)        AS centro_custo_id,
      (an.equipamento_id IS NOT NULL)                       AS possui_anomalia,
      (vc.equipamento_id IS NOT NULL)                       AS possui_vencido,
      at.id AS atual_id, at.status AS atual_status,
      at.periodo_inicio AS atual_ini, at.periodo_fim AS atual_fim,
      at.solicitacao_id AS atual_sol, at.solicitacao_item_id AS atual_item,
      coalesce(at.pode_ver, true) AS atual_pode_ver,
      fu.id AS prox_id, fu.status AS prox_status,
      fu.periodo_inicio AS prox_ini, fu.periodo_fim AS prox_fim,
      fu.solicitacao_id AS prox_sol, fu.solicitacao_item_id AS prox_item,
      coalesce(fu.pode_ver, true) AS prox_pode_ver,
      coalesce(fq.qtd, 0) AS qtd_futuros,
      coalesce(aj.qtd, 0) AS qtd_janela,
      coalesce(aj.itens, '[]'::jsonb) AS itens_janela
    FROM escopo e
    LEFT JOIN disp d       ON d.equipamento_id = e.equipamento_id
    LEFT JOIN anomalia an  ON an.equipamento_id = e.equipamento_id
    LEFT JOIN vencidos vc  ON vc.equipamento_id = e.equipamento_id
    LEFT JOIN atual at     ON at.equipamento_id = e.equipamento_id
    LEFT JOIN futuro fu    ON fu.equipamento_id = e.equipamento_id
    LEFT JOIN futuro_qtd fq ON fq.equipamento_id = e.equipamento_id
    LEFT JOIN agg_janela aj ON aj.equipamento_id = e.equipamento_id
  ),
  calc AS (
    SELECT b.*,
      CASE
        WHEN b.possui_anomalia THEN 'CONFLITO_MULTIPLO'
        WHEN b.atual_status IS NOT NULL THEN b.atual_status
        ELSE 'LIVRE'
      END AS compromisso_ativo
      FROM base b
  )
  SELECT jsonb_build_object(
    'ok', true,
    'gerado_em', now(),
    'data_referencia', v_ref,
    'periodo_inicio', p_periodo_inicio,
    'periodo_fim', p_periodo_fim,
    'total', count(*),
    'itens', coalesce(jsonb_agg(jsonb_build_object(
      'equipamento_id', c.equipamento_id,
      'centro_custo_id', c.centro_custo_id,
      'condicao_operacional', c.condicao_operacional,
      'possui_registro_operacional', c.possui_registro_operacional,
      'previsao_liberacao', c.previsao_liberacao,
      'compromisso_ativo', c.compromisso_ativo,
      'compromisso_atual', CASE WHEN c.atual_id IS NULL THEN NULL ELSE jsonb_build_object(
        'atendimento_id', CASE WHEN c.atual_pode_ver THEN to_jsonb(c.atual_id) ELSE 'null'::jsonb END,
        'status', c.atual_status,
        'periodo_inicio', c.atual_ini, 'periodo_fim', c.atual_fim,
        'solicitacao_id', CASE WHEN c.atual_pode_ver THEN to_jsonb(c.atual_sol) ELSE 'null'::jsonb END,
        'solicitacao_item_id', CASE WHEN c.atual_pode_ver THEN to_jsonb(c.atual_item) ELSE 'null'::jsonb END,
        'detalhes_restritos', NOT c.atual_pode_ver) END,
      'proximo_compromisso', CASE WHEN c.prox_id IS NULL THEN NULL ELSE jsonb_build_object(
        'atendimento_id', CASE WHEN c.prox_pode_ver THEN to_jsonb(c.prox_id) ELSE 'null'::jsonb END,
        'status', c.prox_status,
        'periodo_inicio', c.prox_ini, 'periodo_fim', c.prox_fim,
        'solicitacao_id', CASE WHEN c.prox_pode_ver THEN to_jsonb(c.prox_sol) ELSE 'null'::jsonb END,
        'solicitacao_item_id', CASE WHEN c.prox_pode_ver THEN to_jsonb(c.prox_item) ELSE 'null'::jsonb END,
        'detalhes_restritos', NOT c.prox_pode_ver) END,
      'quantidade_compromissos_futuros', c.qtd_futuros,
      'compromissos_na_janela', c.itens_janela,
      'quantidade_compromissos_na_janela', c.qtd_janela,
      'possui_sobreposicao_na_janela', (c.qtd_janela > 0),
      'possui_anomalia_sobreposicao', c.possui_anomalia,
      'possui_compromisso_vencido_ativo', c.possui_vencido,
      'periodo_comprometido', CASE
        WHEN c.atual_id IS NOT NULL THEN jsonb_build_object('inicio', c.atual_ini, 'fim', c.atual_fim)
        WHEN c.prox_id IS NOT NULL THEN jsonb_build_object('inicio', c.prox_ini, 'fim', c.prox_fim)
        ELSE NULL END,
      'atendimento_id', CASE
        WHEN c.atual_id IS NOT NULL AND c.atual_pode_ver THEN to_jsonb(c.atual_id)
        WHEN c.atual_id IS NULL AND c.prox_id IS NOT NULL AND c.prox_pode_ver THEN to_jsonb(c.prox_id)
        ELSE 'null'::jsonb END,
      'solicitacao_id', CASE
        WHEN c.atual_id IS NOT NULL AND c.atual_pode_ver THEN to_jsonb(c.atual_sol)
        WHEN c.atual_id IS NULL AND c.prox_id IS NOT NULL AND c.prox_pode_ver THEN to_jsonb(c.prox_sol)
        ELSE 'null'::jsonb END,
      'solicitacao_item_id', CASE
        WHEN c.atual_id IS NOT NULL AND c.atual_pode_ver THEN to_jsonb(c.atual_item)
        WHEN c.atual_id IS NULL AND c.prox_id IS NOT NULL AND c.prox_pode_ver THEN to_jsonb(c.prox_item)
        ELSE 'null'::jsonb END,
      'estado_logistico', 'SEM_MOVIMENTACAO',
      'estado_exibicao', CASE
        WHEN c.possui_anomalia OR c.possui_vencido THEN 'CONFLITO_OPERACIONAL'
        WHEN c.atual_status = 'EM_TRANSPORTE' THEN 'EM_TRANSPORTE'
        WHEN c.atual_status = 'RESERVADO' THEN 'RESERVADO'
        WHEN c.atual_status = 'ENTREGUE' OR c.condicao_operacional = 'ALOCADO' THEN 'ALOCADO'
        WHEN NOT c.possui_registro_operacional
          OR c.condicao_operacional IN ('SEM_STATUS','MANUTENCAO','INDISPONIVEL')
          THEN 'INDISPONIVEL_PARA_ATENDIMENTO'
        WHEN c.condicao_operacional = 'DISPONIVEL' THEN 'DISPONIVEL'
        ELSE 'INDISPONIVEL_PARA_ATENDIMENTO'
      END,
      'alertas', (
        CASE WHEN c.possui_anomalia THEN jsonb_build_array('SOBREPOSICAO_DETECTADA') ELSE '[]'::jsonb END
        || CASE WHEN c.possui_vencido THEN jsonb_build_array('COMPROMISSO_VENCIDO_ATIVO') ELSE '[]'::jsonb END
        || CASE WHEN c.qtd_futuros > 0 THEN jsonb_build_array('POSSUI_COMPROMISSOS_FUTUROS') ELSE '[]'::jsonb END
      ),
      'bloqueios', (
        CASE WHEN NOT c.possui_registro_operacional THEN jsonb_build_array('SEM_STATUS_OPERACIONAL') ELSE '[]'::jsonb END
        || CASE WHEN c.possui_anomalia THEN jsonb_build_array('MULTIPLOS_COMPROMISSOS_ATIVOS') ELSE '[]'::jsonb END
        || CASE WHEN c.possui_vencido THEN jsonb_build_array('COMPROMISSO_VENCIDO_ATIVO') ELSE '[]'::jsonb END
        || CASE WHEN c.atual_id IS NOT NULL THEN jsonb_build_array('COMPROMISSO_ATUAL') ELSE '[]'::jsonb END
        || CASE WHEN p_periodo_inicio IS NOT NULL AND c.qtd_janela > 0
                THEN jsonb_build_array('PERIODO_COMPROMETIDO') ELSE '[]'::jsonb END
        || CASE WHEN c.possui_registro_operacional AND c.condicao_operacional <> 'DISPONIVEL'
                THEN jsonb_build_array('CONDICAO_OPERACIONAL_RESTRITA') ELSE '[]'::jsonb END
      ),
      'origem_decisao', 'CT2_2_ESTADO_EFETIVO'
    ) ORDER BY c.equipamento_id), '[]'::jsonb)
  ) INTO v_out
  FROM calc c;

  RETURN coalesce(v_out, jsonb_build_object('ok', true, 'total', 0, 'itens', '[]'::jsonb));
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_ct_estado_efetivo_lote(uuid[], uuid[], date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_ct_estado_efetivo_lote(uuid[], uuid[], date, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_ct_estado_efetivo_lote(uuid[], uuid[], date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ct_estado_efetivo_lote(uuid[], uuid[], date, date) TO service_role;

COMMENT ON FUNCTION public.fn_ct_estado_efetivo_lote(uuid[], uuid[], date, date) IS
'CT2.2: estado efetivo em lote (1..500 ativos). Data de referencia America/Sao_Paulo; dimensoes independentes (atual/janela/futuro); compromisso vencido ativo => CONFLITO_OPERACIONAL; redacao server-side de compromisso fora do escopo; estado_logistico fixo SEM_MOVIMENTACAO ate CT-3C.';