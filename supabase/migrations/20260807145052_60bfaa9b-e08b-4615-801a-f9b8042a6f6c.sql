ALTER TABLE public.bd_ct_comando_requests
  DROP CONSTRAINT IF EXISTS bd_ct_comando_requests_operacao_check;

ALTER TABLE public.bd_ct_comando_requests
  ADD CONSTRAINT bd_ct_comando_requests_operacao_check
  CHECK (operacao IN (
    'MOB_SALVAR_RASCUNHO',
    'MOB_PROGRAMAR',
    'MOB_CANCELAR',
    'MOB_NOVA_REVISAO',
    'CT3E_CHECKLIST_SAIDA'
  ));

CREATE OR REPLACE FUNCTION public.fn_ct_checklist_saida_salvar(
  p_viagem_id uuid,
  p_payload jsonb,
  p_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_func uuid;
  v record;
  v_tipo text := upper(coalesce(p_payload->>'tipo',''));
  v_mov uuid := nullif(p_payload->>'movimentacao_id','')::uuid;
  v_status text := upper(coalesce(p_payload->>'status','RASCUNHO'));
  v_prev public.bd_ct_comando_requests%ROWTYPE;
  v_id uuid;
  v_resp jsonb;
  v_assin uuid;
  v_command_hash text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT3E_AUTH_REQUIRED' USING ERRCODE='P0001', HINT='Sessao expirada. Entre novamente.';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'CT3E_REQUEST_ID_OBRIGATORIO' USING ERRCODE='P0001', HINT='Requisicao invalida.';
  END IF;

  v_command_hash := md5(concat_ws('|',
    'CT3E_CHECKLIST_SAIDA',
    p_viagem_id::text,
    coalesce(p_payload::text, '')
  ));

  SELECT * INTO v_prev
    FROM public.bd_ct_comando_requests
   WHERE request_id = p_request_id;

  IF FOUND THEN
    IF v_prev.operacao <> 'CT3E_CHECKLIST_SAIDA' OR v_prev.command_hash <> v_command_hash THEN
      RAISE EXCEPTION 'CT3_IDEMPOTENCY_KEY_REUSED'
        USING ERRCODE='P0001', HINT='A mesma chave de requisicao foi usada com dados diferentes.';
    END IF;
    RETURN v_prev.response_json || jsonb_build_object('replay', true);
  END IF;

  SELECT * INTO v
    FROM public.bd_ct_viagens
   WHERE id = p_viagem_id
   FOR UPDATE;

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
    IF v_mov IS NULL OR NOT EXISTS (
      SELECT 1
        FROM public.bd_movimentacoes m
       WHERE m.id = v_mov
         AND m.viagem_id = p_viagem_id
         AND coalesce(m.status,'') <> 'CANCELADA'
    ) THEN
      RAISE EXCEPTION 'CT3E_CARGA_INVALIDA' USING ERRCODE='P0001', HINT='Carga nao pertence a viagem.';
    END IF;
  END IF;

  IF v_status NOT IN ('RASCUNHO','CONCLUIDO') THEN
    v_status := 'RASCUNHO';
  END IF;

  IF v_status = 'CONCLUIDO' AND v_tipo = 'TRANSPORTADOR' THEN
    v_assin := public.fn_ct_registrar_assinatura(v_uid, v.solicitacao_id, 'CT_CHECKLIST_SAIDA');
  END IF;

  SELECT c.id INTO v_id
    FROM public.bd_ct_checklists c
   WHERE c.viagem_id = p_viagem_id
     AND c.fase = 'SAIDA'
     AND c.tipo = v_tipo
     AND ((v_tipo = 'TRANSPORTADOR' AND c.movimentacao_id IS NULL)
          OR (v_tipo = 'CARGA' AND c.movimentacao_id = v_mov))
   FOR UPDATE;

  IF v_id IS NULL THEN
    INSERT INTO public.bd_ct_checklists (
      viagem_id, movimentacao_id, tipo, fase, checklist_codigo, checklist_versao,
      respostas, status, realizado_por_profile_id, realizado_por_funcionario_id,
      realizado_em, latitude, longitude, assinatura_id, created_by, updated_by
    ) VALUES (
      p_viagem_id, v_mov, v_tipo, 'SAIDA',
      coalesce(nullif(p_payload->>'checklist_codigo',''),'CT-GENERICO-V1'),
      coalesce((p_payload->>'checklist_versao')::int, 1),
      coalesce(p_payload->'respostas','{}'::jsonb), v_status, v_uid, v_func,
      CASE WHEN v_status='CONCLUIDO' THEN now() ELSE NULL END,
      nullif(p_payload->>'latitude','')::numeric,
      nullif(p_payload->>'longitude','')::numeric,
      v_assin, v_uid, v_uid
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.bd_ct_checklists
       SET checklist_codigo = coalesce(nullif(p_payload->>'checklist_codigo',''), checklist_codigo),
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
    'ok', true,
    'replay', false,
    'checklist_id', v_id,
    'status', v_status,
    'itens_persistidos', (SELECT count(*) FROM jsonb_object_keys(coalesce(p_payload->'respostas'->'itens','{}'::jsonb))),
    'salvo_em', now()
  );

  INSERT INTO public.bd_ct_comando_requests (
    request_id, operacao, solicitacao_id, planejamento_id, command_hash,
    response_json, created_by
  ) VALUES (
    p_request_id, 'CT3E_CHECKLIST_SAIDA', v.solicitacao_id, v.solicitacao_planejamento_id,
    v_command_hash, v_resp, v_uid
  );

  RETURN v_resp;
END
$function$;