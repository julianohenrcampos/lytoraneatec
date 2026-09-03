CREATE OR REPLACE FUNCTION public.fn_ct_mobilizacao_salvar_rascunho(
  p_solicitacao_id uuid, p_planejamento_id uuid, p_versao_esperada integer,
  p_payload jsonb, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_sa boolean;
  v_cmd text;
  v_led record;
  v_plan public.bd_solicitacoes_planejamento;
  v_content text;
  v_resp jsonb;
  v_viagem jsonb;
  v_ids uuid[] := '{}';
  v_vid uuid;
  v_at uuid;
  v_ate record;
  v_mot record;
  v_veic record;
  v_emp record;
  v_occ record;
  v_dcc record;
  v_cc_destino uuid;
  v_vistos uuid[] := '{}';
  v_mod text;
  v_tipo text;
  v_qtd integer;
  v_novo boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT2_AUTH_REQUIRED' USING ERRCODE='P0001', HINT='Sessao expirada. Entre novamente para continuar.';
  END IF;
  IF p_solicitacao_id IS NULL OR p_request_id IS NULL OR p_payload IS NULL
     OR jsonb_typeof(coalesce(p_payload->'viagens','[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'CT2_PARAMETROS_INVALIDOS' USING ERRCODE='P0001', HINT='Parametros obrigatorios ausentes ou invalidos.';
  END IF;

  v_sa := public.fn_is_super_admin(v_uid);
  IF NOT v_sa THEN
    IF NOT public.user_has_permission_action(v_uid,'gestao_maquinas_central_transporte_view',
              CASE WHEN p_planejamento_id IS NULL THEN 'criar' ELSE 'editar' END) THEN
      RAISE EXCEPTION 'CT2_FORBIDDEN' USING ERRCODE='P0001', HINT='Sem permissao para planejar a mobilizacao.';
    END IF;
    IF NOT public.fn_ativos_can_access_solicitacao(p_solicitacao_id, v_uid) THEN
      RAISE EXCEPTION 'CT2_SCOPE_DENIED' USING ERRCODE='P0001', HINT='Solicitacao fora do seu escopo de acesso.';
    END IF;
  END IF;

  v_cmd := public.fn_ct_mob_command_hash('MOB_SALVAR_RASCUNHO', p_solicitacao_id, p_planejamento_id,
                                          p_versao_esperada, NULL, p_payload);
  PERFORM pg_advisory_xact_lock(hashtextextended('ct3c:req:' || p_request_id::text, 0));
  SELECT * INTO v_led FROM public.bd_ct_comando_requests WHERE request_id = p_request_id;
  IF v_led.request_id IS NOT NULL THEN
    IF v_led.command_hash = v_cmd THEN
      RETURN v_led.response_json || jsonb_build_object('replay', true);
    END IF;
    RAISE EXCEPTION 'CT3_IDEMPOTENCY_KEY_REUSED' USING ERRCODE='P0001',
      HINT='Esta operacao ja foi usada com outro conteudo. Recarregue a pagina.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('ct3c:plan:' || p_solicitacao_id::text, 0));

  SELECT s.centro_custo_id INTO v_cc_destino
    FROM public.bd_solicitacoes_equipamento s WHERE s.id = p_solicitacao_id;

  IF p_planejamento_id IS NULL THEN
    SELECT * INTO v_plan FROM public.bd_solicitacoes_planejamento
     WHERE solicitacao_id = p_solicitacao_id AND status_planejamento = 'RASCUNHO' FOR UPDATE;
    IF v_plan.id IS NULL THEN
      INSERT INTO public.bd_solicitacoes_planejamento (
        solicitacao_id, versao, vigente, status_planejamento, created_by, request_id, updated_by
      ) VALUES (
        p_solicitacao_id,
        (SELECT coalesce(max(versao),0)+1 FROM public.bd_solicitacoes_planejamento WHERE solicitacao_id = p_solicitacao_id),
        NOT EXISTS (SELECT 1 FROM public.bd_solicitacoes_planejamento
                     WHERE solicitacao_id = p_solicitacao_id AND vigente),
        'RASCUNHO', v_uid, p_request_id, v_uid
      ) RETURNING * INTO v_plan;
    END IF;
  ELSE
    SELECT * INTO v_plan FROM public.bd_solicitacoes_planejamento
     WHERE id = p_planejamento_id AND solicitacao_id = p_solicitacao_id FOR UPDATE;
    IF v_plan.id IS NULL THEN
      RAISE EXCEPTION 'CT3C_PLANEJAMENTO_NAO_ENCONTRADO' USING ERRCODE='P0001', HINT='Planejamento inexistente para esta solicitacao.';
    END IF;
    IF v_plan.status_planejamento <> 'RASCUNHO' THEN
      RAISE EXCEPTION 'CT3C_PLANEJAMENTO_IMUTAVEL' USING ERRCODE='P0001', HINT='Somente rascunhos podem ser editados. Abra uma nova revisao.';
    END IF;
    IF p_versao_esperada IS NOT NULL AND p_versao_esperada <> v_plan.lock_version THEN
      RAISE EXCEPTION 'CT3C_VERSAO_SUPERADA' USING ERRCODE='P0001', HINT='Este rascunho foi alterado por outra pessoa. Recarregue a pagina.';
    END IF;
  END IF;

  v_content := public.fn_ct_mob_content_hash(p_payload);

  IF v_plan.content_hash IS NOT NULL AND v_plan.content_hash = v_content THEN
    v_resp := jsonb_build_object('ok', true, 'replay', false, 'no_change', true,
      'planejamento_id', v_plan.id, 'versao', v_plan.versao, 'lock_version', v_plan.lock_version,
      'status', v_plan.status_planejamento, 'content_hash', v_content,
      'viagens', public.fn_ct_mob_viagens_json(v_plan.id));
    INSERT INTO public.bd_ct_comando_requests (request_id, operacao, solicitacao_id, planejamento_id, command_hash, response_json, created_by)
    VALUES (p_request_id, 'MOB_SALVAR_RASCUNHO', p_solicitacao_id, v_plan.id, v_cmd, v_resp, v_uid);
    RETURN v_resp;
  END IF;

  FOR v_viagem IN SELECT * FROM jsonb_array_elements(coalesce(p_payload->'viagens','[]'::jsonb)) LOOP
    v_mod  := upper(coalesce(public.fn_ct_mob_norm_texto(v_viagem->>'modalidade_deslocamento'),''));
    v_tipo := nullif(upper(coalesce(public.fn_ct_mob_norm_texto(v_viagem->>'tipo_transporte'),'')),'');
    IF v_mod NOT IN ('RODANTE','TRANSPORTADO') THEN
      RAISE EXCEPTION 'CT3C_MODALIDADE_INVALIDA' USING ERRCODE='P0001', HINT='Escolha a modalidade da viagem: rodante ou transportado.';
    END IF;
    IF v_mod = 'RODANTE' THEN v_tipo := NULL; END IF;
    IF v_mod = 'TRANSPORTADO' AND coalesce(v_tipo,'') NOT IN ('PROPRIO','TERCEIRO') THEN
      RAISE EXCEPTION 'CT3C_TIPO_TRANSPORTE_INVALIDO' USING ERRCODE='P0001', HINT='Informe se o transporte e proprio ou de terceiro.';
    END IF;

    v_mot := NULL; v_veic := NULL; v_emp := NULL; v_occ := NULL; v_dcc := NULL;

    IF coalesce(v_viagem->>'motorista_id','') <> '' THEN
      SELECT f.id, f.nome_completo, f.cpf INTO v_mot
        FROM public.bd_funcionarios f WHERE f.id = (v_viagem->>'motorista_id')::uuid;
      IF v_mot.id IS NULL THEN
        RAISE EXCEPTION 'CT3C_MOTORISTA_INVALIDO' USING ERRCODE='P0001', HINT='Motorista nao encontrado.';
      END IF;
    END IF;

    IF coalesce(v_viagem->>'veiculo_transportador_id','') <> '' THEN
      SELECT e.id, e.placa, e.situacao INTO v_veic
        FROM public.bd_caminhoes_equipamentos e WHERE e.id = (v_viagem->>'veiculo_transportador_id')::uuid;
      IF v_veic.id IS NULL THEN
        RAISE EXCEPTION 'CT3C_TRANSPORTADOR_INVALIDO' USING ERRCODE='P0001', HINT='Veiculo transportador nao encontrado.';
      END IF;
      IF upper(coalesce(v_veic.situacao,'')) IN ('INATIVO','CANCELADO','MANUTENCAO','INDISPONIVEL') THEN
        RAISE EXCEPTION 'CT3C_TRANSPORTADOR_INDISPONIVEL' USING ERRCODE='P0001', HINT='O veiculo transportador nao esta disponivel.';
      END IF;
      IF NOT v_sa AND NOT public.fn_ativos_can_access_equipamento((v_viagem->>'veiculo_transportador_id')::uuid, v_uid) THEN
        RAISE EXCEPTION 'CT2_SCOPE_DENIED' USING ERRCODE='P0001', HINT='Veiculo transportador fora do seu escopo.';
      END IF;
    END IF;

    IF coalesce(v_viagem->>'empresa_transportadora_id','') <> '' THEN
      SELECT em.id, em.nome_empresa INTO v_emp
        FROM public.bd_empresas em WHERE em.id = (v_viagem->>'empresa_transportadora_id')::uuid;
      IF v_emp.id IS NULL THEN
        RAISE EXCEPTION 'CT3C_EMPRESA_INVALIDA' USING ERRCODE='P0001', HINT='Empresa transportadora nao encontrada.';
      END IF;
    END IF;

    IF coalesce(v_viagem->>'origem_centro_custo_id','') <> '' THEN
      SELECT c.id, c.codigo_centro_custo, c.nome_centro_custo, c.endereco_completo, c.latitude, c.longitude
        INTO v_occ FROM public.bd_centros_custo c WHERE c.id = (v_viagem->>'origem_centro_custo_id')::uuid;
      IF v_occ.id IS NULL THEN
        RAISE EXCEPTION 'CT3C_CC_INVALIDO' USING ERRCODE='P0001', HINT='Centro de custo de origem nao encontrado.';
      END IF;
      IF NOT v_sa AND NOT public.fn_ativos_can_access_centro_custo(v_occ.id, v_uid) THEN
        RAISE EXCEPTION 'CT2_SCOPE_DENIED' USING ERRCODE='P0001', HINT='Centro de custo de origem fora do seu escopo.';
      END IF;
    END IF;

    IF coalesce(v_viagem->>'destino_centro_custo_id','') <> '' THEN
      SELECT c.id, c.codigo_centro_custo, c.nome_centro_custo, c.endereco_completo, c.latitude, c.longitude
        INTO v_dcc FROM public.bd_centros_custo c WHERE c.id = (v_viagem->>'destino_centro_custo_id')::uuid;
      IF v_dcc.id IS NULL THEN
        RAISE EXCEPTION 'CT3C_CC_INVALIDO' USING ERRCODE='P0001', HINT='Centro de custo de destino nao encontrado.';
      END IF;
      IF NOT v_sa AND NOT public.fn_ativos_can_access_centro_custo(v_dcc.id, v_uid) THEN
        RAISE EXCEPTION 'CT2_SCOPE_DENIED' USING ERRCODE='P0001', HINT='Centro de custo de destino fora do seu escopo.';
      END IF;
    END IF;

    IF coalesce(v_viagem->>'data_prevista_saida','') <> ''
       AND coalesce(v_viagem->>'data_prevista_entrega','') <> ''
       AND (v_viagem->>'data_prevista_saida')::date > (v_viagem->>'data_prevista_entrega')::date THEN
      RAISE EXCEPTION 'CT3C_DATAS_INCOERENTES' USING ERRCODE='P0001', HINT='A data de saida nao pode ser posterior a data da mobilizacao.';
    END IF;

    v_novo := coalesce(v_viagem->>'id','') = '';

    IF v_novo THEN
      IF coalesce(v_viagem->>'client_ref','') = '' THEN
        RAISE EXCEPTION 'CT3C_CLIENT_REF_OBRIGATORIO' USING ERRCODE='P0001', HINT='Referencia local da viagem ausente. Recarregue a pagina.';
      END IF;
      INSERT INTO public.bd_ct_viagens (
        solicitacao_id, planejamento_id, status, modalidade_deslocamento, tipo_transporte,
        motorista_id, motorista_nome_snapshot, motorista_cpf_snapshot,
        veiculo_transportador_id, placa_transportador_snapshot,
        empresa_transportadora_id, empresa_transportadora_nome_snapshot,
        origem_centro_custo_id, origem_cc_codigo_snapshot, origem_cc_nome_snapshot,
        origem_cc_endereco_snapshot, origem_cc_latitude_snapshot, origem_cc_longitude_snapshot,
        destino_centro_custo_id, destino_cc_codigo_snapshot, destino_cc_nome_snapshot,
        destino_cc_endereco_snapshot, destino_cc_latitude_snapshot, destino_cc_longitude_snapshot,
        data_prevista_saida, data_prevista_entrega, distancia_km, observacoes,
        responsavel_transporte, transportadora, origem_descricao, destino_descricao,
        created_by, updated_by
      ) VALUES (
        p_solicitacao_id, v_plan.id, 'RASCUNHO', v_mod, v_tipo,
        v_mot.id,
        coalesce(v_mot.nome_completo, public.fn_ct_mob_norm_texto(v_viagem->>'motorista_nome')),
        coalesce(nullif(regexp_replace(coalesce(v_mot.cpf,''),'\D','','g'),''),
                 nullif(regexp_replace(coalesce(v_viagem->>'motorista_cpf',''),'\D','','g'),'')),
        v_veic.id, coalesce(upper(v_veic.placa), upper(public.fn_ct_mob_norm_texto(v_viagem->>'placa_transportador'))),
        v_emp.id, v_emp.nome_empresa,
        v_occ.id, v_occ.codigo_centro_custo, v_occ.nome_centro_custo,
        v_occ.endereco_completo, v_occ.latitude, v_occ.longitude,
        v_dcc.id, v_dcc.codigo_centro_custo, v_dcc.nome_centro_custo,
        v_dcc.endereco_completo, v_dcc.latitude, v_dcc.longitude,
        nullif(v_viagem->>'data_prevista_saida','')::date,
        nullif(v_viagem->>'data_prevista_entrega','')::date,
        nullif(v_viagem->>'distancia_km','')::numeric,
        public.fn_ct_mob_norm_texto(v_viagem->>'observacoes'),
        coalesce(v_mot.nome_completo, public.fn_ct_mob_norm_texto(v_viagem->>'motorista_nome')),
        v_emp.nome_empresa, v_occ.nome_centro_custo, v_dcc.nome_centro_custo,
        v_uid, v_uid
      ) RETURNING id INTO v_vid;
    ELSE
      v_vid := (v_viagem->>'id')::uuid;
      UPDATE public.bd_ct_viagens SET
        modalidade_deslocamento = v_mod,
        tipo_transporte = v_tipo,
        motorista_id = v_mot.id,
        motorista_nome_snapshot = coalesce(v_mot.nome_completo, public.fn_ct_mob_norm_texto(v_viagem->>'motorista_nome')),
        motorista_cpf_snapshot = coalesce(nullif(regexp_replace(coalesce(v_mot.cpf,''),'\D','','g'),''),
                                          nullif(regexp_replace(coalesce(v_viagem->>'motorista_cpf',''),'\D','','g'),'')),
        veiculo_transportador_id = v_veic.id,
        placa_transportador_snapshot = coalesce(upper(v_veic.placa), upper(public.fn_ct_mob_norm_texto(v_viagem->>'placa_transportador'))),
        empresa_transportadora_id = v_emp.id,
        empresa_transportadora_nome_snapshot = v_emp.nome_empresa,
        origem_centro_custo_id = v_occ.id,
        origem_cc_codigo_snapshot = v_occ.codigo_centro_custo,
        origem_cc_nome_snapshot = v_occ.nome_centro_custo,
        origem_cc_endereco_snapshot = v_occ.endereco_completo,
        origem_cc_latitude_snapshot = v_occ.latitude,
        origem_cc_longitude_snapshot = v_occ.longitude,
        destino_centro_custo_id = v_dcc.id,
        destino_cc_codigo_snapshot = v_dcc.codigo_centro_custo,
        destino_cc_nome_snapshot = v_dcc.nome_centro_custo,
        destino_cc_endereco_snapshot = v_dcc.endereco_completo,
        destino_cc_latitude_snapshot = v_dcc.latitude,
        destino_cc_longitude_snapshot = v_dcc.longitude,
        data_prevista_saida = nullif(v_viagem->>'data_prevista_saida','')::date,
        data_prevista_entrega = nullif(v_viagem->>'data_prevista_entrega','')::date,
        distancia_km = nullif(v_viagem->>'distancia_km','')::numeric,
        observacoes = public.fn_ct_mob_norm_texto(v_viagem->>'observacoes'),
        responsavel_transporte = coalesce(v_mot.nome_completo, public.fn_ct_mob_norm_texto(v_viagem->>'motorista_nome')),
        transportadora = v_emp.nome_empresa,
        origem_descricao = v_occ.nome_centro_custo,
        destino_descricao = v_dcc.nome_centro_custo,
        updated_by = v_uid
      WHERE id = v_vid AND planejamento_id = v_plan.id AND status = 'RASCUNHO';
      IF NOT FOUND THEN
        RAISE EXCEPTION 'CT3C_VIAGEM_INVALIDA' USING ERRCODE='P0001', HINT='Viagem nao pertence a este rascunho.';
      END IF;
    END IF;

    v_ids := v_ids || v_vid;

    v_qtd := 0;
    FOR v_at IN SELECT (value #>> '{}')::uuid FROM jsonb_array_elements(coalesce(v_viagem->'atendimento_ids','[]'::jsonb)) LOOP
      IF v_at = ANY(v_vistos) THEN
        RAISE EXCEPTION 'CT3C_ATIVO_EM_MAIS_DE_UMA_VIAGEM' USING ERRCODE='P0001', HINT='Cada ativo reservado pode estar em apenas uma viagem.';
      END IF;
      v_vistos := v_vistos || v_at;
      v_qtd := v_qtd + 1;

      SELECT a.id, a.equipamento_id, a.status INTO v_ate
        FROM public.bd_solicitacao_item_atendimentos a
        JOIN public.bd_solicitacoes_itens si ON si.id = a.solicitacao_item_id
       WHERE a.id = v_at AND si.solicitacao_id = p_solicitacao_id FOR UPDATE OF a;
      IF v_ate.id IS NULL THEN
        RAISE EXCEPTION 'CT3C_ATENDIMENTO_INVALIDO' USING ERRCODE='P0001', HINT='Atendimento nao pertence a esta solicitacao.';
      END IF;
      IF v_ate.status NOT IN ('RESERVADO','EM_TRANSPORTE') THEN
        RAISE EXCEPTION 'CT3C_ATENDIMENTO_NAO_MOBILIZAVEL' USING ERRCODE='P0001', HINT='Somente atendimentos reservados ou em transporte podem ser mobilizados.';
      END IF;
      IF v_veic.id IS NOT NULL AND v_ate.equipamento_id = v_veic.id THEN
        RAISE EXCEPTION 'CT3C_TRANSPORTADOR_E_CARGA' USING ERRCODE='P0001', HINT='O veiculo transportador nao pode ser carga da propria viagem.';
      END IF;
    END LOOP;

    IF v_mod = 'RODANTE' AND v_qtd > 1 THEN
      RAISE EXCEPTION 'CT3C_RODANTE_UM_ATIVO' USING ERRCODE='P0001', HINT='Uma viagem rodante transporta exatamente um ativo.';
    END IF;
  END LOOP;

  UPDATE public.bd_movimentacoes SET status='CANCELADA', updated_at=now()
   WHERE planejamento_id = v_plan.id
     AND coalesce(status,'') <> 'CANCELADA'
     AND (viagem_id IS NULL OR NOT (viagem_id = ANY(v_ids)));

  UPDATE public.bd_ct_viagens SET status='CANCELADA', updated_by=v_uid
   WHERE planejamento_id = v_plan.id AND status = 'RASCUNHO'
     AND NOT (id = ANY(v_ids));

  UPDATE public.bd_movimentacoes SET status='CANCELADA', updated_at=now()
   WHERE planejamento_id = v_plan.id
     AND coalesce(status,'') <> 'CANCELADA'
     AND (atendimento_id IS NULL OR NOT (atendimento_id = ANY(v_vistos)));

  FOR v_viagem IN SELECT * FROM jsonb_array_elements(coalesce(p_payload->'viagens','[]'::jsonb)) LOOP
    IF coalesce(v_viagem->>'id','') <> '' THEN
      v_vid := (v_viagem->>'id')::uuid;
    ELSE
      SELECT vv.id INTO v_vid FROM public.bd_ct_viagens vv
       WHERE vv.planejamento_id = v_plan.id AND vv.status='RASCUNHO'
         AND vv.id = ANY(v_ids)
         AND NOT EXISTS (SELECT 1 FROM public.bd_movimentacoes mm
                          WHERE mm.viagem_id = vv.id AND coalesce(mm.status,'') <> 'CANCELADA')
       ORDER BY vv.created_at LIMIT 1;
    END IF;
    IF v_vid IS NULL THEN CONTINUE; END IF;

    FOR v_at IN SELECT (value #>> '{}')::uuid FROM jsonb_array_elements(coalesce(v_viagem->'atendimento_ids','[]'::jsonb)) LOOP
      UPDATE public.bd_movimentacoes
         SET viagem_id = v_vid, status = 'RASCUNHO', updated_at = now()
       WHERE planejamento_id = v_plan.id AND atendimento_id = v_at
         AND coalesce(status,'') <> 'CANCELADA';
      IF NOT FOUND THEN
        SELECT a.equipamento_id INTO v_ate
          FROM public.bd_solicitacao_item_atendimentos a WHERE a.id = v_at;
        INSERT INTO public.bd_movimentacoes (
          solicitacao_id, solicitacao_planejamento_id, planejamento_id, viagem_id,
          atendimento_id, equipamento_id, origem_tipo, destino_tipo, destino_id,
          status, tipo_movimentacao, created_by
        ) VALUES (
          p_solicitacao_id, v_plan.id, v_plan.id, v_vid, v_at, v_ate.equipamento_id,
          'CENTRO_CUSTO', 'CENTRO_CUSTO', v_cc_destino, 'RASCUNHO', 'MOBILIZACAO', v_uid
        );
      END IF;
    END LOOP;
  END LOOP;

  UPDATE public.bd_solicitacoes_planejamento
     SET lock_version = lock_version + 1,
         content_hash = v_content,
         updated_by = v_uid,
         updated_at = now()
   WHERE id = v_plan.id
   RETURNING * INTO v_plan;

  v_resp := jsonb_build_object('ok', true, 'replay', false, 'no_change', false,
    'planejamento_id', v_plan.id, 'versao', v_plan.versao, 'lock_version', v_plan.lock_version,
    'status', v_plan.status_planejamento, 'content_hash', v_content,
    'viagens', public.fn_ct_mob_viagens_json(v_plan.id));

  INSERT INTO public.bd_ct_comando_requests (request_id, operacao, solicitacao_id, planejamento_id, command_hash, response_json, created_by)
  VALUES (p_request_id, 'MOB_SALVAR_RASCUNHO', p_solicitacao_id, v_plan.id, v_cmd, v_resp, v_uid);

  RETURN v_resp;
END;
$function$;