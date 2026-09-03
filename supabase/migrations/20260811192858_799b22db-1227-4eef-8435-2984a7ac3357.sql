CREATE OR REPLACE FUNCTION public.fn_ct_mov_direta_salvar_rascunho(p_viagem_id uuid, p_payload jsonb, p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid(); v_prev jsonb; v_resp jsonb; v_viagem uuid := p_viagem_id;
  v_hash text; v_cc record; v_par jsonb; v_par_id uuid; v_eq uuid; v_ordem int := 0;
  v_ultimo_cc uuid; v_func record; v_veic record; v_emp record; v_status text;
  v_origem_cc uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT4_AUTH_REQUIRED' USING ERRCODE='P0001', HINT='Sessao expirada. Entre novamente.';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'CT4_REQUEST_ID_OBRIGATORIO' USING ERRCODE='P0001', HINT='Requisicao invalida.';
  END IF;
  IF NOT (public.fn_is_super_admin(v_uid)
          OR public.user_has_permission_action(v_uid,'gestao_maquinas_central_transporte_view','criar')
          OR public.user_has_permission_action(v_uid,'gestao_maquinas_central_transporte_view','editar')) THEN
    RAISE EXCEPTION 'CT4_FORBIDDEN' USING ERRCODE='P0001', HINT='Sem permissao para planejar movimentacoes.';
  END IF;

  SELECT response_json INTO v_prev FROM public.bd_ct_comando_requests WHERE request_id = p_request_id;
  IF v_prev IS NOT NULL THEN RETURN v_prev || jsonb_build_object('replay', true); END IF;

  v_hash := md5(coalesce(p_viagem_id::text,'novo') || coalesce(p_payload::text,''));

  IF v_viagem IS NULL THEN
    INSERT INTO public.bd_ct_viagens (origem_fluxo, solicitacao_id, status, created_by, updated_by)
    VALUES ('MOVIMENTACAO_DIRETA', NULL, 'RASCUNHO', v_uid, v_uid)
    RETURNING id INTO v_viagem;
  ELSE
    SELECT status INTO v_status FROM public.bd_ct_viagens
      WHERE id = v_viagem AND origem_fluxo = 'MOVIMENTACAO_DIRETA' FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'CT4_VIAGEM_NAO_ENCONTRADA' USING ERRCODE='P0001', HINT='Movimentacao inexistente.';
    END IF;
    IF v_status <> 'RASCUNHO' THEN
      RAISE EXCEPTION 'CT4_STATUS_INVALIDO' USING ERRCODE='P0001',
        HINT='Somente rascunhos podem ser alterados.';
    END IF;
  END IF;

  SELECT id, codigo_centro_custo, nome_centro_custo, endereco, latitude, longitude
    INTO v_cc FROM public.bd_centros_custo
   WHERE id = nullif(p_payload->>'origem_centro_custo_id','')::uuid;

  SELECT id, nome_completo, cpf INTO v_func FROM public.bd_funcionarios
   WHERE id = nullif(p_payload->>'motorista_id','')::uuid;
  SELECT id, placa INTO v_veic FROM public.bd_caminhoes_equipamentos
   WHERE id = nullif(p_payload->>'veiculo_transportador_id','')::uuid;
  SELECT id, nome_empresa INTO v_emp FROM public.bd_empresas
   WHERE id = nullif(p_payload->>'empresa_transportadora_id','')::uuid;

  UPDATE public.bd_ct_viagens SET
    modalidade_deslocamento = nullif(p_payload->>'modalidade',''),
    tipo_transporte = nullif(p_payload->>'tipo_transporte',''),
    motorista_id = v_func.id,
    motorista_nome_snapshot = coalesce(v_func.nome_completo, nullif(p_payload->>'motorista_nome','')),
    motorista_cpf_snapshot = v_func.cpf,
    veiculo_transportador_id = v_veic.id,
    placa_transportador_snapshot = coalesce(v_veic.placa, nullif(p_payload->>'placa_transportador','')),
    empresa_transportadora_id = v_emp.id,
    empresa_transportadora_nome_snapshot = v_emp.nome_empresa,
    data_prevista_saida = nullif(p_payload->>'data_prevista_saida','')::date,
    origem_centro_custo_id = v_cc.id,
    origem_cc_codigo_snapshot = v_cc.codigo_centro_custo,
    origem_cc_nome_snapshot = v_cc.nome_centro_custo,
    origem_cc_endereco_snapshot = v_cc.endereco,
    origem_cc_latitude_snapshot = v_cc.latitude,
    origem_cc_longitude_snapshot = v_cc.longitude,
    origem_endereco_operacional = nullif(p_payload->>'origem_endereco',''),
    origem_ponto_exato = nullif(p_payload->>'origem_ponto_exato',''),
    origem_coleta_latitude = nullif(p_payload->>'origem_latitude','')::numeric,
    origem_coleta_longitude = nullif(p_payload->>'origem_longitude','')::numeric,
    observacoes = nullif(p_payload->>'observacoes',''),
    updated_at = now(), updated_by = v_uid
  WHERE id = v_viagem;

  v_origem_cc := v_cc.id;

  -- reconstrucao determinista das paradas do rascunho
  DELETE FROM public.bd_movimentacoes WHERE viagem_id = v_viagem;
  DELETE FROM public.bd_ct_viagem_paradas WHERE viagem_id = v_viagem;

  FOR v_par IN SELECT * FROM jsonb_array_elements(coalesce(p_payload->'paradas','[]'::jsonb)) LOOP
    v_ordem := v_ordem + 1;
    SELECT id, codigo_centro_custo, nome_centro_custo, endereco, latitude, longitude
      INTO v_cc FROM public.bd_centros_custo
     WHERE id = nullif(v_par->>'centro_custo_id','')::uuid;
    IF v_cc.id IS NULL THEN
      RAISE EXCEPTION 'CT4_PARADA_SEM_CENTRO_CUSTO' USING ERRCODE='P0001',
        HINT='Informe a obra/centro de custo de cada parada.';
    END IF;

    INSERT INTO public.bd_ct_viagem_paradas (
      viagem_id, ordem, centro_custo_id, cc_codigo_snapshot, cc_nome_snapshot,
      endereco_snapshot, ponto_exato, latitude, longitude, data_prevista, hora_prevista,
      observacao, recebedor_previsto_funcionario_id, recebedor_previsto_nome_snapshot,
      created_by, updated_by)
    VALUES (
      v_viagem, v_ordem, v_cc.id, v_cc.codigo_centro_custo, v_cc.nome_centro_custo,
      coalesce(nullif(v_par->>'endereco',''), v_cc.endereco),
      nullif(v_par->>'ponto_exato',''),
      coalesce(nullif(v_par->>'latitude','')::numeric, v_cc.latitude),
      coalesce(nullif(v_par->>'longitude','')::numeric, v_cc.longitude),
      nullif(v_par->>'data_prevista','')::date,
      nullif(v_par->>'hora_prevista','')::time,
      nullif(v_par->>'observacao',''),
      nullif(v_par->>'recebedor_previsto_funcionario_id','')::uuid,
      nullif(v_par->>'recebedor_previsto_nome',''),
      v_uid, v_uid)
    RETURNING id INTO v_par_id;

    v_ultimo_cc := v_cc.id;

    FOR v_eq IN SELECT (jsonb_array_elements_text(coalesce(v_par->'equipamentos','[]'::jsonb)))::uuid LOOP
      IF EXISTS (SELECT 1 FROM public.bd_movimentacoes m
                  WHERE m.viagem_id = v_viagem AND m.equipamento_id = v_eq) THEN
        RAISE EXCEPTION 'CT4_EQUIPAMENTO_DUPLICADO' USING ERRCODE='P0001',
          HINT='Um equipamento nao pode ser entregue em duas paradas da mesma viagem.';
      END IF;
      INSERT INTO public.bd_movimentacoes (
        origem_fluxo, solicitacao_id, equipamento_id, viagem_id, parada_id,
        origem_tipo, origem_id, destino_tipo, destino_id,
        tipo_deslocamento, tipo_movimentacao, status, created_by)
      VALUES ('MOVIMENTACAO_DIRETA', NULL, v_eq, v_viagem, v_par_id,
        'CENTRO_CUSTO', v_origem_cc,
        'CENTRO_CUSTO', v_cc.id,
        nullif(p_payload->>'modalidade',''), 'MOVIMENTACAO', 'RASCUNHO', v_uid);
    END LOOP;
  END LOOP;

  /* Ativos participantes da movimentacao que ainda nao tem parada de entrega:
     persistidos na MESMA estrutura de cargas, com parada_id NULL. Nenhuma
     parada fake e nenhum destino inventado. */
  FOR v_eq IN SELECT DISTINCT (jsonb_array_elements_text(coalesce(p_payload->'ativos_planejados','[]'::jsonb)))::uuid LOOP
    IF v_eq IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.bd_movimentacoes m
                        WHERE m.viagem_id = v_viagem AND m.equipamento_id = v_eq) THEN
      INSERT INTO public.bd_movimentacoes (
        origem_fluxo, solicitacao_id, equipamento_id, viagem_id, parada_id,
        origem_tipo, origem_id, destino_tipo, destino_id,
        tipo_deslocamento, tipo_movimentacao, status, created_by)
      VALUES ('MOVIMENTACAO_DIRETA', NULL, v_eq, v_viagem, NULL,
        'CENTRO_CUSTO', v_origem_cc,
        'CENTRO_CUSTO', NULL,
        nullif(p_payload->>'modalidade',''), 'MOVIMENTACAO', 'RASCUNHO', v_uid);
    END IF;
  END LOOP;

  IF v_ultimo_cc IS NOT NULL THEN
    UPDATE public.bd_ct_viagens v SET
      destino_centro_custo_id = v_ultimo_cc,
      destino_cc_codigo_snapshot = c.codigo_centro_custo,
      destino_cc_nome_snapshot = c.nome_centro_custo,
      destino_cc_endereco_snapshot = c.endereco,
      destino_cc_latitude_snapshot = c.latitude,
      destino_cc_longitude_snapshot = c.longitude
    FROM public.bd_centros_custo c
    WHERE v.id = v_viagem AND c.id = v_ultimo_cc;
  END IF;

  v_resp := jsonb_build_object('ok', true, 'replay', false, 'viagem_id', v_viagem,
              'viagem', public.fn_ct_viagem_json(v_viagem));
  INSERT INTO public.bd_ct_comando_requests (request_id, operacao, solicitacao_id, command_hash, response_json, created_by)
  VALUES (p_request_id, 'CT4_MOV_DIRETA_RASCUNHO', NULL, v_hash, v_resp, v_uid);
  RETURN v_resp;
END
$fn$;

CREATE OR REPLACE FUNCTION public.fn_ct_mov_direta_programar(p_viagem_id uuid, p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid(); v_prev jsonb; v_resp jsonb; v record; m record;
  v_paradas int; v_cargas int; v_disp text; v_conf text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT4_AUTH_REQUIRED' USING ERRCODE='P0001', HINT='Sessao expirada. Entre novamente.';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'CT4_REQUEST_ID_OBRIGATORIO' USING ERRCODE='P0001', HINT='Requisicao invalida.';
  END IF;
  IF NOT (public.fn_is_super_admin(v_uid)
          OR public.user_has_permission_action(v_uid,'gestao_maquinas_central_transporte_view','criar')) THEN
    RAISE EXCEPTION 'CT4_FORBIDDEN' USING ERRCODE='P0001', HINT='Sem permissao para programar movimentacoes.';
  END IF;

  SELECT response_json INTO v_prev FROM public.bd_ct_comando_requests WHERE request_id = p_request_id;
  IF v_prev IS NOT NULL THEN RETURN v_prev || jsonb_build_object('replay', true); END IF;

  SELECT * INTO v FROM public.bd_ct_viagens
   WHERE id = p_viagem_id AND origem_fluxo = 'MOVIMENTACAO_DIRETA' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CT4_VIAGEM_NAO_ENCONTRADA' USING ERRCODE='P0001', HINT='Movimentacao inexistente.';
  END IF;
  IF v.status <> 'RASCUNHO' THEN
    RAISE EXCEPTION 'CT4_STATUS_INVALIDO' USING ERRCODE='P0001', HINT='Esta movimentacao ja foi programada.';
  END IF;
  IF v.modalidade_deslocamento IS NULL THEN
    RAISE EXCEPTION 'CT4_MODALIDADE_OBRIGATORIA' USING ERRCODE='P0001', HINT='Informe a modalidade do deslocamento.';
  END IF;
  IF v.data_prevista_saida IS NULL THEN
    RAISE EXCEPTION 'CT4_DATA_OBRIGATORIA' USING ERRCODE='P0001', HINT='Informe a data prevista de saida.';
  END IF;
  IF v.origem_centro_custo_id IS NULL THEN
    RAISE EXCEPTION 'CT4_ORIGEM_OBRIGATORIA' USING ERRCODE='P0001', HINT='Informe o ponto de partida.';
  END IF;
  IF v.modalidade_deslocamento = 'TRANSPORTADO' THEN
    IF v.tipo_transporte = 'PROPRIO' AND (v.veiculo_transportador_id IS NULL OR v.motorista_id IS NULL) THEN
      RAISE EXCEPTION 'CT4_TRANSPORTE_INCOMPLETO' USING ERRCODE='P0001',
        HINT='Selecione o veiculo transportador e o motorista.';
    END IF;
    IF v.tipo_transporte = 'TERCEIRO' AND (v.empresa_transportadora_id IS NULL
        OR v.placa_transportador_snapshot IS NULL OR v.motorista_nome_snapshot IS NULL) THEN
      RAISE EXCEPTION 'CT4_TRANSPORTE_INCOMPLETO' USING ERRCODE='P0001',
        HINT='Informe transportadora, placa e motorista previsto.';
    END IF;
    IF v.tipo_transporte IS NULL THEN
      RAISE EXCEPTION 'CT4_TRANSPORTE_INCOMPLETO' USING ERRCODE='P0001', HINT='Informe o tipo de transporte.';
    END IF;
  END IF;

  SELECT count(*) INTO v_paradas FROM public.bd_ct_viagem_paradas
   WHERE viagem_id = p_viagem_id AND status <> 'CANCELADA';
  IF v_paradas < 1 THEN
    RAISE EXCEPTION 'CT4_SEM_PARADAS' USING ERRCODE='P0001', HINT='Adicione ao menos uma parada.';
  END IF;

  SELECT count(*) INTO v_cargas FROM public.bd_movimentacoes
   WHERE viagem_id = p_viagem_id AND coalesce(status,'') <> 'CANCELADA';
  IF v_cargas < 1 THEN
    RAISE EXCEPTION 'CT4_SEM_EQUIPAMENTOS' USING ERRCODE='P0001',
      HINT='Vincule ao menos um equipamento a uma parada.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.bd_movimentacoes m
              WHERE m.viagem_id = p_viagem_id AND m.parada_id IS NULL
                AND coalesce(m.status,'') <> 'CANCELADA') THEN
    RAISE EXCEPTION 'CT4_ATIVO_SEM_PARADA' USING ERRCODE='P0001',
      HINT='Existem ativos da movimentacao ainda sem parada de entrega.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.bd_ct_viagem_paradas p
              WHERE p.viagem_id = p_viagem_id AND p.status <> 'CANCELADA'
                AND NOT EXISTS (SELECT 1 FROM public.bd_movimentacoes m
                                 WHERE m.parada_id = p.id AND coalesce(m.status,'') <> 'CANCELADA')) THEN
    RAISE EXCEPTION 'CT4_PARADA_SEM_EQUIPAMENTO' USING ERRCODE='P0001',
      HINT='Toda parada precisa de ao menos um equipamento.';
  END IF;

  -- revalidacao autoritativa por equipamento, com lock
  FOR m IN SELECT * FROM public.bd_movimentacoes
            WHERE viagem_id = p_viagem_id AND coalesce(status,'') <> 'CANCELADA'
            ORDER BY id FOR UPDATE LOOP
    SELECT dd.status_operacional INTO v_disp FROM public.bd_disponibilidade_equipamentos dd
     WHERE dd.equipamento_id = m.equipamento_id
     ORDER BY dd.data_inicio DESC NULLS LAST, dd.created_at DESC LIMIT 1;
    IF v_disp IS NULL THEN
      RAISE EXCEPTION 'CT4_DISPONIBILIDADE_SEM_REGISTRO' USING ERRCODE='P0001',
        HINT='Ativo sem registro de disponibilidade. Regularize antes de programar.';
    END IF;
    IF v_disp NOT IN ('DISPONIVEL','ALOCADO') THEN
      RAISE EXCEPTION 'CT4_ATIVO_INDISPONIVEL' USING ERRCODE='P0001',
        HINT='Ativo em manutencao ou indisponivel nao pode ser movimentado.';
    END IF;

    SELECT vv.codigo INTO v_conf FROM public.bd_movimentacoes mm
      JOIN public.bd_ct_viagens vv ON vv.id = mm.viagem_id
     WHERE mm.equipamento_id = m.equipamento_id AND mm.viagem_id <> p_viagem_id
       AND coalesce(mm.status,'') NOT IN ('CANCELADA','CONCLUIDA')
       AND vv.status IN ('PROGRAMADA','EM_TRANSITO','AGUARDANDO_RECEBIMENTO')
     LIMIT 1;
    IF v_conf IS NOT NULL THEN
      RAISE EXCEPTION 'CT4_ATIVO_COMPROMETIDO' USING ERRCODE='P0001',
        HINT='Este equipamento recebeu outro compromisso enquanto o planejamento estava aberto. Atualize a movimentacao e escolha outro ativo.';
    END IF;
  END LOOP;

  UPDATE public.bd_ct_viagens SET status='PROGRAMADA', updated_at=now(), updated_by=v_uid
   WHERE id = p_viagem_id;
  UPDATE public.bd_movimentacoes SET status='PROGRAMADA', updated_at=now()
   WHERE viagem_id = p_viagem_id AND coalesce(status,'') <> 'CANCELADA';

  v_resp := jsonb_build_object('ok', true, 'replay', false, 'status', 'PROGRAMADA',
              'viagem_id', p_viagem_id, 'viagem', public.fn_ct_viagem_json(p_viagem_id));
  INSERT INTO public.bd_ct_comando_requests (request_id, operacao, solicitacao_id, command_hash, response_json, created_by)
  VALUES (p_request_id, 'CT4_MOV_DIRETA_PROGRAMAR', NULL,
          md5(p_viagem_id::text || 'PROGRAMAR'), v_resp, v_uid);
  RETURN v_resp;
END
$fn$;