-- ============ Correcao do trecho invalido em salvar_rascunho ============
CREATE OR REPLACE FUNCTION public.fn_ct_mob_validar_viagem(p_viagem_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  v public.bd_ct_viagens;
  v_qtd integer;
  v_min date;
BEGIN
  SELECT * INTO v FROM public.bd_ct_viagens WHERE id = p_viagem_id;

  SELECT count(*), min(a.periodo_inicio) INTO v_qtd, v_min
    FROM public.bd_movimentacoes m
    JOIN public.bd_solicitacao_item_atendimentos a ON a.id = m.atendimento_id
   WHERE m.viagem_id = v.id AND coalesce(m.status,'') <> 'CANCELADA';

  IF v_qtd = 0 THEN
    RAISE EXCEPTION 'CT3C_VIAGEM_SEM_ATIVOS' USING ERRCODE='P0001',
      HINT='Toda viagem precisa de ao menos um ativo.';
  END IF;
  IF v.modalidade_deslocamento IS NULL THEN
    RAISE EXCEPTION 'CT3C_MODALIDADE_INVALIDA' USING ERRCODE='P0001',
      HINT='Escolha a modalidade da viagem: rodante ou transportado.';
  END IF;
  IF v.data_prevista_entrega IS NULL THEN
    RAISE EXCEPTION 'CT3C_DATA_MOBILIZACAO_OBRIGATORIA' USING ERRCODE='P0001',
      HINT='Informe a data programada da mobilizacao em todas as viagens.';
  END IF;
  IF v.data_prevista_saida IS NOT NULL AND v.data_prevista_saida > v.data_prevista_entrega THEN
    RAISE EXCEPTION 'CT3C_DATAS_INCOERENTES' USING ERRCODE='P0001',
      HINT='A data de saida nao pode ser posterior a data da mobilizacao.';
  END IF;
  IF v_min IS NOT NULL AND v.data_prevista_entrega > v_min THEN
    RAISE EXCEPTION 'CT3C_ENTREGA_APOS_PERIODO' USING ERRCODE='P0001',
      HINT='A data da mobilizacao deve ser anterior ou igual ao inicio do periodo reservado.';
  END IF;
  IF v.origem_centro_custo_id IS NULL OR v.destino_centro_custo_id IS NULL THEN
    RAISE EXCEPTION 'CT3C_ORIGEM_DESTINO_OBRIGATORIOS' USING ERRCODE='P0001',
      HINT='Informe o centro de custo de origem e de destino.';
  END IF;

  IF v.modalidade_deslocamento = 'RODANTE' THEN
    IF v_qtd <> 1 THEN
      RAISE EXCEPTION 'CT3C_RODANTE_UM_ATIVO' USING ERRCODE='P0001',
        HINT='Uma viagem rodante transporta exatamente um ativo.';
    END IF;
    IF v.motorista_id IS NULL THEN
      RAISE EXCEPTION 'CT3C_MOTORISTA_OBRIGATORIO' USING ERRCODE='P0001',
        HINT='Informe o motorista ou operador da viagem rodante.';
    END IF;
  ELSE
    IF v.tipo_transporte = 'PROPRIO' THEN
      IF v.veiculo_transportador_id IS NULL OR v.motorista_id IS NULL THEN
        RAISE EXCEPTION 'CT3C_TRANSPORTE_PROPRIO_INCOMPLETO' USING ERRCODE='P0001',
          HINT='Transporte proprio exige veiculo transportador e motorista.';
      END IF;
    ELSIF v.tipo_transporte = 'TERCEIRO' THEN
      IF v.empresa_transportadora_id IS NULL
         OR coalesce(btrim(v.placa_transportador_snapshot),'') = ''
         OR coalesce(btrim(v.motorista_nome_snapshot),'') = '' THEN
        RAISE EXCEPTION 'CT3C_TRANSPORTE_TERCEIRO_INCOMPLETO' USING ERRCODE='P0001',
          HINT='Transporte de terceiro exige transportadora, placa e nome do motorista.';
      END IF;
    ELSE
      RAISE EXCEPTION 'CT3C_TIPO_TRANSPORTE_INVALIDO' USING ERRCODE='P0001',
        HINT='Informe se o transporte e proprio ou de terceiro.';
    END IF;
  END IF;
END;
$$;

-- ============ PROGRAMAR ============
DROP FUNCTION IF EXISTS public.fn_ct_mobilizacao_programar(uuid, uuid, uuid);
CREATE OR REPLACE FUNCTION public.fn_ct_mobilizacao_programar(
  p_planejamento_id uuid, p_versao_esperada integer, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
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

  RETURN v_resp;
END;
$function$;

-- ============ CANCELAR ============
CREATE OR REPLACE FUNCTION public.fn_ct_mobilizacao_cancelar(
  p_planejamento_id uuid, p_versao_esperada integer, p_motivo text, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_sa boolean;
  v_plan public.bd_solicitacoes_planejamento;
  v_cmd text;
  v_led record;
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

  RETURN v_resp;
END;
$function$;

-- ============ NOVA REVISAO ============
CREATE OR REPLACE FUNCTION public.fn_ct_mobilizacao_nova_revisao(
  p_planejamento_id uuid, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_sa boolean;
  v_base public.bd_solicitacoes_planejamento;
  v_nova public.bd_solicitacoes_planejamento;
  v_cmd text;
  v_led record;
  v_resp jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT2_AUTH_REQUIRED' USING ERRCODE='P0001', HINT='Sessao expirada. Entre novamente para continuar.';
  END IF;
  IF p_planejamento_id IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'CT2_PARAMETROS_INVALIDOS' USING ERRCODE='P0001', HINT='Parametros obrigatorios ausentes.';
  END IF;

  SELECT * INTO v_base FROM public.bd_solicitacoes_planejamento WHERE id = p_planejamento_id;
  IF v_base.id IS NULL THEN
    RAISE EXCEPTION 'CT3C_PLANEJAMENTO_NAO_ENCONTRADO' USING ERRCODE='P0001', HINT='Planejamento inexistente.';
  END IF;

  v_sa := public.fn_is_super_admin(v_uid);
  IF NOT v_sa THEN
    IF NOT public.user_has_permission_action(v_uid,'gestao_maquinas_central_transporte_view','editar') THEN
      RAISE EXCEPTION 'CT2_FORBIDDEN' USING ERRCODE='P0001', HINT='Sem permissao para revisar a mobilizacao.';
    END IF;
    IF NOT public.fn_ativos_can_access_solicitacao(v_base.solicitacao_id, v_uid) THEN
      RAISE EXCEPTION 'CT2_SCOPE_DENIED' USING ERRCODE='P0001', HINT='Solicitacao fora do seu escopo de acesso.';
    END IF;
  END IF;

  v_cmd := public.fn_ct_mob_command_hash('MOB_NOVA_REVISAO', v_base.solicitacao_id, p_planejamento_id, NULL, NULL, NULL);
  PERFORM pg_advisory_xact_lock(hashtextextended('ct3c:req:' || p_request_id::text, 0));
  SELECT * INTO v_led FROM public.bd_ct_comando_requests WHERE request_id = p_request_id;
  IF v_led.request_id IS NOT NULL THEN
    IF v_led.command_hash = v_cmd THEN
      RETURN v_led.response_json || jsonb_build_object('replay', true);
    END IF;
    RAISE EXCEPTION 'CT3_IDEMPOTENCY_KEY_REUSED' USING ERRCODE='P0001', HINT='Esta operacao ja foi usada com outro conteudo. Recarregue a pagina.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('ct3c:plan:' || v_base.solicitacao_id::text, 0));

  IF v_base.status_planejamento <> 'PROGRAMADO' THEN
    RAISE EXCEPTION 'CT3C_REVISAO_INVALIDA' USING ERRCODE='P0001', HINT='Somente um planejamento programado pode ser revisado.';
  END IF;

  SELECT * INTO v_nova FROM public.bd_solicitacoes_planejamento
   WHERE solicitacao_id = v_base.solicitacao_id AND status_planejamento = 'RASCUNHO' LIMIT 1;

  IF v_nova.id IS NULL THEN
    INSERT INTO public.bd_solicitacoes_planejamento (
      solicitacao_id, versao, vigente, status_planejamento, created_by, updated_by,
      revisao_de_planejamento_id, request_id
    ) VALUES (
      v_base.solicitacao_id,
      (SELECT coalesce(max(versao),0)+1 FROM public.bd_solicitacoes_planejamento WHERE solicitacao_id = v_base.solicitacao_id),
      false, 'RASCUNHO', v_uid, v_uid, v_base.id, p_request_id
    ) RETURNING * INTO v_nova;
  END IF;

  v_resp := jsonb_build_object('ok', true, 'replay', false,
    'planejamento_id', v_nova.id, 'versao', v_nova.versao, 'lock_version', v_nova.lock_version,
    'status', v_nova.status_planejamento, 'revisao_de_planejamento_id', v_base.id);

  INSERT INTO public.bd_ct_comando_requests (request_id, operacao, solicitacao_id, planejamento_id, command_hash, response_json, created_by)
  VALUES (p_request_id, 'MOB_NOVA_REVISAO', v_base.solicitacao_id, v_nova.id, v_cmd, v_resp, v_uid);

  RETURN v_resp;
END;
$function$;

-- ============ ACL ============
REVOKE ALL ON FUNCTION public.fn_ct_mobilizacao_estado(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_ct_mobilizacao_salvar_rascunho(uuid,uuid,integer,jsonb,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_ct_mobilizacao_programar(uuid,integer,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_ct_mobilizacao_cancelar(uuid,integer,text,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_ct_mobilizacao_nova_revisao(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_ct_mobilizacao_estado(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_ct_mobilizacao_salvar_rascunho(uuid,uuid,integer,jsonb,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_ct_mobilizacao_programar(uuid,integer,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_ct_mobilizacao_cancelar(uuid,integer,text,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_ct_mobilizacao_nova_revisao(uuid,uuid) TO authenticated, service_role;