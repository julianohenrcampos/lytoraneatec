CREATE OR REPLACE FUNCTION public.fn_solic_equip_capacidades_aprovacao(p_ids uuid[])
 RETURNS TABLE(solicitacao_id uuid, exists_visible boolean, can_approve boolean, can_reject boolean, auto_approval boolean, block_reason text, authorization_source text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid      uuid := auth.uid();
  v_is_super boolean;
  v_ids      uuid[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'EQUIP_CAP_NAO_AUTENTICADO' USING ERRCODE='42501';
  END IF;
  v_is_super := public.fn_is_super_admin(v_uid);

  IF NOT v_is_super THEN
    IF NOT ( public.fn_has_permission('central_aprovacoes_view',  v_uid)
          OR public.fn_has_permission('acesso_gestao_aprovacoes', v_uid) ) THEN
      RAISE EXCEPTION 'EQUIP_CENTRAL_SEM_ACESSO' USING ERRCODE='42501';
    END IF;
    IF NOT public.user_has_permission_action(v_uid, 'equipamentos_solicitacoes_aprovar', 'aprovar') THEN
      RAISE EXCEPTION 'EQUIP_CENTRAL_SEM_ACAO_APROVAR' USING ERRCODE='42501';
    END IF;
  END IF;

  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RETURN;
  END IF;
  v_ids := (SELECT array_agg(DISTINCT x) FROM unnest(p_ids) x WHERE x IS NOT NULL);
  IF array_length(v_ids, 1) > 200 THEN
    RAISE EXCEPTION 'EQUIP_CAP_LIMITE_EXCEDIDO'
      USING ERRCODE='22004',
            DETAIL = jsonb_build_object('qtd', array_length(v_ids,1), 'max', 200)::text;
  END IF;

  RETURN QUERY
  WITH visible AS (
    SELECT s.id                        AS sid,
           s.status_fluxo              AS fluxo,
           s.solicitante_id            AS solic_id,
           s.aprovador_centro_custo_id AS aprov_cc,
           s.centro_custo_id           AS cc_id
      FROM public.bd_solicitacoes_equipamento s
     WHERE s.id = ANY(v_ids)
       AND (
         v_is_super
         OR s.aprovador_centro_custo_id = v_uid
         OR EXISTS (
           SELECT 1 FROM public.fn_ativos_user_centros_custo(v_uid) e
            WHERE e.centro_custo_id = s.centro_custo_id
         )
       )
  ),
  corp AS (
    SELECT e.solicitacao_id AS sid,
           bool_or(true) AS is_corp,
           bool_or(
             COALESCE(e.status,'pendente') = 'pendente'
             AND COALESCE(e.pode_aprovar,false)
             AND (
               e.aprovador_resolvido_id = v_uid
               OR (e.aprovador_origem = 'permissao_rbac'
                   AND public.user_has_permission_action(
                         v_uid,
                         (SELECT pm.codigo FROM public.bd_permissions pm WHERE pm.id = e.permission_id_snapshot),
                         'aprovar'))
             )
           ) AS sou_aprovador_etapa
      FROM public.bd_aprovacoes_fluxo_exec e
     WHERE e.processo_tipo = 'SOLICITACAO_EQUIPAMENTO'
       AND e.solicitacao_id = ANY(v_ids)
     GROUP BY e.solicitacao_id
  )
  SELECT
    u.x AS solicitacao_id,
    (v.sid IS NOT NULL) AS exists_visible,
    CASE
      WHEN v.sid IS NULL THEN false
      WHEN v.fluxo <> 'PENDENTE_APROVACAO' THEN false
      WHEN v_is_super THEN true
      WHEN v.solic_id = v_uid THEN false
      WHEN COALESCE(c.is_corp,false) THEN COALESCE(c.sou_aprovador_etapa,false)
      ELSE true
    END AS can_approve,
    CASE
      WHEN v.sid IS NULL THEN false
      WHEN v.fluxo <> 'PENDENTE_APROVACAO' THEN false
      WHEN v_is_super THEN true
      WHEN v.solic_id = v_uid THEN false
      WHEN COALESCE(c.is_corp,false) THEN COALESCE(c.sou_aprovador_etapa,false)
      ELSE true
    END AS can_reject,
    CASE
      WHEN v.sid IS NULL THEN false
      ELSE (v.solic_id = v_uid)
    END AS auto_approval,
    CASE
      WHEN v.sid IS NULL THEN 'not_available'
      WHEN v.fluxo <> 'PENDENTE_APROVACAO' THEN 'nao_pendente'
      WHEN NOT v_is_super AND v.solic_id = v_uid THEN 'auto_aprovacao_bloqueada'
      WHEN NOT v_is_super AND COALESCE(c.is_corp,false) AND NOT COALESCE(c.sou_aprovador_etapa,false)
        THEN 'nao_e_aprovador_da_etapa_atual'
      ELSE NULL
    END AS block_reason,
    CASE
      WHEN v.sid IS NULL THEN 'denied'
      WHEN v_is_super AND v.solic_id = v_uid THEN 'superadmin_self_approval'
      WHEN v_is_super THEN 'superadmin'
      WHEN COALESCE(c.is_corp,false) THEN 'motor_corporativo_etapa'
      ELSE 'permission_stage'
    END AS authorization_source
  FROM unnest(v_ids) AS u(x)
  LEFT JOIN visible v ON v.sid = u.x
  LEFT JOIN corp c ON c.sid = u.x;
END
$function$;