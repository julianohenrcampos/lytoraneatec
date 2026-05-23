DROP FUNCTION IF EXISTS public.fn_diaria_aditivos_pendentes_escopo(uuid[]);

CREATE FUNCTION public.fn_diaria_aditivos_pendentes_escopo(p_solicitacao_ids uuid[])
 RETURNS TABLE(
   id uuid,
   solicitacao_id uuid,
   tipo text,
   status text,
   data_ajustada date,
   solicitado_em timestamp with time zone,
   funcionario_id uuid,
   solicitado_por uuid,
   decidido_por uuid,
   retroativo boolean,
   justificativa text,
   motivo_reprovacao text,
   snapshot_funcionario jsonb,
   funcionarios_adicionados jsonb,
   funcionarios_removidos jsonb,
   impacto_financeiro jsonb
 )
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
         a.data_ajustada, a.solicitado_em, a.funcionario_id,
         a.solicitado_por, a.decidido_por, a.retroativo,
         a.justificativa,
         CASE WHEN a.status = 'reprovado' THEN a.observacao_aprovador ELSE NULL END AS motivo_reprovacao,
         a.snapshot_funcionario, a.funcionarios_adicionados, a.funcionarios_removidos,
         a.impacto_financeiro
    FROM public.bd_diaria_aditivos a
   WHERE a.status = 'pendente'
     AND a.solicitacao_id = ANY (v_allowed);
END;
$function$;