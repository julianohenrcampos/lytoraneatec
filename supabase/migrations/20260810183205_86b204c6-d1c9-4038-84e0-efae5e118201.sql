-- ============================================================================
-- CT-4 · MOVIMENTAÇÃO DIRETA + VIAGEM MULTIPARADAS (aditivo, retrocompatível)
-- ============================================================================

-- 1) Discriminador de origem -------------------------------------------------
ALTER TABLE public.bd_ct_viagens
  ADD COLUMN IF NOT EXISTS origem_fluxo text NOT NULL DEFAULT 'SOLICITACAO';
ALTER TABLE public.bd_ct_viagens ALTER COLUMN solicitacao_id DROP NOT NULL;

ALTER TABLE public.bd_ct_viagens DROP CONSTRAINT IF EXISTS ck_ct_viagens_origem_fluxo;
ALTER TABLE public.bd_ct_viagens ADD CONSTRAINT ck_ct_viagens_origem_fluxo
  CHECK (origem_fluxo IN ('SOLICITACAO','MOVIMENTACAO_DIRETA'));

ALTER TABLE public.bd_ct_viagens DROP CONSTRAINT IF EXISTS ck_ct_viagens_origem_coerencia;
ALTER TABLE public.bd_ct_viagens ADD CONSTRAINT ck_ct_viagens_origem_coerencia
  CHECK ((origem_fluxo = 'SOLICITACAO' AND solicitacao_id IS NOT NULL)
      OR (origem_fluxo = 'MOVIMENTACAO_DIRETA' AND solicitacao_id IS NULL));

ALTER TABLE public.bd_movimentacoes
  ADD COLUMN IF NOT EXISTS origem_fluxo text NOT NULL DEFAULT 'SOLICITACAO';
ALTER TABLE public.bd_movimentacoes ALTER COLUMN solicitacao_id DROP NOT NULL;

ALTER TABLE public.bd_movimentacoes DROP CONSTRAINT IF EXISTS ck_movimentacoes_origem_fluxo;
ALTER TABLE public.bd_movimentacoes ADD CONSTRAINT ck_movimentacoes_origem_fluxo
  CHECK (origem_fluxo IN ('SOLICITACAO','MOVIMENTACAO_DIRETA'));

ALTER TABLE public.bd_movimentacoes DROP CONSTRAINT IF EXISTS ck_movimentacoes_origem_coerencia;
ALTER TABLE public.bd_movimentacoes ADD CONSTRAINT ck_movimentacoes_origem_coerencia
  CHECK ((origem_fluxo = 'SOLICITACAO' AND solicitacao_id IS NOT NULL)
      OR (origem_fluxo = 'MOVIMENTACAO_DIRETA' AND solicitacao_id IS NULL));

-- ledger de idempotência compartilhado (sem solicitação na origem direta)
ALTER TABLE public.bd_ct_comando_requests ALTER COLUMN solicitacao_id DROP NOT NULL;

-- 2) Paradas da viagem -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bd_ct_viagem_paradas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  viagem_id uuid NOT NULL REFERENCES public.bd_ct_viagens(id) ON DELETE CASCADE,
  ordem integer NOT NULL CHECK (ordem >= 1),
  centro_custo_id uuid NOT NULL REFERENCES public.bd_centros_custo(id),
  cc_codigo_snapshot text,
  cc_nome_snapshot text,
  endereco_snapshot text,
  ponto_exato text,
  latitude numeric,
  longitude numeric,
  data_prevista date,
  hora_prevista time,
  observacao text,
  recebedor_previsto_funcionario_id uuid REFERENCES public.bd_funcionarios(id),
  recebedor_previsto_nome_snapshot text,
  status text NOT NULL DEFAULT 'PENDENTE'
    CHECK (status IN ('PENDENTE','CHEGADA_REGISTRADA','CONCLUIDA','CANCELADA')),
  chegada_registrada_em timestamptz,
  chegada_registrada_por uuid,
  concluida_em timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.bd_ct_viagem_paradas TO authenticated;
GRANT ALL ON public.bd_ct_viagem_paradas TO service_role;
ALTER TABLE public.bd_ct_viagem_paradas ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ct_paradas_viagem_ordem
  ON public.bd_ct_viagem_paradas (viagem_id, ordem);
CREATE INDEX IF NOT EXISTS ix_ct_paradas_viagem
  ON public.bd_ct_viagem_paradas (viagem_id, ordem);

DROP POLICY IF EXISTS ct_paradas_select_escopo ON public.bd_ct_viagem_paradas;
CREATE POLICY ct_paradas_select_escopo ON public.bd_ct_viagem_paradas
  FOR SELECT TO authenticated USING (public.fn_ct_pode_ver_viagem(viagem_id));

DROP TRIGGER IF EXISTS trg_ct_paradas_touch ON public.bd_ct_viagem_paradas;
CREATE TRIGGER trg_ct_paradas_touch BEFORE UPDATE ON public.bd_ct_viagem_paradas
  FOR EACH ROW EXECUTE FUNCTION public.fn_ct_touch_updated_at();

-- 3) Vínculo equipamento -> parada e unicidade por viagem --------------------
ALTER TABLE public.bd_movimentacoes
  ADD COLUMN IF NOT EXISTS parada_id uuid REFERENCES public.bd_ct_viagem_paradas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ix_movimentacoes_parada ON public.bd_movimentacoes (parada_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_movimentacao_viagem_equipamento_ativa
  ON public.bd_movimentacoes (viagem_id, equipamento_id)
  WHERE viagem_id IS NOT NULL AND equipamento_id IS NOT NULL
    AND COALESCE(status,'') <> 'CANCELADA';

-- 4) Recebimento por parada (aditivo) ----------------------------------------
ALTER TABLE public.bd_ct_recebimentos
  ADD COLUMN IF NOT EXISTS parada_id uuid REFERENCES public.bd_ct_viagem_paradas(id) ON DELETE CASCADE;

DROP INDEX IF EXISTS public.uq_ct_recebimentos_viagem;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ct_recebimentos_viagem_sem_parada
  ON public.bd_ct_recebimentos (viagem_id) WHERE parada_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ct_recebimentos_parada
  ON public.bd_ct_recebimentos (parada_id) WHERE parada_id IS NOT NULL;

-- 5) Visibilidade -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_ct_pode_ver_viagem(p_viagem_id uuid, p_user uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_func uuid; r record;
BEGIN
  IF p_user IS NULL OR p_viagem_id IS NULL THEN RETURN false; END IF;
  IF public.fn_is_super_admin(p_user) THEN RETURN true; END IF;

  SELECT motorista_id, recebedor_previsto_funcionario_id,
         origem_centro_custo_id, destino_centro_custo_id
    INTO r FROM public.bd_ct_viagens WHERE id = p_viagem_id;
  IF NOT FOUND THEN RETURN false; END IF;

  v_func := public.fn_ativos_profile_funcionario_id(p_user);
  IF v_func IS NOT NULL AND (v_func = r.motorista_id
        OR v_func = r.recebedor_previsto_funcionario_id
        OR EXISTS (SELECT 1 FROM public.bd_ct_viagem_paradas pp
                    WHERE pp.viagem_id = p_viagem_id
                      AND pp.recebedor_previsto_funcionario_id = v_func)) THEN
    RETURN true;
  END IF;

  IF public.user_has_permission_action(p_user,'gestao_maquinas_central_transporte_view','visualizar') THEN
    IF (r.destino_centro_custo_id IS NOT NULL
        AND public.fn_ativos_can_access_centro_custo(r.destino_centro_custo_id, p_user))
       OR (r.origem_centro_custo_id IS NOT NULL
        AND public.fn_ativos_can_access_centro_custo(r.origem_centro_custo_id, p_user))
       OR EXISTS (SELECT 1 FROM public.bd_ct_viagem_paradas pp
                   WHERE pp.viagem_id = p_viagem_id
                     AND public.fn_ativos_can_access_centro_custo(pp.centro_custo_id, p_user)) THEN
      RETURN true;
    END IF;
  END IF;
  RETURN false;
END $$;

DROP POLICY IF EXISTS ct_viagens_select_scoped ON public.bd_ct_viagens;
CREATE POLICY ct_viagens_select_scoped ON public.bd_ct_viagens
  FOR SELECT TO authenticated USING (
    (solicitacao_id IS NOT NULL AND public.fn_ativos_can_access_solicitacao(solicitacao_id))
    OR (origem_fluxo = 'MOVIMENTACAO_DIRETA' AND public.fn_ct_pode_ver_viagem(id))
  );

DROP POLICY IF EXISTS ct_viagens_insert_scoped ON public.bd_ct_viagens;
CREATE POLICY ct_viagens_insert_scoped ON public.bd_ct_viagens
  FOR INSERT TO authenticated WITH CHECK (
    solicitacao_id IS NOT NULL AND public.fn_ativos_can_access_solicitacao(solicitacao_id)
  );

DROP POLICY IF EXISTS ct_viagens_update_scoped ON public.bd_ct_viagens;
CREATE POLICY ct_viagens_update_scoped ON public.bd_ct_viagens
  FOR UPDATE TO authenticated
  USING (solicitacao_id IS NOT NULL AND public.fn_ativos_can_access_solicitacao(solicitacao_id))
  WITH CHECK (solicitacao_id IS NOT NULL AND public.fn_ativos_can_access_solicitacao(solicitacao_id));

DROP POLICY IF EXISTS movimentacoes_ct_select_scoped ON public.bd_movimentacoes;
CREATE POLICY movimentacoes_ct_select_scoped ON public.bd_movimentacoes
  FOR SELECT TO authenticated USING (
    (solicitacao_id IS NOT NULL AND public.fn_ativos_can_access_solicitacao(solicitacao_id))
    OR (viagem_id IS NOT NULL AND public.fn_ct_pode_ver_viagem(viagem_id))
  );

-- 6) JSON da viagem: origem + paradas ----------------------------------------
CREATE OR REPLACE FUNCTION public.fn_ct_viagem_paradas_json(p_viagem_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
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
$$;
REVOKE ALL ON FUNCTION public.fn_ct_viagem_paradas_json(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_ct_viagem_paradas_json(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_ct_viagem_json(p_viagem_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
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
    'placa_transportador_snapshot', v.placa_transportador_snapshot,
    'empresa_transportadora_nome_snapshot', v.empresa_transportadora_nome_snapshot,
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
$$;
REVOKE ALL ON FUNCTION public.fn_ct_viagem_json(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_ct_viagem_json(uuid) TO authenticated, service_role;

-- 7) Minhas Mobilizações: motor único, com origem e paradas ------------------
CREATE OR REPLACE FUNCTION public.fn_ct_motorista_ordens_listar(
  p_data_inicio date DEFAULT NULL, p_data_fim date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_uid uuid := auth.uid(); v_func uuid; v_sa boolean;
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
    'ok', true, 'vinculo_funcionario', true, 'hoje', v_hoje,
    'ordens', coalesce((
      SELECT jsonb_agg(x ORDER BY x->>'data_ordem' NULLS LAST, x->>'codigo')
        FROM (
          SELECT public.fn_ct_viagem_json(v.id)
                 || jsonb_build_object(
                      'distancia_rota_km', v.distancia_rota_km,
                      'distancia_operacional_km', v.distancia_operacional_km,
                      'distancia_regra_aplicada', v.distancia_regra_aplicada,
                      'duracao_rota_min', v.duracao_rota_min,
                      'rota_resumo', v.rota_resumo) AS x
            FROM public.bd_ct_viagens v
           WHERE v.motorista_id = v_func
             AND v.status IN ('PROGRAMADA','EM_TRANSITO','AGUARDANDO_RECEBIMENTO','CONCLUIDA')
             AND (p_data_inicio IS NULL
                  OR coalesce(v.data_prevista_saida, v.data_prevista_entrega) >= p_data_inicio)
             AND (p_data_fim IS NULL
                  OR coalesce(v.data_prevista_saida, v.data_prevista_entrega) <= p_data_fim)
        ) s
    ), '[]'::jsonb)
  );
END $$;
REVOKE ALL ON FUNCTION public.fn_ct_motorista_ordens_listar(date,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_ct_motorista_ordens_listar(date,date) TO authenticated;

-- 8) Ativos elegíveis para movimentação direta (fail-closed) -----------------
CREATE OR REPLACE FUNCTION public.fn_ct_ativos_movimentacao_listar(
  p_termo text DEFAULT NULL, p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT4_AUTH_REQUIRED' USING ERRCODE='P0001', HINT='Sessao expirada. Entre novamente.';
  END IF;
  IF NOT public.fn_ct_cap_admin(v_uid) THEN
    RAISE EXCEPTION 'CT4_FORBIDDEN' USING ERRCODE='P0001', HINT='Sem permissao na Central do Transporte.';
  END IF;

  RETURN jsonb_build_object('ok', true, 'ativos', coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'equipamento_id', e.id,
             'frota', e.frota,
             'numero_frota', e.numero_frota,
             'placa', e.placa,
             'tipo_ativo', e.tipo_ativo,
             'modelo', e.modelo,
             'centro_custo_id', e.centro_custo_atual_id,
             'centro_custo_label', cc.codigo_centro_custo || ' — ' || cc.nome_centro_custo,
             'status_operacional', coalesce(d.status_operacional,'SEM_REGISTRO'),
             'possui_registro', (d.status_operacional IS NOT NULL),
             'compromisso_viagem', cmp.codigo,
             'elegivel', (d.status_operacional IN ('DISPONIVEL','ALOCADO') AND cmp.codigo IS NULL),
             'bloqueio_motivo', CASE
                WHEN d.status_operacional IS NULL THEN 'Sem registro de disponibilidade'
                WHEN d.status_operacional NOT IN ('DISPONIVEL','ALOCADO') THEN 'Ativo ' || d.status_operacional
                WHEN cmp.codigo IS NOT NULL THEN 'Comprometido na viagem ' || cmp.codigo
                ELSE NULL END
           ) ORDER BY e.frota NULLS LAST, e.numero_frota NULLS LAST)
      FROM public.bd_caminhoes_equipamentos e
      LEFT JOIN public.bd_centros_custo cc ON cc.id = e.centro_custo_atual_id
      LEFT JOIN LATERAL (
        SELECT dd.status_operacional FROM public.bd_disponibilidade_equipamentos dd
         WHERE dd.equipamento_id = e.id
         ORDER BY dd.data_inicio DESC NULLS LAST, dd.created_at DESC LIMIT 1
      ) d ON true
      LEFT JOIN LATERAL (
        SELECT vv.codigo FROM public.bd_movimentacoes mm
          JOIN public.bd_ct_viagens vv ON vv.id = mm.viagem_id
         WHERE mm.equipamento_id = e.id
           AND coalesce(mm.status,'') NOT IN ('CANCELADA','CONCLUIDA')
           AND vv.status IN ('PROGRAMADA','EM_TRANSITO','AGUARDANDO_RECEBIMENTO')
         LIMIT 1
      ) cmp ON true
     WHERE (p_termo IS NULL OR p_termo = ''
            OR upper(coalesce(e.frota,'') || coalesce(e.numero_frota,'') || coalesce(e.placa,'')
               || coalesce(e.modelo,'')) LIKE '%' || upper(p_termo) || '%')
       AND (public.fn_is_super_admin(v_uid)
            OR e.centro_custo_atual_id IS NULL
            OR public.fn_ativos_can_access_centro_custo(e.centro_custo_atual_id, v_uid))
     LIMIT greatest(1, least(coalesce(p_limit,100), 300))
  ), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.fn_ct_ativos_movimentacao_listar(text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_ct_ativos_movimentacao_listar(text,integer) TO authenticated;

-- 9) Listagem das movimentações diretas --------------------------------------
CREATE OR REPLACE FUNCTION public.fn_ct_mov_direta_listar(p_status text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT4_AUTH_REQUIRED' USING ERRCODE='P0001', HINT='Sessao expirada. Entre novamente.';
  END IF;
  IF NOT public.fn_ct_cap_admin(v_uid) THEN
    RAISE EXCEPTION 'CT4_FORBIDDEN' USING ERRCODE='P0001', HINT='Sem permissao na Central do Transporte.';
  END IF;
  RETURN jsonb_build_object('ok', true, 'viagens', coalesce((
    SELECT jsonb_agg(public.fn_ct_viagem_json(v.id) ORDER BY v.created_at DESC)
      FROM public.bd_ct_viagens v
     WHERE v.origem_fluxo = 'MOVIMENTACAO_DIRETA'
       AND (p_status IS NULL OR v.status = p_status)
       AND public.fn_ct_pode_ver_viagem(v.id, v_uid)
  ), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.fn_ct_mov_direta_listar(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_ct_mov_direta_listar(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_ct_mov_direta_estado(p_viagem_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT4_AUTH_REQUIRED' USING ERRCODE='P0001', HINT='Sessao expirada. Entre novamente.';
  END IF;
  IF NOT public.fn_ct_pode_ver_viagem(p_viagem_id, v_uid) THEN
    RAISE EXCEPTION 'CT4_FORBIDDEN' USING ERRCODE='P0001', HINT='Sem acesso a esta movimentacao.';
  END IF;
  RETURN jsonb_build_object('ok', true, 'viagem', public.fn_ct_viagem_json(p_viagem_id));
END $$;
REVOKE ALL ON FUNCTION public.fn_ct_mov_direta_estado(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_ct_mov_direta_estado(uuid) TO authenticated;

-- 10) Salvar rascunho (cria/atualiza viagem direta + paradas + movimentações)
CREATE OR REPLACE FUNCTION public.fn_ct_mov_direta_salvar_rascunho(
  p_viagem_id uuid, p_payload jsonb, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_uid uuid := auth.uid(); v_prev jsonb; v_resp jsonb; v_viagem uuid := p_viagem_id;
  v_hash text; v_cc record; v_par jsonb; v_par_id uuid; v_eq uuid; v_ordem int := 0;
  v_ultimo_cc uuid; v_func record; v_veic record; v_emp record; v_status text;
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

  IF v_viagem IS NULL THEN
    INSERT INTO public.bd_ct_viagens (origem_fluxo, solicitacao_id, status, created_by, updated_by)
    VALUES ('MOVIMENTACAO_DIRETA', NULL, 'RASCUNHO', v_uid, v_uid)
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

  SELECT id, codigo_centro_custo, nome_centro_custo, endereco, latitude, longitude
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
    updated_at = now(), updated_by = v_uid
  WHERE id = v_viagem;

  -- reconstrução determinística das paradas do rascunho
  DELETE FROM public.bd_movimentacoes WHERE viagem_id = v_viagem;
  DELETE FROM public.bd_ct_viagem_paradas WHERE viagem_id = v_viagem;

  FOR v_par IN SELECT * FROM jsonb_array_elements(coalesce(p_payload->'paradas','[]'::jsonb)) LOOP
    v_ordem := v_ordem + 1;
    SELECT id, codigo_centro_custo, nome_centro_custo, endereco, latitude, longitude
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
      IF EXISTS (SELECT 1 FROM public.bd_movimentacoes m
                  WHERE m.viagem_id = v_viagem AND m.equipamento_id = v_eq) THEN
        RAISE EXCEPTION 'CT4_EQUIPAMENTO_DUPLICADO' USING ERRCODE='P0001',
          HINT='Um equipamento nao pode ser entregue em duas paradas da mesma viagem.';
      END IF;
      INSERT INTO public.bd_movimentacoes (
        origem_fluxo, solicitacao_id, equipamento_id, viagem_id, parada_id,
        origem_tipo, origem_id, destino_tipo, destino_id,
        tipo_deslocamento, tipo_movimentacao, status, created_by)
      VALUES ('MOVIMENTACAO_DIRETA', NULL, v_eq, v_viagem, v_par_id,
        'CENTRO_CUSTO', (SELECT origem_centro_custo_id FROM public.bd_ct_viagens WHERE id = v_viagem),
        'CENTRO_CUSTO', v_cc.id,
        nullif(p_payload->>'modalidade',''), 'MOVIMENTACAO', 'RASCUNHO', v_uid);
    END LOOP;
  END LOOP;

  IF v_ultimo_cc IS NOT NULL THEN
    UPDATE public.bd_ct_viagens v SET
      destino_centro_custo_id = v_ultimo_cc,
      destino_cc_codigo_snapshot = c.codigo_centro_custo,
      destino_cc_nome_snapshot = c.nome_centro_custo,
      destino_cc_endereco_snapshot = c.endereco,
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
END $$;
REVOKE ALL ON FUNCTION public.fn_ct_mov_direta_salvar_rascunho(uuid,jsonb,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_ct_mov_direta_salvar_rascunho(uuid,jsonb,uuid) TO authenticated;

-- 11) Programar (validação autoritativa + lock) ------------------------------
CREATE OR REPLACE FUNCTION public.fn_ct_mov_direta_programar(p_viagem_id uuid, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_uid uuid := auth.uid(); v_prev jsonb; v_resp jsonb; v record; m record;
  v_paradas int; v_cargas int; v_disp text; v_conf text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT4_AUTH_REQUIRED' USING ERRCODE='P0001', HINT='Sessao expirada. Entre novamente.';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'CT4_REQUEST_ID_OBRIGATORIO' USING ERRCODE='P0001', HINT='Requisicao invalida.';
  END IF;
  IF NOT (public.fn_is_super_admin(v_uid)
          OR public.user_has_permission_action(v_uid,'gestao_maquinas_central_transporte_view','criar')) THEN
    RAISE EXCEPTION 'CT4_FORBIDDEN' USING ERRCODE='P0001', HINT='Sem permissao para programar movimentacoes.';
  END IF;

  SELECT response_json INTO v_prev FROM public.bd_ct_comando_requests WHERE request_id = p_request_id;
  IF v_prev IS NOT NULL THEN RETURN v_prev || jsonb_build_object('replay', true); END IF;

  SELECT * INTO v FROM public.bd_ct_viagens
   WHERE id = p_viagem_id AND origem_fluxo = 'MOVIMENTACAO_DIRETA' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CT4_VIAGEM_NAO_ENCONTRADA' USING ERRCODE='P0001', HINT='Movimentacao inexistente.';
  END IF;
  IF v.status <> 'RASCUNHO' THEN
    RAISE EXCEPTION 'CT4_STATUS_INVALIDO' USING ERRCODE='P0001', HINT='Esta movimentacao ja foi programada.';
  END IF;
  IF v.modalidade_deslocamento IS NULL THEN
    RAISE EXCEPTION 'CT4_MODALIDADE_OBRIGATORIA' USING ERRCODE='P0001', HINT='Informe a modalidade do deslocamento.';
  END IF;
  IF v.data_prevista_saida IS NULL THEN
    RAISE EXCEPTION 'CT4_DATA_OBRIGATORIA' USING ERRCODE='P0001', HINT='Informe a data prevista de saida.';
  END IF;
  IF v.origem_centro_custo_id IS NULL THEN
    RAISE EXCEPTION 'CT4_ORIGEM_OBRIGATORIA' USING ERRCODE='P0001', HINT='Informe o ponto de partida.';
  END IF;
  IF v.modalidade_deslocamento = 'TRANSPORTADO' THEN
    IF v.tipo_transporte = 'PROPRIO' AND (v.veiculo_transportador_id IS NULL OR v.motorista_id IS NULL) THEN
      RAISE EXCEPTION 'CT4_TRANSPORTE_INCOMPLETO' USING ERRCODE='P0001',
        HINT='Selecione o veiculo transportador e o motorista.';
    END IF;
    IF v.tipo_transporte = 'TERCEIRO' AND (v.empresa_transportadora_id IS NULL
        OR v.placa_transportador_snapshot IS NULL OR v.motorista_nome_snapshot IS NULL) THEN
      RAISE EXCEPTION 'CT4_TRANSPORTE_INCOMPLETO' USING ERRCODE='P0001',
        HINT='Informe transportadora, placa e motorista previsto.';
    END IF;
    IF v.tipo_transporte IS NULL THEN
      RAISE EXCEPTION 'CT4_TRANSPORTE_INCOMPLETO' USING ERRCODE='P0001', HINT='Informe o tipo de transporte.';
    END IF;
  END IF;

  SELECT count(*) INTO v_paradas FROM public.bd_ct_viagem_paradas
   WHERE viagem_id = p_viagem_id AND status <> 'CANCELADA';
  IF v_paradas < 1 THEN
    RAISE EXCEPTION 'CT4_SEM_PARADAS' USING ERRCODE='P0001', HINT='Adicione ao menos uma parada.';
  END IF;

  SELECT count(*) INTO v_cargas FROM public.bd_movimentacoes
   WHERE viagem_id = p_viagem_id AND coalesce(status,'') <> 'CANCELADA';
  IF v_cargas < 1 THEN
    RAISE EXCEPTION 'CT4_SEM_EQUIPAMENTOS' USING ERRCODE='P0001',
      HINT='Vincule ao menos um equipamento a uma parada.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.bd_ct_viagem_paradas p
              WHERE p.viagem_id = p_viagem_id AND p.status <> 'CANCELADA'
                AND NOT EXISTS (SELECT 1 FROM public.bd_movimentacoes m
                                 WHERE m.parada_id = p.id AND coalesce(m.status,'') <> 'CANCELADA')) THEN
    RAISE EXCEPTION 'CT4_PARADA_SEM_EQUIPAMENTO' USING ERRCODE='P0001',
      HINT='Toda parada precisa de ao menos um equipamento.';
  END IF;

  -- revalidação autoritativa por equipamento, com lock
  FOR m IN SELECT * FROM public.bd_movimentacoes
            WHERE viagem_id = p_viagem_id AND coalesce(status,'') <> 'CANCELADA'
            ORDER BY id FOR UPDATE LOOP
    SELECT dd.status_operacional INTO v_disp FROM public.bd_disponibilidade_equipamentos dd
     WHERE dd.equipamento_id = m.equipamento_id
     ORDER BY dd.data_inicio DESC NULLS LAST, dd.created_at DESC LIMIT 1;
    IF v_disp IS NULL THEN
      RAISE EXCEPTION 'CT4_DISPONIBILIDADE_SEM_REGISTRO' USING ERRCODE='P0001',
        HINT='Ativo sem registro de disponibilidade. Regularize antes de programar.';
    END IF;
    IF v_disp NOT IN ('DISPONIVEL','ALOCADO') THEN
      RAISE EXCEPTION 'CT4_ATIVO_INDISPONIVEL' USING ERRCODE='P0001',
        HINT='Ativo em manutencao ou indisponivel nao pode ser movimentado.';
    END IF;

    SELECT vv.codigo INTO v_conf FROM public.bd_movimentacoes mm
      JOIN public.bd_ct_viagens vv ON vv.id = mm.viagem_id
     WHERE mm.equipamento_id = m.equipamento_id AND mm.viagem_id <> p_viagem_id
       AND coalesce(mm.status,'') NOT IN ('CANCELADA','CONCLUIDA')
       AND vv.status IN ('PROGRAMADA','EM_TRANSITO','AGUARDANDO_RECEBIMENTO')
     LIMIT 1;
    IF v_conf IS NOT NULL THEN
      RAISE EXCEPTION 'CT4_ATIVO_COMPROMETIDO' USING ERRCODE='P0001',
        HINT='Este equipamento recebeu outro compromisso enquanto o planejamento estava aberto. Atualize a movimentacao e escolha outro ativo.';
    END IF;
  END LOOP;

  UPDATE public.bd_ct_viagens SET status='PROGRAMADA', updated_at=now(), updated_by=v_uid
   WHERE id = p_viagem_id;
  UPDATE public.bd_movimentacoes SET status='PROGRAMADA', updated_at=now()
   WHERE viagem_id = p_viagem_id AND coalesce(status,'') <> 'CANCELADA';

  v_resp := jsonb_build_object('ok', true, 'replay', false, 'status', 'PROGRAMADA',
              'viagem_id', p_viagem_id, 'viagem', public.fn_ct_viagem_json(p_viagem_id));
  INSERT INTO public.bd_ct_comando_requests (request_id, operacao, solicitacao_id, command_hash, response_json, created_by)
  VALUES (p_request_id, 'CT4_MOV_DIRETA_PROGRAMAR', NULL,
          md5(p_viagem_id::text || 'PROGRAMAR'), v_resp, v_uid);
  RETURN v_resp;
END $$;
REVOKE ALL ON FUNCTION public.fn_ct_mov_direta_programar(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_ct_mov_direta_programar(uuid,uuid) TO authenticated;

-- 12) Cancelar (lógico, preserva histórico) ----------------------------------
CREATE OR REPLACE FUNCTION public.fn_ct_mov_direta_cancelar(
  p_viagem_id uuid, p_motivo text, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_prev jsonb; v_resp jsonb; v record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT4_AUTH_REQUIRED' USING ERRCODE='P0001', HINT='Sessao expirada. Entre novamente.';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'CT4_REQUEST_ID_OBRIGATORIO' USING ERRCODE='P0001', HINT='Requisicao invalida.';
  END IF;
  IF NOT (public.fn_is_super_admin(v_uid)
          OR public.user_has_permission_action(v_uid,'gestao_maquinas_central_transporte_view','aprovar')) THEN
    RAISE EXCEPTION 'CT4_FORBIDDEN' USING ERRCODE='P0001', HINT='Sem permissao para cancelar movimentacoes.';
  END IF;
  SELECT response_json INTO v_prev FROM public.bd_ct_comando_requests WHERE request_id = p_request_id;
  IF v_prev IS NOT NULL THEN RETURN v_prev || jsonb_build_object('replay', true); END IF;

  SELECT * INTO v FROM public.bd_ct_viagens
   WHERE id = p_viagem_id AND origem_fluxo = 'MOVIMENTACAO_DIRETA' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CT4_VIAGEM_NAO_ENCONTRADA' USING ERRCODE='P0001', HINT='Movimentacao inexistente.';
  END IF;
  IF v.status IN ('CONCLUIDA','CANCELADA') THEN
    RAISE EXCEPTION 'CT4_STATUS_INVALIDO' USING ERRCODE='P0001', HINT='Movimentacao encerrada nao pode ser cancelada.';
  END IF;

  UPDATE public.bd_ct_viagens
     SET status='CANCELADA',
         observacoes = coalesce(observacoes,'') || E'\n[CANCELAMENTO] ' || coalesce(p_motivo,''),
         updated_at=now(), updated_by=v_uid
   WHERE id = p_viagem_id;
  UPDATE public.bd_movimentacoes SET status='CANCELADA', updated_at=now()
   WHERE viagem_id = p_viagem_id AND coalesce(status,'') NOT IN ('CANCELADA','CONCLUIDA');
  UPDATE public.bd_ct_viagem_paradas SET status='CANCELADA', updated_at=now(), updated_by=v_uid
   WHERE viagem_id = p_viagem_id AND status NOT IN ('CONCLUIDA','CANCELADA');

  v_resp := jsonb_build_object('ok', true, 'replay', false, 'status', 'CANCELADA');
  INSERT INTO public.bd_ct_comando_requests (request_id, operacao, solicitacao_id, command_hash, response_json, created_by)
  VALUES (p_request_id, 'CT4_MOV_DIRETA_CANCELAR', NULL,
          md5(p_viagem_id::text || 'CANCELAR'), v_resp, v_uid);
  RETURN v_resp;
END $$;
REVOKE ALL ON FUNCTION public.fn_ct_mov_direta_cancelar(uuid,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_ct_mov_direta_cancelar(uuid,text,uuid) TO authenticated;

-- 13) Chegada por parada ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_ct_parada_registrar_chegada(p_parada_id uuid, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_func uuid; v_prev jsonb; v_resp jsonb; p record; v record; v_pend int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT3E_AUTH_REQUIRED' USING ERRCODE='P0001', HINT='Sessao expirada. Entre novamente.';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'CT3E_REQUEST_ID_OBRIGATORIO' USING ERRCODE='P0001', HINT='Requisicao invalida.';
  END IF;
  SELECT response_json INTO v_prev FROM public.bd_ct_comando_requests WHERE request_id = p_request_id;
  IF v_prev IS NOT NULL THEN RETURN v_prev || jsonb_build_object('replay', true); END IF;

  SELECT * INTO p FROM public.bd_ct_viagem_paradas WHERE id = p_parada_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CT4_PARADA_NAO_ENCONTRADA' USING ERRCODE='P0001', HINT='Parada inexistente.';
  END IF;
  SELECT * INTO v FROM public.bd_ct_viagens WHERE id = p.viagem_id FOR UPDATE;

  v_func := public.fn_ativos_profile_funcionario_id(v_uid);
  IF NOT (public.fn_is_super_admin(v_uid)
          OR (v_func IS NOT NULL AND v_func = v.motorista_id
              AND public.fn_ct_cap(v_uid,'iniciar_viagem'))) THEN
    RAISE EXCEPTION 'CT3E_FORBIDDEN' USING ERRCODE='P0001', HINT='Somente o motorista registra a chegada.';
  END IF;
  IF v.status <> 'EM_TRANSITO' THEN
    RAISE EXCEPTION 'CT3E_STATUS_INVALIDO' USING ERRCODE='P0001', HINT='A viagem nao esta em transito.';
  END IF;
  IF p.status <> 'PENDENTE' THEN
    RAISE EXCEPTION 'CT4_PARADA_STATUS_INVALIDO' USING ERRCODE='P0001', HINT='Esta parada ja foi registrada.';
  END IF;
  SELECT count(*) INTO v_pend FROM public.bd_ct_viagem_paradas
   WHERE viagem_id = p.viagem_id AND status = 'PENDENTE' AND ordem < p.ordem;
  IF v_pend > 0 THEN
    RAISE EXCEPTION 'CT4_PARADA_FORA_DE_ORDEM' USING ERRCODE='P0001',
      HINT='Conclua a parada anterior antes de registrar esta chegada.';
  END IF;

  UPDATE public.bd_ct_viagem_paradas
     SET status='CHEGADA_REGISTRADA', chegada_registrada_em=now(),
         chegada_registrada_por=v_uid, updated_at=now(), updated_by=v_uid
   WHERE id = p_parada_id;

  UPDATE public.bd_ct_viagens
     SET status='AGUARDANDO_RECEBIMENTO',
         chegada_registrada_em = coalesce(chegada_registrada_em, now()),
         chegada_registrada_por = coalesce(chegada_registrada_por, v_uid),
         updated_at=now(), updated_by=v_uid
   WHERE id = p.viagem_id;

  INSERT INTO public.bd_ct_recebimentos (viagem_id, parada_id, status, recebedor_previsto_id,
         recebedor_nome_snapshot, created_by)
  VALUES (p.viagem_id, p_parada_id, 'RASCUNHO',
          coalesce(p.recebedor_previsto_funcionario_id, v.recebedor_previsto_funcionario_id),
          coalesce(p.recebedor_previsto_nome_snapshot, v.recebedor_previsto_nome_snapshot), v_uid)
  ON CONFLICT (parada_id) WHERE parada_id IS NOT NULL DO NOTHING;

  v_resp := jsonb_build_object('ok', true, 'replay', false, 'parada_id', p_parada_id,
              'status', 'AGUARDANDO_RECEBIMENTO');
  INSERT INTO public.bd_ct_comando_requests (request_id, operacao, solicitacao_id, command_hash, response_json, created_by)
  VALUES (p_request_id, 'CT4_PARADA_CHEGADA', v.solicitacao_id,
          md5(p_parada_id::text || 'CHEGADA'), v_resp, v_uid);
  RETURN v_resp;
END $$;
REVOKE ALL ON FUNCTION public.fn_ct_parada_registrar_chegada(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_ct_parada_registrar_chegada(uuid,uuid) TO authenticated;

-- 14) Recebimento: por parada (novo) ou por viagem (legado) ------------------
CREATE OR REPLACE FUNCTION public.fn_ct_recebimento_finalizar(
  p_viagem_id uuid, p_payload jsonb, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_uid uuid := auth.uid(); v_func uuid; v record; v_prev jsonb; v_resp jsonb;
  v_rec uuid; v_item jsonb; v_total int; v_recusas int := 0; v_ressalvas int := 0;
  v_mov record; v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_status_final text; v_parada uuid; p record; v_dest uuid; v_lat numeric; v_lng numeric;
  v_restantes int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT3E_AUTH_REQUIRED' USING ERRCODE='P0001', HINT='Sessao expirada. Entre novamente.';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'CT3E_REQUEST_ID_OBRIGATORIO' USING ERRCODE='P0001', HINT='Requisicao invalida.';
  END IF;
  SELECT response_json INTO v_prev FROM public.bd_ct_comando_requests WHERE request_id = p_request_id;
  IF v_prev IS NOT NULL THEN RETURN v_prev || jsonb_build_object('replay', true); END IF;

  SELECT * INTO v FROM public.bd_ct_viagens WHERE id = p_viagem_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CT3E_VIAGEM_NAO_ENCONTRADA' USING ERRCODE='P0001', HINT='Viagem inexistente.';
  END IF;
  IF v.status <> 'AGUARDANDO_RECEBIMENTO' THEN
    RAISE EXCEPTION 'CT3E_STATUS_INVALIDO' USING ERRCODE='P0001', HINT='A viagem nao esta aguardando recebimento.';
  END IF;

  v_parada := nullif(p_payload->>'parada_id','')::uuid;
  IF v_parada IS NOT NULL THEN
    SELECT * INTO p FROM public.bd_ct_viagem_paradas
     WHERE id = v_parada AND viagem_id = p_viagem_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'CT4_PARADA_NAO_ENCONTRADA' USING ERRCODE='P0001', HINT='Parada nao pertence a viagem.';
    END IF;
    IF p.status <> 'CHEGADA_REGISTRADA' THEN
      RAISE EXCEPTION 'CT4_PARADA_STATUS_INVALIDO' USING ERRCODE='P0001',
        HINT='Registre a chegada nesta parada antes do recebimento.';
    END IF;
    v_dest := p.centro_custo_id;
  ELSE
    v_dest := v.destino_centro_custo_id;
  END IF;

  v_func := public.fn_ativos_profile_funcionario_id(v_uid);
  IF NOT (public.fn_is_super_admin(v_uid)
          OR (v_func IS NOT NULL AND (v_func = v.recebedor_previsto_funcionario_id
                                      OR (p.id IS NOT NULL AND v_func = p.recebedor_previsto_funcionario_id)))
          OR (public.fn_ct_cap(v_uid,'confirmar_recebimento')
              AND v_dest IS NOT NULL
              AND public.fn_ativos_can_access_centro_custo(v_dest, v_uid))) THEN
    RAISE EXCEPTION 'CT3E_FORBIDDEN' USING ERRCODE='P0001', HINT='Sem autorizacao para confirmar este recebimento.';
  END IF;

  IF nullif(p_payload->>'assinatura_id','') IS NULL THEN
    RAISE EXCEPTION 'CT3E_ASSINATURA_OBRIGATORIA' USING ERRCODE='P0001', HINT='Assinatura obrigatoria no fechamento.';
  END IF;
  IF nullif(p_payload->>'recebedor_nome','') IS NULL THEN
    RAISE EXCEPTION 'CT3E_RECEBEDOR_OBRIGATORIO' USING ERRCODE='P0001', HINT='Informe o nome do recebedor.';
  END IF;

  SELECT count(*) INTO v_total FROM public.bd_movimentacoes m
   WHERE m.viagem_id = p_viagem_id AND coalesce(m.status,'') <> 'CANCELADA'
     AND (v_parada IS NULL OR m.parada_id = v_parada);
  IF jsonb_array_length(coalesce(p_payload->'itens','[]'::jsonb)) <> v_total THEN
    RAISE EXCEPTION 'CT3E_ITENS_INCOMPLETOS' USING ERRCODE='P0001',
      HINT='Informe o resultado de cada equipamento desta entrega.';
  END IF;

  v_lat := nullif(p_payload->>'latitude','')::numeric;
  v_lng := nullif(p_payload->>'longitude','')::numeric;

  SELECT id INTO v_rec FROM public.bd_ct_recebimentos
   WHERE viagem_id = p_viagem_id AND parada_id IS NOT DISTINCT FROM v_parada FOR UPDATE;

  IF v_rec IS NULL THEN
    INSERT INTO public.bd_ct_recebimentos (viagem_id, parada_id, status, recebedor_previsto_id, recebedor_real_id,
       recebedor_nome_snapshot, recebedor_documento_snapshot, operado_por_profile_id, recebido_em,
       assinatura_id, latitude, longitude, observacoes, fotos, created_by, updated_by)
    VALUES (p_viagem_id, v_parada, 'RASCUNHO', v.recebedor_previsto_funcionario_id, v_func,
       p_payload->>'recebedor_nome', p_payload->>'recebedor_documento', v_uid, now(),
       (p_payload->>'assinatura_id')::uuid, v_lat, v_lng,
       p_payload->>'observacoes', coalesce(p_payload->'fotos','[]'::jsonb), v_uid, v_uid)
    RETURNING id INTO v_rec;
  ELSE
    UPDATE public.bd_ct_recebimentos SET
       recebedor_real_id = v_func,
       recebedor_nome_snapshot = p_payload->>'recebedor_nome',
       recebedor_documento_snapshot = p_payload->>'recebedor_documento',
       operado_por_profile_id = v_uid, recebido_em = now(),
       assinatura_id = (p_payload->>'assinatura_id')::uuid,
       latitude = v_lat, longitude = v_lng,
       observacoes = p_payload->>'observacoes',
       fotos = coalesce(p_payload->'fotos','[]'::jsonb),
       updated_by = v_uid, updated_at = now()
     WHERE id = v_rec;
  END IF;

  DELETE FROM public.bd_ct_recebimento_itens WHERE recebimento_id = v_rec;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'itens') LOOP
    SELECT m.* INTO v_mov FROM public.bd_movimentacoes m
     WHERE m.id = (v_item->>'movimentacao_id')::uuid
       AND m.viagem_id = p_viagem_id AND coalesce(m.status,'') <> 'CANCELADA'
       AND (v_parada IS NULL OR m.parada_id = v_parada)
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'CT3E_CARGA_INVALIDA' USING ERRCODE='P0001', HINT='Carga nao pertence a esta entrega.';
    END IF;

    IF upper(coalesce(v_item->>'resultado','')) NOT IN ('ACEITO','ACEITO_COM_RESSALVA','RECUSADO') THEN
      RAISE EXCEPTION 'CT3E_RESULTADO_INVALIDO' USING ERRCODE='P0001', HINT='Resultado invalido para o equipamento.';
    END IF;
    IF upper(v_item->>'resultado') IN ('ACEITO_COM_RESSALVA','RECUSADO') THEN
      IF nullif(v_item->>'observacao','') IS NULL THEN
        RAISE EXCEPTION 'CT3E_MOTIVO_OBRIGATORIO' USING ERRCODE='P0001',
          HINT='Descreva o motivo da ressalva ou recusa.';
      END IF;
      IF jsonb_array_length(coalesce(v_item->'fotos','[]'::jsonb)) < 1 THEN
        RAISE EXCEPTION 'CT3E_FOTO_OBRIGATORIA' USING ERRCODE='P0001',
          HINT='Anexe ao menos uma foto para ressalva ou recusa.';
      END IF;
    END IF;
    IF upper(v_item->>'resultado') = 'ACEITO_COM_RESSALVA'
       AND nullif(v_item->>'nao_conformidade_tipo','') IS NULL THEN
      RAISE EXCEPTION 'CT3E_NC_TIPO_OBRIGATORIO' USING ERRCODE='P0001', HINT='Classifique a nao conformidade.';
    END IF;

    INSERT INTO public.bd_ct_recebimento_itens (recebimento_id, movimentacao_id, equipamento_id,
      resultado, nao_conformidade_tipo, observacao, respostas, fotos, created_by)
    VALUES (v_rec, v_mov.id, v_mov.equipamento_id, upper(v_item->>'resultado'),
      nullif(v_item->>'nao_conformidade_tipo',''), nullif(v_item->>'observacao',''),
      coalesce(v_item->'respostas','{}'::jsonb), coalesce(v_item->'fotos','[]'::jsonb), v_uid);

    IF upper(v_item->>'resultado') = 'RECUSADO' THEN
      v_recusas := v_recusas + 1;
      CONTINUE;
    END IF;
    IF upper(v_item->>'resultado') = 'ACEITO_COM_RESSALVA' THEN
      v_ressalvas := v_ressalvas + 1;
    END IF;

    UPDATE public.bd_movimentacoes SET status='CONCLUIDA', updated_at=now() WHERE id = v_mov.id;

    IF v_mov.atendimento_id IS NOT NULL THEN
      UPDATE public.bd_solicitacao_item_atendimentos SET status='ENTREGUE', updated_at=now()
       WHERE id = v_mov.atendimento_id AND status <> 'ENTREGUE';
    END IF;

    IF v_dest IS NOT NULL THEN
      INSERT INTO public.bd_disponibilidade_equipamentos
        (equipamento_id, status_operacional, centro_custo_id, data_inicio, observacao)
      VALUES (v_mov.equipamento_id, 'ALOCADO', v_dest, v_hoje,
              'Entrega confirmada na Central do Transporte');

      PERFORM public.fn_aplicar_centro_custo_atual_equipamento(
        v_mov.equipamento_id, v_dest, 'CENTRAL_TRANSPORTE', now(), v_uid, true);

      INSERT INTO public.bd_localizacao_equipamentos
        (equipamento_id, centro_custo_id, latitude, longitude, origem, data_registro)
      VALUES (v_mov.equipamento_id, v_dest,
              coalesce(v_lat, p.latitude, v.destino_descarga_latitude, v.destino_cc_latitude_snapshot),
              coalesce(v_lng, p.longitude, v.destino_descarga_longitude, v.destino_cc_longitude_snapshot),
              'CENTRO_CUSTO'::origem_localizacao_enum, now());
    END IF;
  END LOOP;

  IF v_parada IS NOT NULL THEN
    UPDATE public.bd_ct_viagem_paradas
       SET status='CONCLUIDA', concluida_em=now(), updated_at=now(), updated_by=v_uid
     WHERE id = v_parada;
    SELECT count(*) INTO v_restantes FROM public.bd_ct_viagem_paradas
     WHERE viagem_id = p_viagem_id AND status IN ('PENDENTE','CHEGADA_REGISTRADA');
  ELSE
    v_restantes := 0;
  END IF;

  v_status_final := CASE
    WHEN v_recusas > 0 THEN 'PENDENTE_TRATATIVA'
    WHEN v_restantes > 0 THEN 'EM_TRANSITO'
    ELSE 'CONCLUIDA' END;

  UPDATE public.bd_ct_viagens
     SET status = v_status_final,
         finalizada_em = CASE WHEN v_status_final = 'CONCLUIDA' THEN now() ELSE finalizada_em END,
         updated_at = now(), updated_by = v_uid
   WHERE id = p_viagem_id;

  UPDATE public.bd_ct_recebimentos
     SET status = CASE WHEN v_recusas > 0 THEN 'PENDENTE_TRATATIVA' ELSE 'CONCLUIDO' END
   WHERE id = v_rec;

  INSERT INTO public.bd_notificacoes (tipo, titulo, mensagem, link, metadata, created_by)
  VALUES (
    CASE WHEN v_recusas > 0 THEN 'ct_recebimento_recusado'
         WHEN v_ressalvas > 0 THEN 'ct_recebimento_ressalva'
         ELSE 'ct_recebimento_concluido' END,
    CASE WHEN v_recusas > 0 THEN 'Recebimento recusado na Central do Transporte'
         WHEN v_ressalvas > 0 THEN 'Recebimento aceito com ressalva'
         ELSE 'Entrega confirmada' END,
    'Viagem ' || coalesce(v.codigo,'') || ': ' || v_recusas || ' recusa(s), '
      || v_ressalvas || ' ressalva(s).',
    '/central-transporte', jsonb_build_object('viagem_id', p_viagem_id, 'parada_id', v_parada,
      'solicitacao_id', v.solicitacao_id, 'recusas', v_recusas, 'ressalvas', v_ressalvas),
    v_uid);

  v_resp := jsonb_build_object('ok', true, 'replay', false, 'status', v_status_final,
              'recusas', v_recusas, 'ressalvas', v_ressalvas, 'recebimento_id', v_rec,
              'paradas_restantes', v_restantes);
  INSERT INTO public.bd_ct_comando_requests (request_id, operacao, solicitacao_id, command_hash, response_json, created_by)
  VALUES (p_request_id, 'CT3F_RECEBIMENTO_FINALIZAR', v.solicitacao_id,
          md5(p_viagem_id::text || coalesce(v_parada::text,'') || 'RECEBIMENTO'), v_resp, v_uid);
  RETURN v_resp;
END $$;
REVOKE ALL ON FUNCTION public.fn_ct_recebimento_finalizar(uuid,jsonb,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_ct_recebimento_finalizar(uuid,jsonb,uuid) TO authenticated;

-- 15) Chegada legada (viagem sem paradas) continua válida --------------------
CREATE OR REPLACE FUNCTION public.fn_ct_viagem_registrar_chegada(p_viagem_id uuid, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_func uuid; v record; v_prev jsonb; v_resp jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT3E_AUTH_REQUIRED' USING ERRCODE='P0001', HINT='Sessao expirada. Entre novamente.';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'CT3E_REQUEST_ID_OBRIGATORIO' USING ERRCODE='P0001', HINT='Requisicao invalida.';
  END IF;
  SELECT response_json INTO v_prev FROM public.bd_ct_comando_requests WHERE request_id = p_request_id;
  IF v_prev IS NOT NULL THEN RETURN v_prev || jsonb_build_object('replay', true); END IF;

  SELECT * INTO v FROM public.bd_ct_viagens WHERE id = p_viagem_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CT3E_VIAGEM_NAO_ENCONTRADA' USING ERRCODE='P0001', HINT='Viagem inexistente.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.bd_ct_viagem_paradas pp
              WHERE pp.viagem_id = p_viagem_id AND pp.status <> 'CANCELADA') THEN
    RAISE EXCEPTION 'CT4_USE_CHEGADA_POR_PARADA' USING ERRCODE='P0001',
      HINT='Esta viagem possui paradas: registre a chegada parada a parada.';
  END IF;
  v_func := public.fn_ativos_profile_funcionario_id(v_uid);
  IF NOT (public.fn_is_super_admin(v_uid)
          OR (v_func IS NOT NULL AND v_func = v.motorista_id
              AND public.fn_ct_cap(v_uid,'iniciar_viagem'))) THEN
    RAISE EXCEPTION 'CT3E_FORBIDDEN' USING ERRCODE='P0001', HINT='Somente o motorista registra a chegada.';
  END IF;
  IF v.status <> 'EM_TRANSITO' THEN
    RAISE EXCEPTION 'CT3E_STATUS_INVALIDO' USING ERRCODE='P0001', HINT='A viagem nao esta em transito.';
  END IF;

  UPDATE public.bd_ct_viagens
     SET status='AGUARDANDO_RECEBIMENTO', chegada_registrada_em=now(),
         chegada_registrada_por=v_uid, updated_at=now(), updated_by=v_uid
   WHERE id = p_viagem_id;

  INSERT INTO public.bd_ct_recebimentos (viagem_id, status, recebedor_previsto_id,
         recebedor_nome_snapshot, created_by)
  VALUES (p_viagem_id, 'RASCUNHO', v.recebedor_previsto_funcionario_id,
          v.recebedor_previsto_nome_snapshot, v_uid)
  ON CONFLICT (viagem_id) WHERE parada_id IS NULL DO NOTHING;

  v_resp := jsonb_build_object('ok', true, 'replay', false, 'status', 'AGUARDANDO_RECEBIMENTO');
  INSERT INTO public.bd_ct_comando_requests (request_id, operacao, solicitacao_id, command_hash, response_json, created_by)
  VALUES (p_request_id, 'CT3E_VIAGEM_CHEGADA', v.solicitacao_id,
          md5(p_viagem_id::text || 'CHEGADA'), v_resp, v_uid);
  RETURN v_resp;
END $$;
REVOKE ALL ON FUNCTION public.fn_ct_viagem_registrar_chegada(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_ct_viagem_registrar_chegada(uuid,uuid) TO authenticated;

-- 16) Iniciar viagem: preencher command_hash (ledger NOT NULL) ---------------
CREATE OR REPLACE FUNCTION public.fn_ct_viagem_iniciar(p_viagem_id uuid, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_func uuid; v record; v_prev jsonb; v_pend int; v_resp jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT3E_AUTH_REQUIRED' USING ERRCODE='P0001', HINT='Sessao expirada. Entre novamente.';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'CT3E_REQUEST_ID_OBRIGATORIO' USING ERRCODE='P0001', HINT='Requisicao invalida.';
  END IF;
  SELECT response_json INTO v_prev FROM public.bd_ct_comando_requests WHERE request_id = p_request_id;
  IF v_prev IS NOT NULL THEN RETURN v_prev || jsonb_build_object('replay', true); END IF;

  SELECT * INTO v FROM public.bd_ct_viagens WHERE id = p_viagem_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CT3E_VIAGEM_NAO_ENCONTRADA' USING ERRCODE='P0001', HINT='Viagem inexistente.';
  END IF;
  v_func := public.fn_ativos_profile_funcionario_id(v_uid);
  IF NOT (public.fn_is_super_admin(v_uid)
          OR (v_func IS NOT NULL AND v_func = v.motorista_id
              AND public.fn_ct_cap(v_uid,'iniciar_viagem'))) THEN
    RAISE EXCEPTION 'CT3E_FORBIDDEN' USING ERRCODE='P0001', HINT='Somente o motorista da viagem inicia o transporte.';
  END IF;
  IF v.status <> 'PROGRAMADA' THEN
    RAISE EXCEPTION 'CT3E_STATUS_INVALIDO' USING ERRCODE='P0001', HINT='A viagem nao esta programada.';
  END IF;

  SELECT (CASE WHEN v.modalidade_deslocamento='TRANSPORTADO'
               AND NOT EXISTS (SELECT 1 FROM public.bd_ct_checklists c
                 WHERE c.viagem_id=p_viagem_id AND c.tipo='TRANSPORTADOR' AND c.status='CONCLUIDO')
          THEN 1 ELSE 0 END)
       + (SELECT count(*) FROM public.bd_movimentacoes m
           WHERE m.viagem_id=p_viagem_id AND coalesce(m.status,'') <> 'CANCELADA'
             AND NOT EXISTS (SELECT 1 FROM public.bd_ct_checklists c
               WHERE c.viagem_id=p_viagem_id AND c.tipo='CARGA'
                 AND c.movimentacao_id=m.id AND c.status='CONCLUIDO'))
    INTO v_pend;
  IF v_pend > 0 THEN
    RAISE EXCEPTION 'CT3E_CHECKLIST_INCOMPLETO' USING ERRCODE='P0001',
      HINT='Conclua todos os checklists obrigatorios antes de iniciar o transporte.';
  END IF;

  UPDATE public.bd_ct_viagens
     SET status='EM_TRANSITO', transporte_iniciado_em=now(), transporte_iniciado_por=v_uid,
         updated_at=now(), updated_by=v_uid
   WHERE id = p_viagem_id;
  UPDATE public.bd_movimentacoes SET status='EM_TRANSITO', updated_at=now()
   WHERE viagem_id = p_viagem_id AND coalesce(status,'') <> 'CANCELADA';

  v_resp := jsonb_build_object('ok', true, 'replay', false, 'status', 'EM_TRANSITO');
  INSERT INTO public.bd_ct_comando_requests (request_id, operacao, solicitacao_id, command_hash, response_json, created_by)
  VALUES (p_request_id, 'CT3E_VIAGEM_INICIAR', v.solicitacao_id,
          md5(p_viagem_id::text || 'INICIAR'), v_resp, v_uid);
  RETURN v_resp;
END $$;
REVOKE ALL ON FUNCTION public.fn_ct_viagem_iniciar(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_ct_viagem_iniciar(uuid,uuid) TO authenticated;

-- 17) Recebimentos pendentes: incluir escopo por parada ----------------------
CREATE OR REPLACE FUNCTION public.fn_ct_recebimentos_pendentes_listar()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_func uuid; v_sa boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT3E_AUTH_REQUIRED' USING ERRCODE='P0001', HINT='Sessao expirada. Entre novamente.';
  END IF;
  v_sa := public.fn_is_super_admin(v_uid);
  v_func := public.fn_ativos_profile_funcionario_id(v_uid);

  RETURN jsonb_build_object('ok', true, 'ordens', coalesce((
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
  ), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.fn_ct_recebimentos_pendentes_listar() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_ct_recebimentos_pendentes_listar() TO authenticated;