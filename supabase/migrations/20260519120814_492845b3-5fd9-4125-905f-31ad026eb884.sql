-- =========================================================================
-- 1) bd_auditoria_log: INSERT precisa ser do próprio usuário
-- =========================================================================
DROP POLICY IF EXISTS "Sistema pode inserir auditoria" ON public.bd_auditoria_log;

CREATE POLICY "Auditoria insert own user"
  ON public.bd_auditoria_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    usuario_id = auth.uid()
    OR public.check_is_super_admin(auth.uid())
  );

-- =========================================================================
-- 2) bd_pncp_todas_licitacoes: INSERT restrito a gestores PNCP / SuperAdm
-- =========================================================================
DROP POLICY IF EXISTS "Sistema pode inserir licitacoes" ON public.bd_pncp_todas_licitacoes;

CREATE POLICY "PNCP licitacoes insert managers"
  ON public.bd_pncp_todas_licitacoes
  FOR INSERT
  TO authenticated
  WITH CHECK (public.fn_pncp_can_manage(auth.uid()));

-- =========================================================================
-- 3) profiles_admin_update_safe: bloquear escalada de privilégio.
--    AdmRH e similares NÃO podem alterar acesso_global / funcoes /
--    funcao_sistema / funcao_permissao em perfis de terceiros.
--    SuperAdm continua podendo alterar qualquer coluna.
-- =========================================================================
DROP POLICY IF EXISTS profiles_admin_update_safe ON public.profiles;

CREATE POLICY profiles_admin_update_safe
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    public.fn_is_super_admin()
    OR public.fn_has_permission('admin_permissoes_view'::text)
    OR public.fn_has_role('AdmRH'::text)
  )
  WITH CHECK (
    public.fn_is_super_admin()
    OR (
      (
        public.fn_has_permission('admin_permissoes_view'::text)
        OR public.fn_has_role('AdmRH'::text)
      )
      AND NOT (acesso_global IS DISTINCT FROM (
        SELECT p.acesso_global FROM public.profiles p WHERE p.id = profiles.id
      ))
      AND NOT (funcoes IS DISTINCT FROM (
        SELECT p.funcoes FROM public.profiles p WHERE p.id = profiles.id
      ))
      AND NOT (funcao_sistema IS DISTINCT FROM (
        SELECT p.funcao_sistema FROM public.profiles p WHERE p.id = profiles.id
      ))
      AND NOT (funcao_permissao IS DISTINCT FROM (
        SELECT p.funcao_permissao FROM public.profiles p WHERE p.id = profiles.id
      ))
    )
  );