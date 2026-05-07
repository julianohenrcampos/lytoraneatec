
-- =========================================================
-- 1) profiles_self_update_safe — bloquear escalonamento
-- =========================================================
DROP POLICY IF EXISTS profiles_self_update_safe ON public.profiles;

CREATE POLICY profiles_self_update_safe
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = fn_auth_user_id())
WITH CHECK (
  id = fn_auth_user_id()
  AND funcoes          IS NOT DISTINCT FROM (SELECT p.funcoes          FROM public.profiles p WHERE p.id = fn_auth_user_id())
  AND funcao_sistema   IS NOT DISTINCT FROM (SELECT p.funcao_sistema   FROM public.profiles p WHERE p.id = fn_auth_user_id())
  AND acesso_global    IS NOT DISTINCT FROM (SELECT p.acesso_global    FROM public.profiles p WHERE p.id = fn_auth_user_id())
  AND funcao_permissao IS NOT DISTINCT FROM (SELECT p.funcao_permissao FROM public.profiles p WHERE p.id = fn_auth_user_id())
  AND cargo            IS NOT DISTINCT FROM (SELECT p.cargo            FROM public.profiles p WHERE p.id = fn_auth_user_id())
  AND funcionario_id   IS NOT DISTINCT FROM (SELECT p.funcionario_id   FROM public.profiles p WHERE p.id = fn_auth_user_id())
  AND email            IS NOT DISTINCT FROM (SELECT p.email            FROM public.profiles p WHERE p.id = fn_auth_user_id())
);

-- =========================================================
-- 2) bd_solicitacoes_itens — restringir à solicitação pai
-- =========================================================
DROP POLICY IF EXISTS "Authenticated users can read solicitacoes_itens"   ON public.bd_solicitacoes_itens;
DROP POLICY IF EXISTS "Authenticated users can insert solicitacoes_itens" ON public.bd_solicitacoes_itens;
DROP POLICY IF EXISTS "Authenticated users can update solicitacoes_itens" ON public.bd_solicitacoes_itens;

CREATE POLICY solicitacoes_itens_select
ON public.bd_solicitacoes_itens
FOR SELECT
TO authenticated
USING (public.fn_ativos_can_access_solicitacao(solicitacao_id));

CREATE POLICY solicitacoes_itens_insert
ON public.bd_solicitacoes_itens
FOR INSERT
TO authenticated
WITH CHECK (public.fn_ativos_can_access_solicitacao(solicitacao_id));

CREATE POLICY solicitacoes_itens_update
ON public.bd_solicitacoes_itens
FOR UPDATE
TO authenticated
USING (public.fn_ativos_can_access_solicitacao(solicitacao_id))
WITH CHECK (public.fn_ativos_can_access_solicitacao(solicitacao_id));

CREATE POLICY solicitacoes_itens_delete
ON public.bd_solicitacoes_itens
FOR DELETE
TO authenticated
USING (public.fn_ativos_can_access_solicitacao(solicitacao_id));

-- =========================================================
-- 3) bd_aprovacoes_fluxo_exec — só SuperAdm via API pública
--    (edge functions / serviços usam service role e bypassam RLS)
-- =========================================================
DROP POLICY IF EXISTS auth_read_exec   ON public.bd_aprovacoes_fluxo_exec;
DROP POLICY IF EXISTS auth_insert_exec ON public.bd_aprovacoes_fluxo_exec;
DROP POLICY IF EXISTS auth_update_exec ON public.bd_aprovacoes_fluxo_exec;

CREATE POLICY fluxo_exec_select_admin
ON public.bd_aprovacoes_fluxo_exec
FOR SELECT
TO authenticated
USING (public.fn_is_super_admin());

CREATE POLICY fluxo_exec_insert_admin
ON public.bd_aprovacoes_fluxo_exec
FOR INSERT
TO authenticated
WITH CHECK (public.fn_is_super_admin());

CREATE POLICY fluxo_exec_update_admin
ON public.bd_aprovacoes_fluxo_exec
FOR UPDATE
TO authenticated
USING (public.fn_is_super_admin())
WITH CHECK (public.fn_is_super_admin());

-- =========================================================
-- 4) bd_diaria_status — restringir por solicitação
-- =========================================================
DROP POLICY IF EXISTS diaria_status_select ON public.bd_diaria_status;
DROP POLICY IF EXISTS diaria_status_insert ON public.bd_diaria_status;
DROP POLICY IF EXISTS diaria_status_update ON public.bd_diaria_status;

CREATE POLICY diaria_status_select
ON public.bd_diaria_status
FOR SELECT
TO authenticated
USING (public.fn_diaria_can_select_row(solicitacao_id));

CREATE POLICY diaria_status_insert
ON public.bd_diaria_status
FOR INSERT
TO authenticated
WITH CHECK (public.fn_diaria_can_update_row(solicitacao_id));

CREATE POLICY diaria_status_update
ON public.bd_diaria_status
FOR UPDATE
TO authenticated
USING (public.fn_diaria_can_update_row(solicitacao_id))
WITH CHECK (public.fn_diaria_can_update_row(solicitacao_id));

-- =========================================================
-- 5) bd_pncp_todas_licitacoes — UPDATE restrito a gestores
-- =========================================================
DROP POLICY IF EXISTS "Usuarios podem atualizar status" ON public.bd_pncp_todas_licitacoes;

CREATE POLICY pncp_licitacoes_update_managers
ON public.bd_pncp_todas_licitacoes
FOR UPDATE
TO authenticated
USING (public.fn_pncp_can_manage() OR public.fn_pncp_can_view())
WITH CHECK (public.fn_pncp_can_manage() OR public.fn_pncp_can_view());
