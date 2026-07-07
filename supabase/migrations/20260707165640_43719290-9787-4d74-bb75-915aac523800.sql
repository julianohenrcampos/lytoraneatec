
BEGIN;
SET LOCAL session_replication_role = replica;

-- 1) Permissão nova (idempotente)
INSERT INTO public.bd_permissions (codigo, nome, descricao, modulo, tipo, rota, ativo)
VALUES (
  'motoristas_operacional_todos',
  'Motoristas Operacional — Todos',
  'Permite visualizar motoristas ativos em campos operacionais, sem acesso administrativo ao cadastro de funcionários.',
  'operacional',
  'scope',
  NULL,
  true
)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  modulo = EXCLUDED.modulo,
  tipo = EXCLUDED.tipo,
  rota = EXCLUDED.rota,
  ativo = true;

-- 2) Espelho legado (bd_permissoes ainda é lido por usePermission.ts)
INSERT INTO public.bd_permissoes (nome_permissao, descricao, rota)
VALUES (
  'motoristas_operacional_todos',
  'LEGADO/COMPAT — espelho de bd_permissions.motoristas_operacional_todos (scope operacional, sem rota).',
  NULL
)
ON CONFLICT (nome_permissao) DO NOTHING;

-- 3) Vínculo à role Apontador (somente ação mínima 'visualizar')
INSERT INTO public.bd_role_permission_actions (role_id, permission_id, acao)
SELECT r.id, p.id, 'visualizar'
FROM public.bd_roles r
CROSS JOIN public.bd_permissions p
WHERE r.nome = 'Apontador'
  AND p.codigo = 'motoristas_operacional_todos'
ON CONFLICT DO NOTHING;

COMMIT;

-- 4) RPC segura de lookup (fora do bloco de replica)
CREATE OR REPLACE FUNCTION public.fn_motoristas_operacional_lookup()
RETURNS TABLE (
  id uuid,
  nome_completo text,
  matricula text,
  funcao_nome text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_perm_id uuid;
  v_autorizado boolean := false;
  v_denied boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  -- SuperAdm ou acesso_global => autorizado
  IF COALESCE(public.fn_is_super_admin(), false)
     OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_uid AND p.acesso_global = true)
  THEN
    v_autorizado := true;
  ELSE
    SELECT p.id INTO v_perm_id
    FROM public.bd_permissions p
    WHERE p.codigo = 'motoristas_operacional_todos' AND p.ativo = true;

    IF v_perm_id IS NOT NULL THEN
      -- DENY explícito bloqueia
      SELECT EXISTS (
        SELECT 1
        FROM public.bd_user_permission_overrides o
        WHERE o.user_id = v_uid
          AND o.permission_id = v_perm_id
          AND o.permitido = false
      ) INTO v_denied;

      IF NOT v_denied THEN
        -- ALLOW explícito OU concedido via role
        v_autorizado := EXISTS (
          SELECT 1 FROM public.bd_user_permission_overrides o
          WHERE o.user_id = v_uid AND o.permission_id = v_perm_id AND o.permitido = true
        ) OR EXISTS (
          SELECT 1
          FROM public.bd_user_roles ur
          JOIN public.bd_role_permission_actions rpa ON rpa.role_id = ur.role_id
          WHERE ur.user_id = v_uid
            AND rpa.permission_id = v_perm_id
        );
      END IF;
    END IF;
  END IF;

  IF NOT v_autorizado THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    f.id,
    f.nome_completo,
    f.matricula,
    fu.nome_funcao AS funcao_nome
  FROM public.bd_funcionarios f
  JOIN public.bd_funcoes fu ON fu.id = f.funcao_id
  WHERE fu.nome_funcao ILIKE '%motorista%'
    AND f.status IN ('Ativo','Ativo sem Registro','Férias')
  ORDER BY f.nome_completo ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_motoristas_operacional_lookup() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_motoristas_operacional_lookup() FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_motoristas_operacional_lookup() TO authenticated;
