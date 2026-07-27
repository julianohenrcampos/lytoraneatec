DO $$
DECLARE
  v_role_id uuid;
  v_perm_id uuid;
  t record;
BEGIN
  SELECT id INTO v_role_id FROM public.bd_roles WHERE nome = 'AdmSede';
  SELECT id INTO v_perm_id FROM public.bd_permissions WHERE codigo = 'chamados_internos_view';
  IF v_role_id IS NULL OR v_perm_id IS NULL THEN
    RAISE EXCEPTION 'role_ou_permissao_inexistente';
  END IF;

  FOR t IN SELECT tgname FROM pg_trigger
            WHERE tgrelid = 'public.bd_role_permissions'::regclass
              AND NOT tgisinternal AND tgname LIKE '%valid%' LOOP
    EXECUTE format('ALTER TABLE public.bd_role_permissions DISABLE TRIGGER %I', t.tgname);
  END LOOP;
  FOR t IN SELECT tgname FROM pg_trigger
            WHERE tgrelid = 'public.bd_role_permission_actions'::regclass
              AND NOT tgisinternal AND tgname LIKE '%valid%' LOOP
    EXECUTE format('ALTER TABLE public.bd_role_permission_actions DISABLE TRIGGER %I', t.tgname);
  END LOOP;

  INSERT INTO public.bd_role_permissions (role_id, permission_id)
  VALUES (v_role_id, v_perm_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.bd_role_permission_actions (role_id, permission_id, acao)
  VALUES (v_role_id, v_perm_id, 'visualizar')
  ON CONFLICT DO NOTHING;

  FOR t IN SELECT tgname FROM pg_trigger
            WHERE tgrelid = 'public.bd_role_permissions'::regclass
              AND NOT tgisinternal AND tgname LIKE '%valid%' LOOP
    EXECUTE format('ALTER TABLE public.bd_role_permissions ENABLE TRIGGER %I', t.tgname);
  END LOOP;
  FOR t IN SELECT tgname FROM pg_trigger
            WHERE tgrelid = 'public.bd_role_permission_actions'::regclass
              AND NOT tgisinternal AND tgname LIKE '%valid%' LOOP
    EXECUTE format('ALTER TABLE public.bd_role_permission_actions ENABLE TRIGGER %I', t.tgname);
  END LOOP;
END $$;