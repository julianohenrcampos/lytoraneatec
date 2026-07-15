
-- =====================================================================
-- 1) fn_solic_equip_detalhe_central — coluna correta + histórico + pós-decisão
-- =====================================================================
CREATE OR REPLACE FUNCTION public.fn_solic_equip_detalhe_central(p_solicitacao_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_is_super boolean;
  v_has_central boolean;
  v_has_aprovar boolean;
  v_scope_ok boolean;
  v_sol record;
  v_result jsonb;
  v_can_reverter boolean := false;
  v_can_cancelar boolean := false;
  v_pd_reason text := NULL;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_DETALHE_NOT_AVAILABLE' USING ERRCODE = '42501';
  END IF;

  v_is_super := public.fn_is_super_admin(v_uid);

  IF NOT v_is_super THEN
    v_has_central :=
      public.fn_has_permission('central_aprovacoes_view', v_uid)
      OR public.fn_has_permission('acesso_gestao_aprovacoes', v_uid);
    IF NOT v_has_central THEN
      RAISE EXCEPTION 'EQUIP_SOLIC_DETALHE_NOT_AVAILABLE' USING ERRCODE = '42501';
    END IF;
    v_has_aprovar := public.user_has_permission_action(
      v_uid, 'equipamentos_solicitacoes_aprovar', 'aprovar'
    );
    IF NOT v_has_aprovar THEN
      RAISE EXCEPTION 'EQUIP_SOLIC_DETALHE_NOT_AVAILABLE' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT
    s.id, s.centro_custo_id, s.solicitante_id, s.engenheiro_solicitante_id,
    s.apontador_responsavel_id, s.aprovador_centro_custo_id,
    s.status, s.status_fluxo, s.prioridade, s.quantidade,
    s.data_inicio, s.tempo_previsto_dias, s.regime_trabalho,
    s.com_operador, s.justificativa, s.created_at, s.updated_at,
    cc.codigo_centro_custo AS codigo_cc,
    cc.nome_centro_custo   AS nome_cc,
    ps.nome_completo       AS solicitante_nome,
    pe.nome_completo       AS engenheiro_nome,
    pa.nome_completo       AS apontador_nome,
    pap.nome_completo      AS aprovador_nome
  INTO v_sol
  FROM public.bd_solicitacoes_equipamento s
  LEFT JOIN public.bd_centros_custo cc ON cc.id = s.centro_custo_id
  LEFT JOIN public.profiles ps  ON ps.id  = s.solicitante_id
  LEFT JOIN public.profiles pe  ON pe.id  = s.engenheiro_solicitante_id
  LEFT JOIN public.profiles pa  ON pa.id  = s.apontador_responsavel_id
  LEFT JOIN public.profiles pap ON pap.id = s.aprovador_centro_custo_id
  WHERE s.id = p_solicitacao_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_DETALHE_NOT_AVAILABLE' USING ERRCODE = '42501';
  END IF;

  IF NOT v_is_super THEN
    v_scope_ok :=
      v_sol.aprovador_centro_custo_id = v_uid
      OR EXISTS (
        SELECT 1
        FROM public.fn_ativos_user_centros_custo(v_uid) x
        WHERE x.centro_custo_id = v_sol.centro_custo_id
      );
    IF NOT v_scope_ok THEN
      RAISE EXCEPTION 'EQUIP_SOLIC_DETALHE_NOT_AVAILABLE' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Pós-decisão: apenas SuperAdm; REVERTER só se decidida; CANCELAR se não cancelada.
  IF v_is_super THEN
    v_can_reverter := v_sol.status_fluxo IN ('APROVADO','NEGADO');
    v_can_cancelar := v_sol.status_fluxo NOT IN ('CANCELADO');
    IF NOT v_can_reverter AND NOT v_can_cancelar THEN
      v_pd_reason := 'estado_nao_acionavel';
    END IF;
  ELSE
    v_pd_reason := 'sem_permissao_pos_decisao';
  END IF;

  SELECT jsonb_build_object(
    'solicitacao', jsonb_build_object(
      'id', v_sol.id,
      'centro_custo_id', v_sol.centro_custo_id,
      'codigo_cc', v_sol.codigo_cc,
      'nome_cc', v_sol.nome_cc,
      'solicitante_id', v_sol.solicitante_id,
      'solicitante_nome', v_sol.solicitante_nome,
      'engenheiro_solicitante_id', v_sol.engenheiro_solicitante_id,
      'engenheiro_nome', v_sol.engenheiro_nome,
      'apontador_responsavel_id', v_sol.apontador_responsavel_id,
      'apontador_nome', v_sol.apontador_nome,
      'aprovador_centro_custo_id', v_sol.aprovador_centro_custo_id,
      'aprovador_nome', v_sol.aprovador_nome,
      'status', v_sol.status,
      'status_fluxo', v_sol.status_fluxo,
      'prioridade', v_sol.prioridade,
      'quantidade', v_sol.quantidade,
      'data_inicio', v_sol.data_inicio,
      'tempo_previsto_dias', v_sol.tempo_previsto_dias,
      'regime_trabalho', v_sol.regime_trabalho,
      'com_operador', v_sol.com_operador,
      'justificativa', v_sol.justificativa,
      'created_at', v_sol.created_at,
      'updated_at', v_sol.updated_at
    ),
    'itens', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id,
        'tipo_item', i.tipo_item,
        'catalogo_equipamento_id', i.catalogo_equipamento_id,
        'catalogo_variacao_id', i.catalogo_variacao_id,
        'item_nao_catalogado', i.item_nao_catalogado,
        'descricao_livre', i.descricao_livre,
        'capacidade_descricao', i.capacidade_descricao,
        'capacidade_valor', i.capacidade_valor,
        'capacidade_unidade', i.capacidade_unidade,
        'subcategoria_id', i.subcategoria_id,
        'subcategoria_nome', sub.nome_subcategoria,
        'catalogo_descricao', cat.descricao,
        'quantidade', i.quantidade,
        'com_operador', i.com_operador,
        'regime_trabalho', i.regime_trabalho,
        'regime_personalizado', NULL,
        'tempo_previsto_dias', i.tempo_previsto_dias,
        'observacoes', i.observacoes,
        'status_item', i.status_item
      ) ORDER BY i.created_at)
      FROM public.bd_solicitacoes_itens i
      LEFT JOIN public.bd_subcategorias_ativos sub ON sub.id = i.subcategoria_id
      LEFT JOIN public.bd_catalogo_equipamentos cat ON cat.id = i.catalogo_equipamento_id
      WHERE i.solicitacao_id = v_sol.id
    ), '[]'::jsonb),
    'aprovacao_atual', (
      SELECT jsonb_build_object(
        'id', a.id,
        'etapa_aprovacao', a.etapa_aprovacao,
        'aprovador_id', a.aprovador_id,
        'aprovador_nome', pr.nome_completo,
        'status', a.status,
        'comentario', a.comentario,
        'data_decisao', a.data_decisao,
        'created_at', a.created_at
      )
      FROM public.bd_solicitacoes_equip_aprovacoes a
      LEFT JOIN public.profiles pr ON pr.id = a.aprovador_id
      WHERE a.solicitacao_id = v_sol.id
      ORDER BY a.created_at DESC
      LIMIT 1
    ),
    'historico_aprovacoes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id,
        'etapa_aprovacao', a.etapa_aprovacao,
        'aprovador_id', a.aprovador_id,
        'aprovador_nome', pr.nome_completo,
        'status', a.status,
        'comentario', a.comentario,
        'data_decisao', a.data_decisao,
        'created_at', a.created_at
      ) ORDER BY a.created_at DESC)
      FROM public.bd_solicitacoes_equip_aprovacoes a
      LEFT JOIN public.profiles pr ON pr.id = a.aprovador_id
      WHERE a.solicitacao_id = v_sol.id
    ), '[]'::jsonb),
    'post_decision_capabilities', jsonb_build_object(
      'can_reverter', v_can_reverter,
      'can_cancelar', v_can_cancelar,
      'block_reason', v_pd_reason
    )
  )
  INTO v_result;

  RETURN v_result;
END;
$function$;

-- =====================================================================
-- 2) fn_solic_equip_listar_central — adiciona p_minhas_decisoes
-- =====================================================================
CREATE OR REPLACE FUNCTION public.fn_solic_equip_listar_central(
  p_status_fluxo text[] DEFAULT ARRAY['PENDENTE_APROVACAO']::text[],
  p_centro_custo_ids uuid[] DEFAULT NULL,
  p_solicitante_id uuid DEFAULT NULL,
  p_busca text DEFAULT NULL,
  p_apenas_minha_acao boolean DEFAULT false,
  p_periodo_inicio date DEFAULT NULL,
  p_periodo_fim date DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_minhas_decisoes boolean DEFAULT false
)
 RETURNS TABLE(
   solicitacao_id uuid, centro_custo_id uuid, codigo_cc text, nome_cc text,
   solicitante_id uuid, solicitante_nome text, aprovador_centro_custo_id uuid,
   status text, status_fluxo text, prioridade text, data_inicio date,
   created_at timestamptz, updated_at timestamptz,
   quantidade integer, qtd_itens integer, itens_resumo text,
   can_approve boolean, can_reject boolean, auto_approval boolean,
   block_reason text, authorization_source text, total_count bigint
 )
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid        uuid := auth.uid();
  v_is_super   boolean;
  v_lim        integer;
  v_off        integer;
  v_busca      text;
  v_busca_norm text;
  v_qtd_status integer;
  v_qtd_cc     integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'EQUIP_CENTRAL_NAO_AUTENTICADO' USING ERRCODE='42501';
  END IF;
  v_is_super := public.fn_is_super_admin(v_uid);

  IF NOT v_is_super THEN
    IF NOT ( public.fn_has_permission('central_aprovacoes_view',  v_uid)
          OR public.fn_has_permission('acesso_gestao_aprovacoes', v_uid) ) THEN
      RAISE EXCEPTION 'EQUIP_CENTRAL_SEM_ACESSO' USING ERRCODE='42501';
    END IF;
    IF NOT public.user_has_permission_action(v_uid, 'equipamentos_solicitacoes_aprovar', 'aprovar') THEN
      RAISE EXCEPTION 'EQUIP_CENTRAL_SEM_ACAO_APROVAR' USING ERRCODE='42501';
    END IF;
  END IF;

  v_lim := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  v_off := GREATEST(COALESCE(p_offset, 0), 0);

  IF p_status_fluxo IS NULL THEN
    RAISE EXCEPTION 'EQUIP_CENTRAL_STATUS_OBRIGATORIO' USING ERRCODE='22004';
  END IF;
  v_qtd_status := COALESCE(array_length(p_status_fluxo, 1), 0);
  IF v_qtd_status = 0 OR v_qtd_status > 10 THEN
    RAISE EXCEPTION 'EQUIP_CENTRAL_STATUS_LIMITE' USING ERRCODE='22004',
      DETAIL = jsonb_build_object('qtd', v_qtd_status, 'min', 1, 'max', 10)::text;
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_status_fluxo) x WHERE x IS NULL) THEN
    RAISE EXCEPTION 'EQUIP_CENTRAL_STATUS_NULL' USING ERRCODE='22004';
  END IF;

  IF p_centro_custo_ids IS NOT NULL THEN
    v_qtd_cc := COALESCE(array_length(p_centro_custo_ids, 1), 0);
    IF v_qtd_cc > 200 THEN
      RAISE EXCEPTION 'EQUIP_CENTRAL_CC_LIMITE' USING ERRCODE='22004',
        DETAIL = jsonb_build_object('qtd', v_qtd_cc, 'max', 200)::text;
    END IF;
  END IF;

  IF p_periodo_inicio IS NOT NULL AND p_periodo_fim IS NOT NULL
     AND p_periodo_inicio > p_periodo_fim THEN
    RAISE EXCEPTION 'EQUIP_CENTRAL_PERIODO_INVALIDO' USING ERRCODE='22004';
  END IF;

  v_busca := NULLIF(btrim(left(COALESCE(p_busca, ''), 120)), '');
  v_busca_norm := CASE WHEN v_busca IS NULL THEN NULL
                       ELSE '%' || public.unaccent(lower(v_busca)) || '%' END;

  RETURN QUERY
  WITH base AS (
    SELECT
      s.id                              AS solicitacao_id,
      s.centro_custo_id                 AS centro_custo_id,
      cc.codigo_centro_custo::text      AS codigo_cc,
      cc.nome_centro_custo::text        AS nome_cc,
      s.solicitante_id                  AS solicitante_id,
      psol.nome_completo::text          AS solicitante_nome,
      s.aprovador_centro_custo_id       AS aprovador_centro_custo_id,
      s.status::text                    AS status,
      s.status_fluxo::text              AS status_fluxo,
      s.prioridade::text                AS prioridade,
      s.data_inicio                     AS data_inicio,
      s.created_at                      AS created_at,
      s.updated_at                      AS updated_at,
      s.quantidade                      AS quantidade,
      s.justificativa                   AS justificativa,
      (SELECT count(*)::int FROM public.bd_solicitacoes_itens i WHERE i.solicitacao_id = s.id) AS qtd_itens,
      (
        SELECT string_agg(
                 substr(COALESCE(NULLIF(btrim(i.descricao_livre), ''),
                                 NULLIF(btrim(i.capacidade_descricao), ''),
                                 i.tipo_item, ''), 1, 80),
                 ' • '
                 ORDER BY i.created_at ASC)
          FROM (SELECT i2.* FROM public.bd_solicitacoes_itens i2
                 WHERE i2.solicitacao_id = s.id ORDER BY i2.created_at ASC LIMIT 5) i
      ) AS itens_resumo
    FROM public.bd_solicitacoes_equipamento s
    LEFT JOIN public.bd_centros_custo cc ON cc.id = s.centro_custo_id
    LEFT JOIN public.profiles       psol ON psol.id = s.solicitante_id
    WHERE s.status_fluxo = ANY(p_status_fluxo)
      AND (p_centro_custo_ids IS NULL OR s.centro_custo_id = ANY(p_centro_custo_ids))
      AND (p_solicitante_id  IS NULL OR s.solicitante_id  = p_solicitante_id)
      AND (p_periodo_inicio  IS NULL OR s.data_inicio    >= p_periodo_inicio)
      AND (p_periodo_fim     IS NULL OR s.data_inicio    <= p_periodo_fim)
      AND (
        v_is_super
        OR s.aprovador_centro_custo_id = v_uid
        OR EXISTS (SELECT 1 FROM public.fn_ativos_user_centros_custo(v_uid) e WHERE e.centro_custo_id = s.centro_custo_id)
      )
      AND (
        v_busca_norm IS NULL
        OR public.unaccent(lower(COALESCE(cc.codigo_centro_custo::text,''))) LIKE v_busca_norm
        OR public.unaccent(lower(COALESCE(cc.nome_centro_custo::text,'')))   LIKE v_busca_norm
        OR public.unaccent(lower(COALESCE(psol.nome_completo::text,'')))     LIKE v_busca_norm
        OR public.unaccent(lower(COALESCE(s.justificativa,'')))              LIKE v_busca_norm
      )
      AND (
        NOT p_minhas_decisoes
        OR EXISTS (
          SELECT 1 FROM public.bd_solicitacoes_equip_aprovacoes ap
           WHERE ap.solicitacao_id = s.id
             AND ap.aprovador_id  = v_uid
             AND ap.data_decisao IS NOT NULL
        )
      )
  ),
  scored AS (
    SELECT b.*,
      CASE WHEN b.status_fluxo <> 'PENDENTE_APROVACAO' THEN false
           WHEN v_is_super THEN true
           WHEN b.solicitante_id = v_uid THEN false
           ELSE true END AS can_approve,
      CASE WHEN b.status_fluxo <> 'PENDENTE_APROVACAO' THEN false
           WHEN v_is_super THEN true
           WHEN b.solicitante_id = v_uid THEN false
           ELSE true END AS can_reject,
      (b.solicitante_id = v_uid) AS auto_approval,
      CASE WHEN b.status_fluxo <> 'PENDENTE_APROVACAO' THEN 'nao_pendente'
           WHEN NOT v_is_super AND b.solicitante_id = v_uid THEN 'auto_aprovacao_bloqueada'
           ELSE NULL END AS block_reason,
      CASE WHEN v_is_super AND b.solicitante_id = v_uid THEN 'superadmin_self_approval'
           WHEN v_is_super THEN 'superadmin'
           ELSE 'permission_stage' END AS authorization_source
    FROM base b
  ),
  filtered AS (
    SELECT sc.* FROM scored sc WHERE (NOT p_apenas_minha_acao) OR sc.can_approve = true
  )
  SELECT
    f.solicitacao_id, f.centro_custo_id, f.codigo_cc, f.nome_cc,
    f.solicitante_id, f.solicitante_nome, f.aprovador_centro_custo_id,
    f.status, f.status_fluxo, f.prioridade, f.data_inicio,
    f.created_at, f.updated_at,
    f.quantidade, f.qtd_itens, f.itens_resumo,
    f.can_approve, f.can_reject, f.auto_approval,
    f.block_reason, f.authorization_source,
    count(*) OVER()::bigint AS total_count
  FROM filtered f
  ORDER BY CASE f.prioridade WHEN 'URGENTE' THEN 0 WHEN 'ALTA' THEN 1 ELSE 2 END,
           f.created_at ASC, f.solicitacao_id ASC
  LIMIT v_lim OFFSET v_off;
END
$function$;

-- =====================================================================
-- 3) fn_solic_equip_indicadores_central — indicadores canônicos
-- =====================================================================
CREATE OR REPLACE FUNCTION public.fn_solic_equip_indicadores_central()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_is_super boolean;
  v_pendentes int := 0;
  v_minha_acao int := 0;
  v_concluidas_hoje int := 0;
  v_tmed_min numeric := NULL;
  v_hoje_ini timestamptz;
  v_hoje_fim timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'EQUIP_CENTRAL_NAO_AUTENTICADO' USING ERRCODE='42501';
  END IF;
  v_is_super := public.fn_is_super_admin(v_uid);
  IF NOT v_is_super THEN
    IF NOT ( public.fn_has_permission('central_aprovacoes_view',  v_uid)
          OR public.fn_has_permission('acesso_gestao_aprovacoes', v_uid) ) THEN
      RAISE EXCEPTION 'EQUIP_CENTRAL_SEM_ACESSO' USING ERRCODE='42501';
    END IF;
    IF NOT public.user_has_permission_action(v_uid, 'equipamentos_solicitacoes_aprovar', 'aprovar') THEN
      RAISE EXCEPTION 'EQUIP_CENTRAL_SEM_ACAO_APROVAR' USING ERRCODE='42501';
    END IF;
  END IF;

  v_hoje_ini := date_trunc('day', (now() AT TIME ZONE 'America/Sao_Paulo')) AT TIME ZONE 'America/Sao_Paulo';
  v_hoje_fim := v_hoje_ini + interval '1 day';

  SELECT count(*) INTO v_pendentes
  FROM public.bd_solicitacoes_equipamento s
  WHERE s.status_fluxo = 'PENDENTE_APROVACAO'
    AND (v_is_super
         OR s.aprovador_centro_custo_id = v_uid
         OR EXISTS (SELECT 1 FROM public.fn_ativos_user_centros_custo(v_uid) e
                     WHERE e.centro_custo_id = s.centro_custo_id));

  SELECT count(*) INTO v_minha_acao
  FROM public.bd_solicitacoes_equipamento s
  WHERE s.status_fluxo = 'PENDENTE_APROVACAO'
    AND (v_is_super OR s.solicitante_id <> v_uid)
    AND (v_is_super
         OR s.aprovador_centro_custo_id = v_uid
         OR EXISTS (SELECT 1 FROM public.fn_ativos_user_centros_custo(v_uid) e
                     WHERE e.centro_custo_id = s.centro_custo_id));

  SELECT count(*), avg(EXTRACT(EPOCH FROM (a.data_decisao - a.created_at))/60.0)
    INTO v_concluidas_hoje, v_tmed_min
  FROM public.bd_solicitacoes_equip_aprovacoes a
  JOIN public.bd_solicitacoes_equipamento s ON s.id = a.solicitacao_id
  WHERE a.data_decisao >= v_hoje_ini
    AND a.data_decisao <  v_hoje_fim
    AND (v_is_super
         OR s.aprovador_centro_custo_id = v_uid
         OR EXISTS (SELECT 1 FROM public.fn_ativos_user_centros_custo(v_uid) e
                     WHERE e.centro_custo_id = s.centro_custo_id));

  RETURN jsonb_build_object(
    'pendentes', v_pendentes,
    'aguardando_minha_acao', v_minha_acao,
    'concluidas_hoje', v_concluidas_hoje,
    'tempo_medio_hoje_min', CASE WHEN v_tmed_min IS NULL THEN NULL ELSE round(v_tmed_min)::int END
  );
END
$function$;

-- =====================================================================
-- 4) fn_solic_equip_pos_decisao — REVERTER / CANCELAR (SuperAdm)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.fn_solic_equip_pos_decisao(
  p_solicitacao_id uuid,
  p_acao text,
  p_comentario text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_is_super boolean;
  v_status_fluxo text;
  v_status text;
  v_new_fluxo text;
  v_com_norm text;
  v_now timestamptz := now();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'EQUIP_POSDEC_NAO_AUTENTICADO' USING ERRCODE='42501';
  END IF;
  v_is_super := public.fn_is_super_admin(v_uid);
  IF NOT v_is_super THEN
    RAISE EXCEPTION 'EQUIP_POSDEC_APENAS_SUPERADM' USING ERRCODE='42501';
  END IF;
  IF p_acao NOT IN ('REVERTER','CANCELAR') THEN
    RAISE EXCEPTION 'EQUIP_POSDEC_ACAO_INVALIDA' USING ERRCODE='22004';
  END IF;

  v_com_norm := regexp_replace(btrim(COALESCE(p_comentario,'')), '\s+', ' ', 'g');
  IF char_length(v_com_norm) < 10 THEN
    RAISE EXCEPTION 'EQUIP_POSDEC_COMENTARIO_OBRIGATORIO' USING ERRCODE='22004';
  END IF;

  SELECT s.status_fluxo, s.status::text INTO v_status_fluxo, v_status
  FROM public.bd_solicitacoes_equipamento s
  WHERE s.id = p_solicitacao_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EQUIP_POSDEC_INEXISTENTE' USING ERRCODE='P0002';
  END IF;

  IF p_acao = 'REVERTER' THEN
    IF v_status_fluxo NOT IN ('APROVADO','NEGADO') THEN
      RAISE EXCEPTION 'EQUIP_POSDEC_REVERTER_INVALIDO'
        USING ERRCODE='55000', DETAIL = jsonb_build_object('status_fluxo', v_status_fluxo)::text;
    END IF;
    v_new_fluxo := 'PENDENTE_APROVACAO';
    UPDATE public.bd_solicitacoes_equip_aprovacoes
       SET status='PENDENTE', data_decisao=NULL,
           comentario = COALESCE(comentario,'') ||
                        E'\n[REVERTIDO por SuperAdm '|| v_now::text ||'] '|| v_com_norm
     WHERE solicitacao_id = p_solicitacao_id
       AND etapa_aprovacao = 'CENTRO_CUSTO'
       AND status IN ('APROVADO','NEGADO');
  ELSE  -- CANCELAR
    IF v_status_fluxo = 'CANCELADO' THEN
      RAISE EXCEPTION 'EQUIP_POSDEC_JA_CANCELADO' USING ERRCODE='55000';
    END IF;
    v_new_fluxo := 'CANCELADO';
    UPDATE public.bd_solicitacoes_equip_aprovacoes
       SET status='CANCELADO', data_decisao=v_now,
           comentario = COALESCE(comentario,'') ||
                        E'\n[CANCELADO por SuperAdm '|| v_now::text ||'] '|| v_com_norm
     WHERE solicitacao_id = p_solicitacao_id
       AND status = 'PENDENTE';
  END IF;

  UPDATE public.bd_solicitacoes_equipamento
     SET status_fluxo = v_new_fluxo, updated_at = v_now
   WHERE id = p_solicitacao_id;

  INSERT INTO public.bd_ativos_auditoria(
    actor_user_id, acao, recurso_tipo, recurso_id, contexto, filtros, detalhes
  ) VALUES (
    v_uid,
    CASE p_acao WHEN 'REVERTER' THEN 'solic_equip_pos_decisao_reverter'
                ELSE 'solic_equip_pos_decisao_cancelar' END,
    'bd_solicitacoes_equipamento', p_solicitacao_id,
    'central_aprovacoes_b2_corr_hist', '{}'::jsonb,
    jsonb_build_object(
      'status_fluxo_anterior', v_status_fluxo,
      'status_fluxo_novo', v_new_fluxo,
      'status_negocio', v_status,
      'comentario_len', char_length(v_com_norm)
    )
  );

  RETURN jsonb_build_object(
    'solicitacao_id', p_solicitacao_id,
    'acao', p_acao,
    'status_fluxo_anterior', v_status_fluxo,
    'status_fluxo', v_new_fluxo,
    'executado_por', v_uid,
    'executado_em', v_now
  );
END
$function$;

REVOKE ALL ON FUNCTION public.fn_solic_equip_indicadores_central() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_solic_equip_pos_decisao(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_solic_equip_indicadores_central() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_solic_equip_pos_decisao(uuid, text, text) TO authenticated;
