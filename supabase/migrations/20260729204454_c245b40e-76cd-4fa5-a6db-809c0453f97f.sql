DO $mig$
DECLARE
  v_src  text;
  v_def  text;
  v_new  text;
  v_guard text;
BEGIN
  ---------------------------------------------------------------------------
  -- PRECHECK: aborta antes de qualquer DDL se as definicoes vivas divergirem
  ---------------------------------------------------------------------------
  SELECT prosrc INTO v_src FROM pg_proc WHERE oid = 'public.fn_ct_avaliar_disponibilidade(uuid,text,date)'::regprocedure;
  IF md5(v_src) <> '91a89bde623538a7a8c65b344798445c' THEN
    RAISE EXCEPTION 'PRECHECK_FALHOU: fn_ct_avaliar_disponibilidade md5=% inesperado', md5(v_src);
  END IF;

  SELECT prosrc INTO v_src FROM pg_proc WHERE oid = 'public.fn_ct_atendimento_atribuir(uuid,uuid,text,uuid,date,date,text)'::regprocedure;
  IF md5(v_src) <> '0a87fb8c06f8271bb9f635c162dea4f8' THEN
    RAISE EXCEPTION 'PRECHECK_FALHOU: fn_ct_atendimento_atribuir md5=% inesperado', md5(v_src);
  END IF;

  SELECT prosrc INTO v_src FROM pg_proc WHERE oid = 'public.fn_ct_atendimento_substituir(uuid,uuid,text,text,uuid,text)'::regprocedure;
  IF md5(v_src) <> 'd5d266e45cacbf918f8bfee407746186' THEN
    RAISE EXCEPTION 'PRECHECK_FALHOU: fn_ct_atendimento_substituir md5=% inesperado', md5(v_src);
  END IF;

  ---------------------------------------------------------------------------
  -- G0: SEM_REGISTRO passa a ser fail-closed
  ---------------------------------------------------------------------------
  v_def := pg_get_functiondef('public.fn_ct_avaliar_disponibilidade(uuid,text,date)'::regprocedure);
  v_new := replace(
    v_def,
    E'      ''status'', ''SEM_REGISTRO'',\n      ''ok'', true,\n      ''override'', false,\n      ''reconciliado'', true,',
    E'      ''status'', ''SEM_REGISTRO'',\n      ''ok'', false,\n      ''override'', false,\n      ''reconciliado'', false,'
  );
  IF v_new = v_def THEN
    RAISE EXCEPTION 'PATCH_FALHOU: bloco SEM_REGISTRO nao localizado';
  END IF;
  v_def := v_new;
  v_new := replace(
    v_def,
    '''Ativo sem registro de disponibilidade; tratado como disponivel.''',
    '''O ativo nao possui disponibilidade operacional confirmada.'''
  );
  IF v_new = v_def THEN
    RAISE EXCEPTION 'PATCH_FALHOU: motivo SEM_REGISTRO nao localizado';
  END IF;
  EXECUTE v_new;

  ---------------------------------------------------------------------------
  -- HARD BLOCK nas RPCs publicas (apos replay idempotente, antes de escrever)
  ---------------------------------------------------------------------------
  v_guard :=
    E'  v_ovr_disp := (v_disp->>''override'')::boolean;\n\n'
    || E'  -- G0/CT2: ativo sem linha operacional nunca e reservavel (fail-closed, sem override).\n'
    || E'  IF coalesce(v_disp->>''status'', ''SEM_REGISTRO'') = ''SEM_REGISTRO'' THEN\n'
    || E'    RAISE EXCEPTION ''CT2_DISPONIBILIDADE_SEM_REGISTRO'' USING ERRCODE = ''P0001'',\n'
    || E'      HINT = ''Regularize a disponibilidade operacional do ativo antes de continuar.'';\n'
    || E'  END IF;\n';

  v_def := pg_get_functiondef('public.fn_ct_atendimento_atribuir(uuid,uuid,text,uuid,date,date,text)'::regprocedure);
  v_new := replace(v_def, E'  v_ovr_disp := (v_disp->>''override'')::boolean;\n', v_guard);
  IF v_new = v_def THEN
    RAISE EXCEPTION 'PATCH_FALHOU: ancora v_ovr_disp ausente em fn_ct_atendimento_atribuir';
  END IF;
  EXECUTE v_new;

  v_def := pg_get_functiondef('public.fn_ct_atendimento_substituir(uuid,uuid,text,text,uuid,text)'::regprocedure);
  v_new := replace(v_def, E'  v_ovr_disp := (v_disp->>''override'')::boolean;\n', v_guard);
  IF v_new = v_def THEN
    RAISE EXCEPTION 'PATCH_FALHOU: ancora v_ovr_disp ausente em fn_ct_atendimento_substituir';
  END IF;
  EXECUTE v_new;
END
$mig$;

COMMENT ON FUNCTION public.fn_ct_avaliar_disponibilidade(uuid,text,date) IS 'CT2_G0 fail-closed: SEM_REGISTRO nao e disponivel';
COMMENT ON FUNCTION public.fn_ct_atendimento_atribuir(uuid,uuid,text,uuid,date,date,text) IS 'CT2_G0 hard block CT2_DISPONIBILIDADE_SEM_REGISTRO';
COMMENT ON FUNCTION public.fn_ct_atendimento_substituir(uuid,uuid,text,text,uuid,text) IS 'CT2_G0 hard block CT2_DISPONIBILIDADE_SEM_REGISTRO';

---------------------------------------------------------------------------
-- RPC transacional de regularizacao de disponibilidade (capability + escopo)
---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_ct_disponibilidade_upsert(
  p_equipamento_id      uuid,
  p_status_operacional  text,
  p_previsao_liberacao  date DEFAULT NULL,
  p_centro_custo_id     uuid DEFAULT NULL,
  p_confiabilidade      text DEFAULT NULL,
  p_data_inicio         date DEFAULT NULL,
  p_motivo_risco        text DEFAULT NULL,
  p_observacao          text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_uid   uuid;
  v_sa    boolean;
  v_row   record;
  v_id    uuid;
  v_criou boolean := false;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT2_AUTH_REQUIRED' USING ERRCODE = 'P0001',
      HINT = 'Sessao expirada. Entre novamente para continuar.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_uid) THEN
    RAISE EXCEPTION 'CT2_PROFILE_NOT_FOUND' USING ERRCODE = 'P0001',
      HINT = 'Perfil de usuario inexistente.';
  END IF;

  IF p_equipamento_id IS NULL THEN
    RAISE EXCEPTION 'CT2_PARAMETROS_INVALIDOS' USING ERRCODE = 'P0001',
      HINT = 'Equipamento obrigatorio.';
  END IF;

  IF p_status_operacional IS NULL
     OR p_status_operacional NOT IN ('DISPONIVEL','ALOCADO','MANUTENCAO','INDISPONIVEL') THEN
    RAISE EXCEPTION 'CT2_STATUS_INVALIDO' USING ERRCODE = 'P0001',
      HINT = 'Escolha um status operacional valido.';
  END IF;

  IF p_confiabilidade IS NOT NULL AND p_confiabilidade NOT IN ('ALTA','MEDIA','BAIXA') THEN
    RAISE EXCEPTION 'CT2_PARAMETROS_INVALIDOS' USING ERRCODE = 'P0001',
      HINT = 'Confiabilidade invalida.';
  END IF;

  v_sa := public.fn_is_super_admin(v_uid);

  IF NOT v_sa THEN
    IF NOT public.user_has_permission_action(v_uid, 'gestao_maquinas_central_transporte_view', 'editar') THEN
      RAISE EXCEPTION 'CT2_FORBIDDEN' USING ERRCODE = 'P0001',
        HINT = 'Sem permissao para regularizar disponibilidade operacional.';
    END IF;
    IF NOT public.fn_ativos_can_access_equipamento(p_equipamento_id, v_uid) THEN
      RAISE EXCEPTION 'CT2_SCOPE_DENIED' USING ERRCODE = 'P0001',
        HINT = 'Equipamento fora do seu escopo de acesso.';
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.bd_caminhoes_equipamentos e WHERE e.id = p_equipamento_id) THEN
    RAISE EXCEPTION 'CT2_EQUIPAMENTO_NAO_ENCONTRADO' USING ERRCODE = 'P0001',
      HINT = 'O equipamento informado nao existe.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('ct2:disp:' || p_equipamento_id::text, 0));

  SELECT d.id INTO v_row
    FROM public.bd_disponibilidade_equipamentos d
   WHERE d.equipamento_id = p_equipamento_id
   ORDER BY d.updated_at DESC NULLS LAST, d.created_at DESC NULLS LAST, d.id DESC
   LIMIT 1
   FOR UPDATE;

  IF v_row.id IS NULL THEN
    INSERT INTO public.bd_disponibilidade_equipamentos (
      equipamento_id, status_operacional, centro_custo_id, data_inicio,
      previsao_liberacao, confiabilidade_previsao, motivo_risco, observacao
    ) VALUES (
      p_equipamento_id, p_status_operacional::status_operacional_enum, p_centro_custo_id, p_data_inicio,
      p_previsao_liberacao, nullif(p_confiabilidade,'')::confiabilidade_previsao_enum,
      nullif(btrim(coalesce(p_motivo_risco,'')),''), nullif(btrim(coalesce(p_observacao,'')),'')
    )
    RETURNING id INTO v_id;
    v_criou := true;
  ELSE
    UPDATE public.bd_disponibilidade_equipamentos
       SET status_operacional      = p_status_operacional::status_operacional_enum,
           centro_custo_id         = p_centro_custo_id,
           data_inicio             = p_data_inicio,
           previsao_liberacao      = p_previsao_liberacao,
           confiabilidade_previsao = nullif(p_confiabilidade,'')::confiabilidade_previsao_enum,
           motivo_risco            = nullif(btrim(coalesce(p_motivo_risco,'')),''),
           observacao              = nullif(btrim(coalesce(p_observacao,'')),''),
           updated_at              = now()
     WHERE id = v_row.id
    RETURNING id INTO v_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'criou', v_criou,
    'disponibilidade_id', v_id,
    'equipamento_id', p_equipamento_id,
    'status_operacional', p_status_operacional
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.fn_ct_disponibilidade_upsert(uuid,text,date,uuid,text,date,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_ct_disponibilidade_upsert(uuid,text,date,uuid,text,date,text,text) TO authenticated;
COMMENT ON FUNCTION public.fn_ct_disponibilidade_upsert(uuid,text,date,uuid,text,date,text,text) IS 'CT2_G1 regularizacao assistida de disponibilidade operacional (permission gestao_maquinas_central_transporte_view + action editar)';