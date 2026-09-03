CREATE OR REPLACE FUNCTION public.fn_ct_recebimento_finalizar(p_viagem_id uuid, p_payload jsonb, p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid(); v_func uuid; v record; v_prev jsonb; v_resp jsonb;
  v_rec uuid; v_item jsonb; v_total int; v_recusas int := 0; v_ressalvas int := 0;
  v_mov record; v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_status_final text; v_parada uuid; p record; v_dest uuid; v_lat numeric; v_lng numeric;
  v_restantes int; v_notif_dest uuid[]; v_notif_tipo text;
  v_assin uuid; v_aceite boolean;
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

  -- Assinatura: aceita o id de assinatura formal quando enviado; caso contrario
  -- exige o aceite eletronico marcado pelo recebedor na conferencia.
  v_assin := nullif(p_payload->>'assinatura_id','')::uuid;
  v_aceite := lower(coalesce(p_payload->>'assinatura_confirmada','false')) IN ('true','t','1','yes');
  IF v_assin IS NULL AND NOT v_aceite THEN
    RAISE EXCEPTION 'CT3E_ASSINATURA_OBRIGATORIA' USING ERRCODE='P0001',
      HINT='Confirme o aceite da conferencia para registrar o recebimento.';
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
       v_assin, v_lat, v_lng,
       p_payload->>'observacoes', coalesce(p_payload->'fotos','[]'::jsonb), v_uid, v_uid)
    RETURNING id INTO v_rec;
  ELSE
    UPDATE public.bd_ct_recebimentos SET
       recebedor_real_id = v_func,
       recebedor_nome_snapshot = p_payload->>'recebedor_nome',
       recebedor_documento_snapshot = p_payload->>'recebedor_documento',
       operado_por_profile_id = v_uid, recebido_em = now(),
       assinatura_id = coalesce(v_assin, assinatura_id),
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
END
$fn$;