-- =====================================================================
-- CT-3D — Enderecos operacionais, ponto exato, recebedor previsto e
--          ordens do motorista. Aditiva: nada de CT-3C e alterado.
-- =====================================================================

-- 1) Colunas novas em bd_ct_viagens (idempotentes)
ALTER TABLE public.bd_ct_viagens
  ADD COLUMN IF NOT EXISTS origem_endereco_operacional text,
  ADD COLUMN IF NOT EXISTS origem_ponto_exato text,
  ADD COLUMN IF NOT EXISTS origem_coleta_latitude numeric,
  ADD COLUMN IF NOT EXISTS origem_coleta_longitude numeric,
  ADD COLUMN IF NOT EXISTS destino_endereco_operacional text,
  ADD COLUMN IF NOT EXISTS destino_ponto_exato text,
  ADD COLUMN IF NOT EXISTS destino_descarga_latitude numeric,
  ADD COLUMN IF NOT EXISTS destino_descarga_longitude numeric,
  ADD COLUMN IF NOT EXISTS recebedor_previsto_funcionario_id uuid REFERENCES public.bd_funcionarios(id),
  ADD COLUMN IF NOT EXISTS recebedor_previsto_nome_snapshot text,
  ADD COLUMN IF NOT EXISTS recebedor_previsto_telefone_snapshot text;

CREATE INDEX IF NOT EXISTS idx_ct_viagens_motorista_status
  ON public.bd_ct_viagens (motorista_id, status);

-- 2) fn_ct_mob_viagens_json — expor os novos campos
CREATE OR REPLACE FUNCTION public.fn_ct_mob_viagens_json(p_planejamento_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id', v.id,
           'codigo', v.codigo,
           'status', v.status,
           'modalidade_deslocamento', v.modalidade_deslocamento,
           'tipo_transporte', v.tipo_transporte,
           'motorista_id', v.motorista_id,
           'motorista_nome_snapshot', v.motorista_nome_snapshot,
           'motorista_cpf_snapshot', v.motorista_cpf_snapshot,
           'veiculo_transportador_id', v.veiculo_transportador_id,
           'placa_transportador_snapshot', v.placa_transportador_snapshot,
           'empresa_transportadora_id', v.empresa_transportadora_id,
           'empresa_transportadora_nome_snapshot', v.empresa_transportadora_nome_snapshot,
           'origem_centro_custo_id', v.origem_centro_custo_id,
           'origem_cc_codigo_snapshot', v.origem_cc_codigo_snapshot,
           'origem_cc_nome_snapshot', v.origem_cc_nome_snapshot,
           'origem_cc_endereco_snapshot', v.origem_cc_endereco_snapshot,
           'origem_cc_latitude_snapshot', v.origem_cc_latitude_snapshot,
           'origem_cc_longitude_snapshot', v.origem_cc_longitude_snapshot,
           'origem_endereco_operacional', v.origem_endereco_operacional,
           'origem_ponto_exato', v.origem_ponto_exato,
           'origem_coleta_latitude', v.origem_coleta_latitude,
           'origem_coleta_longitude', v.origem_coleta_longitude,
           'destino_centro_custo_id', v.destino_centro_custo_id,
           'destino_cc_codigo_snapshot', v.destino_cc_codigo_snapshot,
           'destino_cc_nome_snapshot', v.destino_cc_nome_snapshot,
           'destino_cc_endereco_snapshot', v.destino_cc_endereco_snapshot,
           'destino_cc_latitude_snapshot', v.destino_cc_latitude_snapshot,
           'destino_cc_longitude_snapshot', v.destino_cc_longitude_snapshot,
           'destino_endereco_operacional', v.destino_endereco_operacional,
           'destino_ponto_exato', v.destino_ponto_exato,
           'destino_descarga_latitude', v.destino_descarga_latitude,
           'destino_descarga_longitude', v.destino_descarga_longitude,
           'recebedor_previsto_funcionario_id', v.recebedor_previsto_funcionario_id,
           'recebedor_previsto_nome_snapshot', v.recebedor_previsto_nome_snapshot,
           'recebedor_previsto_telefone_snapshot', v.recebedor_previsto_telefone_snapshot,
           'data_prevista_saida', v.data_prevista_saida,
           'data_prevista_entrega', v.data_prevista_entrega,
           'distancia_km', v.distancia_km,
           'observacoes', v.observacoes,
           'atendimento_ids', coalesce((
              SELECT jsonb_agg(m.atendimento_id ORDER BY m.atendimento_id)
                FROM public.bd_movimentacoes m
               WHERE m.viagem_id = v.id AND coalesce(m.status,'') <> 'CANCELADA'
           ), '[]'::jsonb)
         ) ORDER BY v.codigo), '[]'::jsonb)
    FROM public.bd_ct_viagens v
   WHERE v.planejamento_id = p_planejamento_id
     AND v.status <> 'CANCELADA'
$function$;

-- 3) fn_ct_mob_validar_viagem — exigir recebedor previsto ao programar
CREATE OR REPLACE FUNCTION public.fn_ct_mob_validar_viagem(p_viagem_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v public.bd_ct_viagens;
  v_qtd integer;
  v_min date;
BEGIN
  SELECT * INTO v FROM public.bd_ct_viagens WHERE id = p_viagem_id;

  SELECT count(*), min(a.periodo_inicio) INTO v_qtd, v_min
    FROM public.bd_movimentacoes m
    JOIN public.bd_solicitacao_item_atendimentos a ON a.id = m.atendimento_id
   WHERE m.viagem_id = v.id AND coalesce(m.status,'') <> 'CANCELADA';

  IF v_qtd = 0 THEN
    RAISE EXCEPTION 'CT3C_VIAGEM_SEM_ATIVOS' USING ERRCODE='P0001',
      HINT='Toda viagem precisa de ao menos um ativo.';
  END IF;
  IF v.modalidade_deslocamento IS NULL THEN
    RAISE EXCEPTION 'CT3C_MODALIDADE_INVALIDA' USING ERRCODE='P0001',
      HINT='Escolha a modalidade da viagem: rodante ou transportado.';
  END IF;
  IF v.data_prevista_entrega IS NULL THEN
    RAISE EXCEPTION 'CT3C_DATA_MOBILIZACAO_OBRIGATORIA' USING ERRCODE='P0001',
      HINT='Informe a data programada da mobilizacao em todas as viagens.';
  END IF;
  IF v.data_prevista_saida IS NOT NULL AND v.data_prevista_saida > v.data_prevista_entrega THEN
    RAISE EXCEPTION 'CT3C_DATAS_INCOERENTES' USING ERRCODE='P0001',
      HINT='A data de saida nao pode ser posterior a data da mobilizacao.';
  END IF;
  IF v_min IS NOT NULL AND v.data_prevista_entrega > v_min THEN
    RAISE EXCEPTION 'CT3C_ENTREGA_APOS_PERIODO' USING ERRCODE='P0001',
      HINT='A data da mobilizacao deve ser anterior ou igual ao inicio do periodo reservado.';
  END IF;
  IF v.origem_centro_custo_id IS NULL OR v.destino_centro_custo_id IS NULL THEN
    RAISE EXCEPTION 'CT3C_ORIGEM_DESTINO_OBRIGATORIOS' USING ERRCODE='P0001',
      HINT='Informe o centro de custo de origem e de destino.';
  END IF;

  -- CT-3D: identificacao operacional de origem e destino
  IF coalesce(btrim(v.origem_endereco_operacional),'') = ''
     AND coalesce(btrim(v.origem_cc_endereco_snapshot),'') = ''
     AND coalesce(btrim(v.origem_ponto_exato),'') = ''
     AND v.origem_coleta_latitude IS NULL THEN
    RAISE EXCEPTION 'CT3D_ORIGEM_NAO_IDENTIFICAVEL' USING ERRCODE='P0001',
      HINT='Informe o endereco operacional ou o ponto exato de coleta da origem.';
  END IF;
  IF coalesce(btrim(v.destino_endereco_operacional),'') = ''
     AND coalesce(btrim(v.destino_cc_endereco_snapshot),'') = ''
     AND coalesce(btrim(v.destino_ponto_exato),'') = ''
     AND v.destino_descarga_latitude IS NULL THEN
    RAISE EXCEPTION 'CT3D_DESTINO_NAO_IDENTIFICAVEL' USING ERRCODE='P0001',
      HINT='Informe o endereco operacional ou o ponto exato de descarga do destino.';
  END IF;
  IF coalesce(btrim(v.recebedor_previsto_nome_snapshot),'') = '' THEN
    RAISE EXCEPTION 'CT3D_RECEBEDOR_OBRIGATORIO' USING ERRCODE='P0001',
      HINT='Informe o recebedor previsto da viagem.';
  END IF;

  IF v.modalidade_deslocamento = 'RODANTE' THEN
    IF v_qtd <> 1 THEN
      RAISE EXCEPTION 'CT3C_RODANTE_UM_ATIVO' USING ERRCODE='P0001',
        HINT='Uma viagem rodante transporta exatamente um ativo.';
    END IF;
    IF v.motorista_id IS NULL THEN
      RAISE EXCEPTION 'CT3C_MOTORISTA_OBRIGATORIO' USING ERRCODE='P0001',
        HINT='Informe o motorista ou operador da viagem rodante.';
    END IF;
  ELSE
    IF v.tipo_transporte = 'PROPRIO' THEN
      IF v.veiculo_transportador_id IS NULL OR v.motorista_id IS NULL THEN
        RAISE EXCEPTION 'CT3C_TRANSPORTE_PROPRIO_INCOMPLETO' USING ERRCODE='P0001',
          HINT='Transporte proprio exige veiculo transportador e motorista.';
      END IF;
    ELSIF v.tipo_transporte = 'TERCEIRO' THEN
      IF v.empresa_transportadora_id IS NULL
         OR coalesce(btrim(v.placa_transportador_snapshot),'') = ''
         OR coalesce(btrim(v.motorista_nome_snapshot),'') = '' THEN
        RAISE EXCEPTION 'CT3C_TRANSPORTE_TERCEIRO_INCOMPLETO' USING ERRCODE='P0001',
          HINT='Transporte de terceiro exige transportadora, placa e nome do motorista.';
      END IF;
    ELSE
      RAISE EXCEPTION 'CT3C_TIPO_TRANSPORTE_INVALIDO' USING ERRCODE='P0001',
        HINT='Informe se o transporte e proprio ou de terceiro.';
    END IF;
  END IF;
END;
$function$;

-- 4) fn_ct_mobilizacao_salvar_rascunho — persistir os campos CT-3D
CREATE OR REPLACE FUNCTION public.fn_ct_mobilizacao_salvar_rascunho(p_solicitacao_id uuid, p_planejamento_id uuid, p_versao_esperada integer, p_payload jsonb, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_rec record;
  v_cc_destino uuid;
  v_vistos uuid[] := '{}';
  v_mod text;
  v_tipo text;
  v_qtd integer;
  v_novo boolean;
  v_o_end text; v_o_ponto text; v_o_lat numeric; v_o_lng numeric;
  v_d_end text; v_d_ponto text; v_d_lat numeric; v_d_lng numeric;
  v_rec_nome text; v_rec_fone text;
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

    v_mot := NULL; v_veic := NULL; v_emp := NULL; v_occ := NULL; v_dcc := NULL; v_rec := NULL;

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

    -- CT-3D: enderecos operacionais e pontos exatos (texto livre do cliente)
    v_o_end   := public.fn_ct_mob_norm_texto(v_viagem->>'origem_endereco_operacional');
    v_o_ponto := public.fn_ct_mob_norm_texto(v_viagem->>'origem_ponto_exato');
    v_o_lat   := nullif(v_viagem->>'origem_coleta_latitude','')::numeric;
    v_o_lng   := nullif(v_viagem->>'origem_coleta_longitude','')::numeric;
    v_d_end   := public.fn_ct_mob_norm_texto(v_viagem->>'destino_endereco_operacional');
    v_d_ponto := public.fn_ct_mob_norm_texto(v_viagem->>'destino_ponto_exato');
    v_d_lat   := nullif(v_viagem->>'destino_descarga_latitude','')::numeric;
    v_d_lng   := nullif(v_viagem->>'destino_descarga_longitude','')::numeric;

    IF (v_o_lat IS NULL) <> (v_o_lng IS NULL) OR (v_d_lat IS NULL) <> (v_d_lng IS NULL) THEN
      RAISE EXCEPTION 'CT3D_COORDENADA_INCOMPLETA' USING ERRCODE='P0001',
        HINT='Informe latitude e longitude juntas ao ajustar o ponto no mapa.';
    END IF;
    IF (v_o_lat IS NOT NULL AND (v_o_lat < -90 OR v_o_lat > 90 OR v_o_lng < -180 OR v_o_lng > 180))
       OR (v_d_lat IS NOT NULL AND (v_d_lat < -90 OR v_d_lat > 90 OR v_d_lng < -180 OR v_d_lng > 180)) THEN
      RAISE EXCEPTION 'CT3D_COORDENADA_INVALIDA' USING ERRCODE='P0001',
        HINT='Coordenada fora do intervalo valido.';
    END IF;

    -- endereco operacional nasce do snapshot do CC quando nao informado
    v_o_end := coalesce(nullif(v_o_end,''), v_occ.endereco_completo);
    v_d_end := coalesce(nullif(v_d_end,''), v_dcc.endereco_completo);

    -- CT-3D: recebedor previsto (snapshot resolvido no servidor)
    IF coalesce(v_viagem->>'recebedor_previsto_funcionario_id','') <> '' THEN
      SELECT f.id, f.nome_completo INTO v_rec
        FROM public.bd_funcionarios f WHERE f.id = (v_viagem->>'recebedor_previsto_funcionario_id')::uuid;
      IF v_rec.id IS NULL THEN
        RAISE EXCEPTION 'CT3D_RECEBEDOR_INVALIDO' USING ERRCODE='P0001', HINT='Recebedor previsto nao encontrado.';
      END IF;
      v_rec_nome := v_rec.nome_completo;
    ELSE
      v_rec_nome := nullif(public.fn_ct_mob_norm_texto(v_viagem->>'recebedor_previsto_nome'),'');
    END IF;
    v_rec_fone := nullif(public.fn_ct_mob_norm_texto(v_viagem->>'recebedor_previsto_telefone'),'');

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
        origem_endereco_operacional, origem_ponto_exato, origem_coleta_latitude, origem_coleta_longitude,
        destino_centro_custo_id, destino_cc_codigo_snapshot, destino_cc_nome_snapshot,
        destino_cc_endereco_snapshot, destino_cc_latitude_snapshot, destino_cc_longitude_snapshot,
        destino_endereco_operacional, destino_ponto_exato, destino_descarga_latitude, destino_descarga_longitude,
        recebedor_previsto_funcionario_id, recebedor_previsto_nome_snapshot, recebedor_previsto_telefone_snapshot,
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
        v_o_end, v_o_ponto, v_o_lat, v_o_lng,
        v_dcc.id, v_dcc.codigo_centro_custo, v_dcc.nome_centro_custo,
        v_dcc.endereco_completo, v_dcc.latitude, v_dcc.longitude,
        v_d_end, v_d_ponto, v_d_lat, v_d_lng,
        v_rec.id, v_rec_nome, v_rec_fone,
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
        origem_endereco_operacional = v_o_end,
        origem_ponto_exato = v_o_ponto,
        origem_coleta_latitude = v_o_lat,
        origem_coleta_longitude = v_o_lng,
        destino_centro_custo_id = v_dcc.id,
        destino_cc_codigo_snapshot = v_dcc.codigo_centro_custo,
        destino_cc_nome_snapshot = v_dcc.nome_centro_custo,
        destino_cc_endereco_snapshot = v_dcc.endereco_completo,
        destino_cc_latitude_snapshot = v_dcc.latitude,
        destino_cc_longitude_snapshot = v_dcc.longitude,
        destino_endereco_operacional = v_d_end,
        destino_ponto_exato = v_d_ponto,
        destino_descarga_latitude = v_d_lat,
        destino_descarga_longitude = v_d_lng,
        recebedor_previsto_funcionario_id = v_rec.id,
        recebedor_previsto_nome_snapshot = v_rec_nome,
        recebedor_previsto_telefone_snapshot = v_rec_fone,
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

-- 5) Ordens do motorista — leitura fail-closed
CREATE OR REPLACE FUNCTION public.fn_ct_motorista_ordens_listar(p_data_inicio date DEFAULT NULL, p_data_fim date DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_func uuid;
  v_sa boolean;
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT2_AUTH_REQUIRED' USING ERRCODE='P0001', HINT='Sessao expirada. Entre novamente para continuar.';
  END IF;

  v_sa := public.fn_is_super_admin(v_uid);
  IF NOT v_sa AND NOT public.user_has_permission_action(v_uid,'gestao_maquinas_minhas_mobilizacoes_view','visualizar') THEN
    RAISE EXCEPTION 'CT2_FORBIDDEN' USING ERRCODE='P0001', HINT='Sem permissao para consultar suas mobilizacoes.';
  END IF;

  v_func := public.fn_ativos_profile_funcionario_id(v_uid);
  IF v_func IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'vinculo_funcionario', false, 'hoje', v_hoje, 'ordens', '[]'::jsonb);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'vinculo_funcionario', true,
    'hoje', v_hoje,
    'ordens', coalesce((
      SELECT jsonb_agg(x ORDER BY x->>'data_ordem' NULLS LAST, x->>'codigo')
        FROM (
          SELECT jsonb_build_object(
                   'id', v.id,
                   'codigo', v.codigo,
                   'status', v.status,
                   'data_ordem', coalesce(v.data_prevista_saida, v.data_prevista_entrega),
                   'data_prevista_saida', v.data_prevista_saida,
                   'data_prevista_entrega', v.data_prevista_entrega,
                   'modalidade_deslocamento', v.modalidade_deslocamento,
                   'tipo_transporte', v.tipo_transporte,
                   'motorista_nome_snapshot', v.motorista_nome_snapshot,
                   'placa_transportador_snapshot', v.placa_transportador_snapshot,
                   'empresa_transportadora_nome_snapshot', v.empresa_transportadora_nome_snapshot,
                   'origem_cc_nome_snapshot', v.origem_cc_nome_snapshot,
                   'origem_endereco', coalesce(v.origem_endereco_operacional, v.origem_cc_endereco_snapshot),
                   'origem_ponto_exato', v.origem_ponto_exato,
                   'origem_latitude', coalesce(v.origem_coleta_latitude, v.origem_cc_latitude_snapshot),
                   'origem_longitude', coalesce(v.origem_coleta_longitude, v.origem_cc_longitude_snapshot),
                   'destino_cc_nome_snapshot', v.destino_cc_nome_snapshot,
                   'destino_endereco', coalesce(v.destino_endereco_operacional, v.destino_cc_endereco_snapshot),
                   'destino_ponto_exato', v.destino_ponto_exato,
                   'destino_latitude', coalesce(v.destino_descarga_latitude, v.destino_cc_latitude_snapshot),
                   'destino_longitude', coalesce(v.destino_descarga_longitude, v.destino_cc_longitude_snapshot),
                   'distancia_km', v.distancia_km,
                   'recebedor_previsto_nome', v.recebedor_previsto_nome_snapshot,
                   'recebedor_previsto_telefone', v.recebedor_previsto_telefone_snapshot,
                   'observacoes', v.observacoes,
                   'cargas', coalesce((
                      SELECT jsonb_agg(jsonb_build_object(
                               'equipamento_id', e.id,
                               'frota', e.frota,
                               'numero_frota', e.numero_frota,
                               'placa', e.placa
                             ) ORDER BY e.frota NULLS LAST, e.numero_frota NULLS LAST)
                        FROM public.bd_movimentacoes m
                        JOIN public.bd_caminhoes_equipamentos e ON e.id = m.equipamento_id
                       WHERE m.viagem_id = v.id AND coalesce(m.status,'') <> 'CANCELADA'
                   ), '[]'::jsonb)
                 ) AS x
            FROM public.bd_ct_viagens v
           WHERE v.motorista_id = v_func
             AND v.status IN ('PROGRAMADA','EM_TRANSITO','CONCLUIDA')
             AND (p_data_inicio IS NULL
                  OR coalesce(v.data_prevista_saida, v.data_prevista_entrega) >= p_data_inicio)
             AND (p_data_fim IS NULL
                  OR coalesce(v.data_prevista_saida, v.data_prevista_entrega) <= p_data_fim)
        ) s
    ), '[]'::jsonb)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_ct_motorista_ordem_detalhe(p_viagem_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_func uuid;
  v_sa boolean;
  v public.bd_ct_viagens;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT2_AUTH_REQUIRED' USING ERRCODE='P0001', HINT='Sessao expirada. Entre novamente para continuar.';
  END IF;
  IF p_viagem_id IS NULL THEN
    RAISE EXCEPTION 'CT2_PARAMETROS_INVALIDOS' USING ERRCODE='P0001', HINT='Ordem obrigatoria.';
  END IF;

  v_sa := public.fn_is_super_admin(v_uid);
  IF NOT v_sa AND NOT public.user_has_permission_action(v_uid,'gestao_maquinas_minhas_mobilizacoes_view','visualizar') THEN
    RAISE EXCEPTION 'CT2_FORBIDDEN' USING ERRCODE='P0001', HINT='Sem permissao para consultar suas mobilizacoes.';
  END IF;

  v_func := public.fn_ativos_profile_funcionario_id(v_uid);

  SELECT * INTO v FROM public.bd_ct_viagens WHERE id = p_viagem_id;
  IF v.id IS NULL
     OR v.status NOT IN ('PROGRAMADA','EM_TRANSITO','CONCLUIDA')
     OR (NOT v_sa AND (v_func IS NULL OR v.motorista_id IS DISTINCT FROM v_func)) THEN
    RAISE EXCEPTION 'CT3D_ORDEM_NAO_DISPONIVEL' USING ERRCODE='P0001',
      HINT='Ordem nao encontrada entre as suas mobilizacoes.';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'ordem', jsonb_build_object(
      'id', v.id,
      'codigo', v.codigo,
      'status', v.status,
      'data_ordem', coalesce(v.data_prevista_saida, v.data_prevista_entrega),
      'data_prevista_saida', v.data_prevista_saida,
      'data_prevista_entrega', v.data_prevista_entrega,
      'modalidade_deslocamento', v.modalidade_deslocamento,
      'tipo_transporte', v.tipo_transporte,
      'motorista_nome_snapshot', v.motorista_nome_snapshot,
      'placa_transportador_snapshot', v.placa_transportador_snapshot,
      'empresa_transportadora_nome_snapshot', v.empresa_transportadora_nome_snapshot,
      'origem_cc_nome_snapshot', v.origem_cc_nome_snapshot,
      'origem_endereco', coalesce(v.origem_endereco_operacional, v.origem_cc_endereco_snapshot),
      'origem_ponto_exato', v.origem_ponto_exato,
      'origem_latitude', coalesce(v.origem_coleta_latitude, v.origem_cc_latitude_snapshot),
      'origem_longitude', coalesce(v.origem_coleta_longitude, v.origem_cc_longitude_snapshot),
      'destino_cc_nome_snapshot', v.destino_cc_nome_snapshot,
      'destino_endereco', coalesce(v.destino_endereco_operacional, v.destino_cc_endereco_snapshot),
      'destino_ponto_exato', v.destino_ponto_exato,
      'destino_latitude', coalesce(v.destino_descarga_latitude, v.destino_cc_latitude_snapshot),
      'destino_longitude', coalesce(v.destino_descarga_longitude, v.destino_cc_longitude_snapshot),
      'distancia_km', v.distancia_km,
      'recebedor_previsto_nome', v.recebedor_previsto_nome_snapshot,
      'recebedor_previsto_telefone', v.recebedor_previsto_telefone_snapshot,
      'observacoes', v.observacoes,
      'cargas', coalesce((
         SELECT jsonb_agg(jsonb_build_object(
                  'equipamento_id', e.id, 'frota', e.frota,
                  'numero_frota', e.numero_frota, 'placa', e.placa
                ) ORDER BY e.frota NULLS LAST, e.numero_frota NULLS LAST)
           FROM public.bd_movimentacoes m
           JOIN public.bd_caminhoes_equipamentos e ON e.id = m.equipamento_id
          WHERE m.viagem_id = v.id AND coalesce(m.status,'') <> 'CANCELADA'
      ), '[]'::jsonb)
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_ct_motorista_ordens_listar(date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_ct_motorista_ordem_detalhe(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_ct_motorista_ordens_listar(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ct_motorista_ordem_detalhe(uuid) TO authenticated;

-- 6) RBAC — permissao dedicada da pagina do motorista
ALTER TABLE public.bd_permissions DISABLE TRIGGER USER;
ALTER TABLE public.bd_permissoes_acoes DISABLE TRIGGER USER;

INSERT INTO public.bd_permissions (codigo, nome, descricao, rota, modulo, tipo, ativo)
VALUES ('gestao_maquinas_minhas_mobilizacoes_view', 'Minhas mobilizações',
        'Visualizar as próprias ordens de mobilização atribuídas ao funcionário vinculado ao usuário.',
        '/minhas-mobilizacoes', 'operacional', 'page', true)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.bd_permissoes_acoes (permission_id, acao, descricao)
SELECT p.id, 'visualizar', 'Visualizar as próprias ordens de mobilização'
  FROM public.bd_permissions p
 WHERE p.codigo = 'gestao_maquinas_minhas_mobilizacoes_view'
   AND NOT EXISTS (
     SELECT 1 FROM public.bd_permissoes_acoes a
      WHERE a.permission_id = p.id AND a.acao = 'visualizar'
   );

ALTER TABLE public.bd_permissoes_acoes ENABLE TRIGGER USER;
ALTER TABLE public.bd_permissions ENABLE TRIGGER USER;