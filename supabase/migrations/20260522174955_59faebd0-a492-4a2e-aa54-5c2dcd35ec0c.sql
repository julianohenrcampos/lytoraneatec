
CREATE OR REPLACE FUNCTION public.fn_diaria_nomes_minimos(p_ids uuid[])
RETURNS TABLE (
  id             uuid,
  nome_completo  text,
  origem         text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid          uuid := auth.uid();
  v_global       boolean;
  v_ccs          uuid[];
  v_allowed_ids  uuid[];
BEGIN
  IF v_uid IS NULL OR p_ids IS NULL OR array_length(p_ids,1) IS NULL THEN
    RETURN;
  END IF;

  v_global := public.fn_is_super_admin(v_uid)
           OR public.fn_diaria_has_global_access(v_uid);

  IF v_global THEN
    v_allowed_ids := p_ids;
  ELSE
    SELECT array_agg(cc) INTO v_ccs
      FROM public.fn_diaria_scope_centros_custo(v_uid) AS cc;

    IF v_ccs IS NULL OR array_length(v_ccs,1) IS NULL THEN
      RETURN;
    END IF;

    SELECT array_agg(DISTINCT x) INTO v_allowed_ids
    FROM (
      SELECT unnest(ARRAY[
        s.criado_por,
        s.engenheiro_solicitante_id,
        s.responsavel_campo_id,
        s.autorizado_por
      ]) AS x
      FROM public.bd_diaria_solicitacoes s
      WHERE s.centro_custo_id = ANY (v_ccs)
    ) t
    WHERE x = ANY (p_ids);

    IF v_allowed_ids IS NULL THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
    SELECT f.id, f.nome_completo, 'funcionario'::text
      FROM public.bd_funcionarios f
     WHERE f.id = ANY (v_allowed_ids)
  UNION
    SELECT p.id, p.nome_completo, 'profile'::text
      FROM public.profiles p
     WHERE p.id = ANY (v_allowed_ids)
       AND p.nome_completo IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_diaria_nomes_minimos(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_diaria_nomes_minimos(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_diaria_aditivos_pendentes_escopo(
  p_solicitacao_ids uuid[]
)
RETURNS TABLE (
  id              uuid,
  solicitacao_id  uuid,
  tipo            text,
  status          text,
  data_ajustada   date,
  solicitado_em   timestamptz,
  funcionario_id  uuid
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_global   boolean;
  v_ccs      uuid[];
  v_allowed  uuid[];
BEGIN
  IF v_uid IS NULL OR p_solicitacao_ids IS NULL
     OR array_length(p_solicitacao_ids,1) IS NULL THEN
    RETURN;
  END IF;

  v_global := public.fn_is_super_admin(v_uid)
           OR public.fn_diaria_has_global_access(v_uid);

  IF NOT v_global THEN
    IF NOT public.fn_has_role('GerenteRegional', v_uid) THEN
      RETURN;
    END IF;
  END IF;

  IF v_global THEN
    v_allowed := p_solicitacao_ids;
  ELSE
    SELECT array_agg(cc) INTO v_ccs
      FROM public.fn_diaria_scope_centros_custo(v_uid) AS cc;
    IF v_ccs IS NULL THEN RETURN; END IF;

    SELECT array_agg(s.id) INTO v_allowed
      FROM public.bd_diaria_solicitacoes s
     WHERE s.id = ANY (p_solicitacao_ids)
       AND s.centro_custo_id = ANY (v_ccs);
    IF v_allowed IS NULL THEN RETURN; END IF;
  END IF;

  RETURN QUERY
  SELECT a.id, a.solicitacao_id, a.tipo, a.status,
         a.data_ajustada, a.solicitado_em, a.funcionario_id
    FROM public.bd_diaria_aditivos a
   WHERE a.status = 'pendente'
     AND a.solicitacao_id = ANY (v_allowed);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_diaria_aditivos_pendentes_escopo(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_diaria_aditivos_pendentes_escopo(uuid[]) TO authenticated;
