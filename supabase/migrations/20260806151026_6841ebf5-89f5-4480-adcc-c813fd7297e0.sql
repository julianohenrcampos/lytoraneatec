-- CT-3E.2 (1) capacidade operacional: acoes especificas herdam de 'editar'
CREATE OR REPLACE FUNCTION public.fn_ct_cap(p_user uuid, p_acao text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p_user IS NOT NULL AND (
    public.fn_is_super_admin(p_user)
    OR public.user_has_permission_action(p_user,'gestao_maquinas_minhas_mobilizacoes_view',p_acao)
    OR (p_acao IN ('registrar_checklist','iniciar_viagem','confirmar_recebimento','tratar_recusa')
        AND public.user_has_permission_action(p_user,'gestao_maquinas_minhas_mobilizacoes_view','editar'))
  );
$function$;

ALTER TABLE public.bd_role_permission_actions DISABLE TRIGGER trg_validate_role_permission_action_change;
ALTER TABLE public.bd_role_permission_actions DISABLE TRIGGER trg_audit_bd_role_permission_actions;

INSERT INTO public.bd_role_permission_actions (role_id, permission_id, acao)
SELECT r.id, pm.id, a.acao
  FROM public.bd_roles r
  JOIN public.bd_permissions pm ON pm.codigo = 'gestao_maquinas_minhas_mobilizacoes_view'
  CROSS JOIN (VALUES ('visualizar'),('editar')) AS a(acao)
 WHERE upper(btrim(r.nome)) IN ('MOTORISTA/OPERADOR','MOTORISTA','OPERADOR')
   AND NOT EXISTS (
     SELECT 1 FROM public.bd_role_permission_actions x
      WHERE x.role_id = r.id AND x.permission_id = pm.id AND x.acao = a.acao);

ALTER TABLE public.bd_role_permission_actions ENABLE TRIGGER trg_validate_role_permission_action_change;
ALTER TABLE public.bd_role_permission_actions ENABLE TRIGGER trg_audit_bd_role_permission_actions;

-- CT-3E.2 (2) gravacao do checklist: upsert real por viagem/carga
CREATE OR REPLACE FUNCTION public.fn_ct_checklist_saida_salvar(p_viagem_id uuid, p_payload jsonb, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  SELECT c.id INTO v_id
    FROM public.bd_ct_checklists c
   WHERE c.viagem_id = p_viagem_id AND c.fase = 'SAIDA' AND c.tipo = v_tipo
     AND ((v_tipo = 'TRANSPORTADOR' AND c.movimentacao_id IS NULL)
          OR (v_tipo = 'CARGA' AND c.movimentacao_id = v_mov))
   FOR UPDATE;

  IF v_id IS NULL THEN
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
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.bd_ct_checklists SET
      checklist_codigo = coalesce(nullif(p_payload->>'checklist_codigo',''), checklist_codigo),
      checklist_versao = coalesce((p_payload->>'checklist_versao')::int, checklist_versao),
      respostas = coalesce(p_payload->'respostas', respostas),
      status = v_status,
      realizado_por_profile_id = v_uid,
      realizado_por_funcionario_id = v_func,
      realizado_em = CASE WHEN v_status='CONCLUIDO' THEN now() ELSE realizado_em END,
      latitude = coalesce(nullif(p_payload->>'latitude','')::numeric, latitude),
      longitude = coalesce(nullif(p_payload->>'longitude','')::numeric, longitude),
      assinatura_id = coalesce(v_assin, assinatura_id),
      updated_by = v_uid
    WHERE id = v_id;
  END IF;

  v_resp := jsonb_build_object(
    'ok', true, 'replay', false, 'checklist_id', v_id, 'status', v_status,
    'itens_persistidos', (SELECT count(*) FROM jsonb_object_keys(coalesce(p_payload->'respostas','{}'::jsonb))),
    'salvo_em', now());
  INSERT INTO public.bd_ct_comando_requests (request_id, operacao, solicitacao_id, response_json, created_by)
  VALUES (p_request_id, 'CT3E_CHECKLIST_SAIDA', v.solicitacao_id, v_resp, v_uid);
  RETURN v_resp;
END $function$;

-- CT-3E.2 (3) recebimentos: recebedor conhece a entrega antes da chegada
CREATE OR REPLACE FUNCTION public.fn_ct_recebimentos_pendentes_listar()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid(); v_func uuid; v_sa boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT3E_AUTH_REQUIRED' USING ERRCODE='P0001', HINT='Sessao expirada. Entre novamente.';
  END IF;
  v_sa := public.fn_is_super_admin(v_uid);
  v_func := public.fn_ativos_profile_funcionario_id(v_uid);

  RETURN jsonb_build_object('ok', true, 'ordens', coalesce((
    SELECT jsonb_agg(public.fn_ct_viagem_json(v.id)
           ORDER BY coalesce(v.chegada_registrada_em, v.transporte_iniciado_em,
                             v.data_prevista_entrega::timestamptz) DESC NULLS LAST)
      FROM public.bd_ct_viagens v
     WHERE v.status IN ('PROGRAMADA','EM_TRANSITO','AGUARDANDO_RECEBIMENTO','PENDENTE_TRATATIVA','CONCLUIDA')
       AND (v_sa
            OR (v_func IS NOT NULL AND v_func = v.recebedor_previsto_funcionario_id)
            OR (public.fn_ct_cap(v_uid,'confirmar_recebimento')
                AND v.destino_centro_custo_id IS NOT NULL
                AND public.fn_ativos_can_access_centro_custo(v.destino_centro_custo_id, v_uid)))
  ), '[]'::jsonb));
END $function$;

-- CT-3E.2 (4) apoio ao planejamento: funcionarios com usuario do sistema
CREATE OR REPLACE FUNCTION public.fn_ct_funcionarios_com_usuario()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT3E_AUTH_REQUIRED' USING ERRCODE='P0001', HINT='Sessao expirada. Entre novamente.';
  END IF;
  RETURN jsonb_build_object('ok', true, 'funcionario_ids', coalesce((
    SELECT jsonb_agg(DISTINCT p.funcionario_id)
      FROM public.profiles p WHERE p.funcionario_id IS NOT NULL), '[]'::jsonb));
END $function$;

REVOKE ALL ON FUNCTION public.fn_ct_funcionarios_com_usuario() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_ct_funcionarios_com_usuario() TO authenticated;