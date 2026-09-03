
-- =========================================================================
-- v6.9 RESET BASE — Registro de Aplicação Manual (sem rua/geo)
-- =========================================================================

-- 0) PREFLIGHT
DO $$
DECLARE v_missing text := '';
BEGIN
  IF to_regprocedure('public.fn_logistica_is_privileged_user()')          IS NULL THEN v_missing:=v_missing||' fn_logistica_is_privileged_user'; END IF;
  IF to_regprocedure('public.fn_logistica_can_access_centro_custo(uuid)') IS NULL THEN v_missing:=v_missing||' fn_logistica_can_access_centro_custo'; END IF;
  IF to_regprocedure('public.fn_logistica_can_access_entrega(uuid)')      IS NULL THEN v_missing:=v_missing||' fn_logistica_can_access_entrega'; END IF;
  IF to_regprocedure('public.fn_logistica_can_manage_entrega(uuid)')      IS NULL THEN v_missing:=v_missing||' fn_logistica_can_manage_entrega'; END IF;
  IF to_regprocedure('public.fn_diaria_scope_centros_custo(uuid)')        IS NULL THEN v_missing:=v_missing||' fn_diaria_scope_centros_custo'; END IF;
  IF to_regprocedure('public.user_has_permission_action(uuid,text,text)') IS NULL THEN v_missing:=v_missing||' user_has_permission_action'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bd_permissions
                  WHERE codigo='requisicoes_registro_aplicacao_view' AND ativo=true)
    THEN v_missing:=v_missing||' perm:requisicoes_registro_aplicacao_view'; END IF;
  IF v_missing<>'' THEN RAISE EXCEPTION 'PREFLIGHT v6.9 falhou:%', v_missing; END IF;

  IF EXISTS (SELECT 1 FROM public.bd_registro_apontamento_aplicacao)
     OR EXISTS (SELECT 1 FROM public.bd_registro_aplicacao_detalhes) THEN
    RAISE EXCEPTION 'v6.9: tabelas nao estao vazias. Execute a Etapa A antes.';
  END IF;
END $$;

-- 1) CABEÇALHO — colunas + CHECKs + FK + índice parcial
ALTER TABLE public.bd_registro_apontamento_aplicacao
  ADD COLUMN IF NOT EXISTS origem_registro TEXT NOT NULL DEFAULT 'logistico',
  ADD COLUMN IF NOT EXISTS atividade       TEXT NULL,
  ADD COLUMN IF NOT EXISTS centro_custo_id UUID NULL;

ALTER TABLE public.bd_registro_apontamento_aplicacao
  DROP CONSTRAINT IF EXISTS chk_raa_origem_registro,
  DROP CONSTRAINT IF EXISTS chk_raa_atividade,
  DROP CONSTRAINT IF EXISTS chk_raa_origem_consistencia;

ALTER TABLE public.bd_registro_apontamento_aplicacao
  ADD CONSTRAINT chk_raa_origem_registro CHECK (origem_registro IN ('logistico','manual')),
  ADD CONSTRAINT chk_raa_atividade CHECK (
    atividade IS NULL OR atividade IN ('tapa_buraco','pavimentacao_mecanizada','fresagem')),
  ADD CONSTRAINT chk_raa_origem_consistencia CHECK (
    (origem_registro='manual'
       AND centro_custo_id IS NOT NULL AND atividade IS NOT NULL
       AND lista_entrega_id IS NULL   AND registro_carga_id IS NULL)
    OR
    (origem_registro='logistico' AND lista_entrega_id IS NOT NULL));

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_raa_centro_custo') THEN
    ALTER TABLE public.bd_registro_apontamento_aplicacao
      ADD CONSTRAINT fk_raa_centro_custo
      FOREIGN KEY (centro_custo_id) REFERENCES public.bd_centros_custo(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_raa_manual_cc_data
  ON public.bd_registro_apontamento_aplicacao (centro_custo_id, data_aplicacao)
  WHERE origem_registro='manual';

-- 2) DETALHES — nullabilidade + tipo_item + coerência
ALTER TABLE public.bd_registro_aplicacao_detalhes
  ALTER COLUMN lista_entrega_id  DROP NOT NULL,
  ALTER COLUMN registro_carga_id DROP NOT NULL;

ALTER TABLE public.bd_registro_aplicacao_detalhes
  ADD COLUMN IF NOT EXISTS tipo_item TEXT NULL;

ALTER TABLE public.bd_registro_aplicacao_detalhes
  DROP CONSTRAINT IF EXISTS chk_rad_tipo_item,
  DROP CONSTRAINT IF EXISTS chk_rad_manual_requer_tipo_item;

ALTER TABLE public.bd_registro_aplicacao_detalhes
  ADD CONSTRAINT chk_rad_tipo_item CHECK (
    tipo_item IS NULL OR tipo_item IN ('buraco','faixa','trecho','embocadura','bordo')),
  ADD CONSTRAINT chk_rad_manual_requer_tipo_item CHECK (
    (lista_entrega_id IS NOT NULL)
    OR (lista_entrega_id IS NULL AND registro_carga_id IS NULL AND tipo_item IS NOT NULL));

-- 3) POLICIES — DROP defensivo AMPLIADO
DROP POLICY IF EXISTS "Apontamento aplicacao por escopo logistico"             ON public.bd_registro_apontamento_aplicacao;
DROP POLICY IF EXISTS "Apontamento aplicacao criacao por escopo logistico"     ON public.bd_registro_apontamento_aplicacao;
DROP POLICY IF EXISTS "Apontamento aplicacao atualizacao por escopo logistico" ON public.bd_registro_apontamento_aplicacao;
DROP POLICY IF EXISTS "Apontamento aplicacao exclusao por escopo logistico"    ON public.bd_registro_apontamento_aplicacao;
DROP POLICY IF EXISTS "raa_select_v67" ON public.bd_registro_apontamento_aplicacao;
DROP POLICY IF EXISTS "raa_insert_v67" ON public.bd_registro_apontamento_aplicacao;
DROP POLICY IF EXISTS "raa_update_v67" ON public.bd_registro_apontamento_aplicacao;
DROP POLICY IF EXISTS "raa_delete_v67" ON public.bd_registro_apontamento_aplicacao;
DROP POLICY IF EXISTS "raa_select_v68" ON public.bd_registro_apontamento_aplicacao;
DROP POLICY IF EXISTS "raa_insert_v68" ON public.bd_registro_apontamento_aplicacao;
DROP POLICY IF EXISTS "raa_update_v68" ON public.bd_registro_apontamento_aplicacao;
DROP POLICY IF EXISTS "raa_delete_v68" ON public.bd_registro_apontamento_aplicacao;
DROP POLICY IF EXISTS "manual_select_rapa" ON public.bd_registro_apontamento_aplicacao;
DROP POLICY IF EXISTS "manual_insert_rapa" ON public.bd_registro_apontamento_aplicacao;
DROP POLICY IF EXISTS "manual_update_rapa" ON public.bd_registro_apontamento_aplicacao;
DROP POLICY IF EXISTS "manual_delete_rapa" ON public.bd_registro_apontamento_aplicacao;
DROP POLICY IF EXISTS "rapa_manual_select" ON public.bd_registro_apontamento_aplicacao;
DROP POLICY IF EXISTS "rapa_manual_insert" ON public.bd_registro_apontamento_aplicacao;
DROP POLICY IF EXISTS "rapa_manual_update" ON public.bd_registro_apontamento_aplicacao;
DROP POLICY IF EXISTS "rapa_manual_delete" ON public.bd_registro_apontamento_aplicacao;
DROP POLICY IF EXISTS "raa_select_v69" ON public.bd_registro_apontamento_aplicacao;
DROP POLICY IF EXISTS "raa_insert_v69" ON public.bd_registro_apontamento_aplicacao;
DROP POLICY IF EXISTS "raa_update_v69" ON public.bd_registro_apontamento_aplicacao;
DROP POLICY IF EXISTS "raa_delete_v69" ON public.bd_registro_apontamento_aplicacao;

DROP POLICY IF EXISTS "Aplicacao detalhes por escopo logistico"             ON public.bd_registro_aplicacao_detalhes;
DROP POLICY IF EXISTS "Aplicacao detalhes criacao por escopo logistico"     ON public.bd_registro_aplicacao_detalhes;
DROP POLICY IF EXISTS "Aplicacao detalhes atualizacao por escopo logistico" ON public.bd_registro_aplicacao_detalhes;
DROP POLICY IF EXISTS "Aplicacao detalhes exclusao por escopo logistico"    ON public.bd_registro_aplicacao_detalhes;
DROP POLICY IF EXISTS "rad_select_v67" ON public.bd_registro_aplicacao_detalhes;
DROP POLICY IF EXISTS "rad_insert_v67" ON public.bd_registro_aplicacao_detalhes;
DROP POLICY IF EXISTS "rad_update_v67" ON public.bd_registro_aplicacao_detalhes;
DROP POLICY IF EXISTS "rad_delete_v67" ON public.bd_registro_aplicacao_detalhes;
DROP POLICY IF EXISTS "rad_select_v68" ON public.bd_registro_aplicacao_detalhes;
DROP POLICY IF EXISTS "rad_insert_v68" ON public.bd_registro_aplicacao_detalhes;
DROP POLICY IF EXISTS "rad_update_v68" ON public.bd_registro_aplicacao_detalhes;
DROP POLICY IF EXISTS "rad_delete_v68" ON public.bd_registro_aplicacao_detalhes;
DROP POLICY IF EXISTS "manual_select_rad" ON public.bd_registro_aplicacao_detalhes;
DROP POLICY IF EXISTS "manual_insert_rad" ON public.bd_registro_aplicacao_detalhes;
DROP POLICY IF EXISTS "manual_update_rad" ON public.bd_registro_aplicacao_detalhes;
DROP POLICY IF EXISTS "manual_delete_rad" ON public.bd_registro_aplicacao_detalhes;
DROP POLICY IF EXISTS "rad_manual_select" ON public.bd_registro_aplicacao_detalhes;
DROP POLICY IF EXISTS "rad_manual_insert" ON public.bd_registro_aplicacao_detalhes;
DROP POLICY IF EXISTS "rad_manual_update" ON public.bd_registro_aplicacao_detalhes;
DROP POLICY IF EXISTS "rad_manual_delete" ON public.bd_registro_aplicacao_detalhes;
DROP POLICY IF EXISTS "rad_select_v69" ON public.bd_registro_aplicacao_detalhes;
DROP POLICY IF EXISTS "rad_insert_v69" ON public.bd_registro_aplicacao_detalhes;
DROP POLICY IF EXISTS "rad_update_v69" ON public.bd_registro_aplicacao_detalhes;
DROP POLICY IF EXISTS "rad_delete_v69" ON public.bd_registro_aplicacao_detalhes;

-- 4) POLICIES DO CABEÇALHO (v6.9)
CREATE POLICY "raa_select_v69" ON public.bd_registro_apontamento_aplicacao FOR SELECT TO authenticated
USING (
  public.fn_logistica_is_privileged_user()
  OR (origem_registro='logistico' AND lista_entrega_id IS NOT NULL
      AND public.fn_logistica_can_access_entrega(lista_entrega_id))
  OR (origem_registro='manual' AND lista_entrega_id IS NULL AND registro_carga_id IS NULL AND (
       public.fn_logistica_can_access_centro_custo(centro_custo_id)
       OR EXISTS (SELECT 1 FROM public.fn_diaria_scope_centros_custo(auth.uid()) s(cc)
                   WHERE s.cc = centro_custo_id)
       OR created_by = auth.uid()))
);

CREATE POLICY "raa_insert_v69" ON public.bd_registro_apontamento_aplicacao FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    (origem_registro='logistico' AND lista_entrega_id IS NOT NULL
       AND public.fn_logistica_can_manage_entrega(lista_entrega_id))
    OR
    (origem_registro='manual'
       AND lista_entrega_id IS NULL AND registro_carga_id IS NULL
       AND centro_custo_id IS NOT NULL AND atividade IS NOT NULL
       AND (public.fn_logistica_is_privileged_user()
            OR EXISTS (SELECT 1 FROM public.fn_diaria_scope_centros_custo(auth.uid()) s(cc)
                        WHERE s.cc = centro_custo_id)))
  )
);

CREATE POLICY "raa_update_v69" ON public.bd_registro_apontamento_aplicacao FOR UPDATE TO authenticated
USING (
  public.fn_logistica_is_privileged_user()
  OR (origem_registro='logistico' AND lista_entrega_id IS NOT NULL
      AND public.fn_logistica_can_manage_entrega(lista_entrega_id))
  OR (origem_registro='manual' AND lista_entrega_id IS NULL AND registro_carga_id IS NULL
      AND created_by = auth.uid()
      AND EXISTS (SELECT 1 FROM public.fn_diaria_scope_centros_custo(auth.uid()) s(cc)
                   WHERE s.cc = centro_custo_id))
)
WITH CHECK (
  public.fn_logistica_is_privileged_user()
  OR (origem_registro='logistico' AND lista_entrega_id IS NOT NULL
      AND public.fn_logistica_can_manage_entrega(lista_entrega_id))
  OR (origem_registro='manual' AND lista_entrega_id IS NULL AND registro_carga_id IS NULL
      AND created_by = auth.uid()
      AND EXISTS (SELECT 1 FROM public.fn_diaria_scope_centros_custo(auth.uid()) s(cc)
                   WHERE s.cc = centro_custo_id))
);

CREATE POLICY "raa_delete_v69" ON public.bd_registro_apontamento_aplicacao FOR DELETE TO authenticated
USING (
  public.fn_logistica_is_privileged_user()
  OR (origem_registro='logistico' AND lista_entrega_id IS NOT NULL
      AND public.fn_logistica_can_manage_entrega(lista_entrega_id))
  OR (origem_registro='manual' AND lista_entrega_id IS NULL AND registro_carga_id IS NULL
      AND created_by = auth.uid()
      AND EXISTS (SELECT 1 FROM public.fn_diaria_scope_centros_custo(auth.uid()) s(cc)
                   WHERE s.cc = centro_custo_id))
);

-- 5) POLICIES DOS DETALHES (v6.9)
CREATE POLICY "rad_select_v69" ON public.bd_registro_aplicacao_detalhes FOR SELECT TO authenticated
USING (
  public.fn_logistica_is_privileged_user()
  OR (lista_entrega_id IS NOT NULL AND public.fn_logistica_can_access_entrega(lista_entrega_id))
  OR (lista_entrega_id IS NULL AND registro_carga_id IS NULL
      AND tipo_item IN ('buraco','faixa','trecho','embocadura','bordo')
      AND EXISTS (SELECT 1 FROM public.bd_registro_apontamento_aplicacao r
                   WHERE r.id = registro_aplicacao_id
                     AND r.origem_registro='manual'
                     AND (public.fn_logistica_can_access_centro_custo(r.centro_custo_id)
                          OR EXISTS (SELECT 1 FROM public.fn_diaria_scope_centros_custo(auth.uid()) s(cc)
                                      WHERE s.cc = r.centro_custo_id)
                          OR r.created_by = auth.uid())))
);

CREATE POLICY "rad_insert_v69" ON public.bd_registro_aplicacao_detalhes FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    (lista_entrega_id IS NOT NULL AND public.fn_logistica_can_manage_entrega(lista_entrega_id))
    OR
    (lista_entrega_id IS NULL AND registro_carga_id IS NULL
     AND tipo_item IN ('buraco','faixa','trecho','embocadura','bordo')
     AND EXISTS (SELECT 1 FROM public.bd_registro_apontamento_aplicacao r
                  WHERE r.id = registro_aplicacao_id
                    AND r.origem_registro='manual'
                    AND r.created_by = auth.uid()
                    AND (public.fn_logistica_is_privileged_user()
                         OR EXISTS (SELECT 1 FROM public.fn_diaria_scope_centros_custo(auth.uid()) s(cc)
                                     WHERE s.cc = r.centro_custo_id))))
  )
);

CREATE POLICY "rad_update_v69" ON public.bd_registro_aplicacao_detalhes FOR UPDATE TO authenticated
USING (
  public.fn_logistica_is_privileged_user()
  OR (lista_entrega_id IS NOT NULL AND public.fn_logistica_can_manage_entrega(lista_entrega_id))
  OR (lista_entrega_id IS NULL AND registro_carga_id IS NULL
      AND tipo_item IN ('buraco','faixa','trecho','embocadura','bordo')
      AND EXISTS (SELECT 1 FROM public.bd_registro_apontamento_aplicacao r
                   WHERE r.id = registro_aplicacao_id
                     AND r.origem_registro='manual'
                     AND r.created_by = auth.uid()
                     AND EXISTS (SELECT 1 FROM public.fn_diaria_scope_centros_custo(auth.uid()) s(cc)
                                  WHERE s.cc = r.centro_custo_id)))
)
WITH CHECK (
  public.fn_logistica_is_privileged_user()
  OR (lista_entrega_id IS NOT NULL AND public.fn_logistica_can_manage_entrega(lista_entrega_id))
  OR (lista_entrega_id IS NULL AND registro_carga_id IS NULL
      AND tipo_item IN ('buraco','faixa','trecho','embocadura','bordo')
      AND EXISTS (SELECT 1 FROM public.bd_registro_apontamento_aplicacao r
                   WHERE r.id = registro_aplicacao_id
                     AND r.origem_registro='manual'
                     AND r.created_by = auth.uid()
                     AND EXISTS (SELECT 1 FROM public.fn_diaria_scope_centros_custo(auth.uid()) s(cc)
                                  WHERE s.cc = r.centro_custo_id)))
);

CREATE POLICY "rad_delete_v69" ON public.bd_registro_aplicacao_detalhes FOR DELETE TO authenticated
USING (
  public.fn_logistica_is_privileged_user()
  OR (lista_entrega_id IS NOT NULL AND public.fn_logistica_can_manage_entrega(lista_entrega_id))
  OR (lista_entrega_id IS NULL AND registro_carga_id IS NULL
      AND tipo_item IN ('buraco','faixa','trecho','embocadura','bordo')
      AND EXISTS (SELECT 1 FROM public.bd_registro_apontamento_aplicacao r
                   WHERE r.id = registro_aplicacao_id
                     AND r.origem_registro='manual'
                     AND r.created_by = auth.uid()
                     AND EXISTS (SELECT 1 FROM public.fn_diaria_scope_centros_custo(auth.uid()) s(cc)
                                  WHERE s.cc = r.centro_custo_id)))
);

-- 6) RPC base
CREATE OR REPLACE FUNCTION public.fn_criar_registro_aplicacao_manual(
  p_cabecalho JSONB, p_detalhes JSONB
) RETURNS UUID
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_cc UUID; v_ativ TEXT; v_data DATE; v_hchegada TIME;
  v_logr_cab TEXT; v_cab_id UUID;
  v_item JSONB; v_norm JSONB := '[]'::jsonb; v_nitem JSONB;
  v_tipo TEXT; v_permitidos TEXT[];
  v_area NUMERIC; v_ton NUMERIC; v_comp NUMERIC; v_larg NUMERIC;
  v_logr_snap TEXT; v_seq INT := 0; v_ton_total NUMERIC := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Nao autenticado' USING ERRCODE='28000'; END IF;

  IF NOT public.user_has_permission_action(v_uid, 'requisicoes_registro_aplicacao_view', 'criar') THEN
    RAISE EXCEPTION 'RBAC: usuario sem acao criar em requisicoes_registro_aplicacao_view'
      USING ERRCODE='42501';
  END IF;

  IF p_cabecalho IS NULL OR jsonb_typeof(p_cabecalho)<>'object'
    THEN RAISE EXCEPTION 'p_cabecalho deve ser objeto' USING ERRCODE='22023'; END IF;
  IF p_detalhes IS NULL OR jsonb_typeof(p_detalhes)<>'array' OR jsonb_array_length(p_detalhes)=0
    THEN RAISE EXCEPTION 'p_detalhes deve ser array nao vazio' USING ERRCODE='22023'; END IF;

  v_cc       := NULLIF(p_cabecalho->>'centro_custo_id','')::uuid;
  v_ativ     := lower(NULLIF(p_cabecalho->>'atividade',''));
  v_data     := COALESCE(NULLIF(p_cabecalho->>'data_aplicacao','')::date, CURRENT_DATE);
  v_hchegada := COALESCE(NULLIF(p_cabecalho->>'hora_chegada_local','')::time, CURRENT_TIME);
  v_logr_cab := COALESCE(NULLIF(p_cabecalho->>'logradouro',''),
                         NULLIF(p_cabecalho->>'logradouro_aplicado',''));

  IF v_cc IS NULL THEN RAISE EXCEPTION 'centro_custo_id obrigatorio' USING ERRCODE='22023'; END IF;
  IF v_ativ NOT IN ('tapa_buraco','pavimentacao_mecanizada','fresagem') THEN
    RAISE EXCEPTION 'atividade invalida: %', v_ativ USING ERRCODE='22023'; END IF;
  IF NOT (public.fn_logistica_is_privileged_user()
          OR EXISTS (SELECT 1 FROM public.fn_diaria_scope_centros_custo(v_uid) s(cc)
                      WHERE s.cc = v_cc)) THEN
    RAISE EXCEPTION 'Escopo: CC % fora do escopo do usuario', v_cc USING ERRCODE='42501';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_detalhes) LOOP
    v_tipo := lower(NULLIF(v_item->>'tipo_item',''));
    v_comp := NULLIF(v_item->>'comprimento','')::numeric;
    v_larg := NULLIF(v_item->>'largura_media','')::numeric;
    v_area := NULLIF(v_item->>'area_aplicada','')::numeric;
    v_ton  := COALESCE(NULLIF(v_item->>'tonelada_aplicada','')::numeric, 0);
    v_logr_snap := COALESCE(NULLIF(v_item->>'logradouro_nome',''), v_logr_cab);

    IF v_area IS NULL OR v_area<=0 THEN
      IF v_comp IS NULL OR v_comp<=0 OR v_larg IS NULL OR v_larg<=0 THEN
        RAISE EXCEPTION 'Detalhe sem dimensao: area_aplicada>0 OU comprimento+largura' USING ERRCODE='22023';
      END IF;
      v_area := round((v_comp*v_larg)::numeric, 4);
    END IF;
    IF v_logr_snap IS NULL OR btrim(v_logr_snap)='' THEN
      RAISE EXCEPTION 'logradouro_nome obrigatorio' USING ERRCODE='22023'; END IF;

    IF v_ativ='tapa_buraco' THEN
      v_tipo:='buraco'; v_permitidos:=ARRAY['buraco'];
    ELSIF v_ativ='pavimentacao_mecanizada' THEN
      v_permitidos:=ARRAY['faixa','trecho','bordo','embocadura'];
      IF v_tipo IS NULL THEN v_tipo:='faixa'; END IF;
    ELSE
      v_permitidos:=ARRAY['faixa','trecho'];
      IF v_tipo IS NULL THEN v_tipo:='faixa'; END IF;
    END IF;
    IF NOT (v_tipo = ANY (v_permitidos)) THEN
      RAISE EXCEPTION 'tipo_item % invalido para atividade %', v_tipo, v_ativ USING ERRCODE='22023';
    END IF;

    v_seq := v_seq + 1;
    v_ton_total := v_ton_total + COALESCE(v_ton,0);
    v_norm := v_norm || jsonb_build_array(jsonb_build_object(
      'sequencia',v_seq,'tipo_item',v_tipo,'logradouro_snap',v_logr_snap,
      'comprimento',v_comp,'largura_media',v_larg,
      'area_aplicada',v_area,'tonelada_aplicada',v_ton,
      'bordo',NULLIF(v_item->>'bordo','')));
  END LOOP;

  IF v_logr_cab IS NULL THEN
    SELECT CASE WHEN COUNT(DISTINCT (x->>'logradouro_snap'))>1
                THEN 'Multiplas ruas' ELSE MIN(x->>'logradouro_snap') END
      INTO v_logr_cab FROM jsonb_array_elements(v_norm) x;
  END IF;

  INSERT INTO public.bd_registro_apontamento_aplicacao (
    lista_entrega_id, registro_carga_id,
    data_aplicacao, hora_chegada_local, hora_aplicacao, hora_saida_caminhao,
    temperatura_chegada, temperatura_aplicacao,
    logradouro_aplicado, anotacoes_apontador, observacoes_gerais, bordo,
    centro_custo_id, atividade, origem_registro,
    tonelada_aplicada, carga_total_aplicada, status_aplicacao, created_by
  ) VALUES (
    NULL, NULL,
    v_data, v_hchegada,
    NULLIF(p_cabecalho->>'hora_aplicacao','')::time,
    NULLIF(p_cabecalho->>'hora_saida_caminhao','')::time,
    NULLIF(p_cabecalho->>'temperatura_chegada','')::numeric,
    NULLIF(p_cabecalho->>'temperatura_aplicacao','')::numeric,
    v_logr_cab,
    NULLIF(p_cabecalho->>'anotacoes_apontador',''),
    NULLIF(p_cabecalho->>'observacoes_gerais',''),
    NULLIF(p_cabecalho->>'bordo',''),
    v_cc, v_ativ, 'manual',
    COALESCE(v_ton_total,0), COALESCE(v_ton_total,0),
    'Concluído', v_uid
  ) RETURNING id INTO v_cab_id;

  FOR v_nitem IN SELECT * FROM jsonb_array_elements(v_norm) LOOP
    INSERT INTO public.bd_registro_aplicacao_detalhes (
      registro_aplicacao_id, lista_entrega_id, registro_carga_id,
      sequencia_aplicacao, data_aplicacao, logradouro_nome,
      comprimento, largura_media, area_aplicada, tonelada_aplicada,
      bordo, tipo_item, created_by
    ) VALUES (
      v_cab_id, NULL, NULL,
      (v_nitem->>'sequencia')::int, v_data, v_nitem->>'logradouro_snap',
      NULLIF(v_nitem->>'comprimento','')::numeric,
      NULLIF(v_nitem->>'largura_media','')::numeric,
      (v_nitem->>'area_aplicada')::numeric,
      COALESCE((v_nitem->>'tonelada_aplicada')::numeric, 0),
      NULLIF(v_nitem->>'bordo',''),
      v_nitem->>'tipo_item',
      v_uid
    );
  END LOOP;

  RETURN v_cab_id;
END; $$;

REVOKE ALL ON FUNCTION public.fn_criar_registro_aplicacao_manual(jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_criar_registro_aplicacao_manual(jsonb,jsonb) TO authenticated;
