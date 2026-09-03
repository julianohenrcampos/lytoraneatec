CREATE OR REPLACE FUNCTION public.fn_ct_recebimentos_pendentes_listar()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_func uuid; v_sa boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT3E_AUTH_REQUIRED' USING ERRCODE='P0001', HINT='Sessao expirada. Entre novamente.';
  END IF;
  v_sa := public.fn_is_super_admin(v_uid);
  v_func := public.fn_ativos_profile_funcionario_id(v_uid);

  RETURN jsonb_build_object(
    'ok', true,
    'ordens', coalesce((
      SELECT jsonb_agg(public.fn_ct_viagem_json(v.id) ORDER BY v.chegada_registrada_em DESC NULLS LAST)
        FROM public.bd_ct_viagens v
       WHERE v.status IN ('AGUARDANDO_RECEBIMENTO','PENDENTE_TRATATIVA')
         AND (v_sa
              OR (v_func IS NOT NULL AND v_func = v.recebedor_previsto_funcionario_id)
              OR (v_func IS NOT NULL AND EXISTS (
                    SELECT 1 FROM public.bd_ct_viagem_paradas pp
                     WHERE pp.viagem_id = v.id AND pp.status = 'CHEGADA_REGISTRADA'
                       AND pp.recebedor_previsto_funcionario_id = v_func))
              OR (public.fn_ct_cap(v_uid,'confirmar_recebimento') AND (
                    (v.destino_centro_custo_id IS NOT NULL
                     AND public.fn_ativos_can_access_centro_custo(v.destino_centro_custo_id, v_uid))
                    OR EXISTS (SELECT 1 FROM public.bd_ct_viagem_paradas pp
                                WHERE pp.viagem_id = v.id AND pp.status = 'CHEGADA_REGISTRADA'
                                  AND public.fn_ativos_can_access_centro_custo(pp.centro_custo_id, v_uid)))))
    ), '[]'::jsonb),
    'a_caminho', coalesce((
      SELECT jsonb_agg(public.fn_ct_viagem_json(v.id) ORDER BY v.transporte_iniciado_em DESC NULLS LAST)
        FROM public.bd_ct_viagens v
       WHERE v.status = 'EM_TRANSITO'
         AND (v_sa
              OR (v_func IS NOT NULL AND v_func = v.recebedor_previsto_funcionario_id)
              OR (v_func IS NOT NULL AND EXISTS (
                    SELECT 1 FROM public.bd_ct_viagem_paradas pp
                     WHERE pp.viagem_id = v.id
                       AND pp.recebedor_previsto_funcionario_id = v_func))
              OR (public.fn_ct_cap(v_uid,'confirmar_recebimento') AND (
                    (v.destino_centro_custo_id IS NOT NULL
                     AND public.fn_ativos_can_access_centro_custo(v.destino_centro_custo_id, v_uid))
                    OR EXISTS (SELECT 1 FROM public.bd_ct_viagem_paradas pp
                                WHERE pp.viagem_id = v.id
                                  AND public.fn_ativos_can_access_centro_custo(pp.centro_custo_id, v_uid)))))
    ), '[]'::jsonb));
END $function$;