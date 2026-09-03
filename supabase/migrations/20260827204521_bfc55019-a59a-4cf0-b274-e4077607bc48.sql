CREATE OR REPLACE FUNCTION public.fn_solic_equip_decidir_corporativa(
  p_solicitacao_id uuid, p_decisao text, p_comentario text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid        uuid := auth.uid();
  v_is_super   boolean;
  v_com_norm   text;
  v_sol        record;
  v_etapa      record;
  v_res        jsonb;
  v_total      integer;
  v_new_fluxo  text := NULL;
  v_now        timestamptz := now();
  v_row        record;
BEGIN
  v_is_super := public.fn_is_super_admin(v_uid);
  v_com_norm := regexp_replace(btrim(COALESCE(p_comentario,'')), '\s+', ' ', 'g');

  IF NOT v_is_super THEN
    IF NOT ( public.fn_has_permission('central_aprovacoes_view',  v_uid)
          OR public.fn_has_permission('acesso_gestao_aprovacoes', v_uid) ) THEN
      RAISE EXCEPTION 'EQUIP_CENTRAL_SEM_ACESSO' USING ERRCODE='42501';
    END IF;
    IF NOT public.user_has_permission_action(v_uid, 'equipamentos_solicitacoes_aprovar', 'aprovar') THEN
      RAISE EXCEPTION 'EQUIP_CENTRAL_SEM_ACAO_APROVAR' USING ERRCODE='42501';
    END IF;
  END IF;

  SELECT s.id, s.status::text AS status, s.status_fluxo, s.centro_custo_id, s.chamado_id,
         s.solicitante_id, s.engenheiro_solicitante_id, s.apontador_responsavel_id
    INTO v_sol
    FROM public.bd_solicitacoes_equipamento s
   WHERE s.id = p_solicitacao_id FOR UPDATE;
  IF v_sol.id IS NULL THEN RAISE EXCEPTION 'EQUIP_SOLIC_INEXISTENTE' USING ERRCODE='P0002'; END IF;
  IF v_sol.status_fluxo IS DISTINCT FROM 'PENDENTE_APROVACAO' THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_DECISAO_JA_TOMADA' USING ERRCODE='55000',
      DETAIL = jsonb_build_object('status_fluxo', v_sol.status_fluxo)::text;
  END IF;
  IF NOT v_is_super AND NOT EXISTS (
      SELECT 1 FROM public.fn_ativos_user_centros_custo(v_uid) e
       WHERE e.centro_custo_id = v_sol.centro_custo_id) THEN
    -- aprovador resolvido da etapa também autoriza o escopo
    IF NOT EXISTS (
      SELECT 1 FROM public.bd_aprovacoes_fluxo_exec e
       WHERE e.processo_tipo='SOLICITACAO_EQUIPAMENTO' AND e.solicitacao_id=p_solicitacao_id
         AND COALESCE(e.status,'pendente')='pendente' AND e.pode_aprovar
         AND e.aprovador_resolvido_id = v_uid) THEN
      RAISE EXCEPTION 'EQUIP_SOLIC_DECISAO_FORA_DO_ESCOPO' USING ERRCODE='42501';
    END IF;
  END IF;
  IF p_decisao = 'NEGADO' AND char_length(v_com_norm) < 10 THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_NEGACAO_COMENTARIO_OBRIGATORIO' USING ERRCODE='22004';
  END IF;

  SELECT e.* INTO v_etapa FROM public.bd_aprovacoes_fluxo_exec e
   WHERE e.processo_tipo='SOLICITACAO_EQUIPAMENTO' AND e.solicitacao_id=p_solicitacao_id
     AND COALESCE(e.status,'pendente')='pendente'
   ORDER BY e.ordem LIMIT 1;
  IF v_etapa.id IS NULL THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_DECISAO_SEM_ETAPA_PENDENTE' USING ERRCODE='P0002';
  END IF;

  v_res := public.fn_aprovacao_corporativa_decidir_core(
    'SOLICITACAO_EQUIPAMENTO', p_solicitacao_id, v_etapa.id,
    CASE p_decisao WHEN 'APROVADO' THEN 'aprovado' ELSE 'rejeitado' END,
    NULLIF(v_com_norm,''));

  SELECT count(*) INTO v_total FROM public.bd_aprovacoes_fluxo_exec
   WHERE processo_tipo='SOLICITACAO_EQUIPAMENTO' AND solicitacao_id=p_solicitacao_id;

  IF COALESCE((v_res->>'fluxo_rejeitado')::boolean,false) THEN
    v_new_fluxo := 'NEGADO';
  ELSIF COALESCE((v_res->>'fluxo_completo')::boolean,false) THEN
    v_new_fluxo := 'APROVADO';
  END IF;

  IF v_new_fluxo IS NOT NULL THEN
    UPDATE public.bd_solicitacoes_equipamento
       SET status_fluxo = v_new_fluxo, updated_at = v_now
     WHERE id = p_solicitacao_id;

    UPDATE public.bd_solicitacoes_equip_aprovacoes
       SET status = CASE WHEN v_new_fluxo='APROVADO' THEN 'APROVADO' ELSE 'NEGADO' END,
           comentario = COALESCE(NULLIF(v_com_norm,''),'Decidido pelo motor corporativo de aprovação'),
           data_decisao = v_now
     WHERE solicitacao_id = p_solicitacao_id
       AND etapa_aprovacao = 'CENTRO_CUSTO' AND status = 'PENDENTE';
  END IF;

  INSERT INTO public.bd_ativos_auditoria(
    actor_user_id, acao, recurso_tipo, recurso_id, contexto, filtros, detalhes
  ) VALUES (
    v_uid, 'solic_equip_decidir_corporativa', 'bd_solicitacoes_equipamento', p_solicitacao_id,
    'motor_aprovacao_corporativo', '{}'::jsonb,
    jsonb_build_object('decisao', p_decisao, 'etapa_exec_id', v_etapa.id,
      'etapa_ordem', v_etapa.ordem, 'core', v_res, 'status_fluxo', v_new_fluxo,
      'comentario_len', char_length(v_com_norm))
  );

  IF v_sol.chamado_id IS NOT NULL THEN
    PERFORM public.fn_chamado_interno_registrar_evento_operacional(
      v_sol.chamado_id,
      CASE WHEN p_decisao='APROVADO' THEN 'ETAPA_APROVADA' ELSE 'ETAPA_REJEITADA' END,
      jsonb_build_object('dominio','SOLICITACAO_EQUIPAMENTO','processo_id',p_solicitacao_id,
        'aprovador_id', v_uid, 'aprovador_nome', v_etapa.aprovador_nome_snapshot,
        'etapa', v_etapa.ordem, 'total_etapas', v_total), true, v_uid);

    IF v_new_fluxo = 'APROVADO' THEN
      PERFORM public.fn_chamado_interno_registrar_evento_operacional(
        v_sol.chamado_id, 'APROVACAO_CONCLUIDA',
        jsonb_build_object('dominio','SOLICITACAO_EQUIPAMENTO','processo_id',p_solicitacao_id,
          'etapa', v_etapa.ordem, 'total_etapas', v_total), true, v_uid);
    END IF;
  END IF;

  IF v_new_fluxo IS NOT NULL THEN
    BEGIN
      PERFORM public.fn_notificacao_emitir_core(
        CASE v_new_fluxo WHEN 'APROVADO' THEN 'equip_solicitacao_aprovada'
                         ELSE 'equip_solicitacao_negada' END,
        CASE v_new_fluxo WHEN 'APROVADO' THEN 'Solicitação de equipamento aprovada'
                         ELSE 'Solicitação de equipamento negada' END,
        'A solicitação de equipamento foi ' ||
          CASE v_new_fluxo WHEN 'APROVADO' THEN 'aprovada.' ELSE 'negada.' END,
        '/gestao-maquinas/solicitacoes-equipamentos',
        jsonb_build_object('solicitacao_id', p_solicitacao_id, 'status_fluxo', v_new_fluxo,
                           'decidido_em', v_now, 'origem','CORPORATIVO'),
        public.fn_notificacao_dest_profiles(
          ARRAY[v_sol.solicitante_id, v_sol.engenheiro_solicitante_id, v_sol.apontador_responsavel_id]),
        'equip:solicitacao:' || p_solicitacao_id::text || ':corp:' || v_etapa.id::text || ':'
          || to_char(v_now,'YYYYMMDDHH24MISSUS') || ':' || lower(v_new_fluxo),
        v_uid);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notificacao_falhou (solic_equip_decidir_corporativa %): %', p_solicitacao_id, SQLERRM;
    END;
  END IF;

  RETURN jsonb_build_object(
    'solicitacao_id', p_solicitacao_id,
    'origem', 'CORPORATIVO',
    'etapa_exec_id', v_etapa.id,
    'etapa_ordem', v_etapa.ordem,
    'total_etapas', v_total,
    'etapa_status', v_res->>'etapa_status',
    'fluxo_completo', (v_res->>'fluxo_completo')::boolean,
    'fluxo_rejeitado', (v_res->>'fluxo_rejeitado')::boolean,
    'proxima_etapa', v_res->'proxima_etapa',
    'proximo_aprovador', v_res->'proximo_aprovador',
    'status_fluxo', COALESCE(v_new_fluxo, 'PENDENTE_APROVACAO'),
    'decidido_por', v_uid,
    'decidido_em', v_now
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_solic_equip_decidir_corporativa(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_solic_equip_decidir_corporativa(uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.fn_solic_equip_decidir_corporativa(uuid, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_solic_equip_decidir_corporativa(uuid, text, text) TO service_role;

-- wrapper público: assinatura preservada, roteia para o motor corporativo quando aplicável
CREATE OR REPLACE FUNCTION public.fn_solic_equip_decidir(p_solicitacao_id uuid, p_decisao text, p_comentario text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid           uuid := auth.uid();
  v_is_super      boolean;
  v_h_status      text;
  v_h_fluxo       text;
  v_h_aprovador   uuid;
  v_h_solicitante uuid;
  v_h_cc          uuid;
  v_h_chamado     uuid;
  v_pend_count    integer;
  v_pend_id       uuid;
  v_pend_aprov    uuid;
  v_com_norm      text;
  v_new_fluxo     text;
  v_auto_aprov    boolean;
  v_in_scope      boolean;
  v_auth_source   text;
  v_now           timestamptz := now();
  v_row           record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_DECISAO_NAO_AUTENTICADO' USING ERRCODE='42501';
  END IF;
  IF p_solicitacao_id IS NULL THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_DECISAO_ID_OBRIGATORIO' USING ERRCODE='22004';
  END IF;
  IF p_decisao IS NULL OR p_decisao NOT IN ('APROVADO','NEGADO') THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_DECISAO_INVALIDA' USING ERRCODE='22004';
  END IF;

  -- ROTA CORPORATIVA: solicitação governada pelo motor corporativo
  IF EXISTS (
    SELECT 1 FROM public.bd_aprovacoes_fluxo_exec e
     WHERE e.processo_tipo = 'SOLICITACAO_EQUIPAMENTO' AND e.solicitacao_id = p_solicitacao_id
  ) THEN
    RETURN public.fn_solic_equip_decidir_corporativa(p_solicitacao_id, p_decisao, p_comentario);
  END IF;

  -- ROTA LEGADA (comportamento atual preservado integralmente)
  v_is_super := public.fn_is_super_admin(v_uid);
  v_com_norm := regexp_replace(btrim(COALESCE(p_comentario,'')), '\s+', ' ', 'g');

  IF NOT v_is_super THEN
    IF NOT ( public.fn_has_permission('central_aprovacoes_view',  v_uid)
          OR public.fn_has_permission('acesso_gestao_aprovacoes', v_uid) ) THEN
      RAISE EXCEPTION 'EQUIP_CENTRAL_SEM_ACESSO' USING ERRCODE='42501';
    END IF;
    IF NOT public.user_has_permission_action(v_uid, 'equipamentos_solicitacoes_aprovar', 'aprovar') THEN
      RAISE EXCEPTION 'EQUIP_CENTRAL_SEM_ACAO_APROVAR' USING ERRCODE='42501';
    END IF;
  END IF;

  SELECT s.status::text, s.status_fluxo, s.aprovador_centro_custo_id,
         s.solicitante_id, s.centro_custo_id, s.chamado_id
    INTO v_h_status, v_h_fluxo, v_h_aprovador, v_h_solicitante, v_h_cc, v_h_chamado
    FROM public.bd_solicitacoes_equipamento s
   WHERE s.id = p_solicitacao_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_INEXISTENTE' USING ERRCODE='P0002';
  END IF;
  IF v_h_fluxo IS DISTINCT FROM 'PENDENTE_APROVACAO' THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_DECISAO_JA_TOMADA'
      USING ERRCODE='55000',
            DETAIL = jsonb_build_object('status', v_h_status, 'status_fluxo', v_h_fluxo)::text;
  END IF;

  v_auto_aprov := (v_h_solicitante = v_uid);
  IF v_auto_aprov AND NOT v_is_super THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_AUTOAPROVACAO_BLOQUEADA' USING ERRCODE='42501';
  END IF;
  IF v_auto_aprov AND v_is_super AND char_length(v_com_norm) < 10 THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_AUTOAPROVACAO_COMENTARIO_OBRIGATORIO' USING ERRCODE='22004';
  END IF;

  v_in_scope := v_is_super
    OR v_h_aprovador = v_uid
    OR EXISTS (
      SELECT 1 FROM public.fn_ativos_user_centros_custo(v_uid) e
      WHERE e.centro_custo_id = v_h_cc
    );
  IF NOT v_in_scope THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_DECISAO_FORA_DO_ESCOPO' USING ERRCODE='42501';
  END IF;

  IF p_decisao = 'NEGADO' AND char_length(v_com_norm) < 10 THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_NEGACAO_COMENTARIO_OBRIGATORIO' USING ERRCODE='22004';
  END IF;

  PERFORM 1
    FROM public.bd_solicitacoes_equip_aprovacoes
   WHERE solicitacao_id  = p_solicitacao_id
     AND etapa_aprovacao = 'CENTRO_CUSTO'
     AND status          = 'PENDENTE'
   FOR UPDATE;

  SELECT count(*) INTO v_pend_count
    FROM public.bd_solicitacoes_equip_aprovacoes
   WHERE solicitacao_id  = p_solicitacao_id
     AND etapa_aprovacao = 'CENTRO_CUSTO'
     AND status          = 'PENDENTE';

  IF v_pend_count = 0 THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_DECISAO_SEM_APROVACAO_PENDENTE' USING ERRCODE='P0002';
  ELSIF v_pend_count > 1 THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_DECISAO_MULTIPLAS_APROVACOES'
      USING ERRCODE='P0003', DETAIL = jsonb_build_object('qtd', v_pend_count)::text;
  END IF;

  SELECT id, aprovador_id
    INTO STRICT v_pend_id, v_pend_aprov
    FROM public.bd_solicitacoes_equip_aprovacoes
   WHERE solicitacao_id  = p_solicitacao_id
     AND etapa_aprovacao = 'CENTRO_CUSTO'
     AND status          = 'PENDENTE';

  IF v_pend_aprov IS DISTINCT FROM v_h_aprovador THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_DECISAO_APROVADOR_DIVERGENTE'
      USING ERRCODE='P0004',
            DETAIL = jsonb_build_object('header', v_h_aprovador, 'aprovacao', v_pend_aprov)::text;
  END IF;

  v_new_fluxo := CASE p_decisao WHEN 'APROVADO' THEN 'APROVADO'
                                WHEN 'NEGADO'   THEN 'NEGADO' END;

  IF v_is_super AND v_auto_aprov THEN
    v_auth_source := 'superadmin_self_approval';
  ELSIF v_is_super THEN
    v_auth_source := 'superadmin';
  ELSE
    v_auth_source := 'permission_stage';
  END IF;

  UPDATE public.bd_solicitacoes_equipamento
     SET status_fluxo = v_new_fluxo,
         updated_at   = v_now
   WHERE id = p_solicitacao_id;

  UPDATE public.bd_solicitacoes_equip_aprovacoes
     SET status       = p_decisao,
         comentario   = NULLIF(v_com_norm, ''),
         data_decisao = v_now
   WHERE id = v_pend_id;

  INSERT INTO public.bd_ativos_auditoria(
    actor_user_id, acao, recurso_tipo, recurso_id, contexto, filtros, detalhes
  ) VALUES (
    v_uid,
    CASE WHEN v_auto_aprov AND v_is_super THEN 'solic_equip_decidir_superadmin_self'
         ELSE 'solic_equip_decidir' END,
    'bd_solicitacoes_equipamento', p_solicitacao_id,
    'central_aprovacoes_b1_corr1', '{}'::jsonb,
    jsonb_build_object(
      'decisao', p_decisao,
      'status_anterior', v_h_status,
      'status_fluxo', v_new_fluxo,
      'aprovacao_id', v_pend_id,
      'aprovador_id', v_pend_aprov,
      'comentario_len', char_length(v_com_norm),
      'auto_aprovacao', v_auto_aprov,
      'authorization_source', v_auth_source
    )
  );

  IF v_h_chamado IS NOT NULL THEN
    PERFORM public.fn_chamado_interno_registrar_evento_operacional(
      v_h_chamado,
      CASE WHEN p_decisao='APROVADO' THEN 'APROVACAO_CONCLUIDA' ELSE 'ETAPA_REJEITADA' END,
      jsonb_build_object('dominio','SOLICITACAO_EQUIPAMENTO','processo_id',p_solicitacao_id,
        'aprovador_id', v_uid, 'etapa', 1, 'total_etapas', 1,
        'aprovacao_origem','LEGADO_EQUIPAMENTOS'), true, v_uid);
  END IF;

  BEGIN
    SELECT s.solicitante_id, s.engenheiro_solicitante_id, s.apontador_responsavel_id
      INTO v_row
      FROM public.bd_solicitacoes_equipamento s
     WHERE s.id = p_solicitacao_id;

    PERFORM public.fn_notificacao_emitir_core(
      CASE p_decisao WHEN 'APROVADO' THEN 'equip_solicitacao_aprovada'
                     ELSE 'equip_solicitacao_negada' END,
      CASE p_decisao WHEN 'APROVADO' THEN 'Solicitação de equipamento aprovada'
                     ELSE 'Solicitação de equipamento negada' END,
      'A solicitação de equipamento foi ' ||
        CASE p_decisao WHEN 'APROVADO' THEN 'aprovada.' ELSE 'negada.' END,
      '/gestao-maquinas/solicitacoes-equipamentos',
      jsonb_build_object('solicitacao_id', p_solicitacao_id, 'aprovacao_id', v_pend_id,
                         'status_fluxo', v_new_fluxo, 'decidido_em', v_now),
      public.fn_notificacao_dest_profiles(
        ARRAY[v_row.solicitante_id, v_row.engenheiro_solicitante_id, v_row.apontador_responsavel_id]),
      'equip:solicitacao:' || p_solicitacao_id::text || ':decisao:' || v_pend_id::text
        || ':' || to_char(v_now, 'YYYYMMDDHH24MISSUS') || ':'
        || CASE p_decisao WHEN 'APROVADO' THEN 'aprovada' ELSE 'negada' END,
      v_uid);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notificacao_falhou (solic_equip_decidir %): %', p_solicitacao_id, SQLERRM;
  END;

  RETURN jsonb_build_object(
    'solicitacao_id',        p_solicitacao_id,
    'origem',                'LEGADO_EQUIPAMENTOS',
    'aprovacao_id',          v_pend_id,
    'status_anterior',       v_h_status,
    'status_fluxo',          v_new_fluxo,
    'decidido_por',          v_uid,
    'decidido_em',           v_now,
    'authorization_source',  v_auth_source
  );
END
$function$;