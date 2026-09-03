BEGIN;

DO $outer$
DECLARE
  v_m3_sigs regprocedure[] := ARRAY[
    'public.fn_chamado_interno_can_open_cc(uuid)'::regprocedure,
    'public.fn_chamado_interno_can_attend(public.chamado_interno_setor)'::regprocedure,
    'public.fn_chamado_interno_can_read(uuid)'::regprocedure,
    'public.fn_chamado_interno_listar_ccs_abertura()'::regprocedure,
    'public.fn_chamado_interno_listar_solicitantes_cc(uuid)'::regprocedure,
    'public.fn_chamado_interno_atendentes_listar(public.chamado_interno_setor)'::regprocedure,
    'public.fn_chamado_interno_atendente_vincular(uuid,public.chamado_interno_setor)'::regprocedure,
    'public.fn_chamado_interno_atendente_desativar(uuid)'::regprocedure
  ];
  v_sig regprocedure;
  v_policy_ok int;
  v_module_policy_count int;
  v_acl_ok int;
BEGIN
  FOREACH v_sig IN ARRAY v_m3_sigs LOOP
    PERFORM 1 FROM pg_proc p WHERE p.oid = v_sig::oid;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'm3_signature_missing: %', v_sig;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'fn_chamado_interno_abrir',
        'fn_chamado_interno_assumir',
        'fn_chamado_interno_responder',
        'fn_chamado_interno_solicitar_informacao',
        'fn_chamado_interno_adicionar_nota_interna',
        'fn_chamado_interno_resolver',
        'fn_chamado_interno_responder_solicitante',
        'fn_chamado_interno_confirmar_encerramento',
        'fn_chamado_interno_reabrir',
        'fn_chamado_interno_cancelar'
      )
  ) THEN
    RAISE EXCEPTION 'm5_function_name_or_overload_already_exists';
  END IF;

  SELECT count(*) INTO v_policy_ok
  FROM (VALUES
    ('bd_chamado_interno_categorias','chamado_interno_categorias_select'),
    ('bd_chamados_internos','chamados_internos_select'),
    ('bd_chamado_interno_eventos','chamado_interno_eventos_select'),
    ('bd_chamado_interno_atendentes','chamado_interno_atendentes_select')
  ) AS e(tablename, policyname)
  JOIN pg_policies p
    ON p.schemaname='public'
   AND p.tablename=e.tablename
   AND p.policyname=e.policyname
   AND p.cmd='SELECT'
   AND p.permissive='PERMISSIVE'
   AND p.roles::text[] IS NOT DISTINCT FROM ARRAY['authenticated']::text[];
  IF v_policy_ok <> 4 THEN
    RAISE EXCEPTION 'm4_exact_policies_invalid: %', v_policy_ok;
  END IF;

  SELECT count(*) INTO v_module_policy_count
  FROM pg_policies p
  WHERE p.schemaname='public'
    AND p.tablename IN (
      'bd_chamado_interno_categorias','bd_chamados_internos',
      'bd_chamado_interno_eventos','bd_chamado_interno_atendentes'
    );
  IF v_module_policy_count <> 4 THEN
    RAISE EXCEPTION 'module_policy_count_invalid: %', v_module_policy_count;
  END IF;

  SELECT count(*) INTO v_acl_ok
  FROM (VALUES
    ('public.bd_chamado_interno_categorias'),
    ('public.bd_chamados_internos'),
    ('public.bd_chamado_interno_eventos'),
    ('public.bd_chamado_interno_atendentes')
  ) AS t(tabela)
  WHERE has_table_privilege('authenticated', t.tabela, 'SELECT')
    AND NOT has_table_privilege('authenticated', t.tabela, 'INSERT')
    AND NOT has_table_privilege('authenticated', t.tabela, 'UPDATE')
    AND NOT has_table_privilege('authenticated', t.tabela, 'DELETE')
    AND NOT has_table_privilege('authenticated', t.tabela, 'TRUNCATE')
    AND NOT has_table_privilege('authenticated', t.tabela, 'REFERENCES')
    AND NOT has_table_privilege('authenticated', t.tabela, 'TRIGGER')
    AND NOT has_table_privilege('anon', t.tabela, 'SELECT')
    AND NOT has_table_privilege('anon', t.tabela, 'INSERT')
    AND NOT has_table_privilege('anon', t.tabela, 'UPDATE')
    AND NOT has_table_privilege('anon', t.tabela, 'DELETE')
    AND NOT has_table_privilege('anon', t.tabela, 'TRUNCATE')
    AND NOT has_table_privilege('anon', t.tabela, 'REFERENCES')
    AND NOT has_table_privilege('anon', t.tabela, 'TRIGGER')
    AND NOT EXISTS (
      SELECT 1
      FROM pg_class c
      CROSS JOIN LATERAL aclexplode(
        COALESCE(c.relacl, acldefault('r', c.relowner))
      ) ax
      WHERE c.oid = t.tabela::regclass
        AND ax.grantee = 0
    );
  IF v_acl_ok <> 4 THEN
    RAISE EXCEPTION 'module_table_acl_invalid: %', v_acl_ok;
  END IF;
END
$outer$;

-- ============== 1) ABRIR ==============
CREATE FUNCTION public.fn_chamado_interno_abrir(
  p_centro_custo_id uuid,
  p_categoria_id uuid,
  p_solicitante_funcionario_id uuid,
  p_titulo text,
  p_descricao text
)
RETURNS TABLE(chamado_id uuid, numero bigint, protocolo text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_titulo text := btrim(coalesce(p_titulo,''));
  v_descricao text := btrim(coalesce(p_descricao,''));
  v_categoria public.bd_chamado_interno_categorias%ROWTYPE;
  v_chamado public.bd_chamados_internos%ROWTYPE;
  v_cc_ativo boolean;
  v_func_ok boolean;
  v_numero bigint;
  v_protocolo text;
  v_sla_prazo timestamptz;
  v_chamado_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE='28000'; END IF;
  IF p_centro_custo_id IS NULL OR p_categoria_id IS NULL OR p_solicitante_funcionario_id IS NULL THEN
    RAISE EXCEPTION 'parametros_obrigatorios' USING ERRCODE='22004';
  END IF;
  IF v_titulo = '' OR v_descricao = '' THEN
    RAISE EXCEPTION 'mensagem_obrigatoria' USING ERRCODE='22004';
  END IF;
  IF public.user_has_permission_action(v_uid,'chamados_internos_view','visualizar') IS NOT TRUE THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  IF public.fn_chamado_interno_can_open_cc(p_centro_custo_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'escopo_cc_negado' USING ERRCODE='42501';
  END IF;

  SELECT cc.situacao = 'Ativo' INTO v_cc_ativo
  FROM public.bd_centros_custo cc WHERE cc.id = p_centro_custo_id;
  IF v_cc_ativo IS NULL OR v_cc_ativo IS FALSE THEN
    RAISE EXCEPTION 'centro_custo_inativo' USING ERRCODE='P0001';
  END IF;

  SELECT cat.* INTO v_categoria
  FROM public.bd_chamado_interno_categorias cat WHERE cat.id = p_categoria_id;
  IF NOT FOUND OR v_categoria.ativo IS FALSE THEN
    RAISE EXCEPTION 'categoria_inexistente' USING ERRCODE='P0002';
  END IF;

  SELECT f.status IN ('Ativo','Ativo sem Registro') AND f.centro_custo_id = p_centro_custo_id
  INTO v_func_ok
  FROM public.bd_funcionarios f WHERE f.id = p_solicitante_funcionario_id;
  IF v_func_ok IS NULL OR v_func_ok IS FALSE THEN
    RAISE EXCEPTION 'solicitante_invalido' USING ERRCODE='P0002';
  END IF;

  v_numero := nextval('public.bd_chamados_internos_numero_seq'::regclass);
  IF v_numero > 999999 THEN
    RAISE EXCEPTION 'protocolo_estouro_sequencia' USING ERRCODE='22003';
  END IF;
  v_protocolo := format('CHI-%s-%s',
    to_char((now() AT TIME ZONE 'America/Sao_Paulo')::date,'YYYY'),
    lpad(v_numero::text,6,'0'));
  v_sla_prazo := CASE WHEN v_categoria.sla_horas IS NOT NULL
                      THEN now() + make_interval(hours => v_categoria.sla_horas)
                      ELSE NULL END;

  INSERT INTO public.bd_chamados_internos AS ci (
    numero, protocolo, centro_custo_id, categoria_id, solicitante_funcionario_id,
    aberto_por, responsavel_atual_profile_id, titulo, descricao, status, setor,
    prioridade, is_critico, sla_prazo
  ) VALUES (
    v_numero, v_protocolo, p_centro_custo_id, p_categoria_id, p_solicitante_funcionario_id,
    v_uid, NULL, v_titulo, v_descricao, 'aberto', v_categoria.setor,
    v_categoria.prioridade_padrao, v_categoria.is_critico, v_sla_prazo
  ) RETURNING ci.* INTO v_chamado;
  v_chamado_id := v_chamado.id;

  INSERT INTO public.bd_chamado_interno_eventos (
    chamado_id, tipo, autor_profile_id, mensagem, status_anterior, status_novo, visivel_solicitante, payload
  ) VALUES
  (v_chamado_id,'abertura',v_uid,NULL,NULL,'aberto',true,
    jsonb_build_object('categoria_codigo',v_categoria.codigo,'protocolo',v_protocolo,'numero',v_numero)),
  (v_chamado_id,'roteamento',v_uid,NULL,'aberto','aberto',true,
    jsonb_build_object('setor_destino',v_categoria.setor::text));

  INSERT INTO public.bd_auditoria_log (
    tabela, registro_id, operacao, dados_anteriores, dados_novos, campos_alterados, usuario_id
  ) VALUES (
    'bd_chamados_internos', v_chamado_id::text, 'INSERT', NULL,
    to_jsonb(v_chamado) || jsonb_build_object('acao_chamado','abrir_chamado'),
    NULL, v_uid
  );

  chamado_id := v_chamado_id; numero := v_numero; protocolo := v_protocolo;
  RETURN NEXT;
END;
$function$;

-- ============== 2) ASSUMIR ==============
CREATE FUNCTION public.fn_chamado_interno_assumir(p_chamado_id uuid)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_ant public.bd_chamados_internos%ROWTYPE;
  v_nov public.bd_chamados_internos%ROWTYPE;
  v_campos_alterados text[];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE='28000'; END IF;
  IF p_chamado_id IS NULL THEN RAISE EXCEPTION 'parametros_obrigatorios' USING ERRCODE='22004'; END IF;
  SELECT c.* INTO v_ant FROM public.bd_chamados_internos c WHERE c.id=p_chamado_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'chamado_inexistente' USING ERRCODE='P0002'; END IF;
  IF public.user_has_permission_action(v_uid,'chamados_internos_view','visualizar') IS NOT TRUE
     OR public.user_has_permission_action(v_uid,'chamados_internos_atender','editar') IS NOT TRUE
     OR NOT EXISTS (SELECT 1 FROM public.bd_chamado_interno_atendentes a
                    WHERE a.atendente_profile_id=v_uid AND a.setor=v_ant.setor AND a.ativo IS TRUE) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  IF v_ant.status NOT IN ('aberto','em_triagem','em_analise','reaberto') THEN
    RAISE EXCEPTION 'estado_invalido_para_transicao' USING ERRCODE='P0001';
  END IF;
  IF v_ant.status='em_analise' AND v_ant.responsavel_atual_profile_id=v_uid THEN RETURN; END IF;
  IF v_ant.responsavel_atual_profile_id IS NOT NULL AND v_ant.responsavel_atual_profile_id<>v_uid THEN
    RAISE EXCEPTION 'chamado_ja_atribuido' USING ERRCODE='55000';
  END IF;

  UPDATE public.bd_chamados_internos AS c
  SET responsavel_atual_profile_id=v_uid, status='em_analise'
  WHERE c.id=p_chamado_id RETURNING c.* INTO v_nov;

  v_campos_alterados := ARRAY['responsavel_atual_profile_id'];
  IF v_ant.status IS DISTINCT FROM 'em_analise'::public.chamado_interno_status THEN
    v_campos_alterados := v_campos_alterados || 'status';
  END IF;

  INSERT INTO public.bd_chamado_interno_eventos (chamado_id,tipo,autor_profile_id,mensagem,status_anterior,status_novo,visivel_solicitante,payload)
  VALUES (p_chamado_id,'atribuicao',v_uid,NULL,v_ant.status,'em_analise',true,'{}'::jsonb);
  INSERT INTO public.bd_auditoria_log (tabela,registro_id,operacao,dados_anteriores,dados_novos,campos_alterados,usuario_id)
  VALUES ('bd_chamados_internos',p_chamado_id::text,'UPDATE',to_jsonb(v_ant),
          to_jsonb(v_nov)||jsonb_build_object('acao_chamado','assumir'),v_campos_alterados,v_uid);
END;
$function$;

-- ============== 3) RESPONDER ==============
CREATE FUNCTION public.fn_chamado_interno_responder(p_chamado_id uuid, p_mensagem text)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_msg text := btrim(coalesce(p_mensagem,''));
  v_ant public.bd_chamados_internos%ROWTYPE;
  v_nov public.bd_chamados_internos%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE='28000'; END IF;
  IF p_chamado_id IS NULL THEN RAISE EXCEPTION 'parametros_obrigatorios' USING ERRCODE='22004'; END IF;
  IF v_msg='' THEN RAISE EXCEPTION 'mensagem_obrigatoria' USING ERRCODE='22004'; END IF;
  SELECT c.* INTO v_ant FROM public.bd_chamados_internos c WHERE c.id=p_chamado_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'chamado_inexistente' USING ERRCODE='P0002'; END IF;
  IF public.user_has_permission_action(v_uid,'chamados_internos_view','visualizar') IS NOT TRUE
     OR public.user_has_permission_action(v_uid,'chamados_internos_atender','editar') IS NOT TRUE
     OR NOT EXISTS (SELECT 1 FROM public.bd_chamado_interno_atendentes a
                    WHERE a.atendente_profile_id=v_uid AND a.setor=v_ant.setor AND a.ativo IS TRUE)
     OR v_ant.responsavel_atual_profile_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  IF v_ant.status<>'em_analise' THEN RAISE EXCEPTION 'estado_invalido_para_transicao' USING ERRCODE='P0001'; END IF;
  UPDATE public.bd_chamados_internos AS c SET status='respondido' WHERE c.id=p_chamado_id RETURNING c.* INTO v_nov;
  INSERT INTO public.bd_chamado_interno_eventos (chamado_id,tipo,autor_profile_id,mensagem,status_anterior,status_novo,visivel_solicitante,payload)
  VALUES (p_chamado_id,'resposta_atendente',v_uid,v_msg,v_ant.status,'respondido',true,'{}'::jsonb);
  INSERT INTO public.bd_auditoria_log (tabela,registro_id,operacao,dados_anteriores,dados_novos,campos_alterados,usuario_id)
  VALUES ('bd_chamados_internos',p_chamado_id::text,'UPDATE',to_jsonb(v_ant),
          to_jsonb(v_nov)||jsonb_build_object('acao_chamado','responder'),ARRAY['status'],v_uid);
END;
$function$;

-- ============== 4) SOLICITAR INFORMAÇÃO ==============
CREATE FUNCTION public.fn_chamado_interno_solicitar_informacao(p_chamado_id uuid, p_mensagem text)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_msg text := btrim(coalesce(p_mensagem,''));
  v_ant public.bd_chamados_internos%ROWTYPE;
  v_nov public.bd_chamados_internos%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE='28000'; END IF;
  IF p_chamado_id IS NULL THEN RAISE EXCEPTION 'parametros_obrigatorios' USING ERRCODE='22004'; END IF;
  IF v_msg='' THEN RAISE EXCEPTION 'mensagem_obrigatoria' USING ERRCODE='22004'; END IF;
  SELECT c.* INTO v_ant FROM public.bd_chamados_internos c WHERE c.id=p_chamado_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'chamado_inexistente' USING ERRCODE='P0002'; END IF;
  IF public.user_has_permission_action(v_uid,'chamados_internos_view','visualizar') IS NOT TRUE
     OR public.user_has_permission_action(v_uid,'chamados_internos_atender','editar') IS NOT TRUE
     OR NOT EXISTS (SELECT 1 FROM public.bd_chamado_interno_atendentes a
                    WHERE a.atendente_profile_id=v_uid AND a.setor=v_ant.setor AND a.ativo IS TRUE)
     OR v_ant.responsavel_atual_profile_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  IF v_ant.status NOT IN ('em_triagem','em_analise') THEN
    RAISE EXCEPTION 'estado_invalido_para_transicao' USING ERRCODE='P0001';
  END IF;
  UPDATE public.bd_chamados_internos AS c SET status='aguardando_solicitante'
  WHERE c.id=p_chamado_id RETURNING c.* INTO v_nov;
  INSERT INTO public.bd_chamado_interno_eventos (chamado_id,tipo,autor_profile_id,mensagem,status_anterior,status_novo,visivel_solicitante,payload)
  VALUES (p_chamado_id,'solicitacao_informacao',v_uid,v_msg,v_ant.status,'aguardando_solicitante',true,'{}'::jsonb);
  INSERT INTO public.bd_auditoria_log (tabela,registro_id,operacao,dados_anteriores,dados_novos,campos_alterados,usuario_id)
  VALUES ('bd_chamados_internos',p_chamado_id::text,'UPDATE',to_jsonb(v_ant),
          to_jsonb(v_nov)||jsonb_build_object('acao_chamado','solicitar_informacao'),ARRAY['status'],v_uid);
END;
$function$;

-- ============== 5) NOTA INTERNA ==============
CREATE FUNCTION public.fn_chamado_interno_adicionar_nota_interna(p_chamado_id uuid, p_mensagem text)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_msg text := btrim(coalesce(p_mensagem,''));
  v_ant public.bd_chamados_internos%ROWTYPE;
  v_nov public.bd_chamados_internos%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE='28000'; END IF;
  IF p_chamado_id IS NULL THEN RAISE EXCEPTION 'parametros_obrigatorios' USING ERRCODE='22004'; END IF;
  IF v_msg='' THEN RAISE EXCEPTION 'mensagem_obrigatoria' USING ERRCODE='22004'; END IF;
  SELECT c.* INTO v_ant FROM public.bd_chamados_internos c WHERE c.id=p_chamado_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'chamado_inexistente' USING ERRCODE='P0002'; END IF;
  IF public.user_has_permission_action(v_uid,'chamados_internos_view','visualizar') IS NOT TRUE
     OR public.user_has_permission_action(v_uid,'chamados_internos_atender','editar') IS NOT TRUE
     OR NOT EXISTS (SELECT 1 FROM public.bd_chamado_interno_atendentes a
                    WHERE a.atendente_profile_id=v_uid AND a.setor=v_ant.setor AND a.ativo IS TRUE)
     OR v_ant.responsavel_atual_profile_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  IF v_ant.status IN ('encerrado','cancelado') THEN
    RAISE EXCEPTION 'estado_invalido_para_transicao' USING ERRCODE='P0001';
  END IF;
  UPDATE public.bd_chamados_internos AS c SET updated_at=now()
  WHERE c.id=p_chamado_id RETURNING c.* INTO v_nov;
  INSERT INTO public.bd_chamado_interno_eventos (chamado_id,tipo,autor_profile_id,mensagem,status_anterior,status_novo,visivel_solicitante,payload)
  VALUES (p_chamado_id,'nota_interna',v_uid,v_msg,v_ant.status,v_ant.status,false,'{}'::jsonb);
  INSERT INTO public.bd_auditoria_log (tabela,registro_id,operacao,dados_anteriores,dados_novos,campos_alterados,usuario_id)
  VALUES ('bd_chamados_internos',p_chamado_id::text,'UPDATE',to_jsonb(v_ant),
          to_jsonb(v_nov)||jsonb_build_object('acao_chamado','adicionar_nota_interna'),ARRAY['updated_at'],v_uid);
END;
$function$;

-- ============== 6) RESOLVER ==============
CREATE FUNCTION public.fn_chamado_interno_resolver(p_chamado_id uuid, p_mensagem text)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_msg text := btrim(coalesce(p_mensagem,''));
  v_ant public.bd_chamados_internos%ROWTYPE;
  v_nov public.bd_chamados_internos%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE='28000'; END IF;
  IF p_chamado_id IS NULL THEN RAISE EXCEPTION 'parametros_obrigatorios' USING ERRCODE='22004'; END IF;
  IF v_msg='' THEN RAISE EXCEPTION 'mensagem_obrigatoria' USING ERRCODE='22004'; END IF;
  SELECT c.* INTO v_ant FROM public.bd_chamados_internos c WHERE c.id=p_chamado_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'chamado_inexistente' USING ERRCODE='P0002'; END IF;
  IF public.user_has_permission_action(v_uid,'chamados_internos_view','visualizar') IS NOT TRUE
     OR public.user_has_permission_action(v_uid,'chamados_internos_atender','editar') IS NOT TRUE
     OR NOT EXISTS (SELECT 1 FROM public.bd_chamado_interno_atendentes a
                    WHERE a.atendente_profile_id=v_uid AND a.setor=v_ant.setor AND a.ativo IS TRUE)
     OR v_ant.responsavel_atual_profile_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  IF v_ant.status NOT IN ('em_analise','respondido') THEN
    RAISE EXCEPTION 'estado_invalido_para_transicao' USING ERRCODE='P0001';
  END IF;
  UPDATE public.bd_chamados_internos AS c SET status='resolvido' WHERE c.id=p_chamado_id RETURNING c.* INTO v_nov;
  INSERT INTO public.bd_chamado_interno_eventos (chamado_id,tipo,autor_profile_id,mensagem,status_anterior,status_novo,visivel_solicitante,payload)
  VALUES (p_chamado_id,'resolucao',v_uid,v_msg,v_ant.status,'resolvido',true,'{}'::jsonb);
  INSERT INTO public.bd_auditoria_log (tabela,registro_id,operacao,dados_anteriores,dados_novos,campos_alterados,usuario_id)
  VALUES ('bd_chamados_internos',p_chamado_id::text,'UPDATE',to_jsonb(v_ant),
          to_jsonb(v_nov)||jsonb_build_object('acao_chamado','resolver'),ARRAY['status'],v_uid);
END;
$function$;

-- ============== 7) RESPONDER SOLICITANTE ==============
CREATE FUNCTION public.fn_chamado_interno_responder_solicitante(p_chamado_id uuid, p_mensagem text)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_msg text := btrim(coalesce(p_mensagem,''));
  v_ant public.bd_chamados_internos%ROWTYPE;
  v_nov public.bd_chamados_internos%ROWTYPE;
  v_is_admin boolean;
  v_is_requester_actor boolean;
  v_fid uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE='28000'; END IF;
  IF p_chamado_id IS NULL THEN RAISE EXCEPTION 'parametros_obrigatorios' USING ERRCODE='22004'; END IF;
  IF v_msg='' THEN RAISE EXCEPTION 'mensagem_obrigatoria' USING ERRCODE='22004'; END IF;
  SELECT c.* INTO v_ant FROM public.bd_chamados_internos c WHERE c.id=p_chamado_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'chamado_inexistente' USING ERRCODE='P0002'; END IF;

  v_fid := public.get_user_funcionario_id(v_uid);
  v_is_admin := public.user_has_permission_action(v_uid,'chamados_internos_admin','editar') IS TRUE;
  v_is_requester_actor :=
    (public.user_has_permission_action(v_uid,'chamados_internos_abrir','editar') IS TRUE)
    AND (
      v_ant.aberto_por = v_uid
      OR (v_fid IS NOT NULL AND v_ant.solicitante_funcionario_id = v_fid)
    );
  IF public.user_has_permission_action(v_uid,'chamados_internos_view','visualizar') IS NOT TRUE
     OR (v_is_admin OR v_is_requester_actor) IS NOT TRUE THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  IF v_ant.status<>'aguardando_solicitante' THEN
    RAISE EXCEPTION 'estado_invalido_para_transicao' USING ERRCODE='P0001';
  END IF;
  UPDATE public.bd_chamados_internos AS c SET status='em_analise' WHERE c.id=p_chamado_id RETURNING c.* INTO v_nov;
  INSERT INTO public.bd_chamado_interno_eventos (chamado_id,tipo,autor_profile_id,mensagem,status_anterior,status_novo,visivel_solicitante,payload)
  VALUES (p_chamado_id,'resposta_solicitante',v_uid,v_msg,v_ant.status,'em_analise',true,'{}'::jsonb);
  INSERT INTO public.bd_auditoria_log (tabela,registro_id,operacao,dados_anteriores,dados_novos,campos_alterados,usuario_id)
  VALUES ('bd_chamados_internos',p_chamado_id::text,'UPDATE',to_jsonb(v_ant),
          to_jsonb(v_nov)||jsonb_build_object('acao_chamado','responder_solicitante'),ARRAY['status'],v_uid);
END;
$function$;

-- ============== 8) CONFIRMAR ENCERRAMENTO ==============
CREATE FUNCTION public.fn_chamado_interno_confirmar_encerramento(p_chamado_id uuid)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_ant public.bd_chamados_internos%ROWTYPE;
  v_nov public.bd_chamados_internos%ROWTYPE;
  v_is_admin boolean;
  v_is_requester_actor boolean;
  v_fid uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE='28000'; END IF;
  IF p_chamado_id IS NULL THEN RAISE EXCEPTION 'parametros_obrigatorios' USING ERRCODE='22004'; END IF;
  SELECT c.* INTO v_ant FROM public.bd_chamados_internos c WHERE c.id=p_chamado_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'chamado_inexistente' USING ERRCODE='P0002'; END IF;

  v_fid := public.get_user_funcionario_id(v_uid);
  v_is_admin := public.user_has_permission_action(v_uid,'chamados_internos_admin','editar') IS TRUE;
  v_is_requester_actor :=
    (public.user_has_permission_action(v_uid,'chamados_internos_abrir','editar') IS TRUE)
    AND (
      v_ant.aberto_por = v_uid
      OR (v_fid IS NOT NULL AND v_ant.solicitante_funcionario_id = v_fid)
    );
  IF public.user_has_permission_action(v_uid,'chamados_internos_view','visualizar') IS NOT TRUE
     OR (v_is_admin OR v_is_requester_actor) IS NOT TRUE THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  IF v_ant.status<>'resolvido' THEN
    RAISE EXCEPTION 'estado_invalido_para_transicao' USING ERRCODE='P0001';
  END IF;
  UPDATE public.bd_chamados_internos AS c SET status='encerrado' WHERE c.id=p_chamado_id RETURNING c.* INTO v_nov;
  INSERT INTO public.bd_chamado_interno_eventos (chamado_id,tipo,autor_profile_id,mensagem,status_anterior,status_novo,visivel_solicitante,payload)
  VALUES (p_chamado_id,'confirmacao_encerramento',v_uid,'Encerramento confirmado.',v_ant.status,'encerrado',true,'{}'::jsonb);
  INSERT INTO public.bd_auditoria_log (tabela,registro_id,operacao,dados_anteriores,dados_novos,campos_alterados,usuario_id)
  VALUES ('bd_chamados_internos',p_chamado_id::text,'UPDATE',to_jsonb(v_ant),
          to_jsonb(v_nov)||jsonb_build_object('acao_chamado','confirmar_encerramento'),ARRAY['status'],v_uid);
END;
$function$;

-- ============== 9) REABRIR ==============
CREATE FUNCTION public.fn_chamado_interno_reabrir(p_chamado_id uuid, p_mensagem text)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_msg text := btrim(coalesce(p_mensagem,''));
  v_ant public.bd_chamados_internos%ROWTYPE;
  v_nov public.bd_chamados_internos%ROWTYPE;
  v_is_admin boolean;
  v_is_requester_actor boolean;
  v_fid uuid;
  v_campos_alterados text[];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE='28000'; END IF;
  IF p_chamado_id IS NULL THEN RAISE EXCEPTION 'parametros_obrigatorios' USING ERRCODE='22004'; END IF;
  IF v_msg='' THEN RAISE EXCEPTION 'mensagem_obrigatoria' USING ERRCODE='22004'; END IF;
  SELECT c.* INTO v_ant FROM public.bd_chamados_internos c WHERE c.id=p_chamado_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'chamado_inexistente' USING ERRCODE='P0002'; END IF;

  v_fid := public.get_user_funcionario_id(v_uid);
  v_is_admin := public.user_has_permission_action(v_uid,'chamados_internos_admin','editar') IS TRUE;
  v_is_requester_actor :=
    (public.user_has_permission_action(v_uid,'chamados_internos_abrir','editar') IS TRUE)
    AND (
      v_ant.aberto_por = v_uid
      OR (v_fid IS NOT NULL AND v_ant.solicitante_funcionario_id = v_fid)
    );
  IF public.user_has_permission_action(v_uid,'chamados_internos_view','visualizar') IS NOT TRUE
     OR (v_is_admin OR v_is_requester_actor) IS NOT TRUE THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  IF v_ant.status NOT IN ('respondido','resolvido','encerrado') THEN
    RAISE EXCEPTION 'estado_invalido_para_transicao' USING ERRCODE='P0001';
  END IF;

  UPDATE public.bd_chamados_internos AS c
  SET status='reaberto', responsavel_atual_profile_id=NULL
  WHERE c.id=p_chamado_id RETURNING c.* INTO v_nov;

  v_campos_alterados := ARRAY['status'];
  IF v_ant.responsavel_atual_profile_id IS NOT NULL THEN
    v_campos_alterados := v_campos_alterados || 'responsavel_atual_profile_id';
  END IF;

  INSERT INTO public.bd_chamado_interno_eventos (chamado_id,tipo,autor_profile_id,mensagem,status_anterior,status_novo,visivel_solicitante,payload)
  VALUES (p_chamado_id,'reabertura',v_uid,v_msg,v_ant.status,'reaberto',true,'{}'::jsonb);
  INSERT INTO public.bd_auditoria_log (tabela,registro_id,operacao,dados_anteriores,dados_novos,campos_alterados,usuario_id)
  VALUES ('bd_chamados_internos',p_chamado_id::text,'UPDATE',to_jsonb(v_ant),
          to_jsonb(v_nov)||jsonb_build_object('acao_chamado','reabrir'),v_campos_alterados,v_uid);
END;
$function$;

-- ============== 10) CANCELAR ==============
CREATE FUNCTION public.fn_chamado_interno_cancelar(p_chamado_id uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_msg text := btrim(coalesce(p_motivo,''));
  v_ant public.bd_chamados_internos%ROWTYPE;
  v_nov public.bd_chamados_internos%ROWTYPE;
  v_is_admin boolean;
  v_is_requester_actor boolean;
  v_fid uuid;
  v_campos_alterados text[];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE='28000'; END IF;
  IF p_chamado_id IS NULL THEN RAISE EXCEPTION 'parametros_obrigatorios' USING ERRCODE='22004'; END IF;
  IF v_msg='' THEN RAISE EXCEPTION 'mensagem_obrigatoria' USING ERRCODE='22004'; END IF;
  SELECT c.* INTO v_ant FROM public.bd_chamados_internos c WHERE c.id=p_chamado_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'chamado_inexistente' USING ERRCODE='P0002'; END IF;

  v_fid := public.get_user_funcionario_id(v_uid);
  v_is_admin := public.user_has_permission_action(v_uid,'chamados_internos_admin','editar') IS TRUE;
  v_is_requester_actor :=
    (public.user_has_permission_action(v_uid,'chamados_internos_abrir','editar') IS TRUE)
    AND (
      v_ant.aberto_por = v_uid
      OR (v_fid IS NOT NULL AND v_ant.solicitante_funcionario_id = v_fid)
    );
  IF public.user_has_permission_action(v_uid,'chamados_internos_view','visualizar') IS NOT TRUE
     OR (v_is_admin OR v_is_requester_actor) IS NOT TRUE THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  IF v_ant.status NOT IN ('aberto','em_triagem','aguardando_solicitante') THEN
    RAISE EXCEPTION 'estado_invalido_para_transicao' USING ERRCODE='P0001';
  END IF;

  UPDATE public.bd_chamados_internos AS c
  SET status='cancelado', responsavel_atual_profile_id=NULL
  WHERE c.id=p_chamado_id RETURNING c.* INTO v_nov;

  v_campos_alterados := ARRAY['status'];
  IF v_ant.responsavel_atual_profile_id IS NOT NULL THEN
    v_campos_alterados := v_campos_alterados || 'responsavel_atual_profile_id';
  END IF;

  INSERT INTO public.bd_chamado_interno_eventos (chamado_id,tipo,autor_profile_id,mensagem,status_anterior,status_novo,visivel_solicitante,payload)
  VALUES (p_chamado_id,'cancelamento',v_uid,v_msg,v_ant.status,'cancelado',true,'{}'::jsonb);
  INSERT INTO public.bd_auditoria_log (tabela,registro_id,operacao,dados_anteriores,dados_novos,campos_alterados,usuario_id)
  VALUES ('bd_chamados_internos',p_chamado_id::text,'UPDATE',to_jsonb(v_ant),
          to_jsonb(v_nov)||jsonb_build_object('acao_chamado','cancelar'),v_campos_alterados,v_uid);
END;
$function$;

-- ============== REVOKE (exatamente 10) ==============
REVOKE ALL ON FUNCTION public.fn_chamado_interno_abrir(uuid,uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_chamado_interno_assumir(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_chamado_interno_responder(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_chamado_interno_solicitar_informacao(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_chamado_interno_adicionar_nota_interna(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_chamado_interno_resolver(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_chamado_interno_responder_solicitante(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_chamado_interno_confirmar_encerramento(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_chamado_interno_reabrir(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_chamado_interno_cancelar(uuid,text) FROM PUBLIC, anon, authenticated;

-- ============== GRANT EXECUTE (exatamente 10) ==============
GRANT EXECUTE ON FUNCTION public.fn_chamado_interno_abrir(uuid,uuid,uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_chamado_interno_assumir(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_chamado_interno_responder(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_chamado_interno_solicitar_informacao(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_chamado_interno_adicionar_nota_interna(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_chamado_interno_resolver(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_chamado_interno_responder_solicitante(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_chamado_interno_confirmar_encerramento(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_chamado_interno_reabrir(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_chamado_interno_cancelar(uuid,text) TO authenticated;

-- ============== VALIDAÇÃO PRÉ-COMMIT ==============
DO $outer$
DECLARE
  v_sigs regprocedure[] := ARRAY[
    'public.fn_chamado_interno_abrir(uuid,uuid,uuid,text,text)'::regprocedure,
    'public.fn_chamado_interno_assumir(uuid)'::regprocedure,
    'public.fn_chamado_interno_responder(uuid,text)'::regprocedure,
    'public.fn_chamado_interno_solicitar_informacao(uuid,text)'::regprocedure,
    'public.fn_chamado_interno_adicionar_nota_interna(uuid,text)'::regprocedure,
    'public.fn_chamado_interno_resolver(uuid,text)'::regprocedure,
    'public.fn_chamado_interno_responder_solicitante(uuid,text)'::regprocedure,
    'public.fn_chamado_interno_confirmar_encerramento(uuid)'::regprocedure,
    'public.fn_chamado_interno_reabrir(uuid,text)'::regprocedure,
    'public.fn_chamado_interno_cancelar(uuid,text)'::regprocedure
  ];
  v_sig regprocedure;
  v_rec record;
  v_public_execute boolean;
  v_policy_ok int;
  v_policy_count int;
  v_acl_ok int;
  v_m5_function_count integer;
BEGIN
  FOREACH v_sig IN ARRAY v_sigs LOOP
    SELECT p.oid, p.provolatile, p.prosecdef, p.proconfig, p.proargnames,
           pg_get_userbyid(p.proowner) AS function_owner
    INTO v_rec FROM pg_proc p WHERE p.oid = v_sig::oid;
    IF NOT FOUND THEN RAISE EXCEPTION 'm5_function_missing: %', v_sig; END IF;
    IF v_rec.provolatile <> 'v' THEN RAISE EXCEPTION 'm5_not_volatile: %', v_sig; END IF;
    IF v_rec.prosecdef IS NOT TRUE THEN RAISE EXCEPTION 'm5_not_security_definer: %', v_sig; END IF;
    IF v_rec.proconfig IS NULL OR NOT (v_rec.proconfig @> ARRAY['search_path=public']) THEN
      RAISE EXCEPTION 'm5_search_path_invalid: %', v_sig;
    END IF;
    IF v_rec.function_owner <> 'postgres' THEN
      RAISE EXCEPTION 'm5_owner_invalid: %, owner=%', v_sig, v_rec.function_owner;
    END IF;
    IF has_function_privilege('authenticated', v_sig, 'EXECUTE') IS NOT TRUE THEN
      RAISE EXCEPTION 'm5_authenticated_execute_missing: %', v_sig;
    END IF;
    IF has_function_privilege('anon', v_sig, 'EXECUTE') IS TRUE THEN
      RAISE EXCEPTION 'm5_anon_execute_present: %', v_sig;
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM pg_proc p
      CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) ax
      WHERE p.oid = v_sig::oid AND ax.grantee = 0 AND ax.privilege_type = 'EXECUTE'
    ) INTO v_public_execute;
    IF v_public_execute IS TRUE THEN RAISE EXCEPTION 'm5_public_execute_present: %', v_sig; END IF;
    IF v_rec.proargnames IS NOT NULL AND EXISTS (
      SELECT 1 FROM unnest(v_rec.proargnames) AS a(argname)
      WHERE a.argname IN ('p_user_id','user_id','p_autor','p_autor_id','autor_id','p_status',
                         'p_setor','p_prioridade','p_is_critico','p_visivel','p_visivel_solicitante')
    ) THEN RAISE EXCEPTION 'm5_forbidden_parameter: %', v_sig; END IF;
  END LOOP;

  SELECT count(*) INTO v_m5_function_count
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname='public'
    AND p.proname IN (
      'fn_chamado_interno_abrir','fn_chamado_interno_assumir','fn_chamado_interno_responder',
      'fn_chamado_interno_solicitar_informacao','fn_chamado_interno_adicionar_nota_interna',
      'fn_chamado_interno_resolver','fn_chamado_interno_responder_solicitante',
      'fn_chamado_interno_confirmar_encerramento','fn_chamado_interno_reabrir','fn_chamado_interno_cancelar'
    );
  IF v_m5_function_count <> 10 THEN
    RAISE EXCEPTION 'm5_function_count_invalid: %', v_m5_function_count;
  END IF;

  SELECT count(*) INTO v_policy_ok
  FROM (VALUES
    ('bd_chamado_interno_categorias','chamado_interno_categorias_select'),
    ('bd_chamados_internos','chamados_internos_select'),
    ('bd_chamado_interno_eventos','chamado_interno_eventos_select'),
    ('bd_chamado_interno_atendentes','chamado_interno_atendentes_select')
  ) AS e(tablename, policyname)
  JOIN pg_policies p ON p.schemaname='public' AND p.tablename=e.tablename
   AND p.policyname=e.policyname AND p.cmd='SELECT' AND p.permissive='PERMISSIVE'
   AND p.roles::text[] IS NOT DISTINCT FROM ARRAY['authenticated']::text[];
  IF v_policy_ok <> 4 THEN RAISE EXCEPTION 'm4_exact_policies_invalid_after_m5: %', v_policy_ok; END IF;

  SELECT count(*) INTO v_policy_count FROM pg_policies p
  WHERE p.schemaname='public' AND p.tablename IN (
    'bd_chamado_interno_categorias','bd_chamados_internos',
    'bd_chamado_interno_eventos','bd_chamado_interno_atendentes'
  );
  IF v_policy_count <> 4 THEN RAISE EXCEPTION 'm4_policy_count_invalid_after_m5: %', v_policy_count; END IF;

  SELECT count(*) INTO v_acl_ok
  FROM (VALUES
    ('public.bd_chamado_interno_categorias'),
    ('public.bd_chamados_internos'),
    ('public.bd_chamado_interno_eventos'),
    ('public.bd_chamado_interno_atendentes')
  ) AS t(tabela)
  WHERE has_table_privilege('authenticated', t.tabela, 'SELECT')
    AND NOT has_table_privilege('authenticated', t.tabela, 'INSERT')
    AND NOT has_table_privilege('authenticated', t.tabela, 'UPDATE')
    AND NOT has_table_privilege('authenticated', t.tabela, 'DELETE')
    AND NOT has_table_privilege('authenticated', t.tabela, 'TRUNCATE')
    AND NOT has_table_privilege('authenticated', t.tabela, 'REFERENCES')
    AND NOT has_table_privilege('authenticated', t.tabela, 'TRIGGER')
    AND NOT has_table_privilege('anon', t.tabela, 'SELECT')
    AND NOT has_table_privilege('anon', t.tabela, 'INSERT')
    AND NOT has_table_privilege('anon', t.tabela, 'UPDATE')
    AND NOT has_table_privilege('anon', t.tabela, 'DELETE')
    AND NOT has_table_privilege('anon', t.tabela, 'TRUNCATE')
    AND NOT has_table_privilege('anon', t.tabela, 'REFERENCES')
    AND NOT has_table_privilege('anon', t.tabela, 'TRIGGER')
    AND NOT EXISTS (
      SELECT 1 FROM pg_class c
      CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) ax
      WHERE c.oid = t.tabela::regclass AND ax.grantee = 0
    );
  IF v_acl_ok <> 4 THEN RAISE EXCEPTION 'module_table_acl_invalid_after_m5: %', v_acl_ok; END IF;
END
$outer$;

COMMIT;