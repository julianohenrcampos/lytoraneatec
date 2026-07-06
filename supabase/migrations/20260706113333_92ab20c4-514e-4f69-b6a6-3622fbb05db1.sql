CREATE OR REPLACE FUNCTION public.fn_profiles_block_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_super boolean;
  v_uid uuid;
BEGIN
  v_uid := auth.uid();

  -- Bypass em contexto sem sessão autenticada:
  --   * signup (on_auth_user_created → handle_new_user)
  --   * triggers internos em cascata (SECURITY DEFINER) disparados pelo próprio INSERT
  --     em profiles (link_profile_to_funcionario_by_email, sync_profile_funcao_sistema).
  -- Qualquer chamada vinda do cliente autenticado tem auth.uid() != NULL e continua sujeita ao guard.
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT public.fn_is_super_admin() INTO v_is_super;

  IF v_is_super THEN
    RETURN NEW;
  END IF;

  IF NEW.acesso_global IS DISTINCT FROM OLD.acesso_global
     OR NEW.funcoes IS DISTINCT FROM OLD.funcoes
     OR NEW.funcao_sistema IS DISTINCT FROM OLD.funcao_sistema
     OR NEW.funcao_permissao IS DISTINCT FROM OLD.funcao_permissao
     OR NEW.cargo IS DISTINCT FROM OLD.cargo
  THEN
    RAISE EXCEPTION 'Privilege escalation blocked: only SuperAdm may modify acesso_global, funcoes, funcao_sistema, funcao_permissao, or cargo'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;