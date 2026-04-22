CREATE OR REPLACE FUNCTION public.fn_auth_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.fn_has_role(p_role text, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.fn_is_super_admin(p_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.bd_user_roles ur
      JOIN public.bd_roles r ON r.id = ur.role_id
      WHERE ur.user_id = p_user_id
        AND COALESCE(r.ativo, true) = true
        AND r.nome = p_role
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      LEFT JOIN public.bd_funcoes_permissao fp ON fp.id = p.funcao_permissao
      WHERE p.id = p_user_id
        AND (
          p_role = ANY(COALESCE(p.funcoes, '{}'::text[]))
          OR COALESCE(p.funcao_sistema, '') = p_role
          OR COALESCE(fp.nome_funcao, '') = p_role
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.fn_has_permission(p_nome_permissao text, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH explicit_deny AS (
    SELECT 1
    FROM public.bd_user_permission_overrides uo
    JOIN public.bd_permissoes p ON p.id = uo.permission_id
    WHERE uo.user_id = p_user_id
      AND uo.permitido = false
      AND p.nome_permissao = p_nome_permissao
    LIMIT 1
  ), explicit_allow AS (
    SELECT 1
    FROM public.bd_user_permission_overrides uo
    JOIN public.bd_permissoes p ON p.id = uo.permission_id
    WHERE uo.user_id = p_user_id
      AND uo.permitido = true
      AND p.nome_permissao = p_nome_permissao
    LIMIT 1
  ), role_allow AS (
    SELECT 1
    FROM public.bd_user_roles ur
    JOIN public.bd_roles r ON r.id = ur.role_id
    LEFT JOIN public.bd_role_permissions rp ON rp.role_id = r.id
    LEFT JOIN public.bd_role_permission_actions rpa ON rpa.role_id = r.id
    LEFT JOIN public.bd_permissoes p_rp ON p_rp.id = rp.permission_id
    LEFT JOIN public.bd_permissoes p_rpa ON p_rpa.id = rpa.permission_id
    WHERE ur.user_id = p_user_id
      AND COALESCE(r.ativo, true) = true
      AND (
        p_rp.nome_permissao = p_nome_permissao
        OR p_rpa.nome_permissao = p_nome_permissao
      )
    LIMIT 1
  ), legacy_allow AS (
    SELECT 1
    FROM public.profiles pr
    JOIN public.bd_funcoes_permissao fp ON fp.id = pr.funcao_permissao
    JOIN public.bd_permissoes p ON p.id = ANY(COALESCE(fp.permissoes, '{}'::uuid[]))
    WHERE pr.id = p_user_id
      AND p.nome_permissao = p_nome_permissao
    LIMIT 1
  )
  SELECT CASE
    WHEN public.fn_is_super_admin(p_user_id) THEN true
    WHEN EXISTS (SELECT 1 FROM explicit_deny) THEN false
    WHEN EXISTS (SELECT 1 FROM explicit_allow) THEN true
    WHEN EXISTS (SELECT 1 FROM role_allow) THEN true
    WHEN EXISTS (SELECT 1 FROM legacy_allow) THEN true
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.has_permission(p_permission_name text, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.fn_has_permission(p_permission_name, p_user_id);
$$;

CREATE OR REPLACE FUNCTION public.fn_diaria_can_create(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(p_user_id IS NOT NULL, false)
    AND (
      public.fn_is_super_admin(p_user_id)
      OR public.check_is_admsso(p_user_id)
      OR public.fn_has_permission('diarias_solicitar', p_user_id)
      OR public.fn_has_permission('diarias_solicitar_create', p_user_id)
      OR public.fn_has_permission('diarias_solicitacoes_view', p_user_id)
      OR public.fn_has_role('AdmSede', p_user_id)
      OR public.fn_has_role('AdmOBRA', p_user_id)
      OR public.fn_has_role('Apontador', p_user_id)
      OR public.fn_has_role('Encarregado', p_user_id)
    );
$$;

CREATE OR REPLACE FUNCTION public.fn_diaria_can_manage_row(p_solicitacao_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bd_diaria_solicitacoes s
    LEFT JOIN public.bd_centros_custo cc ON cc.id = s.centro_custo_id
    WHERE s.id = p_solicitacao_id
      AND (
        public.fn_is_super_admin(p_user_id)
        OR public.check_is_admsso(p_user_id)
        OR s.criado_por = p_user_id
        OR s.responsavel_campo_id = public.get_user_funcionario_id(p_user_id)
        OR cc.aprovador_diarias_id = public.get_user_funcionario_id(p_user_id)
        OR cc.adm_sede_funcionario_id = public.get_user_funcionario_id(p_user_id)
        OR public.fn_has_permission('diarias_autorizar', p_user_id)
        OR public.fn_has_permission('diarias_aprovar', p_user_id)
        OR public.fn_has_role('AdmSede', p_user_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.fn_diaria_can_select_row(p_solicitacao_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bd_diaria_solicitacoes s
    LEFT JOIN public.bd_centros_custo cc ON cc.id = s.centro_custo_id
    WHERE s.id = p_solicitacao_id
      AND (
        public.fn_is_super_admin(p_user_id)
        OR public.check_is_admsso(p_user_id)
        OR s.criado_por = p_user_id
        OR s.responsavel_campo_id = public.get_user_funcionario_id(p_user_id)
        OR cc.aprovador_diarias_id = public.get_user_funcionario_id(p_user_id)
        OR cc.adm_sede_funcionario_id = public.get_user_funcionario_id(p_user_id)
        OR public.fn_has_permission('diarias_view', p_user_id)
        OR public.fn_has_permission('diarias_solicitacoes_view', p_user_id)
        OR public.fn_has_permission('diarias_relatorio_view', p_user_id)
        OR public.fn_has_permission('diarias_dashboard_view', p_user_id)
        OR public.fn_has_role('AdmSede', p_user_id)
        OR public.fn_has_role('AdmOBRA', p_user_id)
        OR public.fn_has_role('Apontador', p_user_id)
        OR public.fn_has_role('Encarregado', p_user_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.fn_diaria_can_update_row(p_solicitacao_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bd_diaria_solicitacoes s
    LEFT JOIN public.bd_centros_custo cc ON cc.id = s.centro_custo_id
    WHERE s.id = p_solicitacao_id
      AND (
        public.fn_is_super_admin(p_user_id)
        OR (
          s.criado_por = p_user_id
          AND (
            public.fn_has_permission('diarias_solicitar', p_user_id)
            OR public.fn_has_permission('diarias_solicitar_edit_own', p_user_id)
            OR public.fn_diaria_can_create(p_user_id)
          )
          AND s.status IN ('rascunho', 'enviada', 'reprovada')
        )
        OR (
          (
            cc.aprovador_diarias_id = public.get_user_funcionario_id(p_user_id)
            OR cc.adm_sede_funcionario_id = public.get_user_funcionario_id(p_user_id)
            OR public.fn_has_permission('diarias_autorizar', p_user_id)
            OR public.fn_has_permission('diarias_aprovar', p_user_id)
            OR public.check_is_admsso(p_user_id)
            OR public.fn_has_role('AdmSede', p_user_id)
          )
          AND s.criado_por <> p_user_id
        )
      )
  );
$$;

ALTER TABLE public.bd_diaria_solicitacoes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "diaria_solicitacoes_insert" ON public.bd_diaria_solicitacoes;
CREATE POLICY "diaria_solicitacoes_insert"
ON public.bd_diaria_solicitacoes
FOR INSERT
TO authenticated
WITH CHECK (
  public.fn_diaria_can_create(auth.uid())
  AND COALESCE(criado_por, auth.uid()) = auth.uid()
);

DROP POLICY IF EXISTS "diaria_solicitacoes_select" ON public.bd_diaria_solicitacoes;
CREATE POLICY "diaria_solicitacoes_select"
ON public.bd_diaria_solicitacoes
FOR SELECT
TO authenticated
USING (public.fn_diaria_can_select_row(id, auth.uid()));

DROP POLICY IF EXISTS "diaria_solicitacoes_update" ON public.bd_diaria_solicitacoes;
CREATE POLICY "diaria_solicitacoes_update"
ON public.bd_diaria_solicitacoes
FOR UPDATE
TO authenticated
USING (public.fn_diaria_can_update_row(id, auth.uid()))
WITH CHECK (public.fn_diaria_can_update_row(id, auth.uid()));

DROP POLICY IF EXISTS "diaria_solicitacoes_delete" ON public.bd_diaria_solicitacoes;
CREATE POLICY "diaria_solicitacoes_delete"
ON public.bd_diaria_solicitacoes
FOR DELETE
TO authenticated
USING (
  public.fn_is_super_admin(auth.uid())
  OR (
    criado_por = auth.uid()
    AND public.fn_has_permission('diarias_solicitar_cancel_own', auth.uid())
    AND status = 'rascunho'
  )
  OR public.check_is_admsso(auth.uid())
);

CREATE OR REPLACE FUNCTION public.fn_user_can_access_diaria_solicitacao(_user_id uuid, _solicitacao_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.fn_diaria_can_select_row(_solicitacao_id, _user_id);
$$;