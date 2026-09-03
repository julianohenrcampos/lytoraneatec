-- CT-4 (aditivo) — expor IDs necessários à re-hidratação do rascunho de movimentação direta.
CREATE OR REPLACE FUNCTION public.fn_ct_viagem_paradas_json(p_viagem_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id,
      'ordem', p.ordem,
      'status', p.status,
      'centro_custo_id', p.centro_custo_id,
      'cc_codigo', p.cc_codigo_snapshot,
      'cc_nome', p.cc_nome_snapshot,
      'endereco', p.endereco_snapshot,
      'ponto_exato', p.ponto_exato,
      'latitude', p.latitude,
      'longitude', p.longitude,
      'data_prevista', p.data_prevista,
      'hora_prevista', p.hora_prevista,
      'observacao', p.observacao,
      'recebedor_previsto_funcionario_id', p.recebedor_previsto_funcionario_id,
      'recebedor_previsto_nome', p.recebedor_previsto_nome_snapshot,
      'chegada_registrada_em', p.chegada_registrada_em,
      'concluida_em', p.concluida_em,
      'cargas', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
                 'movimentacao_id', m.id,
                 'status_movimentacao', m.status,
                 'equipamento_id', e.id,
                 'frota', e.frota,
                 'numero_frota', e.numero_frota,
                 'placa', e.placa,
                 'tipo_ativo', e.tipo_ativo,
                 'modelo', e.modelo)
               ORDER BY e.frota NULLS LAST, e.numero_frota NULLS LAST)
          FROM public.bd_movimentacoes m
          JOIN public.bd_caminhoes_equipamentos e ON e.id = m.equipamento_id
         WHERE m.parada_id = p.id AND coalesce(m.status,'') <> 'CANCELADA'
      ), '[]'::jsonb)
    ) ORDER BY p.ordem), '[]'::jsonb)
  FROM public.bd_ct_viagem_paradas p
  WHERE p.viagem_id = p_viagem_id AND p.status <> 'CANCELADA';
$function$;

CREATE OR REPLACE FUNCTION public.fn_ct_viagem_json(p_viagem_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'id', v.id,
    'codigo', v.codigo,
    'status', v.status,
    'origem_fluxo', v.origem_fluxo,
    'solicitacao_id', v.solicitacao_id,
    'data_ordem', coalesce(v.data_prevista_saida, v.data_prevista_entrega),
    'data_prevista_saida', v.data_prevista_saida,
    'data_prevista_entrega', v.data_prevista_entrega,
    'modalidade_deslocamento', v.modalidade_deslocamento,
    'tipo_transporte', v.tipo_transporte,
    'motorista_id', v.motorista_id,
    'motorista_nome_snapshot', v.motorista_nome_snapshot,
    'veiculo_transportador_id', v.veiculo_transportador_id,
    'empresa_transportadora_id', v.empresa_transportadora_id,
    'placa_transportador_snapshot', v.placa_transportador_snapshot,
    'empresa_transportadora_nome_snapshot', v.empresa_transportadora_nome_snapshot,
    'origem_centro_custo_id', v.origem_centro_custo_id,
    'origem_cc_nome_snapshot', v.origem_cc_nome_snapshot,
    'origem_endereco', coalesce(v.origem_endereco_operacional, v.origem_cc_endereco_snapshot),
    'origem_ponto_exato', v.origem_ponto_exato,
    'origem_latitude', coalesce(v.origem_coleta_latitude, v.origem_cc_latitude_snapshot),
    'origem_longitude', coalesce(v.origem_coleta_longitude, v.origem_cc_longitude_snapshot),
    'destino_cc_nome_snapshot', v.destino_cc_nome_snapshot,
    'destino_centro_custo_id', v.destino_centro_custo_id,
    'destino_endereco', coalesce(v.destino_endereco_operacional, v.destino_cc_endereco_snapshot),
    'destino_ponto_exato', v.destino_ponto_exato,
    'destino_latitude', coalesce(v.destino_descarga_latitude, v.destino_cc_latitude_snapshot),
    'destino_longitude', coalesce(v.destino_descarga_longitude, v.destino_cc_longitude_snapshot),
    'distancia_km', coalesce(v.distancia_operacional_km, v.distancia_rota_km, v.distancia_km),
    'recebedor_previsto_nome', v.recebedor_previsto_nome_snapshot,
    'recebedor_previsto_telefone', v.recebedor_previsto_telefone_snapshot,
    'transporte_iniciado_em', v.transporte_iniciado_em,
    'chegada_registrada_em', v.chegada_registrada_em,
    'observacoes', v.observacoes,
    'paradas', public.fn_ct_viagem_paradas_json(v.id),
    'cargas', coalesce((
       SELECT jsonb_agg(jsonb_build_object(
                'movimentacao_id', m.id,
                'status_movimentacao', m.status,
                'parada_id', m.parada_id,
                'equipamento_id', e.id,
                'frota', e.frota,
                'numero_frota', e.numero_frota,
                'placa', e.placa,
                'subcategoria_id', e.subcategoria_ativo_id,
                'tipo_ativo', e.tipo_ativo,
                'modelo', e.modelo
              ) ORDER BY e.frota NULLS LAST, e.numero_frota NULLS LAST)
         FROM public.bd_movimentacoes m
         JOIN public.bd_caminhoes_equipamentos e ON e.id = m.equipamento_id
        WHERE m.viagem_id = v.id AND coalesce(m.status,'') <> 'CANCELADA'
    ), '[]'::jsonb)
  )
  FROM public.bd_ct_viagens v WHERE v.id = p_viagem_id;
$function$;