
-- =====================================================================
-- Carimbos do Relatório AP's — tabela independente + RPCs
-- =====================================================================

-- 1. TABELA -----------------------------------------------------------
CREATE TABLE public.bd_relatorio_aps_carimbos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                text NOT NULL,
  centro_custo_id     uuid NULL REFERENCES public.bd_centros_custo(id) ON DELETE RESTRICT,
  padrao_centro_custo boolean NOT NULL DEFAULT false,
  obra                text NULL,
  empresa             text NULL,
  cliente             text NULL,
  bairro              text NULL,
  revisao             text NOT NULL DEFAULT '00',
  ativo               boolean NOT NULL DEFAULT true,
  created_by          uuid NOT NULL,
  updated_by          uuid NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_aps_carimbo_nome_len       CHECK (length(btrim(nome)) BETWEEN 1 AND 120),
  CONSTRAINT chk_aps_carimbo_revisao_len    CHECK (length(btrim(revisao)) BETWEEN 1 AND 10),
  CONSTRAINT chk_aps_carimbo_padrao_exige_cc CHECK (padrao_centro_custo = false OR centro_custo_id IS NOT NULL),
  CONSTRAINT chk_aps_carimbo_obra_len       CHECK (obra    IS NULL OR length(obra)    <= 200),
  CONSTRAINT chk_aps_carimbo_empresa_len    CHECK (empresa IS NULL OR length(empresa) <= 200),
  CONSTRAINT chk_aps_carimbo_cliente_len    CHECK (cliente IS NULL OR length(cliente) <= 200),
  CONSTRAINT chk_aps_carimbo_bairro_len     CHECK (bairro  IS NULL OR length(bairro)  <= 120)
);

-- 2. GRANTS (somente SELECT ao authenticated; escrita via RPC) -------
REVOKE ALL ON public.bd_relatorio_aps_carimbos FROM PUBLIC;
GRANT  SELECT ON public.bd_relatorio_aps_carimbos TO authenticated;
GRANT  ALL    ON public.bd_relatorio_aps_carimbos TO service_role;

-- 3. RLS --------------------------------------------------------------
ALTER TABLE public.bd_relatorio_aps_carimbos ENABLE ROW LEVEL SECURITY;

CREATE POLICY sel_aps_carimbo
  ON public.bd_relatorio_aps_carimbos
  FOR SELECT
  TO authenticated
  USING (
    ativo = true
    AND public.user_has_permission_action(auth.uid(), 'relatorio_aplicacao_view', 'visualizar')
    AND (
      public.fn_logistica_is_privileged_user()
      OR centro_custo_id IS NULL
      OR public.fn_logistica_can_access_centro_custo(centro_custo_id)
    )
  );

-- 4. ÍNDICES ----------------------------------------------------------
CREATE UNIQUE INDEX ux_aps_carimbo_padrao_por_cc
  ON public.bd_relatorio_aps_carimbos (centro_custo_id)
  WHERE ativo = true AND padrao_centro_custo = true;

CREATE INDEX ix_aps_carimbo_cc_ativo
  ON public.bd_relatorio_aps_carimbos (centro_custo_id, ativo);

CREATE INDEX ix_aps_carimbo_geral_ativo
  ON public.bd_relatorio_aps_carimbos (ativo)
  WHERE centro_custo_id IS NULL;

-- 5. TRIGGER updated_at ----------------------------------------------
CREATE TRIGGER trg_aps_carimbo_updated_at
  BEFORE UPDATE ON public.bd_relatorio_aps_carimbos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. HELPER PRIVADO ---------------------------------------------------
CREATE OR REPLACE FUNCTION public._aps_carimbo_assert_acao(_acao text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NAO_AUTENTICADO' USING ERRCODE = '28000';
  END IF;
  IF NOT public.user_has_permission_action(v_uid, 'relatorio_aplicacao_view', _acao) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO: acao=%', _acao USING ERRCODE = '42501';
  END IF;
  RETURN v_uid;
END $$;
REVOKE ALL ON FUNCTION public._aps_carimbo_assert_acao(text) FROM PUBLIC;

-- 7. RPC: DEFINIR PADRÃO (criada antes de "criar", que a invoca) ------
CREATE OR REPLACE FUNCTION public.fn_relatorio_aps_definir_carimbo_padrao(
  p_carimbo_id      uuid,
  p_centro_custo_id uuid
) RETURNS public.bd_relatorio_aps_carimbos
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := public._aps_carimbo_assert_acao('editar');
  v_cur public.bd_relatorio_aps_carimbos;
  v_row public.bd_relatorio_aps_carimbos;
BEGIN
  IF p_centro_custo_id IS NULL THEN
    RAISE EXCEPTION 'CC_OBRIGATORIO' USING ERRCODE = '22004';
  END IF;
  IF NOT public.fn_logistica_is_privileged_user()
     AND NOT public.fn_logistica_can_access_centro_custo(p_centro_custo_id) THEN
    RAISE EXCEPTION 'ESCOPO_NEGADO_CC' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('aps_carimbo_padrao:'||p_centro_custo_id::text, 0));

  SELECT * INTO v_cur
    FROM public.bd_relatorio_aps_carimbos
    WHERE id = p_carimbo_id AND ativo = true
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CARIMBO_NAO_ENCONTRADO' USING ERRCODE = 'P0002';
  END IF;

  IF v_cur.centro_custo_id IS NULL AND NOT public.fn_logistica_is_privileged_user() THEN
    RAISE EXCEPTION 'CARIMBO_GERAL_RESTRITO' USING ERRCODE = '42501';
  END IF;

  IF v_cur.centro_custo_id IS NOT NULL
     AND v_cur.centro_custo_id <> p_centro_custo_id THEN
    RAISE EXCEPTION 'CARIMBO_ASSOCIADO_OUTRO_CC' USING ERRCODE = '42501';
  END IF;

  UPDATE public.bd_relatorio_aps_carimbos
     SET padrao_centro_custo = false, updated_by = v_uid, updated_at = now()
   WHERE centro_custo_id = p_centro_custo_id
     AND ativo = true
     AND padrao_centro_custo = true
     AND id <> p_carimbo_id;

  UPDATE public.bd_relatorio_aps_carimbos
     SET centro_custo_id = p_centro_custo_id,
         padrao_centro_custo = true,
         updated_by = v_uid,
         updated_at = now()
   WHERE id = p_carimbo_id
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;
REVOKE ALL ON FUNCTION public.fn_relatorio_aps_definir_carimbo_padrao(uuid,uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.fn_relatorio_aps_definir_carimbo_padrao(uuid,uuid) TO authenticated;

-- 8. RPC: CRIAR -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_relatorio_aps_criar_carimbo(
  p_nome            text,
  p_centro_custo_id uuid,
  p_obra            text,
  p_empresa         text,
  p_cliente         text,
  p_bairro          text,
  p_revisao         text,
  p_definir_padrao  boolean DEFAULT false
) RETURNS public.bd_relatorio_aps_carimbos
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := public._aps_carimbo_assert_acao('criar');
  v_row public.bd_relatorio_aps_carimbos;
BEGIN
  IF p_centro_custo_id IS NOT NULL
     AND NOT public.fn_logistica_is_privileged_user()
     AND NOT public.fn_logistica_can_access_centro_custo(p_centro_custo_id) THEN
    RAISE EXCEPTION 'ESCOPO_NEGADO_CC' USING ERRCODE = '42501';
  END IF;
  IF p_centro_custo_id IS NULL AND NOT public.fn_logistica_is_privileged_user() THEN
    RAISE EXCEPTION 'CARIMBO_GERAL_RESTRITO' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.bd_relatorio_aps_carimbos
    (nome, centro_custo_id, obra, empresa, cliente, bairro, revisao,
     ativo, padrao_centro_custo, created_by, updated_by)
  VALUES
    (btrim(p_nome), p_centro_custo_id,
     NULLIF(btrim(p_obra),''), NULLIF(btrim(p_empresa),''),
     NULLIF(btrim(p_cliente),''), NULLIF(btrim(p_bairro),''),
     COALESCE(NULLIF(btrim(p_revisao),''),'00'),
     true, false, v_uid, v_uid)
  RETURNING * INTO v_row;

  IF p_definir_padrao AND p_centro_custo_id IS NOT NULL THEN
    v_row := public.fn_relatorio_aps_definir_carimbo_padrao(v_row.id, p_centro_custo_id);
  END IF;
  RETURN v_row;
END $$;
REVOKE ALL ON FUNCTION public.fn_relatorio_aps_criar_carimbo(text,uuid,text,text,text,text,text,boolean) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.fn_relatorio_aps_criar_carimbo(text,uuid,text,text,text,text,text,boolean) TO authenticated;

-- 9. RPC: ATUALIZAR ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_relatorio_aps_atualizar_carimbo(
  p_carimbo_id          uuid,
  p_updated_at_esperado timestamptz,
  p_nome                text,
  p_obra                text,
  p_empresa             text,
  p_cliente             text,
  p_bairro              text,
  p_revisao             text
) RETURNS public.bd_relatorio_aps_carimbos
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := public._aps_carimbo_assert_acao('editar');
  v_cur public.bd_relatorio_aps_carimbos;
  v_row public.bd_relatorio_aps_carimbos;
BEGIN
  SELECT * INTO v_cur
    FROM public.bd_relatorio_aps_carimbos
    WHERE id = p_carimbo_id AND ativo = true
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CARIMBO_NAO_ENCONTRADO' USING ERRCODE = 'P0002';
  END IF;

  IF v_cur.centro_custo_id IS NOT NULL
     AND NOT public.fn_logistica_is_privileged_user()
     AND NOT public.fn_logistica_can_access_centro_custo(v_cur.centro_custo_id) THEN
    RAISE EXCEPTION 'ESCOPO_NEGADO_CC' USING ERRCODE = '42501';
  END IF;
  IF v_cur.centro_custo_id IS NULL AND NOT public.fn_logistica_is_privileged_user() THEN
    RAISE EXCEPTION 'CARIMBO_GERAL_RESTRITO' USING ERRCODE = '42501';
  END IF;

  UPDATE public.bd_relatorio_aps_carimbos
     SET nome       = btrim(p_nome),
         obra       = NULLIF(btrim(p_obra),''),
         empresa    = NULLIF(btrim(p_empresa),''),
         cliente    = NULLIF(btrim(p_cliente),''),
         bairro     = NULLIF(btrim(p_bairro),''),
         revisao    = COALESCE(NULLIF(btrim(p_revisao),''),'00'),
         updated_by = v_uid,
         updated_at = now()
   WHERE id = p_carimbo_id
     AND updated_at = p_updated_at_esperado
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CARIMBO_CONFLITO_CONCORRENCIA' USING ERRCODE = '40001';
  END IF;
  RETURN v_row;
END $$;
REVOKE ALL ON FUNCTION public.fn_relatorio_aps_atualizar_carimbo(uuid,timestamptz,text,text,text,text,text,text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.fn_relatorio_aps_atualizar_carimbo(uuid,timestamptz,text,text,text,text,text,text) TO authenticated;

-- 10. RPC: DESVINCULAR PADRÃO ----------------------------------------
CREATE OR REPLACE FUNCTION public.fn_relatorio_aps_desvincular_padrao(
  p_centro_custo_id uuid
) RETURNS public.bd_relatorio_aps_carimbos
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := public._aps_carimbo_assert_acao('editar');
  v_row public.bd_relatorio_aps_carimbos;
BEGIN
  IF p_centro_custo_id IS NULL THEN
    RAISE EXCEPTION 'CC_OBRIGATORIO' USING ERRCODE = '22004';
  END IF;
  IF NOT public.fn_logistica_is_privileged_user()
     AND NOT public.fn_logistica_can_access_centro_custo(p_centro_custo_id) THEN
    RAISE EXCEPTION 'ESCOPO_NEGADO_CC' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('aps_carimbo_padrao:'||p_centro_custo_id::text, 0));

  UPDATE public.bd_relatorio_aps_carimbos
     SET padrao_centro_custo = false, updated_by = v_uid, updated_at = now()
   WHERE centro_custo_id = p_centro_custo_id
     AND ativo = true
     AND padrao_centro_custo = true
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;
REVOKE ALL ON FUNCTION public.fn_relatorio_aps_desvincular_padrao(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.fn_relatorio_aps_desvincular_padrao(uuid) TO authenticated;

-- 11. RPC: INATIVAR ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_relatorio_aps_inativar_carimbo(
  p_carimbo_id          uuid,
  p_updated_at_esperado timestamptz
) RETURNS public.bd_relatorio_aps_carimbos
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := public._aps_carimbo_assert_acao('excluir');
  v_cur public.bd_relatorio_aps_carimbos;
  v_row public.bd_relatorio_aps_carimbos;
BEGIN
  SELECT * INTO v_cur
    FROM public.bd_relatorio_aps_carimbos
    WHERE id = p_carimbo_id AND ativo = true
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CARIMBO_NAO_ENCONTRADO' USING ERRCODE = 'P0002';
  END IF;

  IF v_cur.centro_custo_id IS NOT NULL
     AND NOT public.fn_logistica_is_privileged_user()
     AND NOT public.fn_logistica_can_access_centro_custo(v_cur.centro_custo_id) THEN
    RAISE EXCEPTION 'ESCOPO_NEGADO_CC' USING ERRCODE = '42501';
  END IF;
  IF v_cur.centro_custo_id IS NULL AND NOT public.fn_logistica_is_privileged_user() THEN
    RAISE EXCEPTION 'CARIMBO_GERAL_RESTRITO' USING ERRCODE = '42501';
  END IF;

  UPDATE public.bd_relatorio_aps_carimbos
     SET ativo = false, padrao_centro_custo = false,
         updated_by = v_uid, updated_at = now()
   WHERE id = p_carimbo_id
     AND updated_at = p_updated_at_esperado
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CARIMBO_CONFLITO_CONCORRENCIA' USING ERRCODE = '40001';
  END IF;
  RETURN v_row;
END $$;
REVOKE ALL ON FUNCTION public.fn_relatorio_aps_inativar_carimbo(uuid,timestamptz) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.fn_relatorio_aps_inativar_carimbo(uuid,timestamptz) TO authenticated;

-- 12. CATÁLOGO DE AÇÕES RBAC (idempotente) ---------------------------
INSERT INTO public.bd_permissoes_acoes (permission_id, acao, descricao)
SELECT p.id, a.acao, a.descricao
  FROM public.bd_permissions p
  CROSS JOIN (VALUES
    ('criar'::text,   'Criar carimbos do Relatório AP''s'::text),
    ('editar'::text,  'Atualizar carimbos e definir padrão por CC'::text),
    ('excluir'::text, 'Inativar carimbos do Relatório AP''s'::text)
  ) AS a(acao, descricao)
 WHERE p.codigo = 'relatorio_aplicacao_view'
   AND NOT EXISTS (
     SELECT 1 FROM public.bd_permissoes_acoes pa
      WHERE pa.permission_id = p.id AND pa.acao = a.acao
   );
