-- ============ CT5 — leitura autoritativa ============
CREATE OR REPLACE FUNCTION public.fn_ct_puxada_json(p_puxada_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', p.id,
    'codigo', p.codigo,
    'status', p.status,
    'data_puxada', p.data_puxada,
    'centro_custo_id', p.centro_custo_id,
    'cc_codigo', cc.codigo_centro_custo,
    'cc_nome', cc.nome_centro_custo,
    'planejador_user_id', p.planejador_user_id,
    'planejador_nome', p.planejador_nome_snapshot,
    'coleta', jsonb_build_object('endereco', p.coleta_endereco,
                                 'latitude', p.coleta_latitude,
                                 'longitude', p.coleta_longitude),
    'descarga', jsonb_build_object('endereco', p.descarga_endereco,
                                   'latitude', p.descarga_latitude,
                                   'longitude', p.descarga_longitude),
    'rota', jsonb_build_object('distancia_km', p.distancia_rota_km,
                               'duracao_min', p.duracao_rota_min,
                               'resumo', p.rota_resumo,
                               'geometria', p.rota_geometria),
    'observacoes', p.observacoes,
    'programada_em', p.programada_em,
    'cancelado_em', p.cancelado_em,
    'motivo_cancelamento', p.motivo_cancelamento,
    'created_at', p.created_at,
    'updated_at', p.updated_at,
    'caminhoes', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', pc.id,
               'caminhao_equipamento_id', pc.caminhao_equipamento_id,
               'frota', pc.frota_snapshot,
               'placa', pc.placa_snapshot,
               'motorista_funcionario_id', pc.motorista_funcionario_id,
               'motorista_nome', pc.motorista_nome_snapshot
             ) ORDER BY pc.frota_snapshot NULLS LAST, pc.created_at)
        FROM public.bd_ct_puxada_caminhoes pc WHERE pc.puxada_id = p.id
    ), '[]'::jsonb)
  )
  FROM public.bd_ct_puxadas p
  LEFT JOIN public.bd_centros_custo cc ON cc.id = p.centro_custo_id
  WHERE p.id = p_puxada_id;
$$;

CREATE OR REPLACE FUNCTION public.fn_ct_puxada_estado(p_puxada_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT5_AUTH_REQUIRED' USING ERRCODE='P0001', HINT='Sessao expirada. Entre novamente.';
  END IF;
  IF NOT public.fn_ct_pode_ver_puxada(p_puxada_id, v_uid) THEN
    RAISE EXCEPTION 'CT5_FORBIDDEN' USING ERRCODE='P0001', HINT='Sem acesso a esta puxada.';
  END IF;
  RETURN jsonb_build_object('puxada', public.fn_ct_puxada_json(p_puxada_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_ct_puxada_listar(
  p_status text DEFAULT NULL,
  p_data_inicio date DEFAULT NULL,
  p_data_fim date DEFAULT NULL,
  p_centro_custo_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_out jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT5_AUTH_REQUIRED' USING ERRCODE='P0001', HINT='Sessao expirada. Entre novamente.';
  END IF;

  SELECT coalesce(jsonb_agg(j ORDER BY (j->>'data_puxada') DESC, j->>'codigo' DESC), '[]'::jsonb)
    INTO v_out
  FROM (
    SELECT jsonb_build_object(
             'id', p.id, 'codigo', p.codigo, 'status', p.status,
             'data_puxada', p.data_puxada,
             'centro_custo_id', p.centro_custo_id,
             'cc_codigo', cc.codigo_centro_custo, 'cc_nome', cc.nome_centro_custo,
             'planejador_nome', p.planejador_nome_snapshot,
             'total_caminhoes', coalesce(c.qtd, 0),
             'coleta', jsonb_build_object('endereco', p.coleta_endereco,
                                          'latitude', p.coleta_latitude,
                                          'longitude', p.coleta_longitude),
             'descarga', jsonb_build_object('endereco', p.descarga_endereco,
                                            'latitude', p.descarga_latitude,
                                            'longitude', p.descarga_longitude),
             'rota', jsonb_build_object('distancia_km', p.distancia_rota_km,
                                        'duracao_min', p.duracao_rota_min,
                                        'resumo', p.rota_resumo,
                                        'geometria', p.rota_geometria)
           ) AS j
      FROM public.bd_ct_puxadas p
      LEFT JOIN public.bd_centros_custo cc ON cc.id = p.centro_custo_id
      LEFT JOIN (SELECT puxada_id, count(*) qtd FROM public.bd_ct_puxada_caminhoes GROUP BY puxada_id) c
             ON c.puxada_id = p.id
     WHERE (p_status IS NULL OR p.status = p_status)
       AND (p_data_inicio IS NULL OR p.data_puxada >= p_data_inicio)
       AND (p_data_fim IS NULL OR p.data_puxada <= p_data_fim)
       AND (p_centro_custo_id IS NULL OR p.centro_custo_id = p_centro_custo_id)
       AND public.fn_ct_pode_ver_puxada(p.id, v_uid)
  ) s;

  RETURN jsonb_build_object('puxadas', v_out);
END;
$$;

-- ============ CT5 — salvar rascunho ============
CREATE OR REPLACE FUNCTION public.fn_ct_puxada_salvar_rascunho(
  p_puxada_id uuid,
  p_payload jsonb,
  p_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_prev jsonb;
  v_resp jsonb;
  v_id uuid := p_puxada_id;
  v_status text;
  v_cc uuid;
  v_data date;
  v_nome text;
  v_geo jsonb;
  v_item jsonb;
  v_cam record;
  v_mot record;
  v_qtd int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT5_AUTH_REQUIRED' USING ERRCODE='P0001', HINT='Sessao expirada. Entre novamente.';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'CT5_REQUEST_ID_OBRIGATORIO' USING ERRCODE='P0001', HINT='Requisicao invalida.';
  END IF;
  IF NOT (public.fn_is_super_admin(v_uid)
          OR public.user_has_permission_action(v_uid,'gestao_maquinas_central_transporte_view','criar')
          OR public.user_has_permission_action(v_uid,'gestao_maquinas_central_transporte_view','editar')) THEN
    RAISE EXCEPTION 'CT5_FORBIDDEN' USING ERRCODE='P0001', HINT='Sem permissao para planejar puxadas.';
  END IF;

  SELECT response_json INTO v_prev FROM public.bd_ct_comando_requests WHERE request_id = p_request_id;
  IF v_prev IS NOT NULL THEN RETURN v_prev || jsonb_build_object('replay', true); END IF;

  v_data := nullif(p_payload->>'data_puxada','')::date;
  v_cc := nullif(p_payload->>'centro_custo_id','')::uuid;
  IF v_data IS NULL THEN
    RAISE EXCEPTION 'CT5_DATA_OBRIGATORIA' USING ERRCODE='P0001', HINT='Informe a data da puxada.';
  END IF;
  IF v_cc IS NULL THEN
    RAISE EXCEPTION 'CT5_CENTRO_CUSTO_OBRIGATORIO' USING ERRCODE='P0001', HINT='Informe o centro de custo da puxada.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bd_centros_custo WHERE id = v_cc) THEN
    RAISE EXCEPTION 'CT5_CENTRO_CUSTO_INVALIDO' USING ERRCODE='P0001', HINT='Centro de custo inexistente.';
  END IF;
  IF NOT (public.fn_is_super_admin(v_uid) OR public.fn_ativos_can_access_centro_custo(v_cc, v_uid)) THEN
    RAISE EXCEPTION 'CT5_CENTRO_CUSTO_FORA_DO_ESCOPO' USING ERRCODE='P0001',
      HINT='Voce nao tem acesso a este centro de custo.';
  END IF;

  v_geo := p_payload->'rota'->'geometria';
  IF v_geo IS NOT NULL AND jsonb_typeof(v_geo) = 'object' THEN
    IF coalesce(v_geo->>'type','') <> 'LineString'
       OR jsonb_typeof(v_geo->'coordinates') <> 'array'
       OR jsonb_array_length(v_geo->'coordinates') < 2 THEN
      RAISE EXCEPTION 'CT5_ROTA_GEOMETRIA_INVALIDA' USING ERRCODE='P0001',
        HINT='Rota invalida: recalcule o trajeto no mapa.';
    END IF;
  ELSE
    v_geo := NULL;
  END IF;

  SELECT coalesce(nullif(btrim(nome_completo),''), 'Usuario') INTO v_nome
    FROM public.profiles WHERE id = v_uid;
  IF v_nome IS NULL THEN
    RAISE EXCEPTION 'CT5_USUARIO_SEM_PERFIL' USING ERRCODE='P0001', HINT='Perfil do usuario nao encontrado.';
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.bd_ct_puxadas (
      codigo, status, data_puxada, centro_custo_id,
      planejador_user_id, planejador_nome_snapshot,
      coleta_endereco, coleta_latitude, coleta_longitude,
      descarga_endereco, descarga_latitude, descarga_longitude,
      distancia_rota_km, duracao_rota_min, rota_resumo, rota_geometria,
      observacoes, created_by, updated_by
    ) VALUES (
      public.fn_ct5_proximo_codigo_puxada(), 'RASCUNHO', v_data, v_cc,
      v_uid, v_nome,
      nullif(btrim(coalesce(p_payload->'coleta'->>'endereco','')),''),
      nullif(p_payload->'coleta'->>'latitude','')::numeric,
      nullif(p_payload->'coleta'->>'longitude','')::numeric,
      nullif(btrim(coalesce(p_payload->'descarga'->>'endereco','')),''),
      nullif(p_payload->'descarga'->>'latitude','')::numeric,
      nullif(p_payload->'descarga'->>'longitude','')::numeric,
      nullif(p_payload->'rota'->>'distancia_km','')::numeric,
      nullif(p_payload->'rota'->>'duracao_min','')::int,
      nullif(btrim(coalesce(p_payload->'rota'->>'resumo','')),''),
      v_geo,
      nullif(btrim(coalesce(p_payload->>'observacoes','')),''),
      v_uid, v_uid
    ) RETURNING id INTO v_id;
  ELSE
    SELECT status INTO v_status FROM public.bd_ct_puxadas WHERE id = v_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'CT5_PUXADA_NAO_ENCONTRADA' USING ERRCODE='P0001', HINT='Puxada inexistente.';
    END IF;
    IF v_status IN ('CANCELADA','CONCLUIDA','EM_EXECUCAO') THEN
      RAISE EXCEPTION 'CT5_STATUS_NAO_EDITAVEL' USING ERRCODE='P0001',
        HINT='O planejamento desta puxada nao pode mais ser alterado.';
    END IF;

    UPDATE public.bd_ct_puxadas SET
      data_puxada = v_data,
      centro_custo_id = v_cc,
      coleta_endereco = nullif(btrim(coalesce(p_payload->'coleta'->>'endereco','')),''),
      coleta_latitude = nullif(p_payload->'coleta'->>'latitude','')::numeric,
      coleta_longitude = nullif(p_payload->'coleta'->>'longitude','')::numeric,
      descarga_endereco = nullif(btrim(coalesce(p_payload->'descarga'->>'endereco','')),''),
      descarga_latitude = nullif(p_payload->'descarga'->>'latitude','')::numeric,
      descarga_longitude = nullif(p_payload->'descarga'->>'longitude','')::numeric,
      distancia_rota_km = nullif(p_payload->'rota'->>'distancia_km','')::numeric,
      duracao_rota_min = nullif(p_payload->'rota'->>'duracao_min','')::int,
      rota_resumo = nullif(btrim(coalesce(p_payload->'rota'->>'resumo','')),''),
      rota_geometria = v_geo,
      observacoes = nullif(btrim(coalesce(p_payload->>'observacoes','')),''),
      updated_at = now(), updated_by = v_uid
     WHERE id = v_id;
  END IF;

  -- Caminhoes: reconstrucao determinística quando a chave vem no payload.
  IF jsonb_typeof(p_payload->'caminhoes') = 'array' THEN
    DELETE FROM public.bd_ct_puxada_caminhoes WHERE puxada_id = v_id;
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'caminhoes') LOOP
      SELECT ce.id, ce.frota, ce.numero_frota, ce.placa INTO v_cam
        FROM public.bd_caminhoes_equipamentos ce
       WHERE ce.id = nullif(v_item->>'caminhao_equipamento_id','')::uuid;
      IF v_cam.id IS NULL THEN
        RAISE EXCEPTION 'CT5_CAMINHAO_INVALIDO' USING ERRCODE='P0001', HINT='Caminhao inexistente.';
      END IF;

      SELECT f.id, f.nome_completo, f.status INTO v_mot
        FROM public.bd_funcionarios f
       WHERE f.id = nullif(v_item->>'motorista_funcionario_id','')::uuid;
      IF v_mot.id IS NULL THEN
        RAISE EXCEPTION 'CT5_MOTORISTA_OBRIGATORIO' USING ERRCODE='P0001',
          HINT='Selecione o motorista de cada caminhao.';
      END IF;
      IF v_mot.status NOT IN ('Ativo','Ativo sem Registro','Férias') THEN
        RAISE EXCEPTION 'CT5_MOTORISTA_INATIVO' USING ERRCODE='P0001',
          HINT='Motorista sem cadastro ativo: ' || coalesce(v_mot.nome_completo,'-');
      END IF;

      BEGIN
        INSERT INTO public.bd_ct_puxada_caminhoes (
          puxada_id, caminhao_equipamento_id, motorista_funcionario_id,
          frota_snapshot, placa_snapshot, motorista_nome_snapshot
        ) VALUES (
          v_id, v_cam.id, v_mot.id,
          btrim(coalesce(v_cam.frota,'') || '-' || coalesce(v_cam.numero_frota,'')),
          v_cam.placa, coalesce(nullif(btrim(v_mot.nome_completo),''),'Motorista')
        );
      EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'CT5_CAMINHAO_DUPLICADO_NA_PUXADA' USING ERRCODE='P0001',
          HINT='O caminhao ' || coalesce(v_cam.placa, v_cam.frota, '-') || ' já está nesta puxada.';
      END;
      v_qtd := v_qtd + 1;
    END LOOP;
  END IF;

  v_resp := jsonb_build_object('ok', true, 'replay', false, 'puxada_id', v_id,
                               'total_caminhoes', v_qtd,
                               'puxada', public.fn_ct_puxada_json(v_id));

  INSERT INTO public.bd_ct_comando_requests
    (request_id, operacao, puxada_id, command_hash, response_json, created_by)
  VALUES (p_request_id, 'CT5_PUXADA_RASCUNHO', v_id,
          md5(v_id::text || 'RASCUNHO' || coalesce(p_payload::text,'')), v_resp, v_uid);

  RETURN v_resp;
END;
$$;

-- ============ CT5 — programar ============
CREATE OR REPLACE FUNCTION public.fn_ct_puxada_programar(
  p_puxada_id uuid,
  p_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_prev jsonb;
  v_resp jsonb;
  v record;
  v_c record;
  v_disp jsonb;
  v_conflito text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT5_AUTH_REQUIRED' USING ERRCODE='P0001', HINT='Sessao expirada. Entre novamente.';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'CT5_REQUEST_ID_OBRIGATORIO' USING ERRCODE='P0001', HINT='Requisicao invalida.';
  END IF;
  IF NOT (public.fn_is_super_admin(v_uid)
          OR public.user_has_permission_action(v_uid,'gestao_maquinas_central_transporte_view','aprovar')
          OR public.user_has_permission_action(v_uid,'gestao_maquinas_central_transporte_view','criar')) THEN
    RAISE EXCEPTION 'CT5_FORBIDDEN' USING ERRCODE='P0001', HINT='Sem permissao para programar puxadas.';
  END IF;

  SELECT response_json INTO v_prev FROM public.bd_ct_comando_requests WHERE request_id = p_request_id;
  IF v_prev IS NOT NULL THEN RETURN v_prev || jsonb_build_object('replay', true); END IF;

  SELECT * INTO v FROM public.bd_ct_puxadas WHERE id = p_puxada_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CT5_PUXADA_NAO_ENCONTRADA' USING ERRCODE='P0001', HINT='Puxada inexistente.';
  END IF;
  IF v.status = 'PROGRAMADA' THEN
    RETURN jsonb_build_object('ok', true, 'replay', true, 'puxada_id', v.id,
                              'status', 'PROGRAMADA', 'puxada', public.fn_ct_puxada_json(v.id));
  END IF;
  IF v.status <> 'RASCUNHO' THEN
    RAISE EXCEPTION 'CT5_STATUS_INVALIDO' USING ERRCODE='P0001',
      HINT='Somente puxadas em rascunho podem ser programadas.';
  END IF;
  IF NOT (public.fn_is_super_admin(v_uid) OR public.fn_ativos_can_access_centro_custo(v.centro_custo_id, v_uid)) THEN
    RAISE EXCEPTION 'CT5_CENTRO_CUSTO_FORA_DO_ESCOPO' USING ERRCODE='P0001',
      HINT='Voce nao tem acesso ao centro de custo desta puxada.';
  END IF;

  IF v.coleta_latitude IS NULL OR v.coleta_longitude IS NULL THEN
    RAISE EXCEPTION 'CT5_COLETA_INCOMPLETA' USING ERRCODE='P0001',
      HINT='Confirme o ponto de coleta no mapa.';
  END IF;
  IF v.descarga_latitude IS NULL OR v.descarga_longitude IS NULL THEN
    RAISE EXCEPTION 'CT5_DESCARGA_INCOMPLETA' USING ERRCODE='P0001',
      HINT='Confirme o ponto de descarga no mapa.';
  END IF;
  IF v.rota_geometria IS NULL OR coalesce(v.rota_geometria->>'type','') <> 'LineString'
     OR jsonb_array_length(coalesce(v.rota_geometria->'coordinates','[]'::jsonb)) < 2 THEN
    RAISE EXCEPTION 'CT5_ROTA_NAO_CALCULADA' USING ERRCODE='P0001',
      HINT='Calcule a rota entre coleta e descarga antes de programar.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bd_ct_puxada_caminhoes WHERE puxada_id = v.id) THEN
    RAISE EXCEPTION 'CT5_SEM_CAMINHOES' USING ERRCODE='P0001',
      HINT='Adicione ao menos um caminhao com motorista.';
  END IF;

  /* Locks determinísticos (ordem por id) por caminhao+data: evita corrida entre programacoes. */
  FOR v_c IN
    SELECT pc.caminhao_equipamento_id AS cam, pc.frota_snapshot, pc.placa_snapshot,
           pc.motorista_funcionario_id AS mot
      FROM public.bd_ct_puxada_caminhoes pc
     WHERE pc.puxada_id = v.id
     ORDER BY pc.caminhao_equipamento_id
  LOOP
    PERFORM pg_advisory_xact_lock(hashtext('ct5_pux_cam_' || v_c.cam::text || '_' || v.data_puxada::text));

    IF v_c.mot IS NULL THEN
      RAISE EXCEPTION 'CT5_MOTORISTA_OBRIGATORIO' USING ERRCODE='P0001',
        HINT='Todos os caminhoes precisam de motorista.';
    END IF;

    /* Disponibilidade: motor unico existente, sem novo mecanismo. */
    v_disp := public.fn_ct_avaliar_disponibilidade(v_c.cam, 'RODANTE', v.data_puxada);
    IF coalesce((v_disp->>'ok')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'CT5_CAMINHAO_INDISPONIVEL' USING ERRCODE='P0001',
        HINT='Caminhao ' || coalesce(v_c.placa_snapshot, v_c.frota_snapshot, '-') || ': '
             || coalesce(v_disp->>'motivo','indisponivel para a data da puxada.');
    END IF;

    SELECT p2.codigo INTO v_conflito
      FROM public.bd_ct_puxada_caminhoes pc2
      JOIN public.bd_ct_puxadas p2 ON p2.id = pc2.puxada_id
     WHERE pc2.caminhao_equipamento_id = v_c.cam
       AND p2.id <> v.id
       AND p2.data_puxada = v.data_puxada
       AND p2.status IN ('PROGRAMADA','EM_EXECUCAO')
     LIMIT 1;
    IF v_conflito IS NOT NULL THEN
      RAISE EXCEPTION 'CT5_CAMINHAO_COMPROMETIDO_PUXADA' USING ERRCODE='P0001',
        HINT='O caminhao ' || coalesce(v_c.placa_snapshot, v_c.frota_snapshot, '-')
             || ' ja esta comprometido com ' || v_conflito || ' nesta data.';
    END IF;
  END LOOP;

  UPDATE public.bd_ct_puxadas
     SET status = 'PROGRAMADA', programada_por = v_uid, programada_em = now(),
         updated_at = now(), updated_by = v_uid
   WHERE id = v.id;

  v_resp := jsonb_build_object('ok', true, 'replay', false, 'puxada_id', v.id,
                               'status', 'PROGRAMADA', 'puxada', public.fn_ct_puxada_json(v.id));

  INSERT INTO public.bd_ct_comando_requests
    (request_id, operacao, puxada_id, command_hash, response_json, created_by)
  VALUES (p_request_id, 'CT5_PUXADA_PROGRAMAR', v.id,
          md5(v.id::text || 'PROGRAMAR'), v_resp, v_uid);

  RETURN v_resp;
END;
$$;

-- ============ CT5 — cancelar ============
CREATE OR REPLACE FUNCTION public.fn_ct_puxada_cancelar(
  p_puxada_id uuid,
  p_motivo text,
  p_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_prev jsonb;
  v_resp jsonb;
  v record;
  v_motivo text := btrim(coalesce(p_motivo,''));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT5_AUTH_REQUIRED' USING ERRCODE='P0001', HINT='Sessao expirada. Entre novamente.';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'CT5_REQUEST_ID_OBRIGATORIO' USING ERRCODE='P0001', HINT='Requisicao invalida.';
  END IF;
  IF NOT (public.fn_is_super_admin(v_uid)
          OR public.user_has_permission_action(v_uid,'gestao_maquinas_central_transporte_view','aprovar')
          OR public.user_has_permission_action(v_uid,'gestao_maquinas_central_transporte_view','editar')) THEN
    RAISE EXCEPTION 'CT5_FORBIDDEN' USING ERRCODE='P0001', HINT='Sem permissao para cancelar puxadas.';
  END IF;
  IF length(v_motivo) < 5 THEN
    RAISE EXCEPTION 'CT5_MOTIVO_OBRIGATORIO' USING ERRCODE='P0001', HINT='Informe o motivo do cancelamento.';
  END IF;

  SELECT response_json INTO v_prev FROM public.bd_ct_comando_requests WHERE request_id = p_request_id;
  IF v_prev IS NOT NULL THEN RETURN v_prev || jsonb_build_object('replay', true); END IF;

  SELECT * INTO v FROM public.bd_ct_puxadas WHERE id = p_puxada_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CT5_PUXADA_NAO_ENCONTRADA' USING ERRCODE='P0001', HINT='Puxada inexistente.';
  END IF;
  IF v.status = 'CANCELADA' THEN
    RETURN jsonb_build_object('ok', true, 'replay', true, 'puxada_id', v.id, 'status', 'CANCELADA',
                              'motivo', coalesce(v.motivo_cancelamento, v_motivo));
  END IF;
  IF v.status = 'EM_EXECUCAO' THEN
    RAISE EXCEPTION 'CT5_CANCELAMENTO_APOS_INICIO_NAO_PERMITIDO' USING ERRCODE='P0001',
      HINT='A operacao desta puxada ja foi iniciada.';
  END IF;
  IF v.status = 'CONCLUIDA' THEN
    RAISE EXCEPTION 'CT5_STATUS_INVALIDO' USING ERRCODE='P0001',
      HINT='Puxada encerrada nao pode ser cancelada.';
  END IF;

  UPDATE public.bd_ct_puxadas
     SET status = 'CANCELADA', cancelado_por = v_uid, cancelado_em = now(),
         motivo_cancelamento = v_motivo, updated_at = now(), updated_by = v_uid
   WHERE id = v.id;

  v_resp := jsonb_build_object('ok', true, 'replay', false, 'puxada_id', v.id,
                               'status', 'CANCELADA', 'motivo', v_motivo);

  INSERT INTO public.bd_ct_comando_requests
    (request_id, operacao, puxada_id, command_hash, response_json, created_by)
  VALUES (p_request_id, 'CT5_PUXADA_CANCELAR', v.id,
          md5(v.id::text || 'CANCELAR'), v_resp, v_uid);

  RETURN v_resp;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_ct_puxada_salvar_rascunho(uuid, jsonb, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.fn_ct_puxada_programar(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.fn_ct_puxada_cancelar(uuid, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.fn_ct_puxada_estado(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.fn_ct_puxada_listar(text, date, date, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.fn_ct_puxada_json(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.fn_ct_pode_ver_puxada(uuid, uuid) FROM anon;