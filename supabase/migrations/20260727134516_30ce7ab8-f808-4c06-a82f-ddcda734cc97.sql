-- 1) Remove acesso administrativo global do módulo para a role AdmSede
ALTER TABLE public.bd_role_permission_actions DISABLE TRIGGER trg_validate_role_permission_action_change;

DELETE FROM public.bd_role_permission_actions a
USING public.bd_roles r, public.bd_permissions p
WHERE a.role_id = r.id
  AND a.permission_id = p.id
  AND r.nome = 'AdmSede'
  AND p.codigo = 'chamados_internos_admin';

ALTER TABLE public.bd_role_permission_actions ENABLE TRIGGER trg_validate_role_permission_action_change;

DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT tgname FROM pg_trigger
     WHERE tgrelid = 'public.bd_role_permissions'::regclass
       AND NOT tgisinternal
       AND tgname LIKE '%valid%'
  LOOP
    EXECUTE format('ALTER TABLE public.bd_role_permissions DISABLE TRIGGER %I', t.tgname);
  END LOOP;

  DELETE FROM public.bd_role_permissions rp
  USING public.bd_roles r, public.bd_permissions p
  WHERE rp.role_id = r.id
    AND rp.permission_id = p.id
    AND r.nome = 'AdmSede'
    AND p.codigo = 'chamados_internos_admin';

  FOR t IN
    SELECT tgname FROM pg_trigger
     WHERE tgrelid = 'public.bd_role_permissions'::regclass
       AND NOT tgisinternal
       AND tgname LIKE '%valid%'
  LOOP
    EXECUTE format('ALTER TABLE public.bd_role_permissions ENABLE TRIGGER %I', t.tgname);
  END LOOP;
END $$;

-- 2) Abertura de chamado: AdmSede restrito aos CCs sob sua gestão
CREATE OR REPLACE FUNCTION public.fn_chamado_interno_can_open_cc(p_cc_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_fid uuid;
  v_admin_obra uuid;
  v_adm_sede uuid;
  v_situacao text;
BEGIN
  IF v_uid IS NULL OR p_cc_id IS NULL THEN RETURN false; END IF;
  IF NOT public.user_has_permission_action(v_uid,'chamados_internos_view','visualizar') THEN
    RETURN false;
  END IF;

  SELECT situacao, adm_obra_funcionario_id, adm_sede_funcionario_id
    INTO v_situacao, v_admin_obra, v_adm_sede
    FROM public.bd_centros_custo
   WHERE id = p_cc_id;
  IF v_situacao IS NULL OR v_situacao <> 'Ativo' THEN RETURN false; END IF;

  IF public.user_has_permission_action(v_uid,'chamados_internos_admin','criar') THEN
    RETURN true;
  END IF;

  IF public.user_has_permission_action(v_uid,'chamados_internos_abrir','criar') THEN
    v_fid := public.get_user_funcionario_id(v_uid);
    RETURN v_fid IS NOT NULL
       AND (v_admin_obra = v_fid OR v_adm_sede = v_fid);
  END IF;

  RETURN false;
END;
$function$;