CREATE OR REPLACE FUNCTION public.rpc_create_gestor_role(p_role_name text, p_descricao text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor    uuid := auth.uid();
  v_name     text;
  v_desc     text;
  v_role_id  uuid;
  v_created  boolean := false;
BEGIN
  -- 1. Autenticação obrigatória
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Operação requer usuário autenticado.'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Autorização: apenas SuperAdm
  IF NOT public.fn_is_super_admin(v_actor) THEN
    RAISE EXCEPTION 'Apenas SuperAdm pode criar roles Gestor_*.'
      USING ERRCODE = '42501';
  END IF;

  -- 3. Normalização de entrada
  v_name := btrim(coalesce(p_role_name, ''));
  v_desc := nullif(btrim(coalesce(p_descricao, '')), '');

  IF v_name = '' THEN
    RAISE EXCEPTION 'Nome da role é obrigatório.'
      USING ERRCODE = '22023';
  END IF;

  -- 4. Validação de prefixo + caracteres permitidos
  IF v_name !~ '^Gestor_[A-Za-z0-9_]+$' THEN
    RAISE EXCEPTION
      'Nome inválido: deve seguir o padrão Gestor_<sufixo alfanumérico>.'
      USING ERRCODE = '22023';
  END IF;

  -- 5. Blacklist de nomes protegidos (case-insensitive)
  IF lower(v_name) IN ('superadm', 'administrador', 'admin') THEN
    RAISE EXCEPTION 'Nome de role reservado/protegido: %.', v_name
      USING ERRCODE = '42501';
  END IF;

  -- 6. Inserção idempotente SEM UPDATE
  WITH inserted AS (
    INSERT INTO public.bd_roles (nome, descricao, ativo)
    VALUES (v_name, v_desc, true)
    ON CONFLICT (nome) DO NOTHING
    RETURNING id
  )
  SELECT id INTO v_role_id FROM inserted;

  IF v_role_id IS NOT NULL THEN
    v_created := true;
  ELSE
    SELECT id
      INTO v_role_id
      FROM public.bd_roles
     WHERE nome = v_name;
  END IF;

  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'Não foi possível criar ou recuperar a role Gestor.'
      USING ERRCODE = '23505';
  END IF;

  -- 7. Auditoria (Opção A: operacao sempre 'INSERT'; semântica RPC vai em dados_novos.mode)
  INSERT INTO public.bd_auditoria_log (
    tabela,
    operacao,
    registro_id,
    usuario_id,
    dados_novos
  )
  VALUES (
    'bd_roles',
    'INSERT',
    v_role_id::text,
    v_actor,
    jsonb_build_object(
      'rpc',         'rpc_create_gestor_role',
      'origem',      'rpc_create_gestor_role',
      'mode',        CASE WHEN v_created THEN 'INSERT_RPC' ELSE 'GET_RPC' END,
      'role_nome',   v_name,
      'role_id',     v_role_id,
      'created',     v_created,
      'descricao',   v_desc
    )
  );

  RETURN v_role_id;
END;
$function$;