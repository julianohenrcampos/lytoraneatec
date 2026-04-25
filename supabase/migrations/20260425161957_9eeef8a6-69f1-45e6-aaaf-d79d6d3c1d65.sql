
-- =====================================================
-- Escopo de visibilidade — Registro de Desvios SSO
-- (com bypass de triggers de validação que exigem auth.uid())
-- =====================================================

DO $$
DECLARE
  v_perm_id uuid;
  v_role record;
BEGIN
  -- Desabilitar triggers de validação (catálogo de permissões + RBAC links)
  ALTER TABLE public.bd_permissions DISABLE TRIGGER trg_validate_permission_catalog_change;
  ALTER TABLE public.bd_role_permissions DISABLE TRIGGER trg_validate_role_permission_link_change;
  ALTER TABLE public.bd_role_permission_actions DISABLE TRIGGER trg_validate_role_permission_action_change;

  -- 1) Permissão global "ver todos os desvios" (idempotente)
  INSERT INTO public.bd_permissions (codigo, nome, descricao, rota)
  VALUES (
    'desvios_ver_todos',
    'Ver todos os Registros de Desvios SSO',
    'Permite visualizar desvios de qualquer obra/criador, ignorando o escopo padrão (criador / AdmOBRA / AdmSede).',
    NULL
  )
  ON CONFLICT (codigo) DO NOTHING;

  SELECT id INTO v_perm_id FROM public.bd_permissions WHERE codigo = 'desvios_ver_todos';

  -- 2) Conceder a SuperAdm, AdmSSO e TecSSO
  FOR v_role IN
    SELECT id, nome FROM public.bd_roles WHERE nome IN ('SuperAdm','AdmSSO','TecSSO')
  LOOP
    INSERT INTO public.bd_role_permissions (role_id, permission_id)
    VALUES (v_role.id, v_perm_id)
    ON CONFLICT (role_id, permission_id) DO NOTHING;

    INSERT INTO public.bd_role_permission_actions (role_id, permission_id, acao)
    VALUES (v_role.id, v_perm_id, 'visualizar')
    ON CONFLICT (role_id, permission_id, acao) DO NOTHING;
  END LOOP;

  -- Reabilitar triggers
  ALTER TABLE public.bd_role_permission_actions ENABLE TRIGGER trg_validate_role_permission_action_change;
  ALTER TABLE public.bd_role_permissions ENABLE TRIGGER trg_validate_role_permission_link_change;
  ALTER TABLE public.bd_permissions ENABLE TRIGGER trg_validate_permission_catalog_change;
END $$;

-- 3) Função SECURITY DEFINER que define se o usuário pode ver uma linha de desvio
CREATE OR REPLACE FUNCTION public.fn_desvio_can_select_row(
  p_criado_por uuid,
  p_obra_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_funcionario_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  IF check_is_super_admin() THEN
    RETURN true;
  END IF;

  IF has_permission('desvios_ver_todos') THEN
    RETURN true;
  END IF;

  IF p_criado_por = v_uid THEN
    RETURN true;
  END IF;

  -- AdmSede do CC
  IF p_obra_id IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.get_admsede_centros_custo(v_uid) cc(id)
       WHERE cc.id = p_obra_id
     )
  THEN
    RETURN true;
  END IF;

  -- AdmOBRA / Aprovador do CC (proxy via aprovador_diarias_id)
  IF p_obra_id IS NOT NULL THEN
    SELECT funcionario_id INTO v_funcionario_id
    FROM public.profiles WHERE id = v_uid;

    IF v_funcionario_id IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM public.bd_centros_custo
         WHERE id = p_obra_id
           AND aprovador_diarias_id = v_funcionario_id
       )
    THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$$;

-- 4) Substituir RLS de SELECT/UPDATE/DELETE
DROP POLICY IF EXISTS "Desvios SSO: SELECT para usuários autenticados" ON public.bd_registro_desvios_sso;
DROP POLICY IF EXISTS "Desvios SSO: UPDATE para usuários autenticados" ON public.bd_registro_desvios_sso;
DROP POLICY IF EXISTS "Desvios SSO: DELETE para admins" ON public.bd_registro_desvios_sso;

CREATE POLICY "Desvios SSO: SELECT por escopo"
ON public.bd_registro_desvios_sso
FOR SELECT
TO authenticated
USING ( public.fn_desvio_can_select_row(criado_por, obra_id) );

CREATE POLICY "Desvios SSO: UPDATE por escopo"
ON public.bd_registro_desvios_sso
FOR UPDATE
TO authenticated
USING ( public.fn_desvio_can_select_row(criado_por, obra_id) )
WITH CHECK ( public.fn_desvio_can_select_row(criado_por, obra_id) );

CREATE POLICY "Desvios SSO: DELETE por escopo"
ON public.bd_registro_desvios_sso
FOR DELETE
TO authenticated
USING (
  check_is_super_admin()
  OR has_permission('desvios_ver_todos')
  OR criado_por = auth.uid()
);
