ALTER TABLE public.bd_ct_viagens ADD COLUMN IF NOT EXISTS rota_geometria jsonb NULL;
COMMENT ON COLUMN public.bd_ct_viagens.rota_geometria IS 'Snapshot GeoJSON LineString da rota escolhida no planejamento (CT-4 Fase 1).';

CREATE OR REPLACE FUNCTION public.fn_ct4_proximo_codigo_mov()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ano text;
  v_prefixo text;
  v_max int;
BEGIN
  v_ano := to_char((now() AT TIME ZONE 'America/Sao_Paulo'), 'YYYY');
  v_prefixo := 'MOV' || v_ano || '-';
  /* Lock por ano: serializa a numeracao dentro da transacao corrente. */
  PERFORM pg_advisory_xact_lock(hashtext('ct4_mov_codigo_' || v_ano));
  SELECT coalesce(max(substring(codigo from char_length(v_prefixo) + 1)::int), 0)
    INTO v_max
    FROM public.bd_ct_viagens
   WHERE codigo ~ ('^' || v_prefixo || '[0-9]+$');
  RETURN v_prefixo || lpad((v_max + 1)::text, 3, '0');
END
$function$;

REVOKE ALL ON FUNCTION public.fn_ct4_proximo_codigo_mov() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_ct4_proximo_codigo_mov() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_ct_mov_direta_salvar_rascunho(p_viagem_id uuid, p_payload jsonb, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid(); v_prev jsonb; v_resp jsonb; v_viagem uuid := p_viagem_id;
  v_hash text; v_cc record; v_par jsonb; v_par_id uuid; v_eq uuid; v_ordem int := 0;
  v_ultimo_cc uuid; v_func record; v_veic record; v_emp record; v_status text;
  v_origem_cc uuid;
  v_rota jsonb; v_geo jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT4_AUTH_REQUIRED' USING ERRCODE='P0001', HINT='Sessao expirada. Entre novamente.';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'CT4_REQUEST_ID_OBRIGATORIO' USING ERRCODE='P0001', HINT='Requisicao invalida.';
  END IF;
  IF NOT (public.fn_is_super_admin(v_uid)
          OR public.user_has_permission_action(v_uid,'gestao_maquinas_central_transporte_view','criar')
          OR public.user_has_permission_action(v_uid,'gestao_maquinas_central_transporte_view','editar')) THEN
    RAISE EXCEPTION 'CT4_FORBIDDEN' USING ERRCODE='P0001', HINT='Sem permissao para planejar movimentacoes.';
  END IF;

  SELECT response_json INTO v_prev FROM public.bd_ct_comando_requests WHERE request_id = p_request_id;
  IF v_prev IS NOT NULL THEN RETURN v_prev || jsonb_build_object('replay', true); END IF;

  v_hash := md5(coalesce(p_viagem_id::text,'novo') || coalesce(p_payload::text,''));

  /* Rota planejada (opcional). Validacao leve: nada de PostGIS. */
  IF p_payload ? 'rota' AND jsonb_typeof(p_payload->'rota') = 'object' THEN
    v_rota := p_payload->'rota';
    v_geo := v_rota->'geometria';
    IF v_geo IS NOT NULL AND jsonb_typeof(v_geo) <> 'null' THEN
      IF jsonb_typeof(v_geo) <> 'object'
         OR coalesce(v_geo->>'type','') <> 'LineString'
         OR jsonb_typeof(v_geo->'coordinates') <> 'array'
         OR jsonb_array_length(v_geo->'coordinates') < 2 THEN
        RAISE EXCEPTION 'CT4_ROTA_GEOMETRIA_INVALIDA' USING ERRCODE='P0001',
          HINT='A rota recebida nao e uma LineString valida.';
      END IF;
    ELSE
      v_geo := NULL;
    END IF;
  END IF;

  IF v_viagem IS NULL THEN
    INSERT INTO public.bd_ct_viagens (codigo, origem_fluxo, solicitacao_id, status, created_by, updated_by)
    VALUES (public.fn_ct4_proximo_codigo_mov(), 'MOVIMENTACAO_DIRETA', NULL, 'RASCUNHO', v_uid, v_uid)
    RETURNING id INTO v_viagem;
  ELSE
    SELECT status INTO v_status FROM public.bd_ct_viagens
      WHERE id = v_viagem AND origem_fluxo = 'MOVIMENTACAO_DIRETA' FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'CT4_VIAGEM_NAO_ENCONTRADA' USING ERRCODE='P0001', HINT='Movimentacao inexistente.';
    END IF;
    IF v_status <> 'RASCUNHO' THEN
      RAISE EXCEPTION 'CT4_STATUS_INVALIDO' USING ERRCODE='P0001',
        HINT='Somente rascunhos podem ser alterados.';
    END IF;
  END IF;

  SELECT id, codigo_centro_custo, nome_centro_custo, endereco_completo AS endereco, latitude, longitude
    INTO v_cc FROM public.bd_centros_custo
   WHERE id = nullif(p_payload->>'origem_centro_custo_id','')::uuid;

  SELECT id, nome_completo, cpf INTO v_func FROM public.bd_funcionarios
   WHERE id = nullif(p_payload->>'motorista_id','')::uuid;
  SELECT id, placa INTO v_veic FROM public.bd_caminhoes_equipamentos
   WHERE id = nullif(p_payload->>'veiculo_transportador_id','')::uuid;
  SELECT id, nome_empresa INTO v_emp FROM public.bd_empresas
   WHERE id = nullif(p_payload->>'empresa_transportadora_id','')::uuid;

  UPDATE public.bd_ct_viagens SET
    modalidade_deslocamento = nullif(p_payload->>'modalidade',''),
    tipo_transporte = nullif(p_payload->>'tipo_transporte',''),
    motorista_id = v_func.id,
    motorista_nome_snapshot = coalesce(v_func.nome_completo, nullif(p_payload->>'motorista_nome','')),
    motorista_cpf_snapshot = v_func.cpf,
    veiculo_transportador_id = v_veic.id,
    placa_transportador_snapshot = coalesce(v_veic.placa, nullif(p_payload->>'placa_transportador','')),
    empresa_transportadora_id = v_emp.id,
    empresa_transportadora_nome_snapshot = v_emp.nome_empresa,
    data_prevista_saida = nullif(p_payload->>'data_prevista_saida','')::date,
    origem_centro_custo_id = v_cc.id,
    origem_cc_codigo_snapshot = v_cc.codigo_centro_custo,
    origem_cc_nome_snapshot = v_cc.nome_centro_custo,
    origem_cc_endereco_snapshot = v_cc.endereco,
    origem_cc_latitude_snapshot = v_cc.latitude,
    origem_cc_longitude_snapshot = v_cc.longitude,
    origem_endereco_operacional = nullif(p_payload->>'origem_endereco',''),
    origem_ponto_exato = nullif(p_payload->>'origem_ponto_exato',''),
    origem_coleta_latitude = nullif(p_payload->>'origem_latitude','')::numeric,
    origem_coleta_longitude = nullif(p_payload->>'origem_longitude','')::numeric,
    observacoes = nullif(p_payload->>'observacoes',''),
    distancia_rota_km = CASE WHEN v_rota IS NULL THEN distancia_rota_km
                             ELSE nullif(v_rota->>'distancia_km','')::numeric END,
    duracao_rota_min = CASE WHEN v_rota IS NULL THEN duracao_rota_min
                            ELSE nullif(v_rota->>'duracao_min','')::int END,
    rota_resumo = CASE WHEN v_rota IS NULL THEN rota_resumo
                       ELSE nullif(v_rota->>'resumo','') END,
    rota_geometria = CASE WHEN v_rota IS NULL THEN rota_geometria ELSE v_geo END,
    updated_at = now(), updated_by = v_uid
  WHERE id = v_viagem;

  v_origem_cc := v_cc.id;

  -- reconstrucao determinista das paradas do rascunho
  DELETE FROM public.bd_movimentacoes WHERE viagem_id = v_viagem;
  DELETE FROM public.bd_ct_viagem_paradas WHERE viagem_id = v_viagem;

  FOR v_par IN SELECT * FROM jsonb_array_elements(coalesce(p_payload->'paradas','[]'::jsonb)) LOOP
    v_ordem := v_ordem + 1;
    SELECT id, codigo_centro_custo, nome_centro_custo, endereco_completo AS endereco, latitude, longitude
      INTO v_cc FROM public.bd_centros_custo
     WHERE id = nullif(v_par->>'centro_custo_id','')::uuid;
    IF v_cc.id IS NULL THEN
      RAISE EXCEPTION 'CT4_PARADA_SEM_CENTRO_CUSTO' USING ERRCODE='P0001',
        HINT='Informe a obra/centro de custo de cada parada.';
    END IF;

    INSERT INTO public.bd_ct_viagem_paradas (
      viagem_id, ordem, centro_custo_id, cc_codigo_snapshot, cc_nome_snapshot,
      endereco_snapshot, ponto_exato, latitude, longitude, data_prevista, hora_prevista,
      observacao, recebedor_previsto_funcionario_id, recebedor_previsto_nome_snapshot,
      created_by, updated_by)
    VALUES (
      v_viagem, v_ordem, v_cc.id, v_cc.codigo_centro_custo, v_cc.nome_centro_custo,
      coalesce(nullif(v_par->>'endereco',''), v_cc.endereco),
      nullif(v_par->>'ponto_exato',''),
      coalesce(nullif(v_par->>'latitude','')::numeric, v_cc.latitude),
      coalesce(nullif(v_par->>'longitude','')::numeric, v_cc.longitude),
      nullif(v_par->>'data_prevista','')::date,
      nullif(v_par->>'hora_prevista','')::time,
      nullif(v_par->>'observacao',''),
      nullif(v_par->>'recebedor_previsto_funcionario_id','')::uuid,
      nullif(v_par->>'recebedor_previsto_nome',''),
      v_uid, v_uid)
    RETURNING id INTO v_par_id;

    v_ultimo_cc := v_cc.id;

    FOR v_eq IN SELECT (jsonb_array_elements_text(coalesce(v_par->'equipamentos','[]'::jsonb)))::uuid LOOP
      IF EXISTS (SELECT 1 FROM public.bd_movimentacoes mv
                  WHERE mv.viagem_id = v_viagem AND mv.equipamento_id = v_eq) THEN
        RAISE EXCEPTION 'CT4_EQUIPAMENTO_DUPLICADO' USING ERRCODE='P0001',
          HINT='Um equipamento nao pode ser entregue em duas paradas da mesma viagem.';
      END IF;
      INSERT INTO public.bd_movimentacoes (
        origem_fluxo, solicitacao_id, equipamento_id, viagem_id, parada_id,
        origem_tipo, origem_id, destino_tipo, destino_id,
        tipo_deslocamento, tipo_movimentacao, status, created_by)
      VALUES ('MOVIMENTACAO_DIRETA', NULL, v_eq, v_viagem, v_par_id,
        'CENTRO_CUSTO', v_origem_cc,
        'CENTRO_CUSTO', v_cc.id,
        nullif(p_payload->>'modalidade',''), 'MOVIMENTACAO', 'RASCUNHO', v_uid);
    END LOOP;
  END LOOP;

  /* Ativos participantes sem parada de entrega: mesma estrutura, parada_id NULL. */
  FOR v_eq IN SELECT DISTINCT (jsonb_array_elements_text(coalesce(p_payload->'ativos_planejados','[]'::jsonb)))::uuid LOOP
    IF v_eq IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.bd_movimentacoes mv
                        WHERE mv.viagem_id = v_viagem AND mv.equipamento_id = v_eq) THEN
      INSERT INTO public.bd_movimentacoes (
        origem_fluxo, solicitacao_id, equipamento_id, viagem_id, parada_id,
        origem_tipo, origem_id, destino_tipo, destino_id,
        tipo_deslocamento, tipo_movimentacao, status, created_by)
      VALUES ('MOVIMENTACAO_DIRETA', NULL, v_eq, v_viagem, NULL,
        'CENTRO_CUSTO', v_origem_cc,
        'CENTRO_CUSTO', NULL,
        nullif(p_payload->>'modalidade',''), 'MOVIMENTACAO', 'RASCUNHO', v_uid);
    END IF;
  END LOOP;

  IF v_ultimo_cc IS NOT NULL THEN
    UPDATE public.bd_ct_viagens v SET
      destino_centro_custo_id = v_ultimo_cc,
      destino_cc_codigo_snapshot = c.codigo_centro_custo,
      destino_cc_nome_snapshot = c.nome_centro_custo,
      destino_cc_endereco_snapshot = c.endereco_completo,
      destino_cc_latitude_snapshot = c.latitude,
      destino_cc_longitude_snapshot = c.longitude
    FROM public.bd_centros_custo c
    WHERE v.id = v_viagem AND c.id = v_ultimo_cc;
  END IF;

  v_resp := jsonb_build_object('ok', true, 'replay', false, 'viagem_id', v_viagem,
              'viagem', public.fn_ct_viagem_json(v_viagem));
  INSERT INTO public.bd_ct_comando_requests (request_id, operacao, solicitacao_id, command_hash, response_json, created_by)
  VALUES (p_request_id, 'CT4_MOV_DIRETA_RASCUNHO', NULL, v_hash, v_resp, v_uid);
  RETURN v_resp;
END
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
    'distancia_rota_km', v.distancia_rota_km,
    'duracao_rota_min', v.duracao_rota_min,
    'rota_resumo', v.rota_resumo,
    'rota_geometria', v.rota_geometria,
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