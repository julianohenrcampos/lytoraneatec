
CREATE OR REPLACE FUNCTION public.user_has_permission_action(
  _user_id uuid, _codigo text, _acao text
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_perm_id  uuid;
  v_override boolean;
  v_bypass   boolean;
  v_has      boolean;
BEGIN
  IF _user_id IS NULL OR _codigo IS NULL OR _acao IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = _user_id
      AND p.acesso_global IS TRUE
  )
  AND EXISTS (
    SELECT 1
    FROM public.bd_user_roles ur
    JOIN public.bd_roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id
      AND lower(btrim(r.nome)) = 'superadm'
      AND r.ativo IS TRUE
  )
  INTO v_bypass;

  IF v_bypass THEN RETURN true; END IF;

  SELECT id INTO v_perm_id FROM public.bd_permissions WHERE codigo = _codigo;
  IF v_perm_id IS NULL THEN RETURN false; END IF;

  SELECT permitido INTO v_override
    FROM public.bd_user_permission_overrides
   WHERE user_id = _user_id AND permission_id = v_perm_id AND acao = _acao
   LIMIT 1;
  IF v_override IS NOT NULL THEN RETURN v_override; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.bd_user_roles ur
    JOIN public.bd_role_permission_actions rpa ON rpa.role_id = ur.role_id
    WHERE ur.user_id = _user_id AND rpa.permission_id = v_perm_id AND rpa.acao = _acao
  ) INTO v_has;

  RETURN coalesce(v_has, false);
END
$function$;
