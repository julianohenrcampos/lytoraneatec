CREATE OR REPLACE FUNCTION public.fn_ct_viagem_operacao_detalhe(p_viagem_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_func uuid;
  v record;
  v_pend int;
  v_total_cargas int;
  v_pode_receber boolean;
  v_parada_atual uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT3E_AUTH_REQUIRED' USING ERRCODE='P0001', HINT='Sessao expirada. Entre novamente.';
  END IF;
  IF NOT public.fn_ct_pode_ver_viagem(p_viagem_id, v_uid) THEN
    RAISE EXCEPTION 'CT3E_FORBIDDEN' USING ERRCODE='P0001', HINT='Viagem fora do seu escopo.';
  END IF;

  SELECT * INTO v FROM public.bd_ct_viagens WHERE id = p_viagem_id;
  v_func := public.fn_ativos_profile_funcionario_id(v_uid);

  SELECT p.id INTO v_parada_atual FROM public.bd_ct_viagem_paradas p
   WHERE p.viagem_id = p_viagem_id AND p.status = 'CHEGADA_REGISTRADA'
   ORDER BY p.ordem LIMIT 1;

  SELECT count(*) INTO v_total_cargas
    FROM public.bd_movimentacoes m
   WHERE m.viagem_id = p_viagem_id AND coalesce(m.status,'') <> 'CANCELADA';

  SELECT (CASE WHEN v.modalidade_deslocamento='TRANSPORTADO'
               AND NOT EXISTS (SELECT 1 FROM public.bd_ct_checklists c
                                WHERE c.viagem_id=p_viagem_id AND c.tipo='TRANSPORTADOR'
                                  AND c.status='CONCLUIDO')
          THEN 1 ELSE 0 END)
       + (SELECT count(*) FROM public.bd_movimentacoes m
           WHERE m.viagem_id=p_viagem_id AND coalesce(m.status,'') <> 'CANCELADA'
             AND NOT EXISTS (SELECT 1 FROM public.bd_ct_checklists c
                              WHERE c.viagem_id=p_viagem_id AND c.tipo='CARGA'
                                AND c.movimentacao_id=m.id AND c.status='CONCLUIDO'))
    INTO v_pend;

  v_pode_receber := public.fn_is_super_admin(v_uid)
    OR (v_func IS NOT NULL AND v_func = v.recebedor_previsto_funcionario_id)
    OR (v_func IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.bd_ct_viagem_paradas p
           WHERE p.viagem_id = p_viagem_id AND p.status = 'CHEGADA_REGISTRADA'
             AND p.recebedor_previsto_funcionario_id = v_func))
    OR (public.fn_ct_cap(v_uid,'confirmar_recebimento') AND (
          (v.destino_centro_custo_id IS NOT NULL
           AND public.fn_ativos_can_access_centro_custo(v.destino_centro_custo_id, v_uid))
          OR EXISTS (SELECT 1 FROM public.bd_ct_viagem_paradas p
                      WHERE p.viagem_id = p_viagem_id AND p.status = 'CHEGADA_REGISTRADA'
                        AND public.fn_ativos_can_access_centro_custo(p.centro_custo_id, v_uid))));

  RETURN jsonb_build_object(
    'ok', true,
    'viagem', public.fn_ct_viagem_json(p_viagem_id),
    'parada_atual_id', v_parada_atual,
    'sou_motorista', (v_func IS NOT NULL AND v_func = v.motorista_id),
    'checklists_pendentes', v_pend,
    'total_cargas', v_total_cargas,
    'pode_registrar_checklist', (v_func IS NOT NULL AND v_func = v.motorista_id
                                 AND public.fn_ct_cap(v_uid,'registrar_checklist'))
                                 OR public.fn_is_super_admin(v_uid),
    'pode_iniciar', (v.status='PROGRAMADA' AND v_pend = 0),
    'pode_registrar_chegada', (v.status='EM_TRANSITO'),
    'pode_receber', v_pode_receber,
    'checklists', coalesce((SELECT jsonb_agg(jsonb_build_object(
             'id', c.id, 'tipo', c.tipo, 'movimentacao_id', c.movimentacao_id,
             'checklist_codigo', c.checklist_codigo, 'checklist_versao', c.checklist_versao,
             'status', c.status, 'respostas', c.respostas,
             'realizado_em', c.realizado_em, 'latitude', c.latitude, 'longitude', c.longitude)
             ORDER BY c.tipo, c.created_at)
        FROM public.bd_ct_checklists c WHERE c.viagem_id = p_viagem_id), '[]'::jsonb),
    'recebimento', (SELECT jsonb_build_object(
             'id', r.id, 'status', r.status, 'recebido_em', r.recebido_em,
             'recebedor_nome', r.recebedor_nome_snapshot,
             'observacoes', r.observacoes,
             'itens', coalesce((SELECT jsonb_agg(jsonb_build_object(
                        'movimentacao_id', i.movimentacao_id, 'equipamento_id', i.equipamento_id,
                        'resultado', i.resultado, 'nao_conformidade_tipo', i.nao_conformidade_tipo,
                        'observacao', i.observacao, 'fotos', i.fotos))
                      FROM public.bd_ct_recebimento_itens i WHERE i.recebimento_id = r.id),'[]'::jsonb))
        FROM public.bd_ct_recebimentos r
       WHERE r.viagem_id = p_viagem_id
         AND r.parada_id IS NOT DISTINCT FROM v_parada_atual
       LIMIT 1));
END $$;
REVOKE ALL ON FUNCTION public.fn_ct_viagem_operacao_detalhe(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_ct_viagem_operacao_detalhe(uuid) TO authenticated;