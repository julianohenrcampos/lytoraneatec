-- N3.2 parte 2: emissão dos eventos de viagem CT dentro das RPCs de comando

CREATE OR REPLACE FUNCTION public.fn_ct_mobilizacao_programar(p_planejamento_id uuid, p_versao_esperada integer, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_sa boolean;
  v_plan public.bd_solicitacoes_planejamento;
  v_cmd text;
  v_led record;
  v_v uuid;
  v_resp jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT2_AUTH_REQUIRED' USING ERRCODE='P0001', HINT='Sessao expirada. Entre novamente para continuar.';
  END IF;
  IF p_planejamento_id IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'CT2_PARAMETROS_INVALIDOS' USING ERRCODE='P0001', HINT='Parametros obrigatorios ausentes.';
  END IF;

  SELECT * INTO v_plan FROM public.bd_solicitacoes_planejamento WHERE id = p_planejamento_id;
  IF v_plan.id IS NULL THEN
    RAISE EXCEPTION 'CT3C_PLANEJAMENTO_NAO_ENCONTRADO' USING ERRCODE='P0001', HINT='Planejamento inexistente.';
  END IF;

  v_sa := public.fn_is_super_admin(v_uid);
  IF NOT v_sa THEN
    IF NOT public.user_has_permission_action(v_uid,'gestao_maquinas_central_transporte_view','aprovar') THEN
      RAISE EXCEPTION 'CT2_FORBIDDEN' USING ERRCODE='P0001', HINT='Sem permissao para programar a mobilizacao.';
    END IF;
    IF NOT public.fn_ativos_can_access_solicitacao(v_plan.solicitacao_id, v_uid) THEN
      RAISE EXCEPTION 'CT2_SCOPE_DENIED' USING ERRCODE='P0001', HINT='Solicitacao fora do seu escopo de acesso.';
    END IF;
  END IF;

  v_cmd := public.fn_ct_mob_command_hash('MOB_PROGRAMAR', v_plan.solicitacao_id, p_planejamento_id, p_versao_esperada, NULL, NULL);
  PERFORM pg_advisory_xact_lock(hashtextextended('ct3c:req:' || p_request_id::text, 0));
  SELECT * INTO v_led FROM public.bd_ct_comando_requests WHERE request_id = p_request_id;
  IF v_led.request_id IS NOT NULL THEN
    IF v_led.command_hash = v_cmd THEN
      RETURN v_led.response_json || jsonb_build_object('replay', true);
    END IF;
    RAISE EXCEPTION 'CT3_IDEMPOTENCY_KEY_REUSED' USING ERRCODE='P0001', HINT='Esta operacao ja foi usada com outro conteudo. Recarregue a pagina.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('ct3c:plan:' || v_plan.solicitacao_id::text, 0));
  SELECT * INTO v_plan FROM public.bd_solicitacoes_planejamento WHERE id = p_planejamento_id FOR UPDATE;

  IF v_plan.status_planejamento <> 'RASCUNHO' THEN
    RAISE EXCEPTION 'CT3C_PLANEJAMENTO_IMUTAVEL' USING ERRCODE='P0001', HINT='Somente um rascunho pode ser programado.';
  END IF;
  IF p_versao_esperada IS NOT NULL AND p_versao_esperada <> v_plan.lock_version THEN
    RAISE EXCEPTION 'CT3C_VERSAO_SUPERADA' USING ERRCODE='P0001', HINT='Este rascunho foi alterado. Recarregue a pagina.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.bd_ct_viagens v
     WHERE v.planejamento_id = v_plan.id AND v.status = 'RASCUNHO'
       AND EXISTS (SELECT 1 FROM public.bd_movimentacoes m
                    WHERE m.viagem_id = v.id AND coalesce(m.status,'') <> 'CANCELADA')
  ) THEN
    RAISE EXCEPTION 'CT3C_SEM_VIAGENS' USING ERRCODE='P0001', HINT='Crie ao menos uma viagem com ativos antes de programar.';
  END IF;

  FOR v_v IN SELECT id FROM public.bd_ct_viagens
              WHERE planejamento_id = v_plan.id AND status = 'RASCUNHO' LOOP
    PERFORM public.fn_ct_mob_validar_viagem(v_v);
  END LOOP;

  UPDATE public.bd_ct_viagens SET status='PROGRAMADA', updated_by=v_uid
   WHERE planejamento_id = v_plan.id AND status='RASCUNHO';

  UPDATE public.bd_movimentacoes SET status='PROGRAMADA', updated_at=now()
   WHERE planejamento_id = v_plan.id AND coalesce(status,'') = 'RASCUNHO';

  UPDATE public.bd_solicitacoes_planejamento
     SET vigente = false, updated_at = now(), updated_by = v_uid
   WHERE solicitacao_id = v_plan.solicitacao_id AND vigente AND id <> v_plan.id;

  UPDATE public.bd_solicitacoes_planejamento
     SET status_planejamento='PROGRAMADO', vigente=true, programado_em=now(),
         programado_por=v_uid, lock_version=lock_version+1, updated_by=v_uid, updated_at=now()
   WHERE id = v_plan.id
   RETURNING * INTO v_plan;

  v_resp := jsonb_build_object('ok', true, 'replay', false,
    'planejamento_id', v_plan.id, 'versao', v_plan.versao, 'lock_version', v_plan.lock_version,
    'status', v_plan.status_planejamento, 'viagens', public.fn_ct_mob_viagens_json(v_plan.id));

  INSERT INTO public.bd_ct_comando_requests (request_id, operacao, solicitacao_id, planejamento_id, command_hash, response_json, created_by)
  VALUES (p_request_id, 'MOB_PROGRAMAR', v_plan.solicitacao_id, v_plan.id, v_cmd, v_resp, v_uid);

  -- N3.2: evento identificado pelo comando (request_id)
  FOR v_v IN SELECT id FROM public.bd_ct_viagens
              WHERE planejamento_id = v_plan.id AND status = 'PROGRAMADA' LOOP
    PERFORM public.fn_notificacao_ct_viagem_evento(
      v_v, 'ct_viagem_programada', 'Mobilização programada', p_request_id, v_uid);
  END LOOP;

  RETURN v_resp;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_ct_mobilizacao_cancelar(p_planejamento_id uuid, p_versao_esperada integer, p_motivo text, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_sa boolean;
  v_plan public.bd_solicitacoes_planejamento;
  v_cmd text;
  v_led record;
  v_resp jsonb;
  v_v uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT2_AUTH_REQUIRED' USING ERRCODE='P0001', HINT='Sessao expirada. Entre novamente para continuar.';
  END IF;
  IF p_planejamento_id IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'CT2_PARAMETROS_INVALIDOS' USING ERRCODE='P0001', HINT='Parametros obrigatorios ausentes.';
  END IF;

  SELECT * INTO v_plan FROM public.bd_solicitacoes_planejamento WHERE id = p_planejamento_id;
  IF v_plan.id IS NULL THEN
    RAISE EXCEPTION 'CT3C_PLANEJAMENTO_NAO_ENCONTRADO' USING ERRCODE='P0001', HINT='Planejamento inexistente.';
  END IF;

  v_sa := public.fn_is_super_admin(v_uid);
  IF NOT v_sa THEN
    IF NOT public.user_has_permission_action(v_uid,'gestao_maquinas_central_transporte_view','editar') THEN
      RAISE EXCEPTION 'CT2_FORBIDDEN' USING ERRCODE='P0001', HINT='Sem permissao para cancelar o rascunho.';
    END IF;
    IF NOT public.fn_ativos_can_access_solicitacao(v_plan.solicitacao_id, v_uid) THEN
      RAISE EXCEPTION 'CT2_SCOPE_DENIED' USING ERRCODE='P0001', HINT='Solicitacao fora do seu escopo de acesso.';
    END IF;
  END IF;

  v_cmd := public.fn_ct_mob_command_hash('MOB_CANCELAR', v_plan.solicitacao_id, p_planejamento_id, p_versao_esperada, p_motivo, NULL);
  PERFORM pg_advisory_xact_lock(hashtextextended('ct3c:req:' || p_request_id::text, 0));
  SELECT * INTO v_led FROM public.bd_ct_comando_requests WHERE request_id = p_request_id;
  IF v_led.request_id IS NOT NULL THEN
    IF v_led.command_hash = v_cmd THEN
      RETURN v_led.response_json || jsonb_build_object('replay', true);
    END IF;
    RAISE EXCEPTION 'CT3_IDEMPOTENCY_KEY_REUSED' USING ERRCODE='P0001', HINT='Esta operacao ja foi usada com outro conteudo. Recarregue a pagina.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('ct3c:plan:' || v_plan.solicitacao_id::text, 0));
  SELECT * INTO v_plan FROM public.bd_solicitacoes_planejamento WHERE id = p_planejamento_id FOR UPDATE;

  IF v_plan.status_planejamento <> 'RASCUNHO' THEN
    RAISE EXCEPTION 'CT3C_PLANEJAMENTO_IMUTAVEL' USING ERRCODE='P0001', HINT='Somente rascunhos podem ser cancelados.';
  END IF;
  IF p_versao_esperada IS NOT NULL AND p_versao_esperada <> v_plan.lock_version THEN
    RAISE EXCEPTION 'CT3C_VERSAO_SUPERADA' USING ERRCODE='P0001', HINT='Este rascunho foi alterado. Recarregue a pagina.';
  END IF;

  UPDATE public.bd_movimentacoes SET status='CANCELADA', updated_at=now()
   WHERE planejamento_id = v_plan.id AND coalesce(status,'') <> 'CANCELADA';
  UPDATE public.bd_ct_viagens SET status='CANCELADA', updated_by=v_uid
   WHERE planejamento_id = v_plan.id AND status <> 'CANCELADA';
  UPDATE public.bd_solicitacoes_planejamento
     SET status_planejamento='CANCELADO', vigente=false,
         observacoes = coalesce(nullif(btrim(coalesce(p_motivo,'')),''), observacoes),
         lock_version = lock_version + 1, updated_by = v_uid, updated_at = now()
   WHERE id = v_plan.id RETURNING * INTO v_plan;

  v_resp := jsonb_build_object('ok', true, 'replay', false,
    'planejamento_id', v_plan.id, 'versao', v_plan.versao,
    'lock_version', v_plan.lock_version, 'status', v_plan.status_planejamento);

  INSERT INTO public.bd_ct_comando_requests (request_id, operacao, solicitacao_id, planejamento_id, command_hash, response_json, created_by)
  VALUES (p_request_id, 'MOB_CANCELAR', v_plan.solicitacao_id, v_plan.id, v_cmd, v_resp, v_uid);

  -- N3.2: evento identificado pelo comando (request_id)
  FOR v_v IN SELECT id FROM public.bd_ct_viagens
              WHERE planejamento_id = v_plan.id AND status = 'CANCELADA' LOOP
    PERFORM public.fn_notificacao_ct_viagem_evento(
      v_v, 'ct_viagem_cancelada', 'Viagem cancelada', p_request_id, v_uid);
  END LOOP;

  RETURN v_resp;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_ct_mov_direta_programar(p_viagem_id uuid, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid(); v_prev jsonb; v_resp jsonb; v record; m record;
  v_paradas int; v_cargas int; v_disp text; v_conf text; v_os text;
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

    SELECT os.numero_os INTO v_os FROM public.bd_ordens_servico os
     WHERE os.caminhao_equipamento_id = m.equipamento_id
       AND os.status IN ('Aberta','Em Andamento') LIMIT 1;
    IF v_os IS NOT NULL THEN
      RAISE EXCEPTION 'CT4_ATIVO_EM_MANUTENCAO' USING ERRCODE='P0001',
        HINT='Ativo com ordem de servico de manutencao aberta (OS ' || v_os || '). Conclua a OS antes de movimentar.';
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

  PERFORM public.fn_notificacao_ct_viagem_evento(
    p_viagem_id, 'ct_viagem_programada', 'Mobilização programada', p_request_id, v_uid);

  RETURN v_resp;
END $function$;

CREATE OR REPLACE FUNCTION public.fn_ct_mov_direta_cancelar(p_viagem_id uuid, p_motivo text, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_prev jsonb; v_resp jsonb; v record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT4_AUTH_REQUIRED' USING ERRCODE='P0001', HINT='Sessao expirada. Entre novamente.';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'CT4_REQUEST_ID_OBRIGATORIO' USING ERRCODE='P0001', HINT='Requisicao invalida.';
  END IF;
  IF NOT (public.fn_is_super_admin(v_uid)
          OR public.user_has_permission_action(v_uid,'gestao_maquinas_central_transporte_view','aprovar')) THEN
    RAISE EXCEPTION 'CT4_FORBIDDEN' USING ERRCODE='P0001', HINT='Sem permissao para cancelar movimentacoes.';
  END IF;
  SELECT response_json INTO v_prev FROM public.bd_ct_comando_requests WHERE request_id = p_request_id;
  IF v_prev IS NOT NULL THEN RETURN v_prev || jsonb_build_object('replay', true); END IF;

  SELECT * INTO v FROM public.bd_ct_viagens
   WHERE id = p_viagem_id AND origem_fluxo = 'MOVIMENTACAO_DIRETA' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CT4_VIAGEM_NAO_ENCONTRADA' USING ERRCODE='P0001', HINT='Movimentacao inexistente.';
  END IF;
  IF v.status IN ('CONCLUIDA','CANCELADA') THEN
    RAISE EXCEPTION 'CT4_STATUS_INVALIDO' USING ERRCODE='P0001', HINT='Movimentacao encerrada nao pode ser cancelada.';
  END IF;

  UPDATE public.bd_ct_viagens
     SET status='CANCELADA',
         observacoes = coalesce(observacoes,'') || E'\n[CANCELAMENTO] ' || coalesce(p_motivo,''),
         updated_at=now(), updated_by=v_uid
   WHERE id = p_viagem_id;
  UPDATE public.bd_movimentacoes SET status='CANCELADA', updated_at=now()
   WHERE viagem_id = p_viagem_id AND coalesce(status,'') NOT IN ('CANCELADA','CONCLUIDA');
  UPDATE public.bd_ct_viagem_paradas SET status='CANCELADA', updated_at=now(), updated_by=v_uid
   WHERE viagem_id = p_viagem_id AND status NOT IN ('CONCLUIDA','CANCELADA');

  v_resp := jsonb_build_object('ok', true, 'replay', false, 'status', 'CANCELADA');
  INSERT INTO public.bd_ct_comando_requests (request_id, operacao, solicitacao_id, command_hash, response_json, created_by)
  VALUES (p_request_id, 'CT4_MOV_DIRETA_CANCELAR', NULL,
          md5(p_viagem_id::text || 'CANCELAR'), v_resp, v_uid);

  PERFORM public.fn_notificacao_ct_viagem_evento(
    p_viagem_id, 'ct_viagem_cancelada', 'Viagem cancelada', p_request_id, v_uid);

  RETURN v_resp;
END $function$;

CREATE OR REPLACE FUNCTION public.fn_ct_viagem_iniciar(p_viagem_id uuid, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_func uuid; v record; v_prev jsonb; v_pend int; v_resp jsonb;
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
  INSERT INTO public.bd_ct_comando_requests (request_id, operacao, solicitacao_id, command_hash, response_json, created_by)
  VALUES (p_request_id, 'CT3E_VIAGEM_INICIAR', v.solicitacao_id,
          md5(p_viagem_id::text || 'INICIAR'), v_resp, v_uid);

  PERFORM public.fn_notificacao_ct_viagem_evento(
    p_viagem_id, 'ct_viagem_iniciada', 'Entrega iniciada', p_request_id, v_uid);

  RETURN v_resp;
END $function$;

CREATE OR REPLACE FUNCTION public.fn_ct_viagem_registrar_chegada(p_viagem_id uuid, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_func uuid; v record; v_prev jsonb; v_resp jsonb;
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
  IF EXISTS (SELECT 1 FROM public.bd_ct_viagem_paradas pp
              WHERE pp.viagem_id = p_viagem_id AND pp.status <> 'CANCELADA') THEN
    RAISE EXCEPTION 'CT4_USE_CHEGADA_POR_PARADA' USING ERRCODE='P0001',
      HINT='Esta viagem possui paradas: registre a chegada parada a parada.';
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
  ON CONFLICT (viagem_id) WHERE parada_id IS NULL DO NOTHING;

  v_resp := jsonb_build_object('ok', true, 'replay', false, 'status', 'AGUARDANDO_RECEBIMENTO');
  INSERT INTO public.bd_ct_comando_requests (request_id, operacao, solicitacao_id, command_hash, response_json, created_by)
  VALUES (p_request_id, 'CT3E_VIAGEM_CHEGADA', v.solicitacao_id,
          md5(p_viagem_id::text || 'CHEGADA'), v_resp, v_uid);

  PERFORM public.fn_notificacao_ct_viagem_evento(
    p_viagem_id, 'ct_viagem_aguardando_recebimento',
    'Aguardando confirmação de recebimento', p_request_id, v_uid);

  RETURN v_resp;
END $function$;

CREATE OR REPLACE FUNCTION public.fn_ct_parada_registrar_chegada(p_parada_id uuid, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_func uuid; v_prev jsonb; v_resp jsonb; p record; v record; v_pend int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT3E_AUTH_REQUIRED' USING ERRCODE='P0001', HINT='Sessao expirada. Entre novamente.';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'CT3E_REQUEST_ID_OBRIGATORIO' USING ERRCODE='P0001', HINT='Requisicao invalida.';
  END IF;
  SELECT response_json INTO v_prev FROM public.bd_ct_comando_requests WHERE request_id = p_request_id;
  IF v_prev IS NOT NULL THEN RETURN v_prev || jsonb_build_object('replay', true); END IF;

  SELECT * INTO p FROM public.bd_ct_viagem_paradas WHERE id = p_parada_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CT4_PARADA_NAO_ENCONTRADA' USING ERRCODE='P0001', HINT='Parada inexistente.';
  END IF;
  SELECT * INTO v FROM public.bd_ct_viagens WHERE id = p.viagem_id FOR UPDATE;

  v_func := public.fn_ativos_profile_funcionario_id(v_uid);
  IF NOT (public.fn_is_super_admin(v_uid)
          OR (v_func IS NOT NULL AND v_func = v.motorista_id
              AND public.fn_ct_cap(v_uid,'iniciar_viagem'))) THEN
    RAISE EXCEPTION 'CT3E_FORBIDDEN' USING ERRCODE='P0001', HINT='Somente o motorista registra a chegada.';
  END IF;
  IF v.status <> 'EM_TRANSITO' THEN
    RAISE EXCEPTION 'CT3E_STATUS_INVALIDO' USING ERRCODE='P0001', HINT='A viagem nao esta em transito.';
  END IF;
  IF p.status <> 'PENDENTE' THEN
    RAISE EXCEPTION 'CT4_PARADA_STATUS_INVALIDO' USING ERRCODE='P0001', HINT='Esta parada ja foi registrada.';
  END IF;
  SELECT count(*) INTO v_pend FROM public.bd_ct_viagem_paradas
   WHERE viagem_id = p.viagem_id AND status = 'PENDENTE' AND ordem < p.ordem;
  IF v_pend > 0 THEN
    RAISE EXCEPTION 'CT4_PARADA_FORA_DE_ORDEM' USING ERRCODE='P0001',
      HINT='Conclua a parada anterior antes de registrar esta chegada.';
  END IF;

  UPDATE public.bd_ct_viagem_paradas
     SET status='CHEGADA_REGISTRADA', chegada_registrada_em=now(),
         chegada_registrada_por=v_uid, updated_at=now(), updated_by=v_uid
   WHERE id = p_parada_id;

  UPDATE public.bd_ct_viagens
     SET status='AGUARDANDO_RECEBIMENTO',
         chegada_registrada_em = coalesce(chegada_registrada_em, now()),
         chegada_registrada_por = coalesce(chegada_registrada_por, v_uid),
         updated_at=now(), updated_by=v_uid
   WHERE id = p.viagem_id;

  INSERT INTO public.bd_ct_recebimentos (viagem_id, parada_id, status, recebedor_previsto_id,
         recebedor_nome_snapshot, created_by)
  VALUES (p.viagem_id, p_parada_id, 'RASCUNHO',
          coalesce(p.recebedor_previsto_funcionario_id, v.recebedor_previsto_funcionario_id),
          coalesce(p.recebedor_previsto_nome_snapshot, v.recebedor_previsto_nome_snapshot), v_uid)
  ON CONFLICT (parada_id) WHERE parada_id IS NOT NULL DO NOTHING;

  v_resp := jsonb_build_object('ok', true, 'replay', false, 'parada_id', p_parada_id,
              'status', 'AGUARDANDO_RECEBIMENTO');
  INSERT INTO public.bd_ct_comando_requests (request_id, operacao, solicitacao_id, command_hash, response_json, created_by)
  VALUES (p_request_id, 'CT4_PARADA_CHEGADA', v.solicitacao_id,
          md5(p_parada_id::text || 'CHEGADA'), v_resp, v_uid);

  PERFORM public.fn_notificacao_ct_viagem_evento(
    p.viagem_id, 'ct_viagem_aguardando_recebimento',
    'Aguardando confirmação de recebimento', p_request_id, v_uid);

  RETURN v_resp;
END $function$;
