-- CT-3E/CT-3F · M2b — assinatura resolvida no servidor
CREATE OR REPLACE FUNCTION public.fn_ct_registrar_assinatura(
  p_user uuid, p_solicitacao_id uuid, p_tipo text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  a record; v_nome text; v_cpf text; v_id uuid;
BEGIN
  SELECT * INTO a FROM public.bd_assinaturas_usuarios
   WHERE usuario_id = p_user AND ativo = true
   ORDER BY updated_at DESC LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CT3E_ASSINATURA_NAO_CADASTRADA' USING ERRCODE='P0001',
      HINT='Cadastre sua assinatura digital antes de concluir esta etapa.';
  END IF;
  v_nome := a.nome_completo;
  v_cpf := a.cpf;

  INSERT INTO public.bd_assinaturas (solicitacao_id, usuario_id, nome_usuario, cargo,
      assinatura_png, ip, hash_assinatura, data_assinatura, tipo_assinatura, cpf)
  VALUES (p_solicitacao_id, p_user, v_nome, a.cargo, a.assinatura_url,
      coalesce(inet_client_addr()::text,'desconhecido'),
      encode(digest(coalesce(v_nome,'')||'|'||coalesce(v_cpf,'')||'|'||p_tipo||'|'||now()::text,'sha256'),'hex'),
      now(), p_tipo, v_cpf)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.fn_ct_registrar_assinatura(uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_ct_registrar_assinatura(uuid,uuid,text) TO service_role;

-- checklist: assinatura server-side quando confirmada
CREATE OR REPLACE FUNCTION public.fn_ct_checklist_saida_salvar(
  p_viagem_id uuid, p_payload jsonb, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_func uuid; v record;
  v_tipo text := upper(coalesce(p_payload->>'tipo',''));
  v_mov uuid := nullif(p_payload->>'movimentacao_id','')::uuid;
  v_status text := upper(coalesce(p_payload->>'status','RASCUNHO'));
  v_prev jsonb; v_id uuid; v_resp jsonb; v_assin uuid;
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

  v_func := public.fn_ativos_profile_funcionario_id(v_uid);
  IF NOT (public.fn_is_super_admin(v_uid)
          OR (v_func IS NOT NULL AND v_func = v.motorista_id
              AND public.fn_ct_cap(v_uid,'registrar_checklist'))) THEN
    RAISE EXCEPTION 'CT3E_FORBIDDEN' USING ERRCODE='P0001', HINT='Somente o motorista da viagem registra o checklist.';
  END IF;
  IF v.status <> 'PROGRAMADA' THEN
    RAISE EXCEPTION 'CT3E_VIAGEM_NAO_PERMITE_CHECKLIST' USING ERRCODE='P0001',
      HINT='Checklist de saida so e permitido antes do inicio do transporte.';
  END IF;
  IF v_tipo NOT IN ('TRANSPORTADOR','CARGA') THEN
    RAISE EXCEPTION 'CT3E_TIPO_CHECKLIST_INVALIDO' USING ERRCODE='P0001', HINT='Tipo de checklist invalido.';
  END IF;
  IF v_tipo = 'TRANSPORTADOR' THEN
    IF coalesce(v.modalidade_deslocamento,'') <> 'TRANSPORTADO' THEN
      RAISE EXCEPTION 'CT3E_CHECKLIST_TRANSPORTADOR_NAO_APLICAVEL' USING ERRCODE='P0001',
        HINT='Viagem rodante nao possui checklist de transportador.';
    END IF;
    v_mov := NULL;
  ELSE
    IF v_mov IS NULL OR NOT EXISTS (SELECT 1 FROM public.bd_movimentacoes m
        WHERE m.id = v_mov AND m.viagem_id = p_viagem_id AND coalesce(m.status,'') <> 'CANCELADA') THEN
      RAISE EXCEPTION 'CT3E_CARGA_INVALIDA' USING ERRCODE='P0001', HINT='Carga nao pertence a viagem.';
    END IF;
  END IF;
  IF v_status NOT IN ('RASCUNHO','CONCLUIDO') THEN v_status := 'RASCUNHO'; END IF;

  IF v_status = 'CONCLUIDO' AND v_tipo = 'TRANSPORTADOR' THEN
    v_assin := public.fn_ct_registrar_assinatura(v_uid, v.solicitacao_id, 'CT_CHECKLIST_SAIDA');
  END IF;

  INSERT INTO public.bd_ct_checklists (
    viagem_id, movimentacao_id, tipo, fase, checklist_codigo, checklist_versao,
    respostas, status, realizado_por_profile_id, realizado_por_funcionario_id,
    realizado_em, latitude, longitude, assinatura_id, created_by, updated_by)
  VALUES (
    p_viagem_id, v_mov, v_tipo, 'SAIDA',
    coalesce(nullif(p_payload->>'checklist_codigo',''),'CT-GENERICO-V1'),
    coalesce((p_payload->>'checklist_versao')::int, 1),
    coalesce(p_payload->'respostas','{}'::jsonb), v_status, v_uid, v_func,
    CASE WHEN v_status='CONCLUIDO' THEN now() ELSE NULL END,
    nullif(p_payload->>'latitude','')::numeric, nullif(p_payload->>'longitude','')::numeric,
    v_assin, v_uid, v_uid)
  ON CONFLICT ON CONSTRAINT bd_ct_checklists_pkey DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    UPDATE public.bd_ct_checklists SET
      checklist_codigo = coalesce(nullif(p_payload->>'checklist_codigo',''), checklist_codigo),
      checklist_versao = coalesce((p_payload->>'checklist_versao')::int, checklist_versao),
      respostas = coalesce(p_payload->'respostas', respostas),
      status = v_status,
      realizado_por_profile_id = v_uid,
      realizado_por_funcionario_id = v_func,
      realizado_em = CASE WHEN v_status='CONCLUIDO' THEN now() ELSE NULL END,
      latitude = coalesce(nullif(p_payload->>'latitude','')::numeric, latitude),
      longitude = coalesce(nullif(p_payload->>'longitude','')::numeric, longitude),
      assinatura_id = coalesce(v_assin, assinatura_id),
      updated_by = v_uid
    WHERE viagem_id = p_viagem_id AND fase='SAIDA' AND tipo = v_tipo
      AND (v_tipo='TRANSPORTADOR' OR movimentacao_id = v_mov)
    RETURNING id INTO v_id;
  END IF;

  v_resp := jsonb_build_object('ok', true, 'replay', false, 'checklist_id', v_id, 'status', v_status);
  INSERT INTO public.bd_ct_comando_requests (request_id, operacao, solicitacao_id, response_json, created_by)
  VALUES (p_request_id, 'CT3E_CHECKLIST_SAIDA', v.solicitacao_id, v_resp, v_uid);
  RETURN v_resp;
END $$;

-- recebimento: assinatura server-side obrigatória
CREATE OR REPLACE FUNCTION public.fn_ct_recebimento_finalizar(
  p_viagem_id uuid, p_payload jsonb, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_uid uuid := auth.uid(); v_func uuid; v record; v_prev jsonb; v_resp jsonb;
  v_rec uuid; v_item jsonb; v_total int; v_recusas int := 0; v_ressalvas int := 0;
  v_mov record; v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_status_final text; v_assin uuid;
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

  v_func := public.fn_ativos_profile_funcionario_id(v_uid);
  IF NOT (public.fn_is_super_admin(v_uid)
          OR (v_func IS NOT NULL AND v_func = v.recebedor_previsto_funcionario_id)
          OR (public.fn_ct_cap(v_uid,'confirmar_recebimento')
              AND v.destino_centro_custo_id IS NOT NULL
              AND public.fn_ativos_can_access_centro_custo(v.destino_centro_custo_id, v_uid))) THEN
    RAISE EXCEPTION 'CT3E_FORBIDDEN' USING ERRCODE='P0001', HINT='Sem autorizacao para confirmar este recebimento.';
  END IF;
  IF nullif(p_payload->>'recebedor_nome','') IS NULL THEN
    RAISE EXCEPTION 'CT3E_RECEBEDOR_OBRIGATORIO' USING ERRCODE='P0001', HINT='Informe o nome do recebedor.';
  END IF;
  IF coalesce(p_payload->>'assinatura_confirmada','') <> 'true' THEN
    RAISE EXCEPTION 'CT3E_ASSINATURA_OBRIGATORIA' USING ERRCODE='P0001', HINT='Assinatura obrigatoria no fechamento.';
  END IF;

  SELECT count(*) INTO v_total FROM public.bd_movimentacoes m
   WHERE m.viagem_id = p_viagem_id AND coalesce(m.status,'') <> 'CANCELADA';
  IF jsonb_array_length(coalesce(p_payload->'itens','[]'::jsonb)) <> v_total THEN
    RAISE EXCEPTION 'CT3E_ITENS_INCOMPLETOS' USING ERRCODE='P0001',
      HINT='Informe o resultado de cada equipamento da viagem.';
  END IF;

  v_assin := public.fn_ct_registrar_assinatura(v_uid, v.solicitacao_id, 'CT_RECEBIMENTO');

  INSERT INTO public.bd_ct_recebimentos (viagem_id, status, recebedor_previsto_id, recebedor_real_id,
     recebedor_nome_snapshot, recebedor_documento_snapshot, operado_por_profile_id, recebido_em,
     assinatura_id, latitude, longitude, observacoes, fotos, created_by, updated_by)
  VALUES (p_viagem_id, 'RASCUNHO', v.recebedor_previsto_funcionario_id, v_func,
     p_payload->>'recebedor_nome', p_payload->>'recebedor_documento', v_uid, now(),
     v_assin, nullif(p_payload->>'latitude','')::numeric, nullif(p_payload->>'longitude','')::numeric,
     p_payload->>'observacoes', coalesce(p_payload->'fotos','[]'::jsonb), v_uid, v_uid)
  ON CONFLICT (viagem_id) DO UPDATE SET
     recebedor_real_id = excluded.recebedor_real_id,
     recebedor_nome_snapshot = excluded.recebedor_nome_snapshot,
     recebedor_documento_snapshot = excluded.recebedor_documento_snapshot,
     operado_por_profile_id = excluded.operado_por_profile_id,
     recebido_em = excluded.recebido_em, assinatura_id = excluded.assinatura_id,
     latitude = excluded.latitude, longitude = excluded.longitude,
     observacoes = excluded.observacoes, fotos = excluded.fotos, updated_by = excluded.updated_by
  RETURNING id INTO v_rec;

  DELETE FROM public.bd_ct_recebimento_itens WHERE recebimento_id = v_rec;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'itens') LOOP
    SELECT m.* INTO v_mov FROM public.bd_movimentacoes m
     WHERE m.id = (v_item->>'movimentacao_id')::uuid
       AND m.viagem_id = p_viagem_id AND coalesce(m.status,'') <> 'CANCELADA'
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'CT3E_CARGA_INVALIDA' USING ERRCODE='P0001', HINT='Carga nao pertence a viagem.';
    END IF;
    IF upper(coalesce(v_item->>'resultado','')) NOT IN ('ACEITO','ACEITO_COM_RESSALVA','RECUSADO') THEN
      RAISE EXCEPTION 'CT3E_RESULTADO_INVALIDO' USING ERRCODE='P0001', HINT='Resultado invalido para o equipamento.';
    END IF;
    IF upper(v_item->>'resultado') IN ('ACEITO_COM_RESSALVA','RECUSADO') THEN
      IF nullif(v_item->>'observacao','') IS NULL THEN
        RAISE EXCEPTION 'CT3E_MOTIVO_OBRIGATORIO' USING ERRCODE='P0001', HINT='Descreva o motivo da ressalva ou recusa.';
      END IF;
      IF jsonb_array_length(coalesce(v_item->'fotos','[]'::jsonb)) < 1 THEN
        RAISE EXCEPTION 'CT3E_FOTO_OBRIGATORIA' USING ERRCODE='P0001', HINT='Anexe ao menos uma foto para ressalva ou recusa.';
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
      v_recusas := v_recusas + 1; CONTINUE;
    END IF;
    IF upper(v_item->>'resultado') = 'ACEITO_COM_RESSALVA' THEN
      v_ressalvas := v_ressalvas + 1;
    END IF;

    UPDATE public.bd_movimentacoes SET status='CONCLUIDA', updated_at=now() WHERE id = v_mov.id;
    IF v_mov.atendimento_id IS NOT NULL THEN
      UPDATE public.bd_solicitacao_item_atendimentos SET status='ENTREGUE', updated_at=now()
       WHERE id = v_mov.atendimento_id AND status <> 'ENTREGUE';
    END IF;
    IF v.destino_centro_custo_id IS NOT NULL THEN
      INSERT INTO public.bd_disponibilidade_equipamentos
        (equipamento_id, status_operacional, centro_custo_id, data_inicio, observacao)
      VALUES (v_mov.equipamento_id, 'ALOCADO', v.destino_centro_custo_id, v_hoje,
              'Entrega confirmada na Central do Transporte');
      PERFORM public.fn_aplicar_centro_custo_atual_equipamento(
        v_mov.equipamento_id, v.destino_centro_custo_id, 'CENTRAL_TRANSPORTE', now(), v_uid, true);
      INSERT INTO public.bd_localizacao_equipamentos
        (equipamento_id, centro_custo_id, latitude, longitude, origem, data_registro)
      VALUES (v_mov.equipamento_id, v.destino_centro_custo_id,
              coalesce(nullif(p_payload->>'latitude','')::numeric, v.destino_descarga_latitude, v.destino_cc_latitude_snapshot),
              coalesce(nullif(p_payload->>'longitude','')::numeric, v.destino_descarga_longitude, v.destino_cc_longitude_snapshot),
              'CENTRO_CUSTO'::origem_localizacao_enum, now());
    END IF;
  END LOOP;

  v_status_final := CASE WHEN v_recusas > 0 THEN 'PENDENTE_TRATATIVA' ELSE 'CONCLUIDA' END;
  UPDATE public.bd_ct_viagens SET status = v_status_final, finalizada_em = now(),
         updated_at = now(), updated_by = v_uid WHERE id = p_viagem_id;
  UPDATE public.bd_ct_recebimentos
     SET status = CASE WHEN v_recusas > 0 THEN 'PENDENTE_TRATATIVA' ELSE 'CONCLUIDO' END
   WHERE id = v_rec;

  INSERT INTO public.bd_notificacoes (tipo, titulo, mensagem, link, metadata, created_by)
  VALUES (
    CASE WHEN v_recusas > 0 THEN 'ct_recebimento_recusado'
         WHEN v_ressalvas > 0 THEN 'ct_recebimento_ressalva'
         ELSE 'ct_recebimento_concluido' END,
    CASE WHEN v_recusas > 0 THEN 'Recebimento recusado na Central do Transporte'
         WHEN v_ressalvas > 0 THEN 'Recebimento aceito com ressalva'
         ELSE 'Entrega confirmada' END,
    'Viagem ' || coalesce(v.codigo,'') || ': ' || v_recusas || ' recusa(s), ' || v_ressalvas || ' ressalva(s).',
    '/central-transporte', jsonb_build_object('viagem_id', p_viagem_id,
      'solicitacao_id', v.solicitacao_id, 'recusas', v_recusas, 'ressalvas', v_ressalvas), v_uid);

  v_resp := jsonb_build_object('ok', true, 'replay', false, 'status', v_status_final,
              'recusas', v_recusas, 'ressalvas', v_ressalvas, 'recebimento_id', v_rec);
  INSERT INTO public.bd_ct_comando_requests (request_id, operacao, solicitacao_id, response_json, created_by)
  VALUES (p_request_id, 'CT3F_RECEBIMENTO_FINALIZAR', v.solicitacao_id, v_resp, v_uid);
  RETURN v_resp;
END $$;