-- =============================================================================
-- M10-A v2 — Escopo operacional dos Chamados Internos
-- Alvo: escopo can_operate/can_read + 5 RPCs operacionais + policy eventos + RPC fila
-- Fonte: pg_get_functiondef (READ-ONLY) capturado antes da redação.
-- NÃO EXECUTAR nesta rodada.
-- =============================================================================
BEGIN;

-- -----------------------------------------------------------------------------
-- 1) PREFLIGHT — asserts das dependências e dos objetos que serão substituídos
-- -----------------------------------------------------------------------------
DO $preflight$
DECLARE
  v_missing text;
BEGIN
  -- Dependências invocadas pelas novas funções
  PERFORM 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='fn_is_super_admin'
     AND pg_get_function_identity_arguments(p.oid)='p_user_id uuid';
  IF NOT FOUND THEN RAISE EXCEPTION 'dependencia_ausente: public.fn_is_super_admin(uuid)'; END IF;

  PERFORM 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='user_has_permission_action'
     AND pg_get_function_identity_arguments(p.oid)='_user_id uuid, _codigo text, _acao text';
  IF NOT FOUND THEN RAISE EXCEPTION 'dependencia_ausente: public.user_has_permission_action(uuid,text,text)'; END IF;

  PERFORM 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='get_user_funcionario_id'
     AND pg_get_function_identity_arguments(p.oid)='user_id uuid';
  IF NOT FOUND THEN RAISE EXCEPTION 'dependencia_ausente: public.get_user_funcionario_id(uuid)'; END IF;

  PERFORM 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='fn_chamado_interno_can_attend'
     AND pg_get_function_identity_arguments(p.oid)='p_setor chamado_interno_setor';
  IF NOT FOUND THEN RAISE EXCEPTION 'dependencia_ausente: public.fn_chamado_interno_can_attend(chamado_interno_setor)'; END IF;

  -- Objetos que serão substituídos
  FOR v_missing IN
    SELECT expected
      FROM (VALUES
        ('fn_chamado_interno_can_read(p_chamado_id uuid)'),
        ('fn_chamado_interno_assumir(p_chamado_id uuid)'),
        ('fn_chamado_interno_responder(p_chamado_id uuid, p_mensagem text)'),
        ('fn_chamado_interno_solicitar_informacao(p_chamado_id uuid, p_mensagem text)'),
        ('fn_chamado_interno_adicionar_nota_interna(p_chamado_id uuid, p_mensagem text)'),
        ('fn_chamado_interno_resolver(p_chamado_id uuid, p_mensagem text)')
      ) t(expected)
     WHERE NOT EXISTS (
       SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public'
          AND (p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')') = t.expected
     )
  LOOP
    RAISE EXCEPTION 'funcao_alvo_ausente: %', v_missing;
  END LOOP;

  -- Policy alvo
  PERFORM 1 FROM pg_policies
   WHERE schemaname='public' AND tablename='bd_chamado_interno_eventos'
     AND policyname='chamado_interno_eventos_select';
  IF NOT FOUND THEN RAISE EXCEPTION 'policy_alvo_ausente: chamado_interno_eventos_select'; END IF;

  -- Confirma que as duas funções novas NÃO existem ainda (idempotência de criação)
  PERFORM 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='fn_chamado_interno_can_operate'
     AND pg_get_function_identity_arguments(p.oid)='p_chamado_id uuid';
  IF FOUND THEN RAISE EXCEPTION 'colisao: public.fn_chamado_interno_can_operate(uuid) ja existe'; END IF;

  PERFORM 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='fn_chamado_interno_listar_fila_atendimento';
  IF FOUND THEN RAISE EXCEPTION 'colisao: public.fn_chamado_interno_listar_fila_atendimento ja existe'; END IF;
END
$preflight$;

-- -----------------------------------------------------------------------------
-- 2) NOVA FUNÇÃO: fn_chamado_interno_can_operate(uuid)
--    Ordem: valida uid+param -> carrega chamado -> se inexistente RETURN FALSE
--           -> SuperAdm/acesso_global -> AdmSede -> atendente setorial -> false
--    AdmSede e atendente setorial exigem cumulativamente:
--      chamados_internos_view/visualizar, atender/visualizar, atender/editar.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_chamado_interno_can_operate(p_chamado_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_fid uuid;
  v_cc  uuid;
  v_setor public.chamado_interno_setor;
  v_adm_sede uuid;
  v_acesso_global boolean;
  v_has_min_ops boolean;
BEGIN
  IF v_uid IS NULL OR p_chamado_id IS NULL THEN
    RETURN false;
  END IF;

  -- Carrega o chamado; se não existir, sempre false (inclusive SuperAdm).
  SELECT c.centro_custo_id, c.setor
    INTO v_cc, v_setor
    FROM public.bd_chamados_internos c
   WHERE c.id = p_chamado_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- SuperAdm / acesso_global
  IF public.fn_is_super_admin(v_uid) THEN
    RETURN true;
  END IF;
  SELECT p.acesso_global INTO v_acesso_global
    FROM public.profiles p WHERE p.id = v_uid;
  IF v_acesso_global IS TRUE THEN
    RETURN true;
  END IF;

  -- Guardas mínimos comuns exigidos para AdmSede e atendente setorial
  v_has_min_ops :=
       public.user_has_permission_action(v_uid,'chamados_internos_view','visualizar') IS TRUE
   AND public.user_has_permission_action(v_uid,'chamados_internos_atender','visualizar') IS TRUE
   AND public.user_has_permission_action(v_uid,'chamados_internos_atender','editar') IS TRUE;
  IF NOT v_has_min_ops THEN
    RETURN false;
  END IF;

  -- AdmSede responsável pelo CC do chamado
  v_fid := public.get_user_funcionario_id(v_uid);
  IF v_fid IS NOT NULL THEN
    SELECT cc.adm_sede_funcionario_id
      INTO v_adm_sede
      FROM public.bd_centros_custo cc
     WHERE cc.id = v_cc;
    IF v_adm_sede IS NOT NULL AND v_adm_sede = v_fid THEN
      RETURN true;
    END IF;
  END IF;

  -- Atendente setorial com vínculo ativo
  IF EXISTS (
    SELECT 1
      FROM public.bd_chamado_interno_atendentes a
     WHERE a.atendente_profile_id = v_uid
       AND a.setor = v_setor
       AND a.ativo IS TRUE
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$function$;

ALTER FUNCTION public.fn_chamado_interno_can_operate(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_chamado_interno_can_operate(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_chamado_interno_can_operate(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_chamado_interno_can_operate(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_chamado_interno_can_operate(uuid) TO service_role;

-- -----------------------------------------------------------------------------
-- 3) SUBSTITUIÇÃO: fn_chamado_interno_can_read(uuid)
--    Preserva integralmente os caminhos anteriores.
--    Ordem: valida uid+param -> carrega chamado (false se inexistente)
--           -> SuperAdm/acesso_global global
--           -> permissão view/visualizar (guarda comum)
--           -> admin do módulo -> aberto_por -> solicitante_funcionario_id
--           -> AdmSede do CC (apenas view/visualizar)
--           -> fallback fn_chamado_interno_can_attend(setor)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_chamado_interno_can_read(p_chamado_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_fid uuid;
  v_acesso_global boolean;
  v_adm_sede uuid;
  r record;
BEGIN
  IF v_uid IS NULL OR p_chamado_id IS NULL THEN
    RETURN false;
  END IF;

  -- Carrega o chamado antes de qualquer ramo global.
  SELECT solicitante_funcionario_id, aberto_por, setor, centro_custo_id
    INTO r
    FROM public.bd_chamados_internos
   WHERE id = p_chamado_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- SuperAdm / acesso_global (após confirmar existência do chamado)
  IF public.fn_is_super_admin(v_uid) THEN
    RETURN true;
  END IF;
  SELECT p.acesso_global INTO v_acesso_global
    FROM public.profiles p WHERE p.id = v_uid;
  IF v_acesso_global IS TRUE THEN
    RETURN true;
  END IF;

  -- Guarda comum de leitura
  IF NOT public.user_has_permission_action(v_uid,'chamados_internos_view','visualizar') THEN
    RETURN false;
  END IF;

  -- Admin do módulo
  IF public.user_has_permission_action(v_uid,'chamados_internos_admin','visualizar') THEN
    RETURN true;
  END IF;

  -- Autor do chamado
  IF r.aberto_por = v_uid THEN
    RETURN true;
  END IF;

  -- Solicitante (funcionario vinculado ao próprio user)
  v_fid := public.get_user_funcionario_id(v_uid);
  IF v_fid IS NOT NULL AND r.solicitante_funcionario_id = v_fid THEN
    RETURN true;
  END IF;

  -- AdmSede responsável pelo CC (apenas view/visualizar, sem exigir atender)
  IF v_fid IS NOT NULL THEN
    SELECT cc.adm_sede_funcionario_id INTO v_adm_sede
      FROM public.bd_centros_custo cc
     WHERE cc.id = r.centro_custo_id;
    IF v_adm_sede IS NOT NULL AND v_adm_sede = v_fid THEN
      RETURN true;
    END IF;
  END IF;

  -- Fallback: atendente setorial (mantém compatibilidade com policy anterior)
  RETURN public.fn_chamado_interno_can_attend(r.setor);
END;
$function$;

ALTER FUNCTION public.fn_chamado_interno_can_read(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_chamado_interno_can_read(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_chamado_interno_can_read(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_chamado_interno_can_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_chamado_interno_can_read(uuid) TO service_role;

-- -----------------------------------------------------------------------------
-- 4) fn_chamado_interno_assumir — corpo completo (única alteração: gate)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_chamado_interno_assumir(p_chamado_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  IF public.fn_chamado_interno_can_operate(p_chamado_id) IS NOT TRUE THEN
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

ALTER FUNCTION public.fn_chamado_interno_assumir(uuid) OWNER TO postgres;

-- -----------------------------------------------------------------------------
-- 5) fn_chamado_interno_responder — corpo completo (única alteração: gate)
--    Mantém validação nominal "responsavel_atual_profile_id = v_uid" APÓS o gate.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_chamado_interno_responder(p_chamado_id uuid, p_mensagem text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  IF public.fn_chamado_interno_can_operate(p_chamado_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  IF v_ant.responsavel_atual_profile_id IS DISTINCT FROM v_uid THEN
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

ALTER FUNCTION public.fn_chamado_interno_responder(uuid, text) OWNER TO postgres;

-- -----------------------------------------------------------------------------
-- 6) fn_chamado_interno_solicitar_informacao — corpo completo (única alteração: gate)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_chamado_interno_solicitar_informacao(p_chamado_id uuid, p_mensagem text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  IF public.fn_chamado_interno_can_operate(p_chamado_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  IF v_ant.responsavel_atual_profile_id IS DISTINCT FROM v_uid THEN
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

ALTER FUNCTION public.fn_chamado_interno_solicitar_informacao(uuid, text) OWNER TO postgres;

-- -----------------------------------------------------------------------------
-- 7) fn_chamado_interno_adicionar_nota_interna — corpo completo (única alteração: gate)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_chamado_interno_adicionar_nota_interna(p_chamado_id uuid, p_mensagem text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  IF public.fn_chamado_interno_can_operate(p_chamado_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  IF v_ant.responsavel_atual_profile_id IS DISTINCT FROM v_uid THEN
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

ALTER FUNCTION public.fn_chamado_interno_adicionar_nota_interna(uuid, text) OWNER TO postgres;

-- -----------------------------------------------------------------------------
-- 8) fn_chamado_interno_resolver — corpo completo (única alteração: gate)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_chamado_interno_resolver(p_chamado_id uuid, p_mensagem text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  IF public.fn_chamado_interno_can_operate(p_chamado_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  IF v_ant.responsavel_atual_profile_id IS DISTINCT FROM v_uid THEN
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

ALTER FUNCTION public.fn_chamado_interno_resolver(uuid, text) OWNER TO postgres;

-- -----------------------------------------------------------------------------
-- 9) POLICY chamado_interno_eventos_select (SELECT, PERMISSIVE, TO authenticated)
--    Preserva escopo de roles do original. Nota interna continua invisível ao
--    solicitante — visibilidade extra restrita a operadores legítimos.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS chamado_interno_eventos_select ON public.bd_chamado_interno_eventos;
CREATE POLICY chamado_interno_eventos_select
ON public.bd_chamado_interno_eventos
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  public.fn_chamado_interno_can_read(chamado_id)
  AND (
    visivel_solicitante IS TRUE
    OR public.fn_is_super_admin(auth.uid())
    OR public.user_has_permission_action(auth.uid(),'chamados_internos_admin','visualizar')
    OR public.fn_chamado_interno_can_operate(chamado_id)
  )
);

-- -----------------------------------------------------------------------------
-- 10) NOVA RPC: fn_chamado_interno_listar_fila_atendimento
--     Retorna campos derivados (categoria/CC) para eliminar N+1 no Kanban.
--     Precedência determinística: superadm > adm_sede > vinculo_setorial.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_chamado_interno_listar_fila_atendimento(
  p_status public.chamado_interno_status[] DEFAULT NULL,
  p_setor  public.chamado_interno_setor    DEFAULT NULL
)
RETURNS TABLE (
  id                             uuid,
  protocolo                      text,
  titulo                         text,
  status                         public.chamado_interno_status,
  setor                          public.chamado_interno_setor,
  prioridade                     public.chamado_interno_prioridade,
  categoria_id                   uuid,
  categoria_nome                 text,
  centro_custo_id                uuid,
  centro_custo_codigo            text,
  centro_custo_nome              text,
  responsavel_atual_profile_id   uuid,
  sla_prazo                      timestamptz,
  is_critico                     boolean,
  created_at                     timestamptz,
  updated_at                     timestamptz,
  fonte_autorizacao              text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_fid uuid;
  v_super boolean;
  v_acesso_global boolean;
  v_status public.chamado_interno_status[] := COALESCE(
    p_status,
    ARRAY['aberto','em_triagem','em_analise','aguardando_solicitante','respondido','reaberto']::public.chamado_interno_status[]
  );
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE='28000';
  END IF;

  v_super := public.fn_is_super_admin(v_uid);
  IF NOT v_super THEN
    SELECT p.acesso_global INTO v_acesso_global FROM public.profiles p WHERE p.id = v_uid;
    v_super := v_acesso_global IS TRUE;
  END IF;

  IF NOT v_super THEN
    IF public.user_has_permission_action(v_uid,'chamados_internos_view','visualizar') IS NOT TRUE
       OR public.user_has_permission_action(v_uid,'chamados_internos_atender','visualizar') IS NOT TRUE THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
    END IF;
  END IF;

  v_fid := public.get_user_funcionario_id(v_uid);

  RETURN QUERY
  WITH base AS (
    SELECT c.*
      FROM public.bd_chamados_internos c
     WHERE c.status = ANY (v_status)
       AND (p_setor IS NULL OR c.setor = p_setor)
  ),
  classificados AS (
    SELECT b.*,
      CASE
        WHEN v_super THEN 'superadm'
        WHEN v_fid IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.bd_centros_custo cc
           WHERE cc.id = b.centro_custo_id
             AND cc.adm_sede_funcionario_id = v_fid
        ) THEN 'adm_sede'
        WHEN EXISTS (
          SELECT 1 FROM public.bd_chamado_interno_atendentes a
           WHERE a.atendente_profile_id = v_uid
             AND a.setor = b.setor
             AND a.ativo IS TRUE
        ) THEN 'vinculo_setorial'
        ELSE NULL
      END AS fonte_autorizacao
      FROM base b
  )
  SELECT
    c.id,
    c.protocolo,
    c.titulo,
    c.status,
    c.setor,
    c.prioridade,
    c.categoria_id,
    cat.nome AS categoria_nome,
    c.centro_custo_id,
    cc.codigo_centro_custo AS centro_custo_codigo,
    cc.nome_centro_custo   AS centro_custo_nome,
    c.responsavel_atual_profile_id,
    c.sla_prazo,
    c.is_critico,
    c.created_at,
    c.updated_at,
    c.fonte_autorizacao
    FROM classificados c
    LEFT JOIN public.bd_chamado_interno_categorias cat ON cat.id = c.categoria_id
    LEFT JOIN public.bd_centros_custo             cc  ON cc.id  = c.centro_custo_id
   WHERE c.fonte_autorizacao IS NOT NULL
   ORDER BY c.prioridade DESC NULLS LAST, c.created_at ASC;
END;
$function$;

ALTER FUNCTION public.fn_chamado_interno_listar_fila_atendimento(
  public.chamado_interno_status[], public.chamado_interno_setor
) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_chamado_interno_listar_fila_atendimento(
  public.chamado_interno_status[], public.chamado_interno_setor
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_chamado_interno_listar_fila_atendimento(
  public.chamado_interno_status[], public.chamado_interno_setor
) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_chamado_interno_listar_fila_atendimento(
  public.chamado_interno_status[], public.chamado_interno_setor
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_chamado_interno_listar_fila_atendimento(
  public.chamado_interno_status[], public.chamado_interno_setor
) TO service_role;

-- -----------------------------------------------------------------------------
-- 11) ASSERTS PRÉ-COMMIT
-- -----------------------------------------------------------------------------
DO $asserts$
DECLARE
  r record;
  v_expected text;
  v_count int;
BEGIN
  -- 11.1 Duas funções novas existem com assinatura exata
  PERFORM 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='fn_chamado_interno_can_operate'
     AND pg_get_function_identity_arguments(p.oid)='p_chamado_id uuid'
     AND pg_get_function_result(p.oid)='boolean'
     AND p.prosecdef AND p.provolatile='s'
     AND pg_get_userbyid(p.proowner)='postgres'
     AND EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c='search_path=public');
  IF NOT FOUND THEN RAISE EXCEPTION 'assert_falhou: fn_chamado_interno_can_operate(uuid)'; END IF;

  PERFORM 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='fn_chamado_interno_listar_fila_atendimento'
     AND pg_get_function_identity_arguments(p.oid)='p_status chamado_interno_status[], p_setor chamado_interno_setor'
     AND p.prosecdef AND p.provolatile='s'
     AND pg_get_userbyid(p.proowner)='postgres'
     AND EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c='search_path=public');
  IF NOT FOUND THEN RAISE EXCEPTION 'assert_falhou: fn_chamado_interno_listar_fila_atendimento(...)'; END IF;

  -- 11.2 Seis funções substituídas mantêm assinatura/retorno/owner/definer/volatilidade/search_path
  FOR r IN
    SELECT * FROM (VALUES
      ('fn_chamado_interno_can_read',                'p_chamado_id uuid',                    'boolean', 's'),
      ('fn_chamado_interno_assumir',                 'p_chamado_id uuid',                    'void',    'v'),
      ('fn_chamado_interno_responder',               'p_chamado_id uuid, p_mensagem text',   'void',    'v'),
      ('fn_chamado_interno_solicitar_informacao',    'p_chamado_id uuid, p_mensagem text',   'void',    'v'),
      ('fn_chamado_interno_adicionar_nota_interna',  'p_chamado_id uuid, p_mensagem text',   'void',    'v'),
      ('fn_chamado_interno_resolver',                'p_chamado_id uuid, p_mensagem text',   'void',    'v')
    ) t(nome, args, ret, vol)
  LOOP
    PERFORM 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname=r.nome
       AND pg_get_function_identity_arguments(p.oid)=r.args
       AND pg_get_function_result(p.oid)=r.ret
       AND p.prosecdef
       AND p.provolatile=r.vol
       AND pg_get_userbyid(p.proowner)='postgres'
       AND EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c='search_path=public');
    IF NOT FOUND THEN
      RAISE EXCEPTION 'assert_falhou: metadados divergentes em %(%) -> %', r.nome, r.args, r.ret;
    END IF;
  END LOOP;

  -- 11.3 ACL: authenticated com EXECUTE, anon/PUBLIC sem novo acesso
  FOR r IN
    SELECT unnest(ARRAY[
      'fn_chamado_interno_can_operate(uuid)',
      'fn_chamado_interno_can_read(uuid)',
      'fn_chamado_interno_assumir(uuid)',
      'fn_chamado_interno_responder(uuid,text)',
      'fn_chamado_interno_solicitar_informacao(uuid,text)',
      'fn_chamado_interno_adicionar_nota_interna(uuid,text)',
      'fn_chamado_interno_resolver(uuid,text)',
      'fn_chamado_interno_listar_fila_atendimento(chamado_interno_status[],chamado_interno_setor)'
    ]) AS sig
  LOOP
    IF NOT has_function_privilege('authenticated', 'public.'||r.sig, 'EXECUTE') THEN
      RAISE EXCEPTION 'assert_falhou: authenticated sem EXECUTE em %', r.sig;
    END IF;
    IF has_function_privilege('anon', 'public.'||r.sig, 'EXECUTE') THEN
      RAISE EXCEPTION 'assert_falhou: anon obteve EXECUTE indevido em %', r.sig;
    END IF;
    -- role "public" (nome literal do grupo, não pseudo-role PUBLIC)
    IF has_function_privilege('public', 'public.'||r.sig, 'EXECUTE') THEN
      RAISE EXCEPTION 'assert_falhou: role public obteve EXECUTE indevido em %', r.sig;
    END IF;
  END LOOP;

  -- 11.4 Policy: existe com roles/expressão esperadas
  PERFORM 1 FROM pg_policies
   WHERE schemaname='public' AND tablename='bd_chamado_interno_eventos'
     AND policyname='chamado_interno_eventos_select'
     AND permissive='PERMISSIVE'
     AND cmd='SELECT'
     AND roles::text='{authenticated}'
     AND qual LIKE '%fn_chamado_interno_can_read(chamado_id)%'
     AND qual LIKE '%fn_chamado_interno_can_operate(chamado_id)%'
     AND qual LIKE '%visivel_solicitante IS TRUE%'
     AND qual LIKE '%fn_is_super_admin(auth.uid())%'
     AND qual LIKE '%chamados_internos_admin%';
  IF NOT FOUND THEN RAISE EXCEPTION 'assert_falhou: policy chamado_interno_eventos_select divergente'; END IF;

  -- 11.5 can_operate retorna false para UUID inexistente (mesmo com auth.uid nulo)
  IF public.fn_chamado_interno_can_operate('00000000-0000-0000-0000-000000000000'::uuid) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'assert_falhou: can_operate deveria retornar false para uuid inexistente';
  END IF;

  -- 11.6 Nenhum objeto fora do escopo foi alterado
  --      (checagem: existência preservada de fn_chamado_interno_cancelar, can_attend e can_open_cc)
  FOR v_expected IN
    SELECT unnest(ARRAY[
      'fn_chamado_interno_cancelar',
      'fn_chamado_interno_can_attend',
      'fn_chamado_interno_can_open_cc',
      'fn_chamado_interno_abrir'
    ])
  LOOP
    PERFORM 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname=v_expected;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'assert_falhou: funcao fora do escopo removida indevidamente: %', v_expected;
    END IF;
  END LOOP;

  -- 11.7 Zero alterações em RBAC (bd_role_permissions, overrides, user_roles) via count baseline não-transacional:
  --      A migration não contém DML nessas tabelas; o assert abaixo confirma que nenhuma linha
  --      foi tocada nesta transação verificando pg_stat_xact_user_tables.
  SELECT COALESCE(SUM(n_tup_ins + n_tup_upd + n_tup_del),0)
    INTO v_count
    FROM pg_stat_xact_user_tables s
    JOIN pg_class c ON c.oid = s.relid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname='public'
     AND c.relname IN ('bd_role_permissions','bd_role_permission_actions','bd_user_permission_overrides','bd_user_roles','bd_roles','bd_permissions');
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'assert_falhou: DML detectado em tabelas RBAC nesta transacao (%)', v_count;
  END IF;
END
$asserts$;

COMMIT;
-- =============================================================================
-- FIM M10-A v2
-- =============================================================================