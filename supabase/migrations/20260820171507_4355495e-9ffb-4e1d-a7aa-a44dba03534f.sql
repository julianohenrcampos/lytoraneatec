-- Helper interno: aplica apenas a dimensão temporal via função autoritativa existente
CREATE OR REPLACE FUNCTION public.fn_desmob_aplicar_previsao(
  p_equipamento_id uuid,
  p_previsao date,
  p_motivo text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_disp record;
  v_status text;
  v_cc uuid;
  v_ini date;
  v_obs text;
  v_hoje date := (public.fn_server_now_brt())::date;
BEGIN
  SELECT x.status_operacional::text AS status_operacional, x.centro_custo_id, x.data_inicio,
         x.observacao, x.motivo_risco
    INTO v_disp
    FROM public.bd_disponibilidade_equipamentos x
   WHERE x.equipamento_id = p_equipamento_id
   ORDER BY x.updated_at DESC NULLS LAST, x.created_at DESC NULLS LAST, x.id DESC
   LIMIT 1;

  SELECT coalesce(v_disp.status_operacional, 'ALOCADO'),
         coalesce(v_disp.centro_custo_id, e.centro_custo_atual_id),
         coalesce(v_disp.data_inicio, v_hoje)
    INTO v_status, v_cc, v_ini
    FROM public.bd_caminhoes_equipamentos e
   WHERE e.id = p_equipamento_id;

  v_obs := nullif(btrim(coalesce(v_disp.observacao, '')), '');
  v_obs := CASE WHEN v_obs IS NULL THEN p_motivo ELSE v_obs || E'\n' || p_motivo END;

  PERFORM public.fn_ct_disponibilidade_upsert(
    p_equipamento_id,
    v_status,
    p_previsao,
    v_cc,
    'ALTA',
    v_ini,
    v_disp.motivo_risco,
    left(v_obs, 4000),
    'Ajuste temporal automatico decorrente de solicitacao de desmobilizacao registrada e autorizada no modulo de Solicitacoes de Equipamento.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_desmob_aplicar_previsao(uuid, date, text) FROM PUBLIC, anon, authenticated;

-- 1) SOLICITAR
CREATE OR REPLACE FUNCTION public.fn_desmobilizacao_solicitar(
  p_equipamento_id uuid,
  p_engenheiro_responsavel_id uuid,
  p_engenheiro_solicitante_id uuid,
  p_data_retirada date,
  p_hora_retirada time without time zone DEFAULT NULL,
  p_observacoes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sa boolean;
  v_equip record;
  v_hoje date := (public.fn_server_now_brt())::date;
  v_exige boolean;
  v_prev_atual date;
  v_status text;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'DESMOB_AUTH_REQUIRED' USING ERRCODE='P0001', HINT='Sessao expirada. Entre novamente.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_uid) THEN
    RAISE EXCEPTION 'DESMOB_PROFILE_NOT_FOUND' USING ERRCODE='P0001', HINT='Perfil inexistente.';
  END IF;

  v_sa := public.fn_is_super_admin(v_uid);
  IF NOT v_sa AND NOT public.fn_ativos_can_access_equipamento(p_equipamento_id, v_uid) THEN
    RAISE EXCEPTION 'DESMOB_SCOPE_DENIED' USING ERRCODE='P0001', HINT='Equipamento fora do seu escopo de acesso.';
  END IF;

  IF p_data_retirada IS NULL THEN
    RAISE EXCEPTION 'DESMOB_DATA_OBRIGATORIA' USING ERRCODE='P0001', HINT='Informe a data disponivel para retirada.';
  END IF;
  IF p_data_retirada < v_hoje THEN
    RAISE EXCEPTION 'DESMOB_DATA_RETROATIVA' USING ERRCODE='P0001', HINT='A data de retirada nao pode ser anterior a data operacional de hoje.';
  END IF;

  IF p_engenheiro_responsavel_id IS NULL OR p_engenheiro_solicitante_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_engenheiro_responsavel_id)
     OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_engenheiro_solicitante_id) THEN
    RAISE EXCEPTION 'DESMOB_ENGENHEIRO_INVALIDO' USING ERRCODE='P0001', HINT='Engenheiro responsavel/solicitante invalido.';
  END IF;

  SELECT e.id, e.centro_custo_atual_id
    INTO v_equip
    FROM public.bd_caminhoes_equipamentos e
   WHERE e.id = p_equipamento_id
   FOR UPDATE;

  IF v_equip.id IS NULL THEN
    RAISE EXCEPTION 'DESMOB_EQUIPAMENTO_NAO_ENCONTRADO' USING ERRCODE='P0001', HINT='Equipamento inexistente.';
  END IF;
  IF v_equip.centro_custo_atual_id IS NULL THEN
    RAISE EXCEPTION 'ATIVO_SEM_CC_ORIGEM' USING ERRCODE='P0001',
      HINT='O ativo nao possui centro de custo atual: nao existe desmobilizacao a ser solicitada.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bd_solicitacoes_desmobilizacao d
     WHERE d.equipamento_id = p_equipamento_id
       AND d.status IN ('PENDENTE_APROVACAO','APROVADA')
  ) THEN
    RAISE EXCEPTION 'DESMOB_SOLICITACAO_VIVA_EXISTENTE' USING ERRCODE='P0001',
      HINT='Ja existe uma solicitacao de desmobilizacao viva para este ativo.';
  END IF;

  SELECT (c.valor = 'true') INTO v_exige
    FROM public.bd_configuracoes_sistema c
   WHERE c.chave = 'veic_equip_exige_aprovacao_desmobilizacao';
  v_exige := coalesce(v_exige, true);

  SELECT x.previsao_liberacao INTO v_prev_atual
    FROM public.bd_disponibilidade_equipamentos x
   WHERE x.equipamento_id = p_equipamento_id
   ORDER BY x.updated_at DESC NULLS LAST, x.created_at DESC NULLS LAST, x.id DESC
   LIMIT 1;

  v_status := CASE WHEN v_exige THEN 'PENDENTE_APROVACAO' ELSE 'APROVADA' END;

  INSERT INTO public.bd_solicitacoes_desmobilizacao (
    equipamento_id, centro_custo_origem_id, engenheiro_responsavel_id, engenheiro_solicitante_id,
    solicitante_id, data_retirada, hora_retirada, observacoes, status, exige_aprovacao,
    previsao_liberacao_anterior, previsao_aplicada, aprovado_por, aprovado_em
  ) VALUES (
    p_equipamento_id, v_equip.centro_custo_atual_id, p_engenheiro_responsavel_id, p_engenheiro_solicitante_id,
    v_uid, p_data_retirada, p_hora_retirada, nullif(btrim(coalesce(p_observacoes,'')),''), v_status, v_exige,
    CASE WHEN v_exige THEN NULL ELSE v_prev_atual END, false,
    CASE WHEN v_exige THEN NULL ELSE v_uid END,
    CASE WHEN v_exige THEN NULL ELSE now() END
  ) RETURNING id INTO v_id;

  IF NOT v_exige THEN
    PERFORM public.fn_desmob_aplicar_previsao(
      p_equipamento_id, p_data_retirada,
      'Previsao de liberacao definida pela solicitacao de desmobilizacao ' || v_id::text || '.'
    );
    UPDATE public.bd_solicitacoes_desmobilizacao SET previsao_aplicada = true WHERE id = v_id;
  END IF;

  RETURN jsonb_build_object(
    'id', v_id, 'status', v_status, 'exige_aprovacao', v_exige,
    'previsao_aplicada', NOT v_exige, 'data_retirada', p_data_retirada
  );
END;
$$;

-- 2) DECIDIR
CREATE OR REPLACE FUNCTION public.fn_desmobilizacao_decidir(
  p_id uuid,
  p_decisao text,
  p_motivo text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sa boolean;
  v_row public.bd_solicitacoes_desmobilizacao;
  v_prev date;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'DESMOB_AUTH_REQUIRED' USING ERRCODE='P0001', HINT='Sessao expirada.';
  END IF;
  IF upper(coalesce(p_decisao,'')) NOT IN ('APROVAR','REPROVAR') THEN
    RAISE EXCEPTION 'DESMOB_DECISAO_INVALIDA' USING ERRCODE='P0001', HINT='Decisao deve ser APROVAR ou REPROVAR.';
  END IF;

  v_sa := public.fn_is_super_admin(v_uid);
  IF NOT v_sa AND NOT public.user_has_permission_action(v_uid, 'equipamentos_solicitacoes_aprovar', 'aprovar') THEN
    RAISE EXCEPTION 'DESMOB_FORBIDDEN' USING ERRCODE='P0001', HINT='Sem permissao para decidir desmobilizacoes.';
  END IF;

  SELECT * INTO v_row FROM public.bd_solicitacoes_desmobilizacao WHERE id = p_id FOR UPDATE;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'DESMOB_NAO_ENCONTRADA' USING ERRCODE='P0001', HINT='Solicitacao inexistente.';
  END IF;
  IF v_row.status <> 'PENDENTE_APROVACAO' THEN
    RAISE EXCEPTION 'DESMOB_ESTADO_INVALIDO' USING ERRCODE='P0001',
      HINT='Somente solicitacoes pendentes de aprovacao podem ser decididas.';
  END IF;
  IF NOT v_sa AND NOT public.fn_ativos_can_access_equipamento(v_row.equipamento_id, v_uid) THEN
    RAISE EXCEPTION 'DESMOB_SCOPE_DENIED' USING ERRCODE='P0001', HINT='Ativo fora do seu escopo.';
  END IF;

  IF upper(p_decisao) = 'REPROVAR' THEN
    UPDATE public.bd_solicitacoes_desmobilizacao
       SET status='REPROVADA', aprovado_por=v_uid, aprovado_em=now(),
           motivo_recusa=nullif(btrim(coalesce(p_motivo,'')),'')
     WHERE id = p_id;
    RETURN jsonb_build_object('id', p_id, 'status','REPROVADA','previsao_aplicada', false);
  END IF;

  SELECT x.previsao_liberacao INTO v_prev
    FROM public.bd_disponibilidade_equipamentos x
   WHERE x.equipamento_id = v_row.equipamento_id
   ORDER BY x.updated_at DESC NULLS LAST, x.created_at DESC NULLS LAST, x.id DESC
   LIMIT 1;

  UPDATE public.bd_solicitacoes_desmobilizacao
     SET status='APROVADA', aprovado_por=v_uid, aprovado_em=now(),
         previsao_liberacao_anterior=v_prev
   WHERE id = p_id;

  PERFORM public.fn_desmob_aplicar_previsao(
    v_row.equipamento_id, v_row.data_retirada,
    'Previsao de liberacao definida pela aprovacao da desmobilizacao ' || p_id::text || '.'
  );

  UPDATE public.bd_solicitacoes_desmobilizacao SET previsao_aplicada = true WHERE id = p_id;

  RETURN jsonb_build_object('id', p_id, 'status','APROVADA','previsao_aplicada', true,
                            'previsao_liberacao', v_row.data_retirada);
END;
$$;

-- 3) CANCELAR
CREATE OR REPLACE FUNCTION public.fn_desmobilizacao_cancelar(
  p_id uuid,
  p_motivo text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sa boolean;
  v_row public.bd_solicitacoes_desmobilizacao;
  v_prev date;
  v_revertida boolean := false;
  v_divergencia boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'DESMOB_AUTH_REQUIRED' USING ERRCODE='P0001', HINT='Sessao expirada.';
  END IF;

  SELECT * INTO v_row FROM public.bd_solicitacoes_desmobilizacao WHERE id = p_id FOR UPDATE;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'DESMOB_NAO_ENCONTRADA' USING ERRCODE='P0001', HINT='Solicitacao inexistente.';
  END IF;

  v_sa := public.fn_is_super_admin(v_uid);
  IF NOT v_sa
     AND v_row.solicitante_id <> v_uid
     AND v_row.engenheiro_solicitante_id <> v_uid
     AND v_row.engenheiro_responsavel_id <> v_uid
     AND NOT public.user_has_permission_action(v_uid, 'equipamentos_solicitacoes_aprovar', 'aprovar') THEN
    RAISE EXCEPTION 'DESMOB_FORBIDDEN' USING ERRCODE='P0001', HINT='Sem permissao para cancelar esta desmobilizacao.';
  END IF;

  IF v_row.status = 'CANCELADA' THEN
    RETURN jsonb_build_object('id', p_id, 'status','CANCELADA','idempotente', true,'previsao_revertida', false);
  END IF;
  IF v_row.status IN ('REPROVADA','CONCLUIDA') THEN
    RAISE EXCEPTION 'DESMOB_ESTADO_INVALIDO' USING ERRCODE='P0001',
      HINT='Somente solicitacoes pendentes ou aprovadas podem ser canceladas.';
  END IF;

  IF v_row.status = 'APROVADA' AND v_row.previsao_aplicada THEN
    SELECT x.previsao_liberacao INTO v_prev
      FROM public.bd_disponibilidade_equipamentos x
     WHERE x.equipamento_id = v_row.equipamento_id
     ORDER BY x.updated_at DESC NULLS LAST, x.created_at DESC NULLS LAST, x.id DESC
     LIMIT 1;

    IF v_prev IS NOT DISTINCT FROM v_row.data_retirada THEN
      PERFORM public.fn_desmob_aplicar_previsao(
        v_row.equipamento_id, v_row.previsao_liberacao_anterior,
        'Previsao de liberacao restaurada pelo cancelamento da desmobilizacao ' || p_id::text || '.'
      );
      v_revertida := true;
    ELSE
      v_divergencia := true;
    END IF;
  END IF;

  UPDATE public.bd_solicitacoes_desmobilizacao
     SET status='CANCELADA', cancelado_por=v_uid, cancelado_em=now(),
         previsao_aplicada = CASE WHEN v_revertida THEN false ELSE previsao_aplicada END,
         motivo_cancelamento = btrim(
           coalesce(nullif(btrim(coalesce(p_motivo,'')),'') , 'Cancelada pelo usuario.')
           || CASE WHEN v_divergencia
                THEN ' [Previsao de liberacao NAO revertida: valor atual foi alterado por outro fluxo apos a aprovacao.]'
                ELSE '' END)
   WHERE id = p_id;

  RETURN jsonb_build_object('id', p_id, 'status','CANCELADA',
                            'previsao_revertida', v_revertida,
                            'divergencia_concorrente', v_divergencia);
END;
$$;

-- 4) CONCLUIR
CREATE OR REPLACE FUNCTION public.fn_desmobilizacao_concluir(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sa boolean;
  v_row public.bd_solicitacoes_desmobilizacao;
  v_cc_atual uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'DESMOB_AUTH_REQUIRED' USING ERRCODE='P0001', HINT='Sessao expirada.';
  END IF;

  SELECT * INTO v_row FROM public.bd_solicitacoes_desmobilizacao WHERE id = p_id FOR UPDATE;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'DESMOB_NAO_ENCONTRADA' USING ERRCODE='P0001', HINT='Solicitacao inexistente.';
  END IF;

  v_sa := public.fn_is_super_admin(v_uid);
  IF NOT v_sa
     AND NOT public.user_has_permission_action(v_uid, 'equipamentos_solicitacoes_aprovar', 'aprovar')
     AND NOT public.user_has_permission_action(v_uid, 'gestao_maquinas_central_transporte_view', 'editar') THEN
    RAISE EXCEPTION 'DESMOB_FORBIDDEN' USING ERRCODE='P0001', HINT='Sem permissao para concluir desmobilizacoes.';
  END IF;

  IF v_row.status = 'CONCLUIDA' THEN
    RETURN jsonb_build_object('id', p_id, 'status','CONCLUIDA','idempotente', true);
  END IF;
  IF v_row.status <> 'APROVADA' THEN
    RAISE EXCEPTION 'DESMOB_ESTADO_INVALIDO' USING ERRCODE='P0001',
      HINT='Somente solicitacoes aprovadas podem ser concluidas.';
  END IF;

  SELECT e.centro_custo_atual_id INTO v_cc_atual
    FROM public.bd_caminhoes_equipamentos e WHERE e.id = v_row.equipamento_id FOR UPDATE;

  IF v_cc_atual IS NOT DISTINCT FROM v_row.centro_custo_origem_id THEN
    RAISE EXCEPTION 'DESMOBILIZACAO_AINDA_NAO_EFETIVADA' USING ERRCODE='P0001',
      HINT='O ativo continua no centro de custo de origem: registre a movimentacao real antes de concluir.';
  END IF;

  UPDATE public.bd_solicitacoes_desmobilizacao
     SET status='CONCLUIDA', concluido_por=v_uid, concluido_em=now()
   WHERE id = p_id;

  RETURN jsonb_build_object('id', p_id, 'status','CONCLUIDA','centro_custo_atual_id', v_cc_atual);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_desmobilizacao_solicitar(uuid, uuid, uuid, date, time without time zone, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_desmobilizacao_decidir(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_desmobilizacao_cancelar(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_desmobilizacao_concluir(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_desmobilizacao_solicitar(uuid, uuid, uuid, date, time without time zone, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_desmobilizacao_decidir(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_desmobilizacao_cancelar(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_desmobilizacao_concluir(uuid) TO authenticated;