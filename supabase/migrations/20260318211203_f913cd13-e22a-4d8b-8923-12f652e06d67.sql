
-- Função SECURITY DEFINER para migrar usuário automaticamente
-- Bypassa RLS para poder inserir em bd_roles, bd_user_roles, bd_permissions, bd_role_permissions
CREATE OR REPLACE FUNCTION public.rbac_auto_migrate_user(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_funcoes text[];
  v_funcao text;
  v_role_id uuid;
  v_funcao_permissao RECORD;
  v_perm RECORD;
  v_perm_id uuid;
  v_migrated_roles text[] := '{}';
  v_migrated_count int := 0;
BEGIN
  -- 1. Verificar se já possui registros no novo modelo
  IF EXISTS (SELECT 1 FROM bd_user_roles WHERE user_id = p_user_id LIMIT 1) THEN
    RETURN jsonb_build_object('status', 'already_migrated', 'migrated', 0);
  END IF;

  -- 2. Buscar funcoes do profile
  SELECT funcoes INTO v_funcoes
  FROM profiles
  WHERE id = p_user_id;

  IF v_funcoes IS NULL OR array_length(v_funcoes, 1) IS NULL THEN
    RETURN jsonb_build_object('status', 'no_funcoes', 'migrated', 0);
  END IF;

  -- 3. Para cada função, criar role + vincular usuário + migrar permissões
  FOREACH v_funcao IN ARRAY v_funcoes
  LOOP
    IF v_funcao IS NULL OR trim(v_funcao) = '' THEN
      CONTINUE;
    END IF;

    -- 3a. Get or create role
    SELECT id INTO v_role_id FROM bd_roles WHERE nome = v_funcao;
    IF v_role_id IS NULL THEN
      INSERT INTO bd_roles (nome, descricao)
      VALUES (v_funcao, 'Role migrada automaticamente de profiles.funcoes')
      ON CONFLICT DO NOTHING
      RETURNING id INTO v_role_id;
      -- If ON CONFLICT hit, fetch it
      IF v_role_id IS NULL THEN
        SELECT id INTO v_role_id FROM bd_roles WHERE nome = v_funcao;
      END IF;
    END IF;

    IF v_role_id IS NULL THEN
      CONTINUE;
    END IF;

    -- 3b. Link user to role (upsert)
    INSERT INTO bd_user_roles (user_id, role_id)
    VALUES (p_user_id, v_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;

    v_migrated_roles := array_append(v_migrated_roles, v_funcao);
    v_migrated_count := v_migrated_count + 1;

    -- 3c. Migrate permissions from old structure
    SELECT permissoes INTO v_funcao_permissao
    FROM bd_funcoes_permissao
    WHERE nome_funcao = v_funcao;

    IF v_funcao_permissao.permissoes IS NOT NULL AND array_length(v_funcao_permissao.permissoes, 1) > 0 THEN
      FOR v_perm IN
        SELECT id, nome_permissao, descricao, rota
        FROM bd_permissoes
        WHERE id = ANY(v_funcao_permissao.permissoes::uuid[])
      LOOP
        -- Create or find permission in new table
        SELECT id INTO v_perm_id FROM bd_permissions WHERE codigo = v_perm.nome_permissao;
        IF v_perm_id IS NULL THEN
          INSERT INTO bd_permissions (codigo, nome, descricao, rota, tipo)
          VALUES (v_perm.nome_permissao, v_perm.nome_permissao, v_perm.descricao, v_perm.rota, 'page')
          ON CONFLICT DO NOTHING
          RETURNING id INTO v_perm_id;
          IF v_perm_id IS NULL THEN
            SELECT id INTO v_perm_id FROM bd_permissions WHERE codigo = v_perm.nome_permissao;
          END IF;
        END IF;

        IF v_perm_id IS NOT NULL THEN
          INSERT INTO bd_role_permissions (role_id, permission_id)
          VALUES (v_role_id, v_perm_id)
          ON CONFLICT (role_id, permission_id) DO NOTHING;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'status', 'migrated',
    'migrated', v_migrated_count,
    'roles', to_jsonb(v_migrated_roles)
  );
END;
$$;
