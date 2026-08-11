-- ================== CT-3E/CT-3F · M2 (RPCs e transições) ==================
-- 0) Correção do gate de leitura: a capability administrativa da Central
CREATE OR REPLACE FUNCTION public.fn_ct_pode_ver_viagem(p_viagem_id uuid, p_user uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_func uuid;
  r record;
BEGIN
  IF p_user IS NULL OR p_viagem_id IS NULL THEN RETURN false; END IF;
  IF public.fn_is_super_admin(p_user) THEN RETURN true; END IF;

  SELECT motorista_id, recebedor_previsto_funcionario_id,
         origem_centro_custo_id, destino_centro_custo_id
    INTO r FROM public.bd_ct_viagens WHERE id = p_viagem_id;
  IF NOT FOUND THEN RETURN false; END IF;

  v_func := public.fn_ativos_profile_funcionario_id(p_user);
  IF v_func IS NOT NULL AND (v_func = r.motorista_id
        OR v_func = r.recebedor_previsto_funcionario_id) THEN
    RETURN true;
  END IF;

  IF public.user_has_permission_action(p_user,'gestao_maquinas_central_transporte_view','visualizar') THEN
    IF (r.destino_centro_custo_id IS NOT NULL
        AND public.fn_ativos_can_access_centro_custo(r.destino_centro_custo_id, p_user))
       OR (r.origem_centro_custo_id IS NOT NULL
        AND public.fn_ativos_can_access_centro_custo(r.origem_centro_custo_id, p_user)) THEN
      RETURN true;
    END IF;
  END IF;
  RETURN false;
END $$;

DROP POLICY IF EXISTS "ct_checklists_storage_select" ON storage.objects;
CREATE POLICY "ct_checklists_storage_select" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id='ct-checklists'
    AND (public.fn_is_super_admin(auth.uid())
      OR public.user_has_permission_action(auth.uid(),'gestao_maquinas_minhas_mobilizacoes_view','visualizar')
      OR public.user_has_permission_action(auth.uid(),'gestao_maquinas_central_transporte_view','visualizar')));

-- 1) capability helper -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_ct_cap(p_user uuid, p_acao text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT p_user IS NOT NULL AND (
    public.fn_is_super_admin(p_user)
    OR public.user_has_permission_action(p_user,'gestao_maquinas_minhas_mobilizacoes_view',p_acao)
  );
$$;
REVOKE ALL ON FUNCTION public.fn_ct_cap(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_ct_cap(uuid,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_ct_cap_admin(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT p_user IS NOT NULL AND (
    public.fn_is_super_admin(p_user)
    OR public.user_has_permission_action(p_user,'gestao_maquinas_central_transporte_view','visualizar')
  );
$$;
REVOKE ALL ON FUNCTION public.fn_ct_cap_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_ct_cap_admin(uuid) TO authenticated, service_role;

-- 2) json da viagem (reuso interno) ------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_ct_viagem_json(p_viagem_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT jsonb_build_object(
    'id', v.id,
    'codigo', v.codigo,
    'status', v.status,
    'solicitacao_id', v.solicitacao_id,
    'data_ordem', coalesce(v.data_prevista_saida, v.data_prevista_entrega),
    'data_prevista_saida', v.data_prevista_saida,
    'data_prevista_entrega', v.data_prevista_entrega,
    'modalidade_deslocamento', v.modalidade_deslocamento,
    'tipo_transporte', v.tipo_transporte,
    'motorista_id', v.motorista_id,
    'motorista_nome_snapshot', v.motorista_nome_snapshot,
    'placa_transportador_snapshot', v.placa_transportador_snapshot,
    'empresa_transportadora_nome_snapshot', v.empresa_transportadora_nome_snapshot,
    'origem_cc_nome_snapshot', v.origem_cc_nome_snapshot,
    'origem_endereco', coalesce(v.origem_endereco_operacional, v.origem_cc_endereco_snapshot),
    'origem_ponto_exato', v.origem_ponto_exato,
    'origem_latitude', coalesce(v.origem_coleta_latitude, v.origem_cc_latitude_snapshot),
    'origem_longitude', coalesce(v.origem_coleta_longitude, v.origem_cc_longitude_snapshot),
    'destino_cc_nome_snapshot', v.destino_cc_nome_snapshot,
    'destino_centro_custo_id', v.destino_centro_custo_id,
    'destino_endereco', coalesce(v.destino_endereco_operacional, v.destino_cc_endereco_snapshot),
    'destino_ponto_exato', v.destino_ponto_exato,
    'destino_latitude', coalesce(v.destino_descarga_latitude, v.destino_cc_latitude_snapshot),
    'destino_longitude', coalesce(v.destino_descarga_longitude, v.destino_cc_longitude_snapshot),
    'distancia_km', coalesce(v.distancia_operacional_km, v.distancia_rota_km, v.distancia_km),
    'recebedor_previsto_nome', v.recebedor_previsto_nome_snapshot,
    'recebedor_previsto_telefone', v.recebedor_previsto_telefone_snapshot,
    'transporte_iniciado_em', v.transporte_iniciado_em,
    'chegada_registrada_em', v.chegada_registrada_em,
    'observacoes', v.observacoes,
    'cargas', coalesce((
       SELECT jsonb_agg(jsonb_build_object(
                'movimentacao_id', m.id,
                'status_movimentacao', m.status,
                'equipamento_id', e.id,
                'frota', e.frota,
                'numero_frota', e.numero_frota,
                'placa', e.placa,
                'subcategoria_id', e.subcategoria_ativo_id,
                'tipo_ativo', e.tipo_ativo,
                'modelo', e.modelo
              ) ORDER BY e.frota NULLS LAST, e.numero_frota NULLS LAST)
         FROM public.bd_movimentacoes m
         JOIN public.bd_caminhoes_equipamentos e ON e.id = m.equipamento_id
        WHERE m.viagem_id = v.id AND coalesce(m.status,'') <> 'CANCELADA'
    ), '[]'::jsonb)
  )
  FROM public.bd_ct_viagens v WHERE v.id = p_viagem_id;
$$;
REVOKE ALL ON FUNCTION public.fn_ct_viagem_json(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_ct_viagem_json(uuid) TO authenticated, service_role;

-- 3) consulta administrativa --------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_ct_operacao_ordens_listar(
  p_status text DEFAULT NULL, p_data_inicio date DEFAULT NULL, p_data_fim date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT3E_AUTH_REQUIRED' USING ERRCODE='P0001', HINT='Sessao expirada. Entre novamente.';
  END IF;
  IF NOT public.fn_ct_cap_admin(v_uid) THEN
    RAISE EXCEPTION 'CT3E_FORBIDDEN' USING ERRCODE='P0001', HINT='Sem permissao para a visao administrativa.';
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'escopo', 'TODAS', 'hoje', v_hoje,
    'ordens', coalesce((
      SELECT jsonb_agg(public.fn_ct_viagem_json(v.id)
             ORDER BY coalesce(v.data_prevista_saida, v.data_prevista_entrega) NULLS LAST, v.codigo)
        FROM public.bd_ct_viagens v
       WHERE v.status <> 'RASCUNHO'
         AND (p_status IS NULL OR v.status = p_status)
         AND (p_data_inicio IS NULL OR coalesce(v.data_prevista_saida, v.data_prevista_entrega) >= p_data_inicio)
         AND (p_data_fim IS NULL OR coalesce(v.data_prevista_saida, v.data_prevista_entrega) <= p_data_fim)
         AND (public.fn_is_super_admin(v_uid) OR public.fn_ct_pode_ver_viagem(v.id, v_uid))
    ), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.fn_ct_operacao_ordens_listar(text,date,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_ct_operacao_ordens_listar(text,date,date) TO authenticated;

-- 4) detalhe operacional ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_ct_viagem_operacao_detalhe(p_viagem_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_func uuid;
  v record;
  v_pend int;
  v_total_cargas int;
  v_pode_receber boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT3E_AUTH_REQUIRED' USING ERRCODE='P0001', HINT='Sessao expirada. Entre novamente.';
  END IF;
  IF NOT public.fn_ct_pode_ver_viagem(p_viagem_id, v_uid) THEN
    RAISE EXCEPTION 'CT3E_FORBIDDEN' USING ERRCODE='P0001', HINT='Viagem fora do seu escopo.';
  END IF;

  SELECT * INTO v FROM public.bd_ct_viagens WHERE id = p_viagem_id;
  v_func := public.fn_ativos_profile_funcionario_id(v_uid);

  SELECT count(*) INTO v_total_cargas
    FROM public.bd_movimentacoes m
   WHERE m.viagem_id = p_viagem_id AND coalesce(m.status,'') <> 'CANCELADA';

  SELECT (CASE WHEN v.modalidade_deslocamento='TRANSPORTADO'
               AND NOT EXISTS (SELECT 1 FROM public.bd_ct_checklists c
                                WHERE c.viagem_id=p_viagem_id AND c.tipo='TRANSPORTADOR'
                                  AND c.status='CONCLUIDO')
          THEN 1 ELSE 0 END)
       + (SELECT count(*) FROM public.bd_movimentacoes m
           WHERE m.viagem_id=p_viagem_id AND coalesce(m.status,'') <> 'CANCELADA'
             AND NOT EXISTS (SELECT 1 FROM public.bd_ct_checklists c
                              WHERE c.viagem_id=p_viagem_id AND c.tipo='CARGA'
                                AND c.movimentacao_id=m.id AND c.status='CONCLUIDO'))
    INTO v_pend;

  v_pode_receber := public.fn_is_super_admin(v_uid)
    OR (v_func IS NOT NULL AND v_func = v.recebedor_previsto_funcionario_id)
    OR (public.fn_ct_cap(v_uid,'confirmar_recebimento')
        AND v.destino_centro_custo_id IS NOT NULL
        AND public.fn_ativos_can_access_centro_custo(v.destino_centro_custo_id, v_uid));

  RETURN jsonb_build_object(
    'ok', true,
    'viagem', public.fn_ct_viagem_json(p_viagem_id),
    'sou_motorista', (v_func IS NOT NULL AND v_func = v.motorista_id),
    'checklists_pendentes', v_pend,
    'total_cargas', v_total_cargas,
    'pode_registrar_checklist', (v_func IS NOT NULL AND v_func = v.motorista_id
                                 AND public.fn_ct_cap(v_uid,'registrar_checklist'))
                                 OR public.fn_is_super_admin(v_uid),
    'pode_iniciar', (v.status='PROGRAMADA' AND v_pend = 0),
    'pode_registrar_chegada', (v.status='EM_TRANSITO'),
    'pode_receber', v_pode_receber,
    'checklists', coalesce((SELECT jsonb_agg(jsonb_build_object(
             'id', c.id, 'tipo', c.tipo, 'movimentacao_id', c.movimentacao_id,
             'checklist_codigo', c.checklist_codigo, 'checklist_versao', c.checklist_versao,
             'status', c.status, 'respostas', c.respostas,
             'realizado_em', c.realizado_em, 'latitude', c.latitude, 'longitude', c.longitude)
             ORDER BY c.tipo, c.created_at)
        FROM public.bd_ct_checklists c WHERE c.viagem_id = p_viagem_id), '[]'::jsonb),
    'recebimento', (SELECT jsonb_build_object(
             'id', r.id, 'status', r.status, 'recebido_em', r.recebido_em,
             'recebedor_nome', r.recebedor_nome_snapshot,
             'observacoes', r.observacoes,
             'itens', coalesce((SELECT jsonb_agg(jsonb_build_object(
                        'movimentacao_id', i.movimentacao_id, 'equipamento_id', i.equipamento_id,
                        'resultado', i.resultado, 'nao_conformidade_tipo', i.nao_conformidade_tipo,
                        'observacao', i.observacao, 'fotos', i.fotos))
                      FROM public.bd_ct_recebimento_itens i WHERE i.recebimento_id = r.id),'[]'::jsonb))
        FROM public.bd_ct_recebimentos r WHERE r.viagem_id = p_viagem_id));
END $$;
REVOKE ALL ON FUNCTION public.fn_ct_viagem_operacao_detalhe(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_ct_viagem_operacao_detalhe(uuid) TO authenticated;

-- 5) checklist de saída -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_ct_checklist_saida_salvar(
  p_viagem_id uuid, p_payload jsonb, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_func uuid;
  v record;
  v_tipo text := upper(coalesce(p_payload->>'tipo',''));
  v_mov uuid := nullif(p_payload->>'movimentacao_id','')::uuid;
  v_status text := upper(coalesce(p_payload->>'status','RASCUNHO'));
  v_prev jsonb;
  v_id uuid;
  v_resp jsonb;
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

  IF v.status NOT IN ('PROGRAMADA') THEN
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
    nullif(p_payload->>'assinatura_id','')::uuid, v_uid, v_uid)
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
      assinatura_id = coalesce(nullif(p_payload->>'assinatura_id','')::uuid, assinatura_id),
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
REVOKE ALL ON FUNCTION public.fn_ct_checklist_saida_salvar(uuid,jsonb,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_ct_checklist_saida_salvar(uuid,jsonb,uuid) TO authenticated;

-- 6) iniciar transporte -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_ct_viagem_iniciar(p_viagem_id uuid, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_func uuid; v record; v_prev jsonb; v_pend int; v_resp jsonb;
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
              AND public.fn_ct_cap(v_uid,'iniciar_viagem'))) THEN
    RAISE EXCEPTION 'CT3E_FORBIDDEN' USING ERRCODE='P0001', HINT='Somente o motorista da viagem inicia o transporte.';
  END IF;
  IF v.status <> 'PROGRAMADA' THEN
    RAISE EXCEPTION 'CT3E_STATUS_INVALIDO' USING ERRCODE='P0001', HINT='A viagem nao esta programada.';
  END IF;

  SELECT (CASE WHEN v.modalidade_deslocamento='TRANSPORTADO'
               AND NOT EXISTS (SELECT 1 FROM public.bd_ct_checklists c
                 WHERE c.viagem_id=p_viagem_id AND c.tipo='TRANSPORTADOR' AND c.status='CONCLUIDO')
          THEN 1 ELSE 0 END)
       + (SELECT count(*) FROM public.bd_movimentacoes m
           WHERE m.viagem_id=p_viagem_id AND coalesce(m.status,'') <> 'CANCELADA'
             AND NOT EXISTS (SELECT 1 FROM public.bd_ct_checklists c
               WHERE c.viagem_id=p_viagem_id AND c.tipo='CARGA'
                 AND c.movimentacao_id=m.id AND c.status='CONCLUIDO'))
    INTO v_pend;
  IF v_pend > 0 THEN
    RAISE EXCEPTION 'CT3E_CHECKLIST_INCOMPLETO' USING ERRCODE='P0001',
      HINT='Conclua todos os checklists obrigatorios antes de iniciar o transporte.';
  END IF;

  UPDATE public.bd_ct_viagens
     SET status='EM_TRANSITO', transporte_iniciado_em=now(), transporte_iniciado_por=v_uid,
         updated_at=now(), updated_by=v_uid
   WHERE id = p_viagem_id;
  UPDATE public.bd_movimentacoes SET status='EM_TRANSITO', updated_at=now()
   WHERE viagem_id = p_viagem_id AND coalesce(status,'') <> 'CANCELADA';

  v_resp := jsonb_build_object('ok', true, 'replay', false, 'status', 'EM_TRANSITO');
  INSERT INTO public.bd_ct_comando_requests (request_id, operacao, solicitacao_id, response_json, created_by)
  VALUES (p_request_id, 'CT3E_VIAGEM_INICIAR', v.solicitacao_id, v_resp, v_uid);
  RETURN v_resp;
END $$;
REVOKE ALL ON FUNCTION public.fn_ct_viagem_iniciar(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_ct_viagem_iniciar(uuid,uuid) TO authenticated;

-- 7) chegada ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_ct_viagem_registrar_chegada(p_viagem_id uuid, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_uid uuid := auth.uid(); v_func uuid; v record; v_prev jsonb; v_resp jsonb;
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
              AND public.fn_ct_cap(v_uid,'iniciar_viagem'))) THEN
    RAISE EXCEPTION 'CT3E_FORBIDDEN' USING ERRCODE='P0001', HINT='Somente o motorista registra a chegada.';
  END IF;
  IF v.status <> 'EM_TRANSITO' THEN
    RAISE EXCEPTION 'CT3E_STATUS_INVALIDO' USING ERRCODE='P0001', HINT='A viagem nao esta em transito.';
  END IF;

  UPDATE public.bd_ct_viagens
     SET status='AGUARDANDO_RECEBIMENTO', chegada_registrada_em=now(),
         chegada_registrada_por=v_uid, updated_at=now(), updated_by=v_uid
   WHERE id = p_viagem_id;

  INSERT INTO public.bd_ct_recebimentos (viagem_id, status, recebedor_previsto_id,
         recebedor_nome_snapshot, created_by)
  VALUES (p_viagem_id, 'RASCUNHO', v.recebedor_previsto_funcionario_id,
          v.recebedor_previsto_nome_snapshot, v_uid)
  ON CONFLICT (viagem_id) DO NOTHING;

  v_resp := jsonb_build_object('ok', true, 'replay', false, 'status', 'AGUARDANDO_RECEBIMENTO');
  INSERT INTO public.bd_ct_comando_requests (request_id, operacao, solicitacao_id, response_json, created_by)
  VALUES (p_request_id, 'CT3E_VIAGEM_CHEGADA', v.solicitacao_id, v_resp, v_uid);
  RETURN v_resp;
END $$;
REVOKE ALL ON FUNCTION public.fn_ct_viagem_registrar_chegada(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_ct_viagem_registrar_chegada(uuid,uuid) TO authenticated;

-- 8) recebimentos pendentes ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_ct_recebimentos_pendentes_listar()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_uid uuid := auth.uid(); v_func uuid; v_sa boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT3E_AUTH_REQUIRED' USING ERRCODE='P0001', HINT='Sessao expirada. Entre novamente.';
  END IF;
  v_sa := public.fn_is_super_admin(v_uid);
  v_func := public.fn_ativos_profile_funcionario_id(v_uid);

  RETURN jsonb_build_object('ok', true, 'ordens', coalesce((
    SELECT jsonb_agg(public.fn_ct_viagem_json(v.id) ORDER BY v.chegada_registrada_em DESC NULLS LAST)
      FROM public.bd_ct_viagens v
     WHERE v.status IN ('AGUARDANDO_RECEBIMENTO','PENDENTE_TRATATIVA')
       AND (v_sa
            OR (v_func IS NOT NULL AND v_func = v.recebedor_previsto_funcionario_id)
            OR (public.fn_ct_cap(v_uid,'confirmar_recebimento')
                AND v.destino_centro_custo_id IS NOT NULL
                AND public.fn_ativos_can_access_centro_custo(v.destino_centro_custo_id, v_uid)))
  ), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.fn_ct_recebimentos_pendentes_listar() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_ct_recebimentos_pendentes_listar() TO authenticated;

-- 9) finalizar recebimento ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_ct_recebimento_finalizar(
  p_viagem_id uuid, p_payload jsonb, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_uid uuid := auth.uid(); v_func uuid; v record; v_prev jsonb; v_resp jsonb;
  v_rec uuid; v_item jsonb; v_total int; v_recusas int := 0; v_ressalvas int := 0;
  v_mov record; v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_status_final text;
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

  IF nullif(p_payload->>'assinatura_id','') IS NULL THEN
    RAISE EXCEPTION 'CT3E_ASSINATURA_OBRIGATORIA' USING ERRCODE='P0001', HINT='Assinatura obrigatoria no fechamento.';
  END IF;
  IF nullif(p_payload->>'recebedor_nome','') IS NULL THEN
    RAISE EXCEPTION 'CT3E_RECEBEDOR_OBRIGATORIO' USING ERRCODE='P0001', HINT='Informe o nome do recebedor.';
  END IF;

  SELECT count(*) INTO v_total FROM public.bd_movimentacoes m
   WHERE m.viagem_id = p_viagem_id AND coalesce(m.status,'') <> 'CANCELADA';
  IF jsonb_array_length(coalesce(p_payload->'itens','[]'::jsonb)) <> v_total THEN
    RAISE EXCEPTION 'CT3E_ITENS_INCOMPLETOS' USING ERRCODE='P0001',
      HINT='Informe o resultado de cada equipamento da viagem.';
  END IF;

  INSERT INTO public.bd_ct_recebimentos (viagem_id, status, recebedor_previsto_id, recebedor_real_id,
     recebedor_nome_snapshot, recebedor_documento_snapshot, operado_por_profile_id, recebido_em,
     assinatura_id, latitude, longitude, observacoes, fotos, created_by, updated_by)
  VALUES (p_viagem_id, 'RASCUNHO', v.recebedor_previsto_funcionario_id, v_func,
     p_payload->>'recebedor_nome', p_payload->>'recebedor_documento', v_uid, now(),
     (p_payload->>'assinatura_id')::uuid,
     nullif(p_payload->>'latitude','')::numeric, nullif(p_payload->>'longitude','')::numeric,
     p_payload->>'observacoes', coalesce(p_payload->'fotos','[]'::jsonb), v_uid, v_uid)
  ON CONFLICT (viagem_id) DO UPDATE SET
     recebedor_real_id = excluded.recebedor_real_id,
     recebedor_nome_snapshot = excluded.recebedor_nome_snapshot,
     recebedor_documento_snapshot = excluded.recebedor_documento_snapshot,
     operado_por_profile_id = excluded.operado_por_profile_id,
     recebido_em = excluded.recebido_em,
     assinatura_id = excluded.assinatura_id,
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
      RAISE EXCEPTION 'CT3E_NC_TIPO_OBRIGATORIO' USING ERRCODE='P0001',
        HINT='Classifique a nao conformidade.';
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

    -- transições de aceite (atômicas)
    UPDATE public.bd_movimentacoes SET status='CONCLUIDA', updated_at=now() WHERE id = v_mov.id;

    IF v_mov.atendimento_id IS NOT NULL THEN
      UPDATE public.bd_solicitacao_item_atendimentos
         SET status='ENTREGUE', updated_at=now()
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

  UPDATE public.bd_ct_viagens
     SET status = v_status_final, finalizada_em = now(), updated_at = now(), updated_by = v_uid
   WHERE id = p_viagem_id;

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
    'Viagem ' || coalesce(v.codigo,'') || ': ' || v_recusas || ' recusa(s), '
      || v_ressalvas || ' ressalva(s).',
    '/central-transporte', jsonb_build_object('viagem_id', p_viagem_id,
      'solicitacao_id', v.solicitacao_id, 'recusas', v_recusas, 'ressalvas', v_ressalvas),
    v_uid);

  v_resp := jsonb_build_object('ok', true, 'replay', false, 'status', v_status_final,
              'recusas', v_recusas, 'ressalvas', v_ressalvas, 'recebimento_id', v_rec);
  INSERT INTO public.bd_ct_comando_requests (request_id, operacao, solicitacao_id, response_json, created_by)
  VALUES (p_request_id, 'CT3F_RECEBIMENTO_FINALIZAR', v.solicitacao_id, v_resp, v_uid);
  RETURN v_resp;
END $$;
REVOKE ALL ON FUNCTION public.fn_ct_recebimento_finalizar(uuid,jsonb,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_ct_recebimento_finalizar(uuid,jsonb,uuid) TO authenticated;

-- 10) linha do tempo -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_ct_solicitacao_timeline(p_solicitacao_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_uid uuid := auth.uid(); v_func uuid; s record; v_sit text; v_eventos jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT3F_AUTH_REQUIRED' USING ERRCODE='P0001', HINT='Sessao expirada. Entre novamente.';
  END IF;
  SELECT * INTO s FROM public.bd_solicitacoes_equipamento WHERE id = p_solicitacao_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CT3F_SOLICITACAO_NAO_ENCONTRADA' USING ERRCODE='P0001', HINT='Solicitacao inexistente.';
  END IF;

  v_func := public.fn_ativos_profile_funcionario_id(v_uid);
  IF NOT (public.fn_is_super_admin(v_uid)
          OR public.fn_ct_cap_admin(v_uid)
          OR s.solicitante_id = v_uid
          OR (v_func IS NOT NULL AND v_func IN (s.engenheiro_solicitante_id, s.apontador_responsavel_id))
          OR (s.centro_custo_id IS NOT NULL
              AND public.fn_ativos_can_access_centro_custo(s.centro_custo_id, v_uid))) THEN
    RAISE EXCEPTION 'CT3F_FORBIDDEN' USING ERRCODE='P0001', HINT='Solicitacao fora do seu escopo.';
  END IF;

  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.bd_ct_viagens v WHERE v.solicitacao_id=p_solicitacao_id AND v.status='PENDENTE_TRATATIVA') THEN 'PENDENTE_TRATATIVA'
    WHEN EXISTS (SELECT 1 FROM public.bd_ct_viagens v WHERE v.solicitacao_id=p_solicitacao_id AND v.status='AGUARDANDO_RECEBIMENTO') THEN 'AGUARDANDO_RECEBIMENTO'
    WHEN EXISTS (SELECT 1 FROM public.bd_ct_viagens v WHERE v.solicitacao_id=p_solicitacao_id AND v.status='EM_TRANSITO') THEN 'A_CAMINHO'
    WHEN EXISTS (
      SELECT 1 FROM public.bd_ct_viagens v
        JOIN public.bd_ct_recebimentos r ON r.viagem_id=v.id
        JOIN public.bd_ct_recebimento_itens i ON i.recebimento_id=r.id
       WHERE v.solicitacao_id=p_solicitacao_id AND i.resultado='ACEITO_COM_RESSALVA') THEN 'ENTREGUE_COM_RESSALVA'
    WHEN EXISTS (SELECT 1 FROM public.bd_ct_viagens v WHERE v.solicitacao_id=p_solicitacao_id AND v.status='CONCLUIDA') THEN 'ENTREGUE'
    WHEN EXISTS (SELECT 1 FROM public.bd_ct_viagens v
                  WHERE v.solicitacao_id=p_solicitacao_id AND v.status='PROGRAMADA'
                    AND NOT EXISTS (SELECT 1 FROM public.bd_ct_checklists c
                                     WHERE c.viagem_id=v.id AND c.status='CONCLUIDO')) THEN 'CHECKLIST_PENDENTE'
    WHEN EXISTS (SELECT 1 FROM public.bd_ct_viagens v WHERE v.solicitacao_id=p_solicitacao_id AND v.status='PROGRAMADA') THEN 'PRONTO_PARA_SAIDA'
    WHEN EXISTS (SELECT 1 FROM public.bd_solicitacao_item_atendimentos a
                   JOIN public.bd_solicitacoes_itens si ON si.id=a.solicitacao_item_id
                  WHERE si.solicitacao_id=p_solicitacao_id AND a.status='RESERVADO') THEN 'ATIVOS_RESERVADOS'
    ELSE 'AGUARDANDO_SELECAO' END INTO v_sit;

  SELECT coalesce(jsonb_agg(e ORDER BY e->>'em'), '[]'::jsonb) INTO v_eventos FROM (
    SELECT jsonb_build_object('tipo','MOBILIZACAO_PROGRAMADA','em', v.updated_at,
             'viagem', v.codigo, 'responsavel', v.motorista_nome_snapshot,
             'estado','CONCLUIDO','observacao', null) e
      FROM public.bd_ct_viagens v
     WHERE v.solicitacao_id = p_solicitacao_id AND v.status <> 'RASCUNHO'
    UNION ALL
    SELECT jsonb_build_object('tipo','CHECKLIST_SAIDA','em', c.realizado_em,
             'viagem', v.codigo, 'responsavel', v.motorista_nome_snapshot,
             'estado','CONCLUIDO','observacao', null)
      FROM public.bd_ct_checklists c JOIN public.bd_ct_viagens v ON v.id=c.viagem_id
     WHERE v.solicitacao_id = p_solicitacao_id AND c.status='CONCLUIDO'
    UNION ALL
    SELECT jsonb_build_object('tipo','TRANSPORTE_INICIADO','em', v.transporte_iniciado_em,
             'viagem', v.codigo, 'responsavel', v.motorista_nome_snapshot,
             'estado','CONCLUIDO','observacao', null)
      FROM public.bd_ct_viagens v
     WHERE v.solicitacao_id = p_solicitacao_id AND v.transporte_iniciado_em IS NOT NULL
    UNION ALL
    SELECT jsonb_build_object('tipo','CHEGADA','em', v.chegada_registrada_em,
             'viagem', v.codigo, 'responsavel', v.motorista_nome_snapshot,
             'estado','CONCLUIDO','observacao', null)
      FROM public.bd_ct_viagens v
     WHERE v.solicitacao_id = p_solicitacao_id AND v.chegada_registrada_em IS NOT NULL
    UNION ALL
    SELECT jsonb_build_object('tipo','RECEBIMENTO','em', r.recebido_em,
             'viagem', v.codigo, 'responsavel', r.recebedor_nome_snapshot,
             'equipamento', trim(coalesce(eq.frota,'')||' '||coalesce(eq.numero_frota,'')),
             'estado', CASE i.resultado WHEN 'ACEITO' THEN 'CONCLUIDO'
                                        WHEN 'ACEITO_COM_RESSALVA' THEN 'RESSALVA'
                                        ELSE 'RECUSA' END,
             'resultado', i.resultado,
             'observacao', i.observacao)
      FROM public.bd_ct_recebimento_itens i
      JOIN public.bd_ct_recebimentos r ON r.id = i.recebimento_id
      JOIN public.bd_ct_viagens v ON v.id = r.viagem_id
      LEFT JOIN public.bd_caminhoes_equipamentos eq ON eq.id = i.equipamento_id
     WHERE v.solicitacao_id = p_solicitacao_id
  ) t;

  RETURN jsonb_build_object('ok', true, 'solicitacao_id', p_solicitacao_id,
    'situacao_logistica', v_sit, 'status_fluxo', s.status_fluxo, 'eventos', v_eventos);
END $$;
REVOKE ALL ON FUNCTION public.fn_ct_solicitacao_timeline(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_ct_solicitacao_timeline(uuid) TO authenticated;