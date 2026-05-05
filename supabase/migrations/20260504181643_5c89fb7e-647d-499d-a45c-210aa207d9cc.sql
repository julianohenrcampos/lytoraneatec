CREATE OR REPLACE FUNCTION public.rpc_create_gestor_role(
  p_role_name text,
  p_descricao text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor    uuid := auth.uid();
  v_name     text;
  v_desc     text;
  v_role_id  uuid;
  v_created  boolean := false;
  v_op       text;
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

  -- 7. Auditoria diferenciada
  v_op := CASE WHEN v_created THEN 'INSERT_RPC' ELSE 'GET_RPC' END;

  INSERT INTO public.bd_auditoria_log (
    tabela,
    operacao,
    registro_id,
    usuario_id,
    dados_novos
  )
  VALUES (
    'bd_roles',
    v_op,
    v_role_id::text,
    v_actor,
    jsonb_build_object(
      'rpc',         'rpc_create_gestor_role',
      'role_nome',   v_name,
      'role_id',     v_role_id,
      'created',     v_created,
      'descricao',   v_desc
    )
  );

  RETURN v_role_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_create_gestor_role(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_create_gestor_role(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_create_gestor_role(text, text) TO authenticated;

COMMENT ON FUNCTION public.rpc_create_gestor_role(text, text) IS
  'Fase 5B-2.5: cria ou recupera role Gestor_* de forma idempotente. SECURITY DEFINER, restrita a SuperAdm. Não dispara UPDATE em bd_roles quando a role já existe (evita ruído na trigger trg_validate_role_catalog_change).';