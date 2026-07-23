
BEGIN;

-- =====================================================================
-- HELPERS DE AUTORIZAÇÃO
-- =====================================================================

CREATE OR REPLACE FUNCTION public.fn_chamado_interno_can_open_cc(p_cc_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_fid uuid;
  v_admin_obra uuid;
  v_situacao text;
BEGIN
  IF v_uid IS NULL OR p_cc_id IS NULL THEN RETURN false; END IF;
  IF NOT public.user_has_permission_action(v_uid,'chamados_internos_view','visualizar') THEN
    RETURN false;
  END IF;
  SELECT situacao, adm_obra_funcionario_id
    INTO v_situacao, v_admin_obra
    FROM public.bd_centros_custo
   WHERE id = p_cc_id;
  IF v_situacao IS NULL OR v_situacao <> 'Ativo' THEN RETURN false; END IF;
  IF public.user_has_permission_action(v_uid,'chamados_internos_admin','criar') THEN
    RETURN true;
  END IF;
  IF public.user_has_permission_action(v_uid,'chamados_internos_abrir','criar') THEN
    v_fid := public.get_user_funcionario_id(v_uid);
    RETURN v_fid IS NOT NULL AND v_admin_obra = v_fid;
  END IF;
  RETURN false;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_chamado_interno_can_attend(
  p_setor public.chamado_interno_setor
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $function$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR p_setor IS NULL THEN RETURN false; END IF;
  IF NOT public.user_has_permission_action(v_uid,'chamados_internos_view','visualizar') THEN
    RETURN false;
  END IF;
  IF NOT public.user_has_permission_action(v_uid,'chamados_internos_atender','visualizar') THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.bd_chamado_interno_atendentes
     WHERE atendente_profile_id = v_uid
       AND setor = p_setor
       AND ativo IS TRUE
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_chamado_interno_can_read(p_chamado_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_fid uuid;
  r record;
BEGIN
  IF v_uid IS NULL OR p_chamado_id IS NULL THEN RETURN false; END IF;
  IF NOT public.user_has_permission_action(v_uid,'chamados_internos_view','visualizar') THEN
    RETURN false;
  END IF;
  SELECT solicitante_funcionario_id, aberto_por, setor
    INTO r FROM public.bd_chamados_internos WHERE id = p_chamado_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF public.user_has_permission_action(v_uid,'chamados_internos_admin','visualizar') THEN
    RETURN true;
  END IF;
  IF r.aberto_por = v_uid THEN RETURN true; END IF;
  v_fid := public.get_user_funcionario_id(v_uid);
  IF v_fid IS NOT NULL AND r.solicitante_funcionario_id = v_fid THEN
    RETURN true;
  END IF;
  RETURN public.fn_chamado_interno_can_attend(r.setor);
END;
$function$;

-- =====================================================================
-- RPCs DE CONSULTA
-- =====================================================================

CREATE OR REPLACE FUNCTION public.fn_chamado_interno_listar_ccs_abertura()
RETURNS TABLE(centro_custo_id uuid, codigo_centro_custo text, nome_centro_custo text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $function$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE='28000'; END IF;
  IF NOT public.user_has_permission_action(v_uid,'chamados_internos_view','visualizar') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
    SELECT cc.id, cc.codigo_centro_custo, cc.nome_centro_custo
      FROM public.bd_centros_custo cc
     WHERE cc.situacao = 'Ativo'
       AND public.fn_chamado_interno_can_open_cc(cc.id)
     ORDER BY cc.codigo_centro_custo;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_chamado_interno_listar_solicitantes_cc(p_cc_id uuid)
RETURNS TABLE(id uuid, nome_completo text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $function$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE='28000'; END IF;
  IF p_cc_id IS NULL THEN RAISE EXCEPTION 'cc_obrigatorio' USING ERRCODE='22004'; END IF;
  IF NOT public.fn_chamado_interno_can_open_cc(p_cc_id) THEN
    RAISE EXCEPTION 'escopo_cc_negado' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
    SELECT f.id, f.nome_completo
      FROM public.bd_funcionarios f
     WHERE f.centro_custo_id = p_cc_id
       AND f.status IN ('Ativo','Ativo sem Registro')
     ORDER BY f.nome_completo;
END;
$function$;

-- =====================================================================
-- RPCs ADMINISTRATIVAS DE ATENDENTES
-- =====================================================================

CREATE OR REPLACE FUNCTION public.fn_chamado_interno_atendentes_listar(
  p_setor public.chamado_interno_setor DEFAULT NULL
) RETURNS TABLE(
  id uuid, atendente_profile_id uuid, setor public.chamado_interno_setor,
  ativo boolean, profile_nome text, funcionario_nome_completo text,
  created_at timestamptz, updated_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $function$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE='28000'; END IF;
  IF NOT public.user_has_permission_action(v_uid,'chamados_internos_view','visualizar')
     OR NOT public.user_has_permission_action(v_uid,'chamados_internos_admin','visualizar') THEN
    RAISE EXCEPTION 'forbidden_admin' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
    SELECT a.id, a.atendente_profile_id, a.setor, a.ativo,
           p.nome_completo AS profile_nome,
           f.nome_completo AS funcionario_nome_completo,
           a.created_at, a.updated_at
      FROM public.bd_chamado_interno_atendentes a
      LEFT JOIN public.profiles p ON p.id = a.atendente_profile_id
      LEFT JOIN public.bd_funcionarios f ON f.id = p.funcionario_id
     WHERE p_setor IS NULL OR a.setor = p_setor
     ORDER BY a.setor, p.nome_completo NULLS LAST;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_chamado_interno_atendente_vincular(
  p_profile_id uuid,
  p_setor public.chamado_interno_setor
) RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_fid uuid;
  v_vinculo public.bd_chamado_interno_atendentes%ROWTYPE;
  v_anterior jsonb;
  v_novo jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE='28000'; END IF;
  IF NOT public.user_has_permission_action(v_uid,'chamados_internos_view','visualizar')
     OR NOT public.user_has_permission_action(v_uid,'chamados_internos_admin','editar') THEN
    RAISE EXCEPTION 'forbidden_admin' USING ERRCODE='42501';
  END IF;
  IF p_profile_id IS NULL OR p_setor IS NULL THEN
    RAISE EXCEPTION 'parametros_obrigatorios' USING ERRCODE='22004';
  END IF;

  SELECT p.funcionario_id INTO v_fid FROM public.profiles p WHERE p.id = p_profile_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile_inexistente' USING ERRCODE='P0002'; END IF;
  IF v_fid IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.bd_funcionarios f
                     WHERE f.id = v_fid AND f.status IN ('Ativo','Ativo sem Registro')) THEN
    RAISE EXCEPTION 'atendente_sem_funcionario_ativo' USING ERRCODE='23514';
  END IF;

  LOOP
    SELECT a.* INTO v_vinculo
      FROM public.bd_chamado_interno_atendentes a
     WHERE a.atendente_profile_id = p_profile_id AND a.setor = p_setor
     FOR UPDATE;

    IF FOUND THEN
      IF v_vinculo.ativo IS TRUE THEN
        RETURN v_vinculo.id;
      END IF;
      v_anterior := to_jsonb(v_vinculo);
      UPDATE public.bd_chamado_interno_atendentes a
         SET ativo = true
       WHERE a.id = v_vinculo.id
       RETURNING to_jsonb(a.*) INTO v_novo;
      INSERT INTO public.bd_auditoria_log
        (tabela, registro_id, operacao, dados_anteriores, dados_novos, campos_alterados, usuario_id)
      VALUES
        ('bd_chamado_interno_atendentes', v_vinculo.id::text, 'UPDATE',
         v_anterior,
         v_novo || jsonb_build_object('acao_chamado','reativar_atendente'),
         ARRAY['ativo'], v_uid);
      RETURN v_vinculo.id;
    END IF;

    BEGIN
      INSERT INTO public.bd_chamado_interno_atendentes(atendente_profile_id, setor, ativo)
      VALUES (p_profile_id, p_setor, true)
      RETURNING * INTO v_vinculo;
      v_novo := to_jsonb(v_vinculo);
      INSERT INTO public.bd_auditoria_log
        (tabela, registro_id, operacao, dados_anteriores, dados_novos, campos_alterados, usuario_id)
      VALUES
        ('bd_chamado_interno_atendentes', v_vinculo.id::text, 'INSERT',
         NULL,
         v_novo || jsonb_build_object('acao_chamado','vincular_atendente'),
         NULL, v_uid);
      RETURN v_vinculo.id;
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_chamado_interno_atendente_desativar(p_vinculo_id uuid)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_anterior jsonb;
  v_novo jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE='28000'; END IF;
  IF NOT public.user_has_permission_action(v_uid,'chamados_internos_view','visualizar')
     OR NOT public.user_has_permission_action(v_uid,'chamados_internos_admin','editar') THEN
    RAISE EXCEPTION 'forbidden_admin' USING ERRCODE='42501';
  END IF;
  IF p_vinculo_id IS NULL THEN
    RAISE EXCEPTION 'vinculo_obrigatorio' USING ERRCODE='22004';
  END IF;

  SELECT to_jsonb(a.*) INTO v_anterior
    FROM public.bd_chamado_interno_atendentes a
   WHERE a.id = p_vinculo_id
   FOR UPDATE;

  IF v_anterior IS NULL THEN
    RAISE EXCEPTION 'vinculo_inexistente' USING ERRCODE='P0002';
  END IF;

  IF (v_anterior->>'ativo')::boolean IS FALSE THEN
    RETURN;
  END IF;

  UPDATE public.bd_chamado_interno_atendentes a
     SET ativo = false
   WHERE a.id = p_vinculo_id
   RETURNING to_jsonb(a.*) INTO v_novo;

  INSERT INTO public.bd_auditoria_log
    (tabela, registro_id, operacao, dados_anteriores, dados_novos, campos_alterados, usuario_id)
  VALUES
    ('bd_chamado_interno_atendentes', p_vinculo_id::text, 'UPDATE',
     v_anterior,
     v_novo || jsonb_build_object('acao_chamado','desativar_atendente'),
     ARRAY['ativo'], v_uid);
END;
$function$;

-- =====================================================================
-- GRANTS
-- =====================================================================

REVOKE ALL ON FUNCTION public.fn_chamado_interno_can_open_cc(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_chamado_interno_can_attend(public.chamado_interno_setor) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_chamado_interno_can_read(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_chamado_interno_listar_ccs_abertura() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_chamado_interno_listar_solicitantes_cc(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_chamado_interno_atendentes_listar(public.chamado_interno_setor) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_chamado_interno_atendente_vincular(uuid, public.chamado_interno_setor) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_chamado_interno_atendente_desativar(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.fn_chamado_interno_can_open_cc(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_chamado_interno_can_attend(public.chamado_interno_setor) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_chamado_interno_can_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_chamado_interno_listar_ccs_abertura() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_chamado_interno_listar_solicitantes_cc(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_chamado_interno_atendentes_listar(public.chamado_interno_setor) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_chamado_interno_atendente_vincular(uuid, public.chamado_interno_setor) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_chamado_interno_atendente_desativar(uuid) TO authenticated;

-- =====================================================================
-- VALIDAÇÃO ACL
-- =====================================================================
DO $$
DECLARE
  v_pub int;
  v_anon int;
  v_auth int;
  v_expected_signatures text[] := ARRAY[
    'public.fn_chamado_interno_can_open_cc(uuid)',
    'public.fn_chamado_interno_can_attend(public.chamado_interno_setor)',
    'public.fn_chamado_interno_can_read(uuid)',
    'public.fn_chamado_interno_listar_ccs_abertura()',
    'public.fn_chamado_interno_listar_solicitantes_cc(uuid)',
    'public.fn_chamado_interno_atendentes_listar(public.chamado_interno_setor)',
    'public.fn_chamado_interno_atendente_vincular(uuid,public.chamado_interno_setor)',
    'public.fn_chamado_interno_atendente_desativar(uuid)'
  ];
  s text;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE grantee='PUBLIC'),
    COUNT(*) FILTER (WHERE grantee='anon'),
    COUNT(*) FILTER (WHERE grantee='authenticated' AND privilege_type='EXECUTE')
    INTO v_pub, v_anon, v_auth
  FROM information_schema.routine_privileges
  WHERE specific_schema='public'
    AND routine_name LIKE 'fn_chamado_interno_%';

  IF v_pub <> 0 THEN RAISE EXCEPTION 'ACL: PUBLIC possui privilégio indevido em fn_chamado_interno_*'; END IF;
  IF v_anon <> 0 THEN RAISE EXCEPTION 'ACL: anon possui privilégio indevido em fn_chamado_interno_*'; END IF;
  IF v_auth <> array_length(v_expected_signatures,1) THEN
    RAISE EXCEPTION 'ACL: authenticated deveria ter EXECUTE em % funções, tem %',
      array_length(v_expected_signatures,1), v_auth;
  END IF;

  FOREACH s IN ARRAY v_expected_signatures LOOP
    IF has_function_privilege('authenticated', s::regprocedure, 'EXECUTE') IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'ACL: authenticated sem EXECUTE em %', s;
    END IF;
    IF has_function_privilege('anon', s::regprocedure, 'EXECUTE') IS TRUE THEN
      RAISE EXCEPTION 'ACL: anon com EXECUTE indevido em %', s;
    END IF;
  END LOOP;
END $$;

COMMIT;
