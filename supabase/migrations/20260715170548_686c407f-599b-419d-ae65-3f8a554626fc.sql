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
        'catalogo_descricao', cat.descricao_padrao,
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