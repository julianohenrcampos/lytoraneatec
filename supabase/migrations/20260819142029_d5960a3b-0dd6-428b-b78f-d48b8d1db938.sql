-- =========================================================
-- N3.2 — idempotência por OCORRÊNCIA (sem novas tabelas/colunas/índices)
-- =========================================================

-- 1) Helper privado: emissão de evento de viagem CT com identidade de comando
CREATE OR REPLACE FUNCTION public.fn_notificacao_ct_viagem_evento(
  p_viagem_id uuid, p_tipo text, p_titulo text, p_request_id uuid, p_actor uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v record; v_dest uuid[];
BEGIN
  IF p_viagem_id IS NULL OR p_request_id IS NULL OR p_tipo IS NULL THEN
    RAISE WARNING 'notificacao_ct_sem_identidade (viagem %, request %)', p_viagem_id, p_request_id;
    RETURN;
  END IF;

  SELECT * INTO v FROM public.bd_ct_viagens WHERE id = p_viagem_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_dest := public.fn_notificacao_dest_centros_custo(
              ARRAY[v.origem_centro_custo_id, v.destino_centro_custo_id])
            || public.fn_notificacao_dest_profiles(
              ARRAY[v.motorista_id, v.recebedor_previsto_funcionario_id, v.responsavel_transporte]);

  PERFORM public.fn_notificacao_emitir_core(
    p_tipo, p_titulo,
    'Viagem ' || coalesce(v.codigo,'') || ': ' || coalesce(v.origem_descricao,'origem')
      || ' -> ' || coalesce(v.destino_descricao,'destino') || '.',
    '/central-transporte',
    jsonb_build_object('viagem_id', v.id, 'status', v.status, 'codigo', v.codigo,
                       'solicitacao_id', v.solicitacao_id, 'request_id', p_request_id),
    v_dest,
    'ct:viagem:' || v.id::text || ':comando:' || p_request_id::text || ':' || p_tipo,
    p_actor);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notificacao_falhou (ct_viagem % / request %): %', p_viagem_id, p_request_id, SQLERRM;
END
$function$;

REVOKE ALL ON FUNCTION public.fn_notificacao_ct_viagem_evento(uuid,text,text,uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_notificacao_ct_viagem_evento(uuid,text,text,uuid,uuid) FROM anon;
REVOKE ALL ON FUNCTION public.fn_notificacao_ct_viagem_evento(uuid,text,text,uuid,uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_notificacao_ct_viagem_evento(uuid,text,text,uuid,uuid) TO service_role;

-- 2) Trigger CT de status: removida (eventos migrados para as RPCs de comando)
DROP TRIGGER IF EXISTS trg_notif_ct_viagem_status ON public.bd_ct_viagens;
DROP FUNCTION IF EXISTS public.trg_notificar_ct_viagem_status();

-- 3) Trigger de equipamentos: mantém apenas criação, reversão e etapas operacionais
CREATE OR REPLACE FUNCTION public.trg_notificar_solicitacao_equipamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_dest uuid[]; v_status text; v_fluxo text;
  v_tipo text; v_titulo text; v_ocorrencia text;
BEGIN
  BEGIN
    IF TG_OP = 'INSERT' THEN
      IF NEW.aprovador_centro_custo_id IS NULL THEN
        RAISE WARNING 'notificacao_sem_destinatario (solic_equip % criada sem aprovador_centro_custo_id)', NEW.id;
        RETURN NULL;
      END IF;
      v_dest := public.fn_notificacao_dest_profiles(ARRAY[NEW.aprovador_centro_custo_id]);
      PERFORM public.fn_notificacao_emitir_core(
        'equip_solicitacao_criada',
        'Nova solicitação de equipamento',
        'Solicitação de equipamento registrada e aguardando sua aprovação.',
        '/gestao-maquinas/solicitacoes-equipamentos',
        jsonb_build_object('solicitacao_id', NEW.id, 'centro_custo_id', NEW.centro_custo_id,
                           'status', NEW.status::text, 'status_fluxo', coalesce(NEW.status_fluxo::text,'')),
        v_dest,
        'equip:solicitacao:' || NEW.id::text || ':criada',
        coalesce(auth.uid(), NEW.solicitante_id));
      RETURN NULL;
    END IF;

    -- APROVADO / NEGADO / CANCELADO sao emitidos pelas RPCs autoritativas
    -- (fn_solic_equip_decidir / fn_solic_equip_pos_decisao), que conhecem
    -- deterministicamente o id da decisao. Aqui fica apenas a reversao.
    IF NEW.status_fluxo IS DISTINCT FROM OLD.status_fluxo THEN
      v_fluxo := upper(coalesce(NEW.status_fluxo::text, ''));
      IF v_fluxo = 'PENDENTE_APROVACAO' THEN
        IF NEW.aprovador_centro_custo_id IS NOT NULL THEN
          -- PENDENTE_APROVACAO_SEM_ID_OCORRENCIA: a reversao reaproveita a mesma
          -- linha de bd_solicitacoes_equip_aprovacoes; chave preservada como estava.
          PERFORM public.fn_notificacao_emitir_core(
            'equip_solicitacao_pendente_aprovacao',
            'Solicitação de equipamento voltou para aprovação',
            'A decisão foi revertida e a solicitação aguarda nova aprovação.',
            '/gestao-maquinas/solicitacoes-equipamentos',
            jsonb_build_object('solicitacao_id', NEW.id, 'status_fluxo', v_fluxo,
                               'status_fluxo_anterior', OLD.status_fluxo::text),
            public.fn_notificacao_dest_profiles(ARRAY[NEW.aprovador_centro_custo_id]),
            'equip_solic_fluxo:' || NEW.id::text || ':PENDENTE_APROVACAO:' || OLD.status_fluxo::text,
            auth.uid());
        ELSE
          RAISE WARNING 'notificacao_sem_destinatario (solic_equip % revertida sem aprovador)', NEW.id;
        END IF;
        RETURN NULL;
      END IF;
    END IF;

    -- Etapas operacionais repetiveis: identidade pela versao persistida da linha
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      v_status := upper(coalesce(NEW.status::text,''));
      IF v_status = 'EM_ANALISE' THEN
        v_tipo := 'equip_solicitacao_em_analise'; v_titulo := 'Solicitação de equipamento em análise';
      ELSIF v_status = 'ATENDIDO' THEN
        v_tipo := 'equip_solicitacao_atendida'; v_titulo := 'Solicitação de equipamento atendida';
      ELSE
        v_tipo := NULL;
      END IF;

      IF v_tipo IS NOT NULL THEN
        v_ocorrencia := coalesce(upper(coalesce(OLD.status::text,'')) || '>' || v_status
                                 || ':' || to_char(NEW.updated_at, 'YYYYMMDDHH24MISSUS'),
                                 upper(coalesce(OLD.status::text,'')) || '>' || v_status);
        v_dest := public.fn_notificacao_dest_profiles(
                    ARRAY[NEW.solicitante_id, NEW.engenheiro_solicitante_id, NEW.apontador_responsavel_id]);
        PERFORM public.fn_notificacao_emitir_core(
          v_tipo, v_titulo,
          'A solicitação de equipamento passou para o status ' || v_status || '.',
          '/gestao-maquinas/solicitacoes-equipamentos',
          jsonb_build_object('solicitacao_id', NEW.id, 'status', v_status,
                             'status_anterior', OLD.status::text),
          v_dest,
          'equip:solicitacao:' || NEW.id::text || ':etapa:' || v_ocorrencia,
          auth.uid());
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notificacao_falhou (solicitacao_equipamento %): %', NEW.id, SQLERRM;
  END;
  RETURN NULL;
END
$function$;

-- 4) fn_solic_equip_decidir: emite a decisao com identidade da ocorrencia
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
         s.solicitante_id, s.centro_custo_id
    INTO v_h_status, v_h_fluxo, v_h_aprovador, v_h_solicitante, v_h_cc
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

  -- CORREÇÃO CIRÚRGICA: preservar 'status', alterar somente 'status_fluxo'.
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

  -- N3.2: notificacao emitida aqui, com identidade da OCORRENCIA da decisao
  -- (aprovacao_id + data_decisao persistida). Falha nao derruba o negocio.
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
    'aprovacao_id',          v_pend_id,
    'status_anterior',       v_h_status,
    'status_fluxo',          v_new_fluxo,
    'decidido_por',          v_uid,
    'decidido_em',           v_now,
    'authorization_source',  v_auth_source
  );
END
$function$;

-- 5) fn_solic_equip_pos_decisao: cancelamento (terminal) emitido aqui
CREATE OR REPLACE FUNCTION public.fn_solic_equip_pos_decisao(p_solicitacao_id uuid, p_acao text, p_comentario text DEFAULT NULL::text)
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
  v_row record;
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

  -- N3.2: cancelamento e terminal (bloqueado por EQUIP_POSDEC_JA_CANCELADO),
  -- portanto entidade + evento identificam a ocorrencia de forma suficiente.
  IF p_acao = 'CANCELAR' THEN
    BEGIN
      SELECT s.solicitante_id, s.engenheiro_solicitante_id, s.apontador_responsavel_id
        INTO v_row
        FROM public.bd_solicitacoes_equipamento s
       WHERE s.id = p_solicitacao_id;

      PERFORM public.fn_notificacao_emitir_core(
        'equip_solicitacao_cancelada',
        'Solicitação de equipamento cancelada',
        'A solicitação de equipamento foi cancelada.',
        '/gestao-maquinas/solicitacoes-equipamentos',
        jsonb_build_object('solicitacao_id', p_solicitacao_id, 'status_fluxo', v_new_fluxo,
                           'status_fluxo_anterior', v_status_fluxo),
        public.fn_notificacao_dest_profiles(
          ARRAY[v_row.solicitante_id, v_row.engenheiro_solicitante_id, v_row.apontador_responsavel_id]),
        'equip:solicitacao:' || p_solicitacao_id::text || ':cancelada',
        v_uid);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notificacao_falhou (solic_equip_cancelar %): %', p_solicitacao_id, SQLERRM;
    END;
  END IF;

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
