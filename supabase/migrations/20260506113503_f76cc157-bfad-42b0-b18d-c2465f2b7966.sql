
-- 1. bd_arquivo_morto
DROP POLICY IF EXISTS "Authenticated can read arquivo_morto" ON public.bd_arquivo_morto;
DROP POLICY IF EXISTS "Authenticated can insert arquivo_morto" ON public.bd_arquivo_morto;

CREATE POLICY "RH can read arquivo_morto"
  ON public.bd_arquivo_morto FOR SELECT TO authenticated
  USING (
    fn_is_super_admin()
    OR fn_has_role('AdmRH')
    OR fn_has_role('DP')
    OR fn_has_role('Financeiro')
    OR fn_can_access_funcionario_sensitive()
  );

CREATE POLICY "RH can insert arquivo_morto"
  ON public.bd_arquivo_morto FOR INSERT TO authenticated
  WITH CHECK (
    fn_is_super_admin()
    OR fn_has_role('AdmRH')
    OR fn_has_role('DP')
    OR fn_can_access_funcionario_sensitive()
  );

-- 2. bd_importacao_alterdata
DROP POLICY IF EXISTS "Autenticados acessam staging" ON public.bd_importacao_alterdata;

CREATE POLICY "RH manage staging alterdata"
  ON public.bd_importacao_alterdata FOR ALL TO authenticated
  USING (
    fn_is_super_admin()
    OR fn_has_role('AdmRH')
    OR fn_can_access_funcionario_sensitive()
  )
  WITH CHECK (
    fn_is_super_admin()
    OR fn_has_role('AdmRH')
    OR fn_can_access_funcionario_sensitive()
  );

-- 3. bd_log_comunicacao
DROP POLICY IF EXISTS "Authenticated users can view communication logs" ON public.bd_log_comunicacao;

CREATE POLICY "Sender or RH can view communication logs"
  ON public.bd_log_comunicacao FOR SELECT TO authenticated
  USING (
    enviado_por = auth.uid()
    OR fn_is_super_admin()
    OR fn_has_role('AdmRH')
    OR fn_has_role('DP')
  );

-- 4. bd_matching_config
DROP POLICY IF EXISTS "Authenticated users can update matching config" ON public.bd_matching_config;

CREATE POLICY "PNCP managers update matching config"
  ON public.bd_matching_config FOR UPDATE TO authenticated
  USING (fn_is_super_admin() OR fn_pncp_can_manage())
  WITH CHECK (fn_is_super_admin() OR fn_pncp_can_manage());

-- 5. bd_matching_exclusoes
DROP POLICY IF EXISTS "Authenticated users can manage exclusions" ON public.bd_matching_exclusoes;

CREATE POLICY "PNCP managers insert exclusions"
  ON public.bd_matching_exclusoes FOR INSERT TO authenticated
  WITH CHECK (fn_is_super_admin() OR fn_pncp_can_manage());

CREATE POLICY "PNCP managers update exclusions"
  ON public.bd_matching_exclusoes FOR UPDATE TO authenticated
  USING (fn_is_super_admin() OR fn_pncp_can_manage())
  WITH CHECK (fn_is_super_admin() OR fn_pncp_can_manage());

CREATE POLICY "PNCP managers delete exclusions"
  ON public.bd_matching_exclusoes FOR DELETE TO authenticated
  USING (fn_is_super_admin() OR fn_pncp_can_manage());

-- 6. bd_funcoes
DROP POLICY IF EXISTS "bd_funcoes_read_authenticated" ON public.bd_funcoes;

CREATE POLICY "bd_funcoes_read_financial"
  ON public.bd_funcoes FOR SELECT TO authenticated
  USING (
    fn_is_super_admin()
    OR fn_has_role('AdmRH')
    OR fn_has_role('DP')
    OR fn_has_role('Financeiro')
    OR fn_has_permission('gestao_rh_funcoes_view')
    OR fn_has_permission('gestao_rh_funcoes_edit')
  );

CREATE OR REPLACE VIEW public.vw_funcoes_publicas
WITH (security_invoker = true) AS
SELECT
  id,
  nome_funcao,
  descricao,
  situacao,
  created_at,
  updated_at
FROM public.bd_funcoes;

GRANT SELECT ON public.vw_funcoes_publicas TO authenticated;

-- 7. Storage sso-ver-agir
DROP POLICY IF EXISTS "ver_agir_storage_upload" ON storage.objects;

CREATE POLICY "ver_agir_storage_upload_scoped"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'sso-ver-agir'
    AND (storage.foldername(name))[1] = 'ver-agir'
    AND has_sso_permission(auth.uid())
  );
