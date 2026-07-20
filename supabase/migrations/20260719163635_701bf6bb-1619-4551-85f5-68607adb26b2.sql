
-- 1) Drop antigas assinaturas
DROP FUNCTION IF EXISTS public.fn_relatorio_aps_criar_carimbo(text, uuid, text, text, text, text, text, text, text, boolean);
DROP FUNCTION IF EXISTS public.fn_relatorio_aps_atualizar_carimbo(uuid, timestamptz, text, text, text, text, text, text, text, text);

-- 2) Remover coluna rua
ALTER TABLE public.bd_relatorio_aps_carimbos DROP COLUMN IF EXISTS rua;

-- 3) Recriar fn_relatorio_aps_criar_carimbo sem p_rua
CREATE OR REPLACE FUNCTION public.fn_relatorio_aps_criar_carimbo(
  p_nome text,
  p_centro_custo_id uuid,
  p_obra text,
  p_empresa text,
  p_cliente text,
  p_bairro text,
  p_revisao text,
  p_observacoes text,
  p_definir_padrao boolean DEFAULT false
)
RETURNS public.bd_relatorio_aps_carimbos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    (nome, centro_custo_id, obra, empresa, cliente, bairro, revisao, observacoes,
     ativo, padrao_centro_custo, created_by, updated_by)
  VALUES
    (btrim(p_nome), p_centro_custo_id,
     NULLIF(btrim(p_obra),''), NULLIF(btrim(p_empresa),''),
     NULLIF(btrim(p_cliente),''),
     NULLIF(btrim(p_bairro),''),
     COALESCE(NULLIF(btrim(p_revisao),''),'00'),
     NULLIF(btrim(p_observacoes),''),
     true, false, v_uid, v_uid)
  RETURNING * INTO v_row;

  IF p_definir_padrao AND p_centro_custo_id IS NOT NULL THEN
    v_row := public.fn_relatorio_aps_definir_carimbo_padrao(v_row.id, p_centro_custo_id);
  END IF;
  RETURN v_row;
END $$;

REVOKE ALL ON FUNCTION public.fn_relatorio_aps_criar_carimbo(text, uuid, text, text, text, text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_relatorio_aps_criar_carimbo(text, uuid, text, text, text, text, text, text, boolean) TO authenticated, service_role;

-- 4) Recriar fn_relatorio_aps_atualizar_carimbo sem p_rua
CREATE OR REPLACE FUNCTION public.fn_relatorio_aps_atualizar_carimbo(
  p_carimbo_id uuid,
  p_updated_at_esperado timestamptz,
  p_nome text,
  p_obra text,
  p_empresa text,
  p_cliente text,
  p_bairro text,
  p_revisao text,
  p_observacoes text
)
RETURNS public.bd_relatorio_aps_carimbos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
     SET nome        = btrim(p_nome),
         obra        = NULLIF(btrim(p_obra),''),
         empresa     = NULLIF(btrim(p_empresa),''),
         cliente     = NULLIF(btrim(p_cliente),''),
         bairro      = NULLIF(btrim(p_bairro),''),
         revisao     = COALESCE(NULLIF(btrim(p_revisao),''),'00'),
         observacoes = NULLIF(btrim(p_observacoes),''),
         updated_by  = v_uid,
         updated_at  = now()
   WHERE id = p_carimbo_id
     AND updated_at = p_updated_at_esperado
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CARIMBO_CONFLITO_CONCORRENCIA' USING ERRCODE = '40001';
  END IF;
  RETURN v_row;
END $$;

REVOKE ALL ON FUNCTION public.fn_relatorio_aps_atualizar_carimbo(uuid, timestamptz, text, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_relatorio_aps_atualizar_carimbo(uuid, timestamptz, text, text, text, text, text, text, text) TO authenticated, service_role;
