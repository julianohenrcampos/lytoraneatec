CREATE OR REPLACE FUNCTION public.fn_ct_atendimento_atribuir(p_solicitacao_item_id uuid, p_equipamento_id uuid, p_modalidade text, p_request_id uuid, p_periodo_inicio date DEFAULT NULL::date, p_periodo_fim date DEFAULT NULL::date, p_justificativa_override text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sa         boolean;
  v_apr        boolean;
  v_uid        uuid;
  v_item       record;
  v_sol        record;
  v_equip      record;
  v_match      jsonb;
  v_disp       jsonb;
  v_dias       integer;
  v_jan_ini    date;
  v_jan_fim    date;
  v_per_ini    date;
  v_per_fim    date;
  v_ovr_per    boolean;
  v_ovr_disp   boolean;
  v_just       text;
  v_ctx        jsonb;
  v_new_id     uuid;
  v_exist      record;
  v_equiv      boolean;
  v_conflito   integer;
  v_constraint text;
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

  IF p_request_id IS NULL OR p_solicitacao_item_id IS NULL OR p_equipamento_id IS NULL THEN
    RAISE EXCEPTION 'CT2_PARAMETROS_INVALIDOS' USING ERRCODE = 'P0001',
      HINT = 'Dados obrigatorios ausentes na atribuicao.';
  END IF;

  IF p_modalidade IS NULL OR p_modalidade NOT IN ('INTERNO','RESERVA_FUTURA') THEN
    RAISE EXCEPTION 'CT2_MODALIDADE_INVALIDA' USING ERRCODE = 'P0001',
      HINT = 'Modalidade deve ser interna ou reserva futura.';
  END IF;

  -- Serializacao determinista da chave de idempotencia
  PERFORM pg_advisory_xact_lock(hashtextextended('ct2:req:' || p_request_id::text, 0));

  -- Matriz global de request_id: reuso entre criacao e encerramento e proibido
  IF EXISTS (
    SELECT 1 FROM public.bd_solicitacao_item_atendimentos x
     WHERE x.request_id_encerramento = p_request_id
  ) THEN
    RAISE EXCEPTION 'CT2_IDEMPOTENCY_KEY_REUSED' USING ERRCODE = 'P0001',
      HINT = 'Esta operacao ja foi registrada com parametros diferentes.';
  END IF;

  SELECT * INTO v_exist
    FROM public.bd_solicitacao_item_atendimentos x
   WHERE x.request_id_criacao = p_request_id
   FOR UPDATE;

  IF v_exist.id IS NOT NULL THEN
    v_equiv := v_exist.solicitacao_item_id = p_solicitacao_item_id
      AND v_exist.equipamento_id = p_equipamento_id
      AND v_exist.modalidade = p_modalidade
      AND v_exist.created_by = v_uid
      AND (p_periodo_inicio IS NULL OR v_exist.periodo_inicio = p_periodo_inicio)
      AND (p_periodo_fim IS NULL OR v_exist.periodo_fim = p_periodo_fim)
      AND coalesce(btrim(v_exist.justificativa_override), '') = coalesce(btrim(p_justificativa_override), '');
    IF v_equiv IS NOT TRUE THEN
      RAISE EXCEPTION 'CT2_IDEMPOTENCY_KEY_REUSED' USING ERRCODE = 'P0001',
        HINT = 'Esta operacao ja foi registrada com parametros diferentes.';
    END IF;
    -- GATE PRE-REPLAY: capability + escopo antes de devolver qualquer conteudo
    SELECT s.* INTO v_sol
      FROM public.bd_solicitacoes_equipamento s
      JOIN public.bd_solicitacoes_itens i ON i.solicitacao_id = s.id
     WHERE i.id = v_exist.solicitacao_item_id;
    IF NOT v_sa THEN
      IF NOT public.user_has_permission_action(v_uid, 'gestao_maquinas_central_transporte_view', 'criar') THEN
        RAISE EXCEPTION 'CT2_FORBIDDEN' USING ERRCODE = 'P0001',
          HINT = 'Sem permissao para atribuir equipamento na Central do Transporte.';
      END IF;
      IF v_sol.id IS NULL OR NOT public.fn_ativos_can_access_solicitacao(v_sol.id, v_uid) THEN
        RAISE EXCEPTION 'CT2_SCOPE_DENIED' USING ERRCODE = 'P0001',
          HINT = 'Solicitacao fora do seu escopo de acesso.';
      END IF;
      IF NOT public.fn_ativos_can_access_equipamento(v_exist.equipamento_id, v_uid)
         OR NOT public.fn_ativos_can_access_equipamento(p_equipamento_id, v_uid) THEN
        RAISE EXCEPTION 'CT2_SCOPE_DENIED' USING ERRCODE = 'P0001',
          HINT = 'Equipamento fora do seu escopo de acesso.';
      END IF;
    END IF;
    RETURN jsonb_build_object(
      'ok', true,
      'replay', true,
      'atendimento', public.fn_ct_atendimento_json(v_exist.id),
      'item', public.fn_ct_item_resumo_json(v_exist.solicitacao_item_id)
    );
  END IF;

  -- CT2.2: trava transacional por equipamento (anti dupla reserva concorrente)
  PERFORM pg_advisory_xact_lock(hashtextextended('ct2:equip:' || p_equipamento_id::text, 0));

  -- Locks antes das leituras de decisao (anti-TOCTOU)
  SELECT i.* INTO v_item
    FROM public.bd_solicitacoes_itens i
   WHERE i.id = p_solicitacao_item_id
   FOR UPDATE;

  IF v_item.id IS NULL THEN
    RAISE EXCEPTION 'CT2_ITEM_NAO_ENCONTRADO' USING ERRCODE = 'P0001',
      HINT = 'O item da solicitacao nao existe.';
  END IF;

  SELECT s.* INTO v_sol
    FROM public.bd_solicitacoes_equipamento s
   WHERE s.id = v_item.solicitacao_id;

  IF v_sol.id IS NULL THEN
    RAISE EXCEPTION 'CT2_SOLICITACAO_NAO_ENCONTRADA' USING ERRCODE = 'P0001',
      HINT = 'A solicitacao vinculada nao existe.';
  END IF;

  IF NOT v_sa THEN
    IF NOT public.user_has_permission_action(v_uid, 'gestao_maquinas_central_transporte_view', 'criar') THEN
      RAISE EXCEPTION 'CT2_FORBIDDEN' USING ERRCODE = 'P0001',
        HINT = 'Sem permissao para atribuir equipamento na Central do Transporte.';
    END IF;
    IF NOT public.fn_ativos_can_access_solicitacao(v_sol.id, v_uid) THEN
      RAISE EXCEPTION 'CT2_SCOPE_DENIED' USING ERRCODE = 'P0001',
        HINT = 'Solicitacao fora do seu escopo de acesso.';
    END IF;
    IF NOT public.fn_ativos_can_access_equipamento(p_equipamento_id, v_uid) THEN
      RAISE EXCEPTION 'CT2_SCOPE_DENIED' USING ERRCODE = 'P0001',
        HINT = 'Equipamento fora do seu escopo de acesso.';
    END IF;
  END IF;

  SELECT e.* INTO v_equip
    FROM public.bd_caminhoes_equipamentos e
   WHERE e.id = p_equipamento_id
   FOR UPDATE;

  IF v_equip.id IS NULL THEN
    RAISE EXCEPTION 'CT2_EQUIPAMENTO_NAO_ENCONTRADO' USING ERRCODE = 'P0001',
      HINT = 'O equipamento informado nao existe.';
  END IF;

  -- Janela aprovada: a primeira atribuicao do item fixa a janela
  v_dias := greatest(coalesce(v_item.tempo_previsto_dias, v_sol.tempo_previsto_dias, 1), 1);
  v_jan_ini := v_sol.data_inicio;
  IF v_jan_ini IS NULL THEN
    RAISE EXCEPTION 'CT2_JANELA_INDEFINIDA' USING ERRCODE = 'P0001',
      HINT = 'A solicitacao nao possui data de inicio definida.';
  END IF;
  v_jan_fim := v_jan_ini + (v_dias - 1);

  SELECT a.janela_aprovada_inicio, a.janela_aprovada_fim
    INTO v_per_ini, v_per_fim
    FROM public.bd_solicitacao_item_atendimentos a
   WHERE a.solicitacao_item_id = p_solicitacao_item_id
   ORDER BY a.created_at ASC, a.id ASC
   LIMIT 1;

  IF v_per_ini IS NOT NULL THEN
    v_jan_ini := v_per_ini;
    v_jan_fim := v_per_fim;
  END IF;

  v_per_ini := coalesce(p_periodo_inicio, v_jan_ini);
  v_per_fim := coalesce(p_periodo_fim, v_jan_fim);

  IF v_per_fim < v_per_ini THEN
    RAISE EXCEPTION 'CT2_PERIODO_INVALIDO' USING ERRCODE = 'P0001',
      HINT = 'A data final nao pode ser anterior a inicial.';
  END IF;

  v_ovr_per := (v_per_ini <> v_jan_ini) OR (v_per_fim <> v_jan_fim);

  v_match := public.fn_ct_avaliar_match(p_solicitacao_item_id, p_equipamento_id);
  IF (v_match->>'compativel')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'CT2_EQUIPAMENTO_INCOMPATIVEL' USING ERRCODE = 'P0001',
      HINT = 'Equipamento incompativel com o item solicitado.';
  END IF;

  v_disp := public.fn_ct_avaliar_disponibilidade(p_equipamento_id, p_modalidade, v_per_ini);
  v_ovr_disp := (v_disp->>'override')::boolean;

  -- G0/CT2: ativo sem linha operacional nunca e reservavel (fail-closed, sem override).
  IF coalesce(v_disp->>'status', 'SEM_REGISTRO') = 'SEM_REGISTRO' THEN
    RAISE EXCEPTION 'CT2_DISPONIBILIDADE_SEM_REGISTRO' USING ERRCODE = 'P0001',
      HINT = 'Regularize a disponibilidade operacional do ativo antes de continuar.';
  END IF;

  -- CT-2.3: data de inicio da disponibilidade e trava rigida (nunca override).
  IF coalesce(v_disp->>'motivo_codigo', '') = 'CT2_ATIVO_AINDA_NAO_DISPONIVEL' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001',
      MESSAGE = 'CT2_ATIVO_AINDA_NAO_DISPONIVEL',
      DETAIL  = jsonb_build_object(
        'disponivel_a_partir_de', v_disp->>'disponivel_a_partir_de'
      )::text,
      HINT = 'O equipamento ainda nao esta disponivel para o periodo informado.';
  END IF;

  v_just := nullif(btrim(coalesce(p_justificativa_override, '')), '');
  v_apr := v_sa OR public.user_has_permission_action(v_uid, 'gestao_maquinas_central_transporte_view', 'aprovar');

  IF v_match->>'tipo' = 'PARCIAL' AND NOT v_apr THEN
    RAISE EXCEPTION 'CT2_MATCH_PARCIAL_BLOQUEADO' USING ERRCODE = 'P0001',
      HINT = 'Match PARCIAL exige permissao de aprovacao.';
  END IF;

  IF v_ovr_per AND NOT v_apr THEN
    RAISE EXCEPTION 'CT2_PERIODO_FORA_JANELA' USING ERRCODE = 'P0001',
      HINT = 'Periodo fora da janela aprovada exige permissao de aprovacao.';
  END IF;

  IF v_ovr_disp AND NOT v_apr THEN
    RAISE EXCEPTION 'CT2_DISPONIBILIDADE_BLOQUEADA' USING ERRCODE = 'P0001',
      HINT = 'Override de disponibilidade exige permissao de aprovacao.';
  END IF;

  IF (v_match->>'tipo' = 'PARCIAL' OR v_ovr_per OR v_ovr_disp)
     AND (v_just IS NULL OR length(v_just) < 20) THEN
    RAISE EXCEPTION 'CT2_JUSTIFICATIVA_OBRIGATORIA' USING ERRCODE = 'P0001',
      HINT = 'Informe uma justificativa com no minimo 20 caracteres.';
  END IF;

  -- Reserva por janela: overlap no mesmo equipamento (inclusivo, sob lock)
  SELECT count(*)::integer INTO v_conflito
    FROM public.bd_solicitacao_item_atendimentos a
   WHERE a.equipamento_id = p_equipamento_id
     AND a.status IN ('RESERVADO','EM_TRANSPORTE','ENTREGUE')
     AND a.periodo_inicio <= v_per_fim
     AND a.periodo_fim >= v_per_ini;

  IF v_conflito > 0 THEN
    RAISE EXCEPTION 'CT2_EQUIPAMENTO_EM_CONFLITO' USING ERRCODE = 'P0001',
      HINT = 'O equipamento ja possui um compromisso ativo no periodo informado.';
  END IF;

  v_ctx := jsonb_build_object(
    'versao', 'CT2_M2_R4',
    'operacao', 'ATRIBUICAO',
    'match', jsonb_build_object(
      'tipo', v_match->>'tipo',
      'via', v_match->>'via',
      'motivo', v_match->>'motivo'
    ),
    'disponibilidade', jsonb_build_object(
      'status', v_disp->>'status',
      'override', v_ovr_disp::text,
      'reconciliado', v_disp->>'reconciliado',
      'previsao_liberacao', v_disp->>'previsao_liberacao'
    ),
    'periodo', jsonb_build_object(
      'override', v_ovr_per::text,
      'periodo_inicio', v_per_ini::text,
      'periodo_fim', v_per_fim::text,
      'janela_aprovada_inicio', v_jan_ini::text,
      'janela_aprovada_fim', v_jan_fim::text
    )
  );

  BEGIN
    INSERT INTO public.bd_solicitacao_item_atendimentos (
      solicitacao_item_id, equipamento_id, modalidade, status,
      periodo_inicio, periodo_fim, janela_aprovada_inicio, janela_aprovada_fim,
      override_periodo, override_disponibilidade, match_tipo,
      justificativa_override, contexto_decisao, request_id_criacao, created_by
    ) VALUES (
      p_solicitacao_item_id, p_equipamento_id, p_modalidade, 'RESERVADO',
      v_per_ini, v_per_fim, v_jan_ini, v_jan_fim,
      v_ovr_per, v_ovr_disp, v_match->>'tipo',
      v_just, v_ctx, p_request_id, v_uid
    )
    RETURNING id INTO v_new_id;
  EXCEPTION
  WHEN exclusion_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint = 'excl_sia_equip_periodo_ativo' THEN
      RAISE EXCEPTION 'CT2_EQUIPAMENTO_EM_CONFLITO' USING ERRCODE = 'P0001',
        HINT = 'O equipamento ja possui um compromisso ativo no periodo informado.';
    ELSE
      RAISE;
    END IF;
  WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint = 'uq_sia_request_id_criacao' THEN
      SELECT * INTO v_exist
        FROM public.bd_solicitacao_item_atendimentos x
       WHERE x.request_id_criacao = p_request_id;
      v_equiv := v_exist.id IS NOT NULL
        AND v_exist.solicitacao_item_id = p_solicitacao_item_id
        AND v_exist.equipamento_id = p_equipamento_id
        AND v_exist.modalidade = p_modalidade
        AND v_exist.created_by = v_uid
        AND v_exist.periodo_inicio = v_per_ini
        AND v_exist.periodo_fim = v_per_fim
        AND coalesce(btrim(v_exist.justificativa_override), '') = coalesce(v_just, '');
      IF v_equiv IS NOT TRUE THEN
        RAISE EXCEPTION 'CT2_IDEMPOTENCY_KEY_REUSED' USING ERRCODE = 'P0001',
          HINT = 'Esta operacao ja foi registrada com parametros diferentes.';
      END IF;
      RETURN jsonb_build_object(
        'ok', true,
        'replay', true,
        'atendimento', public.fn_ct_atendimento_json(v_exist.id),
        'item', public.fn_ct_item_resumo_json(v_exist.solicitacao_item_id)
      );
    ELSIF v_constraint = 'uq_sia_item_equip_ativo' THEN
      RAISE EXCEPTION 'CT2_EQUIPAMENTO_EM_CONFLITO' USING ERRCODE = 'P0001',
        HINT = 'Este equipamento ja esta atribuido a este item.';
    ELSE
      RAISE EXCEPTION 'CT2_INVARIANTE_VIOLADA' USING ERRCODE = 'P0001',
        HINT = 'A operacao violou uma regra de integridade do atendimento.';
    END IF;
  END;

  PERFORM public.fn_ct_recalcular_status_item(p_solicitacao_item_id);

  -- Marco material no CHI vinculado (idempotente por atendimento)
  PERFORM public.fn_ct_chi_evento(v_sol.id, 'ATIVO_SELECIONADO',
    jsonb_build_object(
      'ativo_id', p_equipamento_id,
      'frota', v_equip.frota,
      'numero_frota', v_equip.numero_frota,
      'departamento_id', v_equip.departamento_id,
      'departamento_nome', (SELECT d.nome_departamento FROM public.bd_departamentos d
                             WHERE d.id = v_equip.departamento_id),
      'item_solicitacao_id', p_solicitacao_item_id,
      'atendimento_id', v_new_id,
      'modalidade', p_modalidade),
    'ct:ativo_selecionado:' || v_new_id::text);

  RETURN jsonb_build_object(
    'ok', true,
    'replay', false,
    'atendimento', public.fn_ct_atendimento_json(v_new_id),
    'item', public.fn_ct_item_resumo_json(p_solicitacao_item_id)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_ct_recebimento_finalizar(p_viagem_id uuid, p_payload jsonb, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid(); v_func uuid; v record; v_prev jsonb; v_resp jsonb;
  v_rec uuid; v_item jsonb; v_total int; v_recusas int := 0; v_ressalvas int := 0;
  v_mov record; v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_status_final text; v_parada uuid; p record; v_dest uuid; v_lat numeric; v_lng numeric;
  v_restantes int; v_notif_dest uuid[]; v_notif_tipo text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT3E_AUTH_REQUIRED' USING ERRCODE='P0001', HINT='Sessao expirada. Entre novamente.';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'CT3E_REQUEST_ID_OBRIGATORIO' USING ERRCODE='P0001', HINT='Requisicao invalida.';
  END IF;
  SELECT response_json INTO v_prev FROM public.bd_ct_comando_requests WHERE request_id = p_request_id;
  IF v_prev IS NOT NULL THEN RETURN v_prev || jsonb_build_object('replay', true); END IF;

  SELECT * INTO v FROM public.bd_ct_viagens WHERE id = p_viagem_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CT3E_VIAGEM_NAO_ENCONTRADA' USING ERRCODE='P0001', HINT='Viagem inexistente.';
  END IF;
  IF v.status <> 'AGUARDANDO_RECEBIMENTO' THEN
    RAISE EXCEPTION 'CT3E_STATUS_INVALIDO' USING ERRCODE='P0001', HINT='A viagem nao esta aguardando recebimento.';
  END IF;

  v_parada := nullif(p_payload->>'parada_id','')::uuid;
  IF v_parada IS NOT NULL THEN
    SELECT * INTO p FROM public.bd_ct_viagem_paradas
     WHERE id = v_parada AND viagem_id = p_viagem_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'CT4_PARADA_NAO_ENCONTRADA' USING ERRCODE='P0001', HINT='Parada nao pertence a viagem.';
    END IF;
    IF p.status <> 'CHEGADA_REGISTRADA' THEN
      RAISE EXCEPTION 'CT4_PARADA_STATUS_INVALIDO' USING ERRCODE='P0001',
        HINT='Registre a chegada nesta parada antes do recebimento.';
    END IF;
    v_dest := p.centro_custo_id;
  ELSE
    v_dest := v.destino_centro_custo_id;
  END IF;

  v_func := public.fn_ativos_profile_funcionario_id(v_uid);
  IF NOT (public.fn_is_super_admin(v_uid)
          OR (v_func IS NOT NULL AND (v_func = v.recebedor_previsto_funcionario_id
                                      OR (p.id IS NOT NULL AND v_func = p.recebedor_previsto_funcionario_id)))
          OR (public.fn_ct_cap(v_uid,'confirmar_recebimento')
              AND v_dest IS NOT NULL
              AND public.fn_ativos_can_access_centro_custo(v_dest, v_uid))) THEN
    RAISE EXCEPTION 'CT3E_FORBIDDEN' USING ERRCODE='P0001', HINT='Sem autorizacao para confirmar este recebimento.';
  END IF;

  IF nullif(p_payload->>'assinatura_id','') IS NULL THEN
    RAISE EXCEPTION 'CT3E_ASSINATURA_OBRIGATORIA' USING ERRCODE='P0001', HINT='Assinatura obrigatoria no fechamento.';
  END IF;
  IF nullif(p_payload->>'recebedor_nome','') IS NULL THEN
    RAISE EXCEPTION 'CT3E_RECEBEDOR_OBRIGATORIO' USING ERRCODE='P0001', HINT='Informe o nome do recebedor.';
  END IF;

  SELECT count(*) INTO v_total FROM public.bd_movimentacoes m
   WHERE m.viagem_id = p_viagem_id AND coalesce(m.status,'') <> 'CANCELADA'
     AND (v_parada IS NULL OR m.parada_id = v_parada);
  IF jsonb_array_length(coalesce(p_payload->'itens','[]'::jsonb)) <> v_total THEN
    RAISE EXCEPTION 'CT3E_ITENS_INCOMPLETOS' USING ERRCODE='P0001',
      HINT='Informe o resultado de cada equipamento desta entrega.';
  END IF;

  v_lat := nullif(p_payload->>'latitude','')::numeric;
  v_lng := nullif(p_payload->>'longitude','')::numeric;

  SELECT id INTO v_rec FROM public.bd_ct_recebimentos
   WHERE viagem_id = p_viagem_id AND parada_id IS NOT DISTINCT FROM v_parada FOR UPDATE;

  IF v_rec IS NULL THEN
    INSERT INTO public.bd_ct_recebimentos (viagem_id, parada_id, status, recebedor_previsto_id, recebedor_real_id,
       recebedor_nome_snapshot, recebedor_documento_snapshot, operado_por_profile_id, recebido_em,
       assinatura_id, latitude, longitude, observacoes, fotos, created_by, updated_by)
    VALUES (p_viagem_id, v_parada, 'RASCUNHO', v.recebedor_previsto_funcionario_id, v_func,
       p_payload->>'recebedor_nome', p_payload->>'recebedor_documento', v_uid, now(),
       (p_payload->>'assinatura_id')::uuid, v_lat, v_lng,
       p_payload->>'observacoes', coalesce(p_payload->'fotos','[]'::jsonb), v_uid, v_uid)
    RETURNING id INTO v_rec;
  ELSE
    UPDATE public.bd_ct_recebimentos SET
       recebedor_real_id = v_func,
       recebedor_nome_snapshot = p_payload->>'recebedor_nome',
       recebedor_documento_snapshot = p_payload->>'recebedor_documento',
       operado_por_profile_id = v_uid, recebido_em = now(),
       assinatura_id = (p_payload->>'assinatura_id')::uuid,
       latitude = v_lat, longitude = v_lng,
       observacoes = p_payload->>'observacoes',
       fotos = coalesce(p_payload->'fotos','[]'::jsonb),
       updated_by = v_uid, updated_at = now()
     WHERE id = v_rec;
  END IF;

  DELETE FROM public.bd_ct_recebimento_itens WHERE recebimento_id = v_rec;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'itens') LOOP
    SELECT m.* INTO v_mov FROM public.bd_movimentacoes m
     WHERE m.id = (v_item->>'movimentacao_id')::uuid
       AND m.viagem_id = p_viagem_id AND coalesce(m.status,'') <> 'CANCELADA'
       AND (v_parada IS NULL OR m.parada_id = v_parada)
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'CT3E_CARGA_INVALIDA' USING ERRCODE='P0001', HINT='Carga nao pertence a esta entrega.';
    END IF;

    IF upper(coalesce(v_item->>'resultado','')) NOT IN ('ACEITO','ACEITO_COM_RESSALVA','RECUSADO') THEN
      RAISE EXCEPTION 'CT3E_RESULTADO_INVALIDO' USING ERRCODE='P0001', HINT='Resultado invalido para o equipamento.';
    END IF;
    IF upper(v_item->>'resultado') IN ('ACEITO_COM_RESSALVA','RECUSADO') THEN
      IF nullif(v_item->>'observacao','') IS NULL THEN
        RAISE EXCEPTION 'CT3E_MOTIVO_OBRIGATORIO' USING ERRCODE='P0001',
          HINT='Descreva o motivo da ressalva ou recusa.';
      END IF;
      IF jsonb_array_length(coalesce(v_item->'fotos','[]'::jsonb)) < 1 THEN
        RAISE EXCEPTION 'CT3E_FOTO_OBRIGATORIA' USING ERRCODE='P0001',
          HINT='Anexe ao menos uma foto para ressalva ou recusa.';
      END IF;
    END IF;
    IF upper(v_item->>'resultado') = 'ACEITO_COM_RESSALVA'
       AND nullif(v_item->>'nao_conformidade_tipo','') IS NULL THEN
      RAISE EXCEPTION 'CT3E_NC_TIPO_OBRIGATORIO' USING ERRCODE='P0001', HINT='Classifique a nao conformidade.';
    END IF;

    INSERT INTO public.bd_ct_recebimento_itens (recebimento_id, movimentacao_id, equipamento_id,
      resultado, nao_conformidade_tipo, observacao, respostas, fotos, created_by)
    VALUES (v_rec, v_mov.id, v_mov.equipamento_id, upper(v_item->>'resultado'),
      nullif(v_item->>'nao_conformidade_tipo',''), nullif(v_item->>'observacao',''),
      coalesce(v_item->'respostas','{}'::jsonb), coalesce(v_item->'fotos','[]'::jsonb), v_uid);

    IF upper(v_item->>'resultado') = 'RECUSADO' THEN
      v_recusas := v_recusas + 1;
      CONTINUE;
    END IF;
    IF upper(v_item->>'resultado') = 'ACEITO_COM_RESSALVA' THEN
      v_ressalvas := v_ressalvas + 1;
    END IF;

    UPDATE public.bd_movimentacoes SET status='CONCLUIDA', updated_at=now() WHERE id = v_mov.id;

    IF v_mov.atendimento_id IS NOT NULL THEN
      UPDATE public.bd_solicitacao_item_atendimentos SET status='ENTREGUE', updated_at=now()
       WHERE id = v_mov.atendimento_id AND status <> 'ENTREGUE';
      PERFORM public.fn_ct_recalcular_status_item(a.solicitacao_item_id)
        FROM public.bd_solicitacao_item_atendimentos a WHERE a.id = v_mov.atendimento_id;
    END IF;

    IF v_dest IS NOT NULL THEN
      INSERT INTO public.bd_disponibilidade_equipamentos
        (equipamento_id, status_operacional, centro_custo_id, data_inicio, observacao)
      VALUES (v_mov.equipamento_id, 'ALOCADO', v_dest, v_hoje,
              'Entrega confirmada na Central do Transporte');

      PERFORM public.fn_aplicar_centro_custo_atual_equipamento(
        v_mov.equipamento_id, v_dest, 'CENTRAL_TRANSPORTE', now(), v_uid, true);

      INSERT INTO public.bd_localizacao_equipamentos
        (equipamento_id, centro_custo_id, latitude, longitude, origem, data_registro)
      VALUES (v_mov.equipamento_id, v_dest,
              coalesce(v_lat, p.latitude, v.destino_descarga_latitude, v.destino_cc_latitude_snapshot),
              coalesce(v_lng, p.longitude, v.destino_descarga_longitude, v.destino_cc_longitude_snapshot),
              'CENTRO_CUSTO'::origem_localizacao_enum, now());
    END IF;
  END LOOP;

  IF v_parada IS NOT NULL THEN
    UPDATE public.bd_ct_viagem_paradas
       SET status='CONCLUIDA', concluida_em=now(), updated_at=now(), updated_by=v_uid
     WHERE id = v_parada;
    SELECT count(*) INTO v_restantes FROM public.bd_ct_viagem_paradas
     WHERE viagem_id = p_viagem_id AND status IN ('PENDENTE','CHEGADA_REGISTRADA');
  ELSE
    v_restantes := 0;
  END IF;

  v_status_final := CASE
    WHEN v_recusas > 0 THEN 'PENDENTE_TRATATIVA'
    WHEN v_restantes > 0 THEN 'EM_TRANSITO'
    ELSE 'CONCLUIDA' END;

  UPDATE public.bd_ct_viagens
     SET status = v_status_final,
         finalizada_em = CASE WHEN v_status_final = 'CONCLUIDA' THEN now() ELSE finalizada_em END,
         updated_at = now(), updated_by = v_uid
   WHERE id = p_viagem_id;

  UPDATE public.bd_ct_recebimentos
     SET status = CASE WHEN v_recusas > 0 THEN 'PENDENTE_TRATATIVA' ELSE 'CONCLUIDO' END
   WHERE id = v_rec;

  -- N3: emissão via nucleo privado, com destinatarios resolvidos e falha nao-bloqueante
  BEGIN
    v_notif_tipo := CASE WHEN v_recusas > 0 THEN 'ct_recebimento_recusado'
                         WHEN v_ressalvas > 0 THEN 'ct_recebimento_ressalva'
                         ELSE 'ct_recebimento_concluido' END;
    v_notif_dest := public.fn_notificacao_dest_centros_custo(
                      ARRAY[v.origem_centro_custo_id, v_dest, v.destino_centro_custo_id])
                    || public.fn_notificacao_dest_profiles(
                      ARRAY[v.motorista_id, v.responsavel_transporte, v.recebedor_previsto_funcionario_id]);

    PERFORM public.fn_notificacao_emitir_core(
      v_notif_tipo,
      CASE WHEN v_recusas > 0 THEN 'Recebimento recusado na Central do Transporte'
           WHEN v_ressalvas > 0 THEN 'Recebimento aceito com ressalva'
           ELSE 'Entrega confirmada' END,
      'Viagem ' || coalesce(v.codigo,'') || ': ' || v_recusas || ' recusa(s), '
        || v_ressalvas || ' ressalva(s).',
      '/central-transporte',
      jsonb_build_object('viagem_id', p_viagem_id, 'parada_id', v_parada,
        'solicitacao_id', v.solicitacao_id, 'recebimento_id', v_rec,
        'recusas', v_recusas, 'ressalvas', v_ressalvas),
      v_notif_dest,
      'ct_receb:' || v_rec::text || ':' || v_notif_tipo,
      v_uid);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notificacao_falhou (ct_recebimento %): %', v_rec, SQLERRM;
  END;

  -- Marcos materiais no CHI vinculado (idempotentes por recebimento)
  IF (v_total - v_recusas) > 0 THEN
    PERFORM public.fn_ct_chi_evento(v.solicitacao_id, 'ENTREGA_REALIZADA',
      public.fn_ct_chi_viagem_payload(p_viagem_id) || jsonb_build_object(
        'parada_id', v_parada,
        'quantidade_ativos', v_total - v_recusas,
        'ressalvas', v_ressalvas,
        'destino_centro_custo_id', v_dest,
        'data_hora', now()),
      'ct:entrega_realizada:' || v_rec::text);
  END IF;

  PERFORM public.fn_ct_chi_evento(v.solicitacao_id, 'RECEBIMENTO_CONFIRMADO',
    public.fn_ct_chi_viagem_payload(p_viagem_id) || jsonb_build_object(
      'recebimento_id', v_rec,
      'parada_id', v_parada,
      'recebedor_id', v_func,
      'recebedor_nome', p_payload->>'recebedor_nome',
      'recusas', v_recusas,
      'ressalvas', v_ressalvas,
      'data_hora', now()),
    'ct:recebimento_confirmado:' || v_rec::text);

  PERFORM public.fn_ct_chi_avaliar_conclusao(v.solicitacao_id);

  v_resp := jsonb_build_object('ok', true, 'replay', false, 'status', v_status_final,
              'recusas', v_recusas, 'ressalvas', v_ressalvas, 'recebimento_id', v_rec,
              'paradas_restantes', v_restantes);
  INSERT INTO public.bd_ct_comando_requests (request_id, operacao, solicitacao_id, command_hash, response_json, created_by)
  VALUES (p_request_id, 'CT3F_RECEBIMENTO_FINALIZAR', v.solicitacao_id,
          md5(p_viagem_id::text || coalesce(v_parada::text,'') || 'RECEBIMENTO'), v_resp, v_uid);
  RETURN v_resp;
END $function$;
