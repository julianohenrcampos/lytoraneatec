CREATE OR REPLACE FUNCTION public.fn_ct_mov_direta_cancelar(p_viagem_id uuid, p_motivo text, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_prev jsonb;
  v_resp jsonb;
  v record;
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_autor text;
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
  IF length(v_motivo) < 5 THEN
    RAISE EXCEPTION 'CT4_MOTIVO_OBRIGATORIO' USING ERRCODE='P0001', HINT='Informe o motivo do cancelamento.';
  END IF;

  SELECT response_json INTO v_prev FROM public.bd_ct_comando_requests WHERE request_id = p_request_id;
  IF v_prev IS NOT NULL THEN RETURN v_prev || jsonb_build_object('replay', true); END IF;

  SELECT * INTO v FROM public.bd_ct_viagens
   WHERE id = p_viagem_id AND origem_fluxo = 'MOVIMENTACAO_DIRETA' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CT4_VIAGEM_NAO_ENCONTRADA' USING ERRCODE='P0001', HINT='Movimentacao inexistente.';
  END IF;

  /* Idempotencia semantica: ja cancelada nao duplica efeitos. */
  IF v.status = 'CANCELADA' THEN
    RETURN jsonb_build_object('ok', true, 'replay', true, 'viagem_id', p_viagem_id,
                              'status', 'CANCELADA', 'motivo', v_motivo);
  END IF;

  /* Transporte iniciado (ou encerrado) nao pode ter o planejamento cancelado. */
  IF v.status IN ('EM_TRANSITO','AGUARDANDO_RECEBIMENTO','PENDENTE_TRATATIVA') THEN
    RAISE EXCEPTION 'CT4_CANCELAMENTO_APOS_INICIO_NAO_PERMITIDO' USING ERRCODE='P0001',
      HINT='O transporte desta movimentacao ja foi iniciado.';
  END IF;
  IF v.status = 'CONCLUIDA' THEN
    RAISE EXCEPTION 'CT4_STATUS_INVALIDO' USING ERRCODE='P0001', HINT='Movimentacao encerrada nao pode ser cancelada.';
  END IF;
  IF v.status NOT IN ('RASCUNHO','PROGRAMADA') THEN
    RAISE EXCEPTION 'CT4_STATUS_INVALIDO' USING ERRCODE='P0001', HINT='Status atual nao permite cancelamento.';
  END IF;

  SELECT coalesce(nullif(btrim(p.nome_completo), ''), 'Usuario') INTO v_autor
    FROM public.profiles p WHERE p.id = v_uid;

  UPDATE public.bd_ct_viagens
     SET status='CANCELADA',
         observacoes = coalesce(observacoes,'') || E'\n[CANCELAMENTO] ' || v_motivo
                       || ' — por ' || coalesce(v_autor,'Usuario')
                       || ' em ' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
         updated_at=now(), updated_by=v_uid
   WHERE id = p_viagem_id;

  /* Compromisso do ativo e derivado (movimentacao ativa + viagem ativa): cancelar libera. */
  UPDATE public.bd_movimentacoes SET status='CANCELADA', updated_at=now()
   WHERE viagem_id = p_viagem_id AND coalesce(status,'') NOT IN ('CANCELADA','CONCLUIDA');
  UPDATE public.bd_ct_viagem_paradas SET status='CANCELADA', updated_at=now(), updated_by=v_uid
   WHERE viagem_id = p_viagem_id AND status NOT IN ('CONCLUIDA','CANCELADA');

  v_resp := jsonb_build_object('ok', true, 'replay', false, 'viagem_id', p_viagem_id,
                               'status', 'CANCELADA', 'motivo', v_motivo);
  INSERT INTO public.bd_ct_comando_requests (request_id, operacao, solicitacao_id, command_hash, response_json, created_by)
  VALUES (p_request_id, 'CT4_MOV_DIRETA_CANCELAR', NULL,
          md5(p_viagem_id::text || 'CANCELAR'), v_resp, v_uid);

  PERFORM public.fn_notificacao_ct_viagem_evento(
    p_viagem_id, 'ct_viagem_cancelada', 'Viagem cancelada', p_request_id, v_uid);

  RETURN v_resp;
END $function$;