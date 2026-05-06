
-- ============================================================
-- Security findings remediation (retry — has_role(text, uuid))
-- ============================================================

-- 1) sso-ver-agir storage
DROP POLICY IF EXISTS "ver_agir_storage_read"   ON storage.objects;
DROP POLICY IF EXISTS "ver_agir_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "ver_agir_storage_delete" ON storage.objects;

-- 2) ponto-fotos storage
DROP POLICY IF EXISTS "ponto_fotos_select" ON storage.objects;
DROP POLICY IF EXISTS "ponto_fotos_insert" ON storage.objects;

-- 3) tickets bucket
DROP POLICY IF EXISTS "Tickets são acessíveis publicamente" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios tickets" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem deletar tickets" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem fazer upload de tickets" ON storage.objects;

CREATE POLICY "tickets_select_scoped"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'tickets' AND public.fn_os_storage_object_allowed(name));

CREATE POLICY "tickets_insert_scoped"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tickets' AND public.fn_os_storage_object_allowed(name));

CREATE POLICY "tickets_update_scoped"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'tickets' AND public.fn_os_storage_object_allowed(name))
  WITH CHECK (bucket_id = 'tickets' AND public.fn_os_storage_object_allowed(name));

CREATE POLICY "tickets_delete_scoped"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'tickets' AND public.fn_os_storage_object_allowed(name));

-- 4) bd_auditoria_correcao_registros_carga
DROP POLICY IF EXISTS "Usuários autenticados podem acessar auditoria correção carga"
  ON public.bd_auditoria_correcao_registros_carga;

CREATE POLICY "auditoria_correcao_carga_select_authenticated"
  ON public.bd_auditoria_correcao_registros_carga
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "auditoria_correcao_carga_insert_authenticated"
  ON public.bd_auditoria_correcao_registros_carga
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- 5) bd_solicitacoes_equip_aprovacoes
DROP POLICY IF EXISTS "Authenticated users can insert approvals" ON public.bd_solicitacoes_equip_aprovacoes;
DROP POLICY IF EXISTS "Authenticated users can update approvals" ON public.bd_solicitacoes_equip_aprovacoes;
DROP POLICY IF EXISTS "Authenticated users can read approvals"   ON public.bd_solicitacoes_equip_aprovacoes;

CREATE POLICY "equip_aprovacoes_select_scoped"
  ON public.bd_solicitacoes_equip_aprovacoes
  FOR SELECT TO authenticated
  USING (public.fn_ativos_can_access_solicitacao(solicitacao_id));

CREATE POLICY "equip_aprovacoes_insert_scoped"
  ON public.bd_solicitacoes_equip_aprovacoes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.fn_ativos_can_access_solicitacao(solicitacao_id)
    AND aprovador_id = auth.uid()
  );

CREATE POLICY "equip_aprovacoes_update_scoped"
  ON public.bd_solicitacoes_equip_aprovacoes
  FOR UPDATE TO authenticated
  USING (
    public.fn_ativos_can_access_solicitacao(solicitacao_id)
    AND aprovador_id = auth.uid()
  )
  WITH CHECK (
    public.fn_ativos_can_access_solicitacao(solicitacao_id)
    AND aprovador_id = auth.uid()
  );

-- 6) bd_historico_funcional
DROP POLICY IF EXISTS "Authenticated users can view career history"   ON public.bd_historico_funcional;
DROP POLICY IF EXISTS "Authenticated users can insert career history" ON public.bd_historico_funcional;

CREATE POLICY "historico_funcional_select_sensitive"
  ON public.bd_historico_funcional
  FOR SELECT TO authenticated
  USING (public.fn_can_access_funcionario_sensitive(funcionario_id));

CREATE POLICY "historico_funcional_insert_sensitive"
  ON public.bd_historico_funcional
  FOR INSERT TO authenticated
  WITH CHECK (public.fn_can_access_funcionario_sensitive(funcionario_id));

-- 7) bd_solicitacoes_planejamento
DROP POLICY IF EXISTS "Authenticated users can read planning"   ON public.bd_solicitacoes_planejamento;
DROP POLICY IF EXISTS "Authenticated users can insert planning" ON public.bd_solicitacoes_planejamento;
DROP POLICY IF EXISTS "Authenticated users can update planning" ON public.bd_solicitacoes_planejamento;

CREATE POLICY "planejamento_select_scoped"
  ON public.bd_solicitacoes_planejamento
  FOR SELECT TO authenticated
  USING (public.fn_ativos_can_access_solicitacao(solicitacao_id));

CREATE POLICY "planejamento_insert_scoped"
  ON public.bd_solicitacoes_planejamento
  FOR INSERT TO authenticated
  WITH CHECK (public.fn_ativos_can_access_solicitacao(solicitacao_id));

CREATE POLICY "planejamento_update_scoped"
  ON public.bd_solicitacoes_planejamento
  FOR UPDATE TO authenticated
  USING (public.fn_ativos_can_access_solicitacao(solicitacao_id))
  WITH CHECK (public.fn_ativos_can_access_solicitacao(solicitacao_id));

-- 8) bd_vale_transporte — has_role(text, uuid)
DROP POLICY IF EXISTS "Auth select vt" ON public.bd_vale_transporte;
DROP POLICY IF EXISTS "Auth update vt" ON public.bd_vale_transporte;
DROP POLICY IF EXISTS "Auth insert vt" ON public.bd_vale_transporte;

CREATE POLICY "vt_select_scoped"
  ON public.bd_vale_transporte
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR public.has_role('SuperAdm', auth.uid())
    OR public.has_role('AdmRH', auth.uid())
    OR public.has_role('TecSSO', auth.uid())
    OR public.has_role('AdmSSO', auth.uid())
    OR public.has_role('Financeiro', auth.uid())
    OR public.has_role('DP', auth.uid())
  );

CREATE POLICY "vt_insert_scoped"
  ON public.bd_vale_transporte
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (created_by IS NULL OR created_by = auth.uid())
  );

CREATE POLICY "vt_update_scoped"
  ON public.bd_vale_transporte
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.has_role('SuperAdm', auth.uid())
    OR public.has_role('AdmRH', auth.uid())
    OR public.has_role('TecSSO', auth.uid())
    OR public.has_role('AdmSSO', auth.uid())
    OR public.has_role('Financeiro', auth.uid())
    OR public.has_role('DP', auth.uid())
  )
  WITH CHECK (
    created_by = auth.uid()
    OR public.has_role('SuperAdm', auth.uid())
    OR public.has_role('AdmRH', auth.uid())
    OR public.has_role('TecSSO', auth.uid())
    OR public.has_role('AdmSSO', auth.uid())
    OR public.has_role('Financeiro', auth.uid())
    OR public.has_role('DP', auth.uid())
  );

-- 9) bd_desligamentos
DROP POLICY IF EXISTS "Authenticated users can view desligamentos"   ON public.bd_desligamentos;
DROP POLICY IF EXISTS "Authenticated users can update desligamentos" ON public.bd_desligamentos;
DROP POLICY IF EXISTS "Authenticated users can insert desligamentos" ON public.bd_desligamentos;

CREATE POLICY "desligamentos_select_sensitive"
  ON public.bd_desligamentos
  FOR SELECT TO authenticated
  USING (public.fn_can_access_funcionario_sensitive(funcionario_id));

CREATE POLICY "desligamentos_insert_sensitive"
  ON public.bd_desligamentos
  FOR INSERT TO authenticated
  WITH CHECK (public.fn_can_access_funcionario_sensitive(funcionario_id));

CREATE POLICY "desligamentos_update_sensitive"
  ON public.bd_desligamentos
  FOR UPDATE TO authenticated
  USING (public.fn_can_access_funcionario_sensitive(funcionario_id))
  WITH CHECK (public.fn_can_access_funcionario_sensitive(funcionario_id));
