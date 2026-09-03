-- =========================================================
-- FASE 1 — CORE CORPORATIVO DE APROVAÇÃO (aditivo, desligado)
-- =========================================================

-- 1. Aplicações de fluxo por processo
CREATE TABLE IF NOT EXISTS public.bd_fluxo_aplicacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fluxo_id uuid NOT NULL REFERENCES public.bd_fluxos_aprovacao(id) ON DELETE CASCADE,
  processo_tipo text NOT NULL,
  centro_custo_id uuid NULL REFERENCES public.bd_centros_custo(id) ON DELETE CASCADE,
  ativo boolean NOT NULL DEFAULT true,
  prioridade integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bd_fluxo_aplicacoes_processo_tipo_chk
    CHECK (processo_tipo IN ('SOLICITACAO_EQUIPAMENTO','DESMOBILIZACAO','CEDENCIA'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bd_fluxo_aplicacoes TO authenticated;
GRANT ALL ON public.bd_fluxo_aplicacoes TO service_role;

ALTER TABLE public.bd_fluxo_aplicacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fluxo_aplicacoes_select" ON public.bd_fluxo_aplicacoes;
CREATE POLICY "fluxo_aplicacoes_select" ON public.bd_fluxo_aplicacoes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "fluxo_aplicacoes_write" ON public.bd_fluxo_aplicacoes;
CREATE POLICY "fluxo_aplicacoes_write" ON public.bd_fluxo_aplicacoes
  FOR ALL TO authenticated
  USING (
    public.check_is_super_admin_hybrid(auth.uid())
    OR public.user_has_permission_action(auth.uid(), 'admin_gestao_fluxos_view', 'editar')
  )
  WITH CHECK (
    public.check_is_super_admin_hybrid(auth.uid())
    OR public.user_has_permission_action(auth.uid(), 'admin_gestao_fluxos_view', 'editar')
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_fluxo_aplic_processo_cc
  ON public.bd_fluxo_aplicacoes (processo_tipo, centro_custo_id)
  WHERE ativo AND centro_custo_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_fluxo_aplic_processo_default
  ON public.bd_fluxo_aplicacoes (processo_tipo)
  WHERE ativo AND centro_custo_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_fluxo_aplic_fluxo ON public.bd_fluxo_aplicacoes (fluxo_id);

DROP TRIGGER IF EXISTS trg_fluxo_aplicacoes_updated_at ON public.bd_fluxo_aplicacoes;
CREATE TRIGGER trg_fluxo_aplicacoes_updated_at
  BEFORE UPDATE ON public.bd_fluxo_aplicacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Etapas: usuario_especifico_id
ALTER TABLE public.bd_fluxo_etapas
  ADD COLUMN IF NOT EXISTS usuario_especifico_id uuid NULL
    REFERENCES public.profiles(id) ON DELETE RESTRICT;

-- 3. Execuções: snapshot corporativo (retrocompatível)
ALTER TABLE public.bd_aprovacoes_fluxo_exec
  ADD COLUMN IF NOT EXISTS processo_tipo text NOT NULL DEFAULT 'DIARIAS',
  ADD COLUMN IF NOT EXISTS aprovador_resolvido_id uuid NULL REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS aprovador_origem text NULL,
  ADD COLUMN IF NOT EXISTS aprovador_nome_snapshot text NULL,
  ADD COLUMN IF NOT EXISTS permission_id_snapshot uuid NULL,
  ADD COLUMN IF NOT EXISTS fluxo_id_snapshot uuid NULL,
  ADD COLUMN IF NOT EXISTS contexto_snapshot jsonb NULL;

CREATE INDEX IF NOT EXISTS idx_aprov_fluxo_exec_processo
  ON public.bd_aprovacoes_fluxo_exec (processo_tipo, solicitacao_id);

-- 4. Helper: resolver fluxo aplicável
CREATE OR REPLACE FUNCTION public.fn_aprovacao_resolver_fluxo(
  p_processo_tipo text,
  p_centro_custo_id uuid
) RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.fluxo_id
  FROM public.bd_fluxo_aplicacoes a
  JOIN public.bd_fluxos_aprovacao f ON f.id = a.fluxo_id
  WHERE a.ativo
    AND COALESCE(f.ativo, false)
    AND a.processo_tipo = p_processo_tipo
    AND (a.centro_custo_id = p_centro_custo_id OR a.centro_custo_id IS NULL)
  ORDER BY (a.centro_custo_id IS NOT NULL) DESC, a.prioridade DESC, a.created_at DESC
  LIMIT 1;
$$;

-- 5. Helper: resolver aprovador de uma etapa
CREATE OR REPLACE FUNCTION public.fn_aprovacao_resolver_aprovador(
  p_tipo_aprovador text,
  p_centro_custo_id uuid,
  p_contexto jsonb DEFAULT '{}'::jsonb,
  p_usuario_especifico_id uuid DEFAULT NULL,
  p_permission_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_func_id uuid;
  v_profile_id uuid;
  v_nome text;
  v_count integer;
  v_status text;
  v_funcao text;
BEGIN
  IF p_tipo_aprovador = 'permissao_rbac' THEN
    IF p_permission_id IS NULL THEN
      RAISE EXCEPTION 'ETAPA_SEM_PERMISSAO_CONFIGURADA';
    END IF;
    RETURN jsonb_build_object(
      'modo','permissao',
      'profile_id', NULL,
      'nome', NULL,
      'origem','permissao_rbac',
      'permission_id', p_permission_id
    );
  END IF;

  IF p_tipo_aprovador = 'usuario_especifico' THEN
    IF p_usuario_especifico_id IS NULL THEN
      RAISE EXCEPTION 'ETAPA_SEM_USUARIO_ESPECIFICO';
    END IF;
    SELECT p.id, p.nome_completo INTO v_profile_id, v_nome
    FROM public.profiles p WHERE p.id = p_usuario_especifico_id;
    IF v_profile_id IS NULL THEN
      RAISE EXCEPTION 'APROVADOR_USUARIO_ESPECIFICO_INVALIDO';
    END IF;
    RETURN jsonb_build_object('modo','individual','profile_id',v_profile_id,
      'nome',v_nome,'origem','usuario_especifico','permission_id',NULL);
  END IF;

  IF p_tipo_aprovador = 'engenheiro_solicitante' THEN
    v_profile_id := NULLIF(p_contexto->>'engenheiro_solicitante_id','')::uuid;
    IF v_profile_id IS NULL THEN
      RAISE EXCEPTION 'CONTEXTO_SEM_ENGENHEIRO_SOLICITANTE';
    END IF;
    SELECT p.nome_completo, p.funcionario_id INTO v_nome, v_func_id
    FROM public.profiles p WHERE p.id = v_profile_id;
    IF v_nome IS NULL AND v_func_id IS NULL THEN
      RAISE EXCEPTION 'ENGENHEIRO_SOLICITANTE_PROFILE_INEXISTENTE';
    END IF;
    IF v_func_id IS NULL THEN
      RAISE EXCEPTION 'ENGENHEIRO_SOLICITANTE_SEM_FUNCIONARIO';
    END IF;
    SELECT f.status, fu.nome_funcao INTO v_status, v_funcao
    FROM public.bd_funcionarios f
    LEFT JOIN public.bd_funcoes fu ON fu.id = f.funcao_id
    WHERE f.id = v_func_id;
    IF v_status IS NULL THEN
      RAISE EXCEPTION 'ENGENHEIRO_SOLICITANTE_FUNCIONARIO_INEXISTENTE';
    END IF;
    IF v_status NOT IN ('Ativo','Ativo sem Registro') THEN
      RAISE EXCEPTION 'ENGENHEIRO_SOLICITANTE_INATIVO';
    END IF;
    IF COALESCE(v_funcao,'') !~* '(ENGENH|GERENT|DIRETOR|COORDENAD)' THEN
      RAISE EXCEPTION 'ENGENHEIRO_SOLICITANTE_FUNCAO_INCOMPATIVEL';
    END IF;
    RETURN jsonb_build_object('modo','individual','profile_id',v_profile_id,
      'nome',v_nome,'origem','engenheiro_solicitante','permission_id',NULL);
  END IF;

  IF p_tipo_aprovador IN ('engenheiro_responsavel_cc','aprovador_padrao_cc') THEN
    IF p_centro_custo_id IS NULL THEN
      RAISE EXCEPTION 'CENTRO_CUSTO_OBRIGATORIO';
    END IF;
    IF p_tipo_aprovador = 'engenheiro_responsavel_cc' THEN
      SELECT cc.engenheiro_responsavel_id INTO v_func_id
      FROM public.bd_centros_custo cc WHERE cc.id = p_centro_custo_id;
      IF v_func_id IS NULL THEN
        RAISE EXCEPTION 'CC_SEM_ENGENHEIRO_RESPONSAVEL';
      END IF;
    ELSE
      SELECT cc.aprovador_diarias_id INTO v_func_id
      FROM public.bd_centros_custo cc WHERE cc.id = p_centro_custo_id;
      IF v_func_id IS NULL THEN
        RAISE EXCEPTION 'CC_SEM_APROVADOR_PADRAO';
      END IF;
    END IF;

    SELECT count(*) INTO v_count FROM public.profiles p WHERE p.funcionario_id = v_func_id;
    IF v_count = 0 THEN
      RAISE EXCEPTION 'APROVADOR_SEM_USUARIO_VINCULADO';
    ELSIF v_count > 1 THEN
      RAISE EXCEPTION 'APROVADOR_COM_MULTIPLOS_USUARIOS';
    END IF;

    SELECT p.id, p.nome_completo INTO v_profile_id, v_nome
    FROM public.profiles p WHERE p.funcionario_id = v_func_id;

    RETURN jsonb_build_object('modo','individual','profile_id',v_profile_id,
      'nome',v_nome,'origem',p_tipo_aprovador,'permission_id',NULL);
  END IF;

  -- tipos legados (gerente_adm, diretor_*): resolução por papel, sem indivíduo
  RETURN jsonb_build_object('modo','legado','profile_id',NULL,'nome',NULL,
    'origem',p_tipo_aprovador,'permission_id',p_permission_id);
END;
$$;

-- 6. Core: iniciar
CREATE OR REPLACE FUNCTION public.fn_aprovacao_corporativa_iniciar(
  p_processo_tipo text,
  p_processo_id uuid,
  p_centro_custo_id uuid,
  p_contexto jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_fluxo_id uuid;
  v_versao integer;
  v_fluxo_nome text;
  v_etapa record;
  v_res jsonb;
  v_total integer := 0;
  v_primeira boolean := true;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NAO_AUTENTICADO';
  END IF;
  IF p_processo_tipo IS NULL OR p_processo_id IS NULL THEN
    RAISE EXCEPTION 'PARAMETROS_OBRIGATORIOS';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_processo_tipo), hashtext(p_processo_id::text));

  IF EXISTS (
    SELECT 1 FROM public.bd_aprovacoes_fluxo_exec
    WHERE processo_tipo = p_processo_tipo AND solicitacao_id = p_processo_id
  ) THEN
    RAISE EXCEPTION 'FLUXO_JA_INICIADO';
  END IF;

  v_fluxo_id := public.fn_aprovacao_resolver_fluxo(p_processo_tipo, p_centro_custo_id);
  IF v_fluxo_id IS NULL THEN
    RETURN jsonb_build_object('resultado','SEM_FLUXO_CONFIGURADO',
      'processo_tipo',p_processo_tipo,'processo_id',p_processo_id);
  END IF;

  SELECT f.versao, f.nome INTO v_versao, v_fluxo_nome
  FROM public.bd_fluxos_aprovacao f WHERE f.id = v_fluxo_id;

  FOR v_etapa IN
    SELECT * FROM public.bd_fluxo_etapas
    WHERE fluxo_id = v_fluxo_id AND COALESCE(ativo,true)
    ORDER BY ordem
  LOOP
    v_res := public.fn_aprovacao_resolver_aprovador(
      v_etapa.tipo_aprovador, p_centro_custo_id, COALESCE(p_contexto,'{}'::jsonb),
      v_etapa.usuario_especifico_id, v_etapa.permission_id
    );

    INSERT INTO public.bd_aprovacoes_fluxo_exec (
      solicitacao_id, processo_tipo, etapa_id, etapa_nome_snapshot, fluxo_versao,
      ordem, status, pode_aprovar, aprovador_resolvido_id, aprovador_origem,
      aprovador_nome_snapshot, permission_id_snapshot, fluxo_id_snapshot, contexto_snapshot
    ) VALUES (
      p_processo_id, p_processo_tipo, v_etapa.id, v_etapa.nome_exibicao, v_versao,
      v_etapa.ordem, 'pendente', v_primeira,
      NULLIF(v_res->>'profile_id','')::uuid, v_res->>'origem',
      v_res->>'nome', NULLIF(v_res->>'permission_id','')::uuid,
      v_fluxo_id, COALESCE(p_contexto,'{}'::jsonb)
    );

    v_total := v_total + 1;
    v_primeira := false;
  END LOOP;

  IF v_total = 0 THEN
    RAISE EXCEPTION 'FLUXO_SEM_ETAPAS_ATIVAS';
  END IF;

  RETURN jsonb_build_object(
    'resultado','FLUXO_INICIADO',
    'processo_tipo',p_processo_tipo,
    'processo_id',p_processo_id,
    'fluxo_id',v_fluxo_id,
    'fluxo_nome',v_fluxo_nome,
    'fluxo_versao',v_versao,
    'total_etapas',v_total
  );
END;
$$;

-- 7. Core: decidir (privado, chamado por wrappers de domínio)
CREATE OR REPLACE FUNCTION public.fn_aprovacao_corporativa_decidir_core(
  p_processo_tipo text,
  p_processo_id uuid,
  p_etapa_exec_id uuid,
  p_decisao text,
  p_observacao text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_etapa record;
  v_perm_codigo text;
  v_autorizado boolean := false;
  v_pendentes integer;
  v_prox record;
  v_completo boolean := false;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NAO_AUTENTICADO'; END IF;
  IF p_decisao NOT IN ('aprovado','rejeitado') THEN
    RAISE EXCEPTION 'DECISAO_INVALIDA';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_processo_tipo), hashtext(p_processo_id::text));

  SELECT * INTO v_etapa FROM public.bd_aprovacoes_fluxo_exec
  WHERE id = p_etapa_exec_id FOR UPDATE;

  IF v_etapa.id IS NULL THEN RAISE EXCEPTION 'ETAPA_INEXISTENTE'; END IF;
  IF v_etapa.solicitacao_id <> p_processo_id OR v_etapa.processo_tipo <> p_processo_tipo THEN
    RAISE EXCEPTION 'ETAPA_NAO_PERTENCE_AO_PROCESSO';
  END IF;
  IF COALESCE(v_etapa.status,'pendente') <> 'pendente' THEN
    RAISE EXCEPTION 'ETAPA_JA_DECIDIDA';
  END IF;
  IF NOT COALESCE(v_etapa.pode_aprovar,false) THEN
    RAISE EXCEPTION 'ETAPA_NAO_LIBERADA';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.bd_aprovacoes_fluxo_exec e
    WHERE e.processo_tipo = p_processo_tipo AND e.solicitacao_id = p_processo_id
      AND e.ordem < v_etapa.ordem AND COALESCE(e.status,'pendente') <> 'aprovado'
  ) THEN
    RAISE EXCEPTION 'ETAPAS_ANTERIORES_PENDENTES';
  END IF;

  IF v_etapa.aprovador_origem = 'permissao_rbac' THEN
    SELECT codigo INTO v_perm_codigo FROM public.bd_permissions
    WHERE id = v_etapa.permission_id_snapshot;
    IF v_perm_codigo IS NULL THEN RAISE EXCEPTION 'PERMISSAO_SNAPSHOT_INVALIDA'; END IF;
    v_autorizado := public.user_has_permission_action(v_uid, v_perm_codigo, 'aprovar');
  ELSIF v_etapa.aprovador_resolvido_id IS NOT NULL THEN
    v_autorizado := (v_etapa.aprovador_resolvido_id = v_uid);
  END IF;

  IF NOT v_autorizado AND public.check_is_super_admin_hybrid(v_uid) THEN
    IF COALESCE(btrim(p_observacao),'') = '' THEN
      RAISE EXCEPTION 'SUPERADM_EXIGE_JUSTIFICATIVA';
    END IF;
    v_autorizado := true;
  END IF;

  IF NOT v_autorizado THEN RAISE EXCEPTION 'USUARIO_NAO_AUTORIZADO_NESTA_ETAPA'; END IF;

  -- self approval bloqueado (solicitante não aprova o próprio processo)
  IF (v_etapa.contexto_snapshot->>'solicitante_id') IS NOT NULL
     AND (v_etapa.contexto_snapshot->>'solicitante_id')::uuid = v_uid
     AND NOT public.check_is_super_admin_hybrid(v_uid) THEN
    RAISE EXCEPTION 'AUTO_APROVACAO_BLOQUEADA';
  END IF;

  UPDATE public.bd_aprovacoes_fluxo_exec
  SET status = p_decisao, usuario_id = v_uid, data_aprovacao = now(),
      observacao = p_observacao, pode_aprovar = false
  WHERE id = p_etapa_exec_id;

  IF p_decisao = 'rejeitado' THEN
    UPDATE public.bd_aprovacoes_fluxo_exec
    SET pode_aprovar = false
    WHERE processo_tipo = p_processo_tipo AND solicitacao_id = p_processo_id
      AND COALESCE(status,'pendente') = 'pendente';
    RETURN jsonb_build_object('etapa_status','rejeitado','fluxo_completo',false,
      'fluxo_rejeitado',true,'proxima_etapa',NULL,'proximo_aprovador',NULL);
  END IF;

  SELECT * INTO v_prox FROM public.bd_aprovacoes_fluxo_exec
  WHERE processo_tipo = p_processo_tipo AND solicitacao_id = p_processo_id
    AND COALESCE(status,'pendente') = 'pendente'
  ORDER BY ordem LIMIT 1;

  IF v_prox.id IS NULL THEN
    v_completo := true;
  ELSE
    UPDATE public.bd_aprovacoes_fluxo_exec SET pode_aprovar = true WHERE id = v_prox.id;
  END IF;

  SELECT count(*) INTO v_pendentes FROM public.bd_aprovacoes_fluxo_exec
  WHERE processo_tipo = p_processo_tipo AND solicitacao_id = p_processo_id
    AND COALESCE(status,'pendente') = 'pendente';

  RETURN jsonb_build_object(
    'etapa_status','aprovado',
    'fluxo_completo',v_completo,
    'fluxo_rejeitado',false,
    'etapas_pendentes',v_pendentes,
    'proxima_etapa', CASE WHEN v_prox.id IS NULL THEN NULL ELSE
      jsonb_build_object('id',v_prox.id,'ordem',v_prox.ordem,'nome',v_prox.etapa_nome_snapshot) END,
    'proximo_aprovador', CASE WHEN v_prox.id IS NULL THEN NULL ELSE
      jsonb_build_object('id',v_prox.aprovador_resolvido_id,
        'nome',v_prox.aprovador_nome_snapshot,'origem',v_prox.aprovador_origem) END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_aprovacao_corporativa_decidir_core(text,uuid,uuid,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_aprovacao_resolver_aprovador(text,uuid,jsonb,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_aprovacao_corporativa_decidir_core(text,uuid,uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_aprovacao_resolver_aprovador(text,uuid,jsonb,uuid,uuid) TO service_role, authenticated;

-- 8. Status para UI
CREATE OR REPLACE FUNCTION public.fn_aprovacao_corporativa_status(
  p_processo_tipo text,
  p_processo_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer;
  v_concluidas integer;
  v_rejeitadas integer;
  v_atual record;
  v_fluxo record;
  v_status text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NAO_AUTENTICADO'; END IF;

  SELECT count(*),
         count(*) FILTER (WHERE status = 'aprovado'),
         count(*) FILTER (WHERE status = 'rejeitado')
    INTO v_total, v_concluidas, v_rejeitadas
  FROM public.bd_aprovacoes_fluxo_exec
  WHERE processo_tipo = p_processo_tipo AND solicitacao_id = p_processo_id;

  IF v_total = 0 THEN
    RETURN jsonb_build_object('requer_aprovacao',false,'status','SEM_FLUXO_CONFIGURADO');
  END IF;

  SELECT * INTO v_atual FROM public.bd_aprovacoes_fluxo_exec
  WHERE processo_tipo = p_processo_tipo AND solicitacao_id = p_processo_id
    AND COALESCE(status,'pendente') = 'pendente'
  ORDER BY ordem LIMIT 1;

  SELECT f.id, f.nome, e.fluxo_versao AS versao INTO v_fluxo
  FROM public.bd_aprovacoes_fluxo_exec e
  LEFT JOIN public.bd_fluxos_aprovacao f ON f.id = e.fluxo_id_snapshot
  WHERE e.processo_tipo = p_processo_tipo AND e.solicitacao_id = p_processo_id
  ORDER BY e.ordem LIMIT 1;

  v_status := CASE
    WHEN v_rejeitadas > 0 THEN 'REJEITADO'
    WHEN v_atual.id IS NULL THEN 'APROVADO'
    ELSE 'AGUARDANDO' END;

  RETURN jsonb_build_object(
    'requer_aprovacao', true,
    'status', v_status,
    'fluxo', jsonb_build_object('id',v_fluxo.id,'nome',v_fluxo.nome,'versao',v_fluxo.versao),
    'total_etapas', v_total,
    'etapas_concluidas', v_concluidas,
    'etapa_atual', CASE WHEN v_atual.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id',v_atual.id,'ordem',v_atual.ordem,'nome',v_atual.etapa_nome_snapshot,
      'status',COALESCE(v_atual.status,'pendente'),
      'aprovador_id',v_atual.aprovador_resolvido_id,
      'aprovador_nome',v_atual.aprovador_nome_snapshot,
      'aprovador_origem',v_atual.aprovador_origem) END
  );
END;
$$;

-- 9. Toggle (desligado)
INSERT INTO public.bd_configuracoes_sistema (chave, valor, descricao, ativo)
VALUES ('motor_aprovacao_corporativo_ativo','false',
  'Ativa o motor corporativo de aprovação (não afeta Diárias)', true)
ON CONFLICT (chave) DO NOTHING;