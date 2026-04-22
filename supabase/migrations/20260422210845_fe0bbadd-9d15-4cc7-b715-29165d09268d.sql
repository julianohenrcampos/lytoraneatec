CREATE OR REPLACE FUNCTION public.fn_pncp_can_view(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.fn_is_super_admin(p_user_id), false)
    OR COALESCE(public.has_pncp_access(p_user_id), false)
    OR COALESCE(public.has_permission('acesso_monitoramento_pncp', p_user_id), false)
    OR COALESCE(public.has_permission('dashboard_licitacoes_view', p_user_id), false)
    OR COALESCE(public.has_permission('relatorio_licitacoes_view', p_user_id), false);
$$;

CREATE OR REPLACE FUNCTION public.fn_pncp_can_manage(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.fn_is_super_admin(p_user_id), false)
    OR COALESCE(public.has_permission('configuracoes_pncp_view', p_user_id), false);
$$;

CREATE OR REPLACE FUNCTION public.fn_pncp_can_view_strategic(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.fn_is_super_admin(p_user_id), false)
    OR COALESCE(public.has_permission('configuracoes_pncp_view', p_user_id), false)
    OR COALESCE(public.has_permission('relatorio_licitacoes_view', p_user_id), false);
$$;

CREATE OR REPLACE FUNCTION public.fn_pncp_can_manage_orgaos(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.fn_pncp_can_manage(p_user_id);
$$;

CREATE OR REPLACE FUNCTION public.fn_pncp_can_access_sync_log_row(p_row_user_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(p_row_user_id = p_user_id, false)
    OR public.fn_pncp_can_manage(p_user_id)
    OR public.fn_pncp_can_view_strategic(p_user_id);
$$;

ALTER TABLE public.bd_pncp_contratacoes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.bd_pncp_config_monitoramento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bd_pncp_config_monitoramento FORCE ROW LEVEL SECURITY;
ALTER TABLE public.bd_pncp_perfis_busca FORCE ROW LEVEL SECURITY;
ALTER TABLE public.bd_orgaos_publicos FORCE ROW LEVEL SECURITY;
ALTER TABLE public.bd_orgaos_alias FORCE ROW LEVEL SECURITY;
ALTER TABLE public.bd_licitacoes_orgaos_pendentes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.bd_pncp_sync_log FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso leitura licitações PNCP" ON public.bd_pncp_contratacoes;
DROP POLICY IF EXISTS "Acesso inserção licitações PNCP" ON public.bd_pncp_contratacoes;
DROP POLICY IF EXISTS "Acesso atualização licitações PNCP" ON public.bd_pncp_contratacoes;
DROP POLICY IF EXISTS "Acesso exclusão licitações PNCP" ON public.bd_pncp_contratacoes;
DROP POLICY IF EXISTS "Usuário vê suas contratações ou admin vê todas" ON public.bd_pncp_contratacoes;
DROP POLICY IF EXISTS "Usuário ou edge function insere contratações" ON public.bd_pncp_contratacoes;
DROP POLICY IF EXISTS "Usuário atualiza suas contratações" ON public.bd_pncp_contratacoes;
DROP POLICY IF EXISTS "Usuário exclui suas contratações" ON public.bd_pncp_contratacoes;
DROP POLICY IF EXISTS "Service role tem acesso total a contratações" ON public.bd_pncp_contratacoes;

CREATE POLICY "pncp_contratacoes_select"
ON public.bd_pncp_contratacoes
FOR SELECT
TO authenticated
USING (public.fn_pncp_can_view(auth.uid()));

CREATE POLICY "pncp_contratacoes_insert"
ON public.bd_pncp_contratacoes
FOR INSERT
TO authenticated
WITH CHECK (
  COALESCE(user_id = auth.uid(), false)
  OR public.fn_pncp_can_manage(auth.uid())
);

CREATE POLICY "pncp_contratacoes_update"
ON public.bd_pncp_contratacoes
FOR UPDATE
TO authenticated
USING (
  COALESCE(user_id = auth.uid(), false)
  OR public.fn_pncp_can_manage(auth.uid())
)
WITH CHECK (
  COALESCE(user_id = auth.uid(), false)
  OR public.fn_pncp_can_manage(auth.uid())
);

CREATE POLICY "pncp_contratacoes_delete"
ON public.bd_pncp_contratacoes
FOR DELETE
TO authenticated
USING (public.fn_pncp_can_manage(auth.uid()));

CREATE POLICY "pncp_contratacoes_service"
ON public.bd_pncp_contratacoes
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Admins podem gerenciar configurações PNCP" ON public.bd_pncp_config_monitoramento;

CREATE POLICY "pncp_config_select"
ON public.bd_pncp_config_monitoramento
FOR SELECT
TO authenticated
USING (public.fn_pncp_can_manage(auth.uid()));

CREATE POLICY "pncp_config_insert"
ON public.bd_pncp_config_monitoramento
FOR INSERT
TO authenticated
WITH CHECK (public.fn_pncp_can_manage(auth.uid()));

CREATE POLICY "pncp_config_update"
ON public.bd_pncp_config_monitoramento
FOR UPDATE
TO authenticated
USING (public.fn_pncp_can_manage(auth.uid()))
WITH CHECK (public.fn_pncp_can_manage(auth.uid()));

CREATE POLICY "pncp_config_delete"
ON public.bd_pncp_config_monitoramento
FOR DELETE
TO authenticated
USING (public.fn_pncp_can_manage(auth.uid()));

CREATE POLICY "pncp_config_service"
ON public.bd_pncp_config_monitoramento
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir leitura de perfis para usuários com acesso PNCP" ON public.bd_pncp_perfis_busca;
DROP POLICY IF EXISTS "Permitir inserção de perfis para usuários com acesso PNCP" ON public.bd_pncp_perfis_busca;
DROP POLICY IF EXISTS "Permitir atualização de perfis para usuários com acesso PNCP" ON public.bd_pncp_perfis_busca;
DROP POLICY IF EXISTS "Permitir exclusão de perfis para usuários com acesso PNCP" ON public.bd_pncp_perfis_busca;
DROP POLICY IF EXISTS "Usuário vê seus perfis ou admin vê todos" ON public.bd_pncp_perfis_busca;
DROP POLICY IF EXISTS "Usuário atualiza seus perfis" ON public.bd_pncp_perfis_busca;
DROP POLICY IF EXISTS "Usuário exclui seus perfis" ON public.bd_pncp_perfis_busca;
DROP POLICY IF EXISTS "Service role tem acesso total a perfis" ON public.bd_pncp_perfis_busca;

CREATE POLICY "pncp_perfis_select"
ON public.bd_pncp_perfis_busca
FOR SELECT
TO authenticated
USING (
  COALESCE(user_id = auth.uid(), false)
  OR public.fn_pncp_can_manage(auth.uid())
);

CREATE POLICY "pncp_perfis_insert"
ON public.bd_pncp_perfis_busca
FOR INSERT
TO authenticated
WITH CHECK (
  COALESCE(user_id = auth.uid(), false)
  OR public.fn_pncp_can_manage(auth.uid())
);

CREATE POLICY "pncp_perfis_update"
ON public.bd_pncp_perfis_busca
FOR UPDATE
TO authenticated
USING (
  COALESCE(user_id = auth.uid(), false)
  OR public.fn_pncp_can_manage(auth.uid())
)
WITH CHECK (
  COALESCE(user_id = auth.uid(), false)
  OR public.fn_pncp_can_manage(auth.uid())
);

CREATE POLICY "pncp_perfis_delete"
ON public.bd_pncp_perfis_busca
FOR DELETE
TO authenticated
USING (
  COALESCE(user_id = auth.uid(), false)
  OR public.fn_pncp_can_manage(auth.uid())
);

CREATE POLICY "pncp_perfis_service"
ON public.bd_pncp_perfis_busca
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "bd_orgaos_publicos_select" ON public.bd_orgaos_publicos;
DROP POLICY IF EXISTS "bd_orgaos_publicos_insert" ON public.bd_orgaos_publicos;
DROP POLICY IF EXISTS "bd_orgaos_publicos_update" ON public.bd_orgaos_publicos;
DROP POLICY IF EXISTS "bd_orgaos_publicos_delete" ON public.bd_orgaos_publicos;
DROP POLICY IF EXISTS "bd_orgaos_publicos_service" ON public.bd_orgaos_publicos;

CREATE POLICY "pncp_orgaos_publicos_select"
ON public.bd_orgaos_publicos
FOR SELECT
TO authenticated
USING (public.fn_pncp_can_view(auth.uid()));

CREATE POLICY "pncp_orgaos_publicos_insert"
ON public.bd_orgaos_publicos
FOR INSERT
TO authenticated
WITH CHECK (public.fn_pncp_can_manage_orgaos(auth.uid()));

CREATE POLICY "pncp_orgaos_publicos_update"
ON public.bd_orgaos_publicos
FOR UPDATE
TO authenticated
USING (public.fn_pncp_can_manage_orgaos(auth.uid()))
WITH CHECK (public.fn_pncp_can_manage_orgaos(auth.uid()));

CREATE POLICY "pncp_orgaos_publicos_delete"
ON public.bd_orgaos_publicos
FOR DELETE
TO authenticated
USING (public.fn_pncp_can_manage_orgaos(auth.uid()));

CREATE POLICY "pncp_orgaos_publicos_service"
ON public.bd_orgaos_publicos
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "bd_orgaos_alias_select" ON public.bd_orgaos_alias;
DROP POLICY IF EXISTS "bd_orgaos_alias_insert" ON public.bd_orgaos_alias;
DROP POLICY IF EXISTS "bd_orgaos_alias_update" ON public.bd_orgaos_alias;
DROP POLICY IF EXISTS "bd_orgaos_alias_delete" ON public.bd_orgaos_alias;
DROP POLICY IF EXISTS "bd_orgaos_alias_service" ON public.bd_orgaos_alias;

CREATE POLICY "pncp_orgaos_alias_select"
ON public.bd_orgaos_alias
FOR SELECT
TO authenticated
USING (public.fn_pncp_can_view(auth.uid()));

CREATE POLICY "pncp_orgaos_alias_insert"
ON public.bd_orgaos_alias
FOR INSERT
TO authenticated
WITH CHECK (public.fn_pncp_can_manage_orgaos(auth.uid()));

CREATE POLICY "pncp_orgaos_alias_update"
ON public.bd_orgaos_alias
FOR UPDATE
TO authenticated
USING (public.fn_pncp_can_manage_orgaos(auth.uid()))
WITH CHECK (public.fn_pncp_can_manage_orgaos(auth.uid()));

CREATE POLICY "pncp_orgaos_alias_delete"
ON public.bd_orgaos_alias
FOR DELETE
TO authenticated
USING (public.fn_pncp_can_manage_orgaos(auth.uid()));

CREATE POLICY "pncp_orgaos_alias_service"
ON public.bd_orgaos_alias
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "bd_licitacoes_orgaos_pendentes_all" ON public.bd_licitacoes_orgaos_pendentes;
DROP POLICY IF EXISTS "bd_licitacoes_orgaos_pendentes_select" ON public.bd_licitacoes_orgaos_pendentes;
DROP POLICY IF EXISTS "bd_licitacoes_orgaos_pendentes_service" ON public.bd_licitacoes_orgaos_pendentes;

CREATE POLICY "pncp_orgaos_pendentes_select"
ON public.bd_licitacoes_orgaos_pendentes
FOR SELECT
TO authenticated
USING (public.fn_pncp_can_view(auth.uid()));

CREATE POLICY "pncp_orgaos_pendentes_insert"
ON public.bd_licitacoes_orgaos_pendentes
FOR INSERT
TO authenticated
WITH CHECK (public.fn_pncp_can_manage_orgaos(auth.uid()));

CREATE POLICY "pncp_orgaos_pendentes_update"
ON public.bd_licitacoes_orgaos_pendentes
FOR UPDATE
TO authenticated
USING (public.fn_pncp_can_manage_orgaos(auth.uid()))
WITH CHECK (public.fn_pncp_can_manage_orgaos(auth.uid()));

CREATE POLICY "pncp_orgaos_pendentes_delete"
ON public.bd_licitacoes_orgaos_pendentes
FOR DELETE
TO authenticated
USING (public.fn_pncp_can_manage_orgaos(auth.uid()));

CREATE POLICY "pncp_orgaos_pendentes_service"
ON public.bd_licitacoes_orgaos_pendentes
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso inserção sync log PNCP" ON public.bd_pncp_sync_log;
DROP POLICY IF EXISTS "Acesso atualização sync log PNCP" ON public.bd_pncp_sync_log;
DROP POLICY IF EXISTS "Usuário pode criar seus logs" ON public.bd_pncp_sync_log;
DROP POLICY IF EXISTS "Usuário vê seus logs ou admin vê todos" ON public.bd_pncp_sync_log;
DROP POLICY IF EXISTS "Service role pode atualizar logs" ON public.bd_pncp_sync_log;

CREATE POLICY "pncp_sync_log_select"
ON public.bd_pncp_sync_log
FOR SELECT
TO authenticated
USING (public.fn_pncp_can_access_sync_log_row(user_id, auth.uid()));

CREATE POLICY "pncp_sync_log_insert"
ON public.bd_pncp_sync_log
FOR INSERT
TO authenticated
WITH CHECK (
  COALESCE(user_id = auth.uid(), false)
  OR public.fn_pncp_can_manage(auth.uid())
);

CREATE POLICY "pncp_sync_log_update"
ON public.bd_pncp_sync_log
FOR UPDATE
TO authenticated
USING (
  public.fn_pncp_can_access_sync_log_row(user_id, auth.uid())
)
WITH CHECK (
  public.fn_pncp_can_access_sync_log_row(user_id, auth.uid())
);

CREATE POLICY "pncp_sync_log_service"
ON public.bd_pncp_sync_log
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.classificar_orgao_pendente(
  p_pendente_id uuid,
  p_orgao_id uuid,
  p_criar_alias boolean DEFAULT true
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_nome_api_original text;
  v_nome_api_normalizado text;
  v_orgao_sigla text;
  v_updated_count integer;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING errcode = '42501';
  END IF;

  IF NOT public.fn_pncp_can_manage_orgaos(v_actor) THEN
    RAISE EXCEPTION 'Você não possui permissão para classificar órgãos pendentes.' USING errcode = '42501';
  END IF;

  SELECT nome_api_original, nome_api_normalizado
    INTO v_nome_api_original, v_nome_api_normalizado
  FROM public.bd_licitacoes_orgaos_pendentes
  WHERE id = p_pendente_id;

  IF v_nome_api_normalizado IS NULL THEN
    RAISE EXCEPTION 'Registro pendente não encontrado';
  END IF;

  SELECT sigla INTO v_orgao_sigla
  FROM public.bd_orgaos_publicos
  WHERE id = p_orgao_id;

  IF v_orgao_sigla IS NULL THEN
    RAISE EXCEPTION 'Órgão não encontrado';
  END IF;

  UPDATE public.bd_licitacoes_orgaos_pendentes
     SET status = 'classificado'
   WHERE id = p_pendente_id;

  UPDATE public.bd_licitacoes_orgaos_pendentes
     SET status = 'classificado'
   WHERE nome_api_normalizado = v_nome_api_normalizado
     AND status = 'pendente';

  IF p_criar_alias THEN
    INSERT INTO public.bd_orgaos_alias (orgao_id, alias_nome, alias_normalizado)
    VALUES (p_orgao_id, v_nome_api_original, v_nome_api_normalizado)
    ON CONFLICT DO NOTHING;
  END IF;

  UPDATE public.bd_pncp_contratacoes
     SET orgao_id = p_orgao_id,
         orgao_sigla = v_orgao_sigla
   WHERE orgao_id IS NULL
     AND orgao_nome IS NOT NULL
     AND UPPER(TRIM(orgao_nome)) = v_nome_api_original;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$function$;

CREATE OR REPLACE VIEW public.vw_pncp_contratacoes_operacional
WITH (security_invoker = true)
AS
SELECT
  c.id,
  c.numero_controle_pncp,
  c.objeto,
  c.orgao_nome,
  c.orgao_cnpj,
  c.unidade_nome,
  c.municipio_nome,
  c.municipio_ibge,
  c.uf,
  c.valor_total_estimado,
  c.data_publicacao,
  c.data_inicio_propostas,
  c.data_fim_propostas,
  c.link_origem_pncp,
  c.modalidade_contratacao,
  c.participando,
  c.descartada,
  c.data_marcacao_participando,
  c.status_resultado,
  c.orgao_id,
  c.orgao_sigla,
  c.created_at,
  c.updated_at
FROM public.bd_pncp_contratacoes c
WHERE public.fn_pncp_can_view(auth.uid());

CREATE OR REPLACE VIEW public.vw_pncp_contratacoes_estrategico
WITH (security_invoker = true)
AS
SELECT
  c.*
FROM public.bd_pncp_contratacoes c
WHERE public.fn_pncp_can_view_strategic(auth.uid());

GRANT SELECT ON public.vw_pncp_contratacoes_operacional TO authenticated;
GRANT SELECT ON public.vw_pncp_contratacoes_estrategico TO authenticated;