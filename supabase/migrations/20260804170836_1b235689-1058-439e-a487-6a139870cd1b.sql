-- ============================================================
-- CT-2.5 + CT-3C — Mobilização real e trava de edição do ativo
-- ============================================================

-- ---------- FASE D: viagens ----------
CREATE SEQUENCE IF NOT EXISTS public.seq_ct_viagem_codigo;

CREATE TABLE IF NOT EXISTS public.bd_ct_viagens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  solicitacao_id uuid NOT NULL REFERENCES public.bd_solicitacoes_equipamento(id) ON DELETE CASCADE,
  planejamento_id uuid,
  codigo text NOT NULL DEFAULT ('VG-' || lpad(nextval('public.seq_ct_viagem_codigo')::text, 6, '0')),
  status text NOT NULL DEFAULT 'RASCUNHO',
  responsavel_transporte text,
  transportadora text,
  data_prevista_saida date,
  data_prevista_entrega date,
  origem_descricao text,
  destino_descricao text,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_ct_viagens_status
    CHECK (status IN ('RASCUNHO','PROGRAMADA','EM_TRANSITO','CONCLUIDA','CANCELADA')),
  CONSTRAINT uq_ct_viagens_codigo UNIQUE (codigo)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bd_ct_viagens TO authenticated;
GRANT ALL ON public.bd_ct_viagens TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.seq_ct_viagem_codigo TO authenticated, service_role;

ALTER TABLE public.bd_ct_viagens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ct_viagens_select_scoped ON public.bd_ct_viagens;
CREATE POLICY ct_viagens_select_scoped ON public.bd_ct_viagens
  FOR SELECT TO authenticated
  USING (public.fn_ativos_can_access_solicitacao(solicitacao_id));

DROP POLICY IF EXISTS ct_viagens_insert_scoped ON public.bd_ct_viagens;
CREATE POLICY ct_viagens_insert_scoped ON public.bd_ct_viagens
  FOR INSERT TO authenticated
  WITH CHECK (public.fn_ativos_can_access_solicitacao(solicitacao_id));

DROP POLICY IF EXISTS ct_viagens_update_scoped ON public.bd_ct_viagens;
CREATE POLICY ct_viagens_update_scoped ON public.bd_ct_viagens
  FOR UPDATE TO authenticated
  USING (public.fn_ativos_can_access_solicitacao(solicitacao_id))
  WITH CHECK (public.fn_ativos_can_access_solicitacao(solicitacao_id));

CREATE INDEX IF NOT EXISTS ix_ct_viagens_solicitacao ON public.bd_ct_viagens (solicitacao_id);
CREATE INDEX IF NOT EXISTS ix_ct_viagens_planejamento ON public.bd_ct_viagens (planejamento_id);

DROP TRIGGER IF EXISTS trg_ct_viagens_updated_at ON public.bd_ct_viagens;
CREATE TRIGGER trg_ct_viagens_updated_at
  BEFORE UPDATE ON public.bd_ct_viagens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- FASE E: planejamento versionado ----------
ALTER TABLE public.bd_solicitacoes_planejamento
  ADD COLUMN IF NOT EXISTS versao integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS vigente boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS status_planejamento text NOT NULL DEFAULT 'RASCUNHO',
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS programado_em timestamptz,
  ADD COLUMN IF NOT EXISTS programado_por uuid,
  ADD COLUMN IF NOT EXISTS request_id uuid;

ALTER TABLE public.bd_solicitacoes_planejamento
  DROP CONSTRAINT IF EXISTS ck_planejamento_status;
ALTER TABLE public.bd_solicitacoes_planejamento
  ADD CONSTRAINT ck_planejamento_status
  CHECK (status_planejamento IN ('RASCUNHO','PROGRAMADO','CANCELADO'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_planejamento_vigente
  ON public.bd_solicitacoes_planejamento (solicitacao_id) WHERE vigente;

CREATE UNIQUE INDEX IF NOT EXISTS uq_planejamento_versao
  ON public.bd_solicitacoes_planejamento (solicitacao_id, versao);

CREATE UNIQUE INDEX IF NOT EXISTS uq_planejamento_request_id
  ON public.bd_solicitacoes_planejamento (request_id) WHERE request_id IS NOT NULL;

ALTER TABLE public.bd_ct_viagens
  ADD CONSTRAINT fk_ct_viagens_planejamento
  FOREIGN KEY (planejamento_id)
  REFERENCES public.bd_solicitacoes_planejamento(id) ON DELETE CASCADE;

-- ---------- FASE F: movimentação por ativo ----------
ALTER TABLE public.bd_movimentacoes
  ADD COLUMN IF NOT EXISTS atendimento_id uuid
    REFERENCES public.bd_solicitacao_item_atendimentos(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS viagem_id uuid
    REFERENCES public.bd_ct_viagens(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS planejamento_id uuid
    REFERENCES public.bd_solicitacoes_planejamento(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS observacoes text;

CREATE INDEX IF NOT EXISTS ix_movimentacoes_atendimento ON public.bd_movimentacoes (atendimento_id);
CREATE INDEX IF NOT EXISTS ix_movimentacoes_viagem ON public.bd_movimentacoes (viagem_id);
CREATE INDEX IF NOT EXISTS ix_movimentacoes_planejamento ON public.bd_movimentacoes (planejamento_id);

-- Um atendimento reservado tem no maximo UMA movimentacao nao cancelada.
CREATE UNIQUE INDEX IF NOT EXISTS uq_movimentacao_atendimento_ativa
  ON public.bd_movimentacoes (atendimento_id)
  WHERE atendimento_id IS NOT NULL AND coalesce(status,'') <> 'CANCELADA';

DROP POLICY IF EXISTS movimentacoes_ct_select_scoped ON public.bd_movimentacoes;
CREATE POLICY movimentacoes_ct_select_scoped ON public.bd_movimentacoes
  FOR SELECT TO authenticated
  USING (public.fn_ativos_can_access_solicitacao(solicitacao_id));

-- ---------- FASE B/H: leitura do estado de mobilizacao ----------
CREATE OR REPLACE FUNCTION public.fn_ct_mobilizacao_estado(p_solicitacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid  uuid := auth.uid();
  v_sa   boolean;
  v_plan record;
  v_out  jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT2_AUTH_REQUIRED' USING ERRCODE='P0001',
      HINT='Sessao expirada. Entre novamente para continuar.';
  END IF;
  IF p_solicitacao_id IS NULL THEN
    RAISE EXCEPTION 'CT2_PARAMETROS_INVALIDOS' USING ERRCODE='P0001',
      HINT='Solicitacao obrigatoria.';
  END IF;

  v_sa := public.fn_is_super_admin(v_uid);
  IF NOT v_sa THEN
    IF NOT public.user_has_permission_action(v_uid,'gestao_maquinas_central_transporte_view','visualizar') THEN
      RAISE EXCEPTION 'CT2_FORBIDDEN' USING ERRCODE='P0001',
        HINT='Sem permissao para consultar a Central do Transporte.';
    END IF;
    IF NOT public.fn_ativos_can_access_solicitacao(p_solicitacao_id, v_uid) THEN
      RAISE EXCEPTION 'CT2_SCOPE_DENIED' USING ERRCODE='P0001',
        HINT='Solicitacao fora do seu escopo de acesso.';
    END IF;
  END IF;

  SELECT * INTO v_plan
    FROM public.bd_solicitacoes_planejamento sp
   WHERE sp.solicitacao_id = p_solicitacao_id AND sp.vigente
   LIMIT 1;

  SELECT jsonb_build_object(
    'ok', true,
    'solicitacao_id', p_solicitacao_id,
    'planejamento', CASE WHEN v_plan.id IS NULL THEN NULL ELSE jsonb_build_object(
        'id', v_plan.id,
        'versao', v_plan.versao,
        'status', v_plan.status_planejamento,
        'data_prevista_entrega', v_plan.data_prevista_entrega,
        'observacoes', v_plan.observacoes,
        'programado_em', v_plan.programado_em
      ) END,
    'ativos', coalesce((
      SELECT jsonb_agg(x ORDER BY x->>'equipamento_frota' NULLS LAST)
        FROM (
          SELECT jsonb_build_object(
                   'atendimento_id', a.id,
                   'solicitacao_item_id', a.solicitacao_item_id,
                   'equipamento_id', a.equipamento_id,
                   'equipamento_frota', e.frota,
                   'equipamento_numero', e.numero_frota,
                   'equipamento_placa', e.placa,
                   'status_atendimento', a.status,
                   'periodo_inicio', a.periodo_inicio,
                   'periodo_fim', a.periodo_fim,
                   'movimentacao_id', m.id,
                   'movimentacao_status', m.status,
                   'viagem_id', m.viagem_id
                 ) AS x
            FROM public.bd_solicitacao_item_atendimentos a
            JOIN public.bd_solicitacoes_itens si ON si.id = a.solicitacao_item_id
            JOIN public.bd_caminhoes_equipamentos e ON e.id = a.equipamento_id
            LEFT JOIN public.bd_movimentacoes m
                   ON m.atendimento_id = a.id
                  AND coalesce(m.status,'') <> 'CANCELADA'
                  AND (v_plan.id IS NULL OR m.planejamento_id = v_plan.id)
           WHERE si.solicitacao_id = p_solicitacao_id
             AND a.status IN ('RESERVADO','EM_TRANSPORTE','ENTREGUE')
        ) s
    ), '[]'::jsonb),
    'viagens', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', v.id,
               'codigo', v.codigo,
               'status', v.status,
               'responsavel_transporte', v.responsavel_transporte,
               'transportadora', v.transportadora,
               'data_prevista_saida', v.data_prevista_saida,
               'data_prevista_entrega', v.data_prevista_entrega,
               'origem_descricao', v.origem_descricao,
               'destino_descricao', v.destino_descricao,
               'observacoes', v.observacoes,
               'atendimento_ids', coalesce((
                 SELECT jsonb_agg(m2.atendimento_id)
                   FROM public.bd_movimentacoes m2
                  WHERE m2.viagem_id = v.id AND coalesce(m2.status,'') <> 'CANCELADA'
               ), '[]'::jsonb)
             ) ORDER BY v.codigo)
        FROM public.bd_ct_viagens v
       WHERE v.solicitacao_id = p_solicitacao_id
         AND v.status <> 'CANCELADA'
         AND (v_plan.id IS NULL OR v.planejamento_id = v_plan.id)
    ), '[]'::jsonb)
  ) INTO v_out;

  RETURN v_out;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_ct_mobilizacao_estado(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_ct_mobilizacao_estado(uuid) TO authenticated, service_role;

-- ---------- FASE H: rascunho versionado ----------
CREATE OR REPLACE FUNCTION public.fn_ct_mobilizacao_salvar_rascunho(
  p_solicitacao_id uuid,
  p_viagens jsonb,
  p_request_id uuid,
  p_observacoes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid    uuid := auth.uid();
  v_sa     boolean;
  v_exist  record;
  v_plan   uuid;
  v_versao integer;
  v_viagem jsonb;
  v_vid    uuid;
  v_at     uuid;
  v_ate    record;
  v_cc     uuid;
  v_vistos uuid[] := '{}';
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT2_AUTH_REQUIRED' USING ERRCODE='P0001',
      HINT='Sessao expirada. Entre novamente para continuar.';
  END IF;
  IF p_solicitacao_id IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'CT2_PARAMETROS_INVALIDOS' USING ERRCODE='P0001',
      HINT='Solicitacao e identificador da operacao sao obrigatorios.';
  END IF;
  IF p_viagens IS NULL OR jsonb_typeof(p_viagens) <> 'array' THEN
    RAISE EXCEPTION 'CT2_PARAMETROS_INVALIDOS' USING ERRCODE='P0001',
      HINT='Lista de viagens invalida.';
  END IF;

  v_sa := public.fn_is_super_admin(v_uid);
  IF NOT v_sa THEN
    IF NOT public.user_has_permission_action(v_uid,'gestao_maquinas_central_transporte_view','editar') THEN
      RAISE EXCEPTION 'CT2_FORBIDDEN' USING ERRCODE='P0001',
        HINT='Sem permissao para planejar a mobilizacao.';
    END IF;
    IF NOT public.fn_ativos_can_access_solicitacao(p_solicitacao_id, v_uid) THEN
      RAISE EXCEPTION 'CT2_SCOPE_DENIED' USING ERRCODE='P0001',
        HINT='Solicitacao fora do seu escopo de acesso.';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('ct3c:plan:' || p_solicitacao_id::text, 0));

  -- Idempotencia: mesmo request_id devolve a versao ja gravada.
  SELECT * INTO v_exist
    FROM public.bd_solicitacoes_planejamento
   WHERE request_id = p_request_id;
  IF v_exist.id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'replay', true,
      'planejamento_id', v_exist.id, 'versao', v_exist.versao,
      'status', v_exist.status_planejamento);
  END IF;

  SELECT sp.status_planejamento INTO v_ate
    FROM public.bd_solicitacoes_planejamento sp
   WHERE sp.solicitacao_id = p_solicitacao_id AND sp.vigente
   FOR UPDATE;
  IF v_ate.status_planejamento = 'PROGRAMADO' THEN
    RAISE EXCEPTION 'CT3C_PLANEJAMENTO_JA_PROGRAMADO' USING ERRCODE='P0001',
      HINT='Ja existe programacao vigente. Cancele-a antes de criar novo rascunho.';
  END IF;

  SELECT coalesce(max(versao),0) + 1 INTO v_versao
    FROM public.bd_solicitacoes_planejamento
   WHERE solicitacao_id = p_solicitacao_id;

  UPDATE public.bd_solicitacoes_planejamento
     SET vigente = false, updated_at = now()
   WHERE solicitacao_id = p_solicitacao_id AND vigente;

  SELECT s.centro_custo_id INTO v_cc
    FROM public.bd_solicitacoes_equipamento s WHERE s.id = p_solicitacao_id;

  INSERT INTO public.bd_solicitacoes_planejamento (
    solicitacao_id, versao, vigente, status_planejamento,
    observacoes, created_by, request_id
  ) VALUES (
    p_solicitacao_id, v_versao, true, 'RASCUNHO',
    nullif(btrim(coalesce(p_observacoes,'')),''), v_uid, p_request_id
  ) RETURNING id INTO v_plan;

  FOR v_viagem IN SELECT * FROM jsonb_array_elements(p_viagens) LOOP
    INSERT INTO public.bd_ct_viagens (
      solicitacao_id, planejamento_id, status, responsavel_transporte, transportadora,
      data_prevista_saida, data_prevista_entrega, origem_descricao, destino_descricao,
      observacoes, created_by
    ) VALUES (
      p_solicitacao_id, v_plan, 'RASCUNHO',
      nullif(btrim(coalesce(v_viagem->>'responsavel_transporte','')),''),
      nullif(btrim(coalesce(v_viagem->>'transportadora','')),''),
      nullif(v_viagem->>'data_prevista_saida','')::date,
      nullif(v_viagem->>'data_prevista_entrega','')::date,
      nullif(btrim(coalesce(v_viagem->>'origem_descricao','')),''),
      nullif(btrim(coalesce(v_viagem->>'destino_descricao','')),''),
      nullif(btrim(coalesce(v_viagem->>'observacoes','')),''),
      v_uid
    ) RETURNING id INTO v_vid;

    FOR v_at IN
      SELECT (value #>> '{}')::uuid
        FROM jsonb_array_elements(coalesce(v_viagem->'atendimento_ids','[]'::jsonb))
    LOOP
      IF v_at = ANY(v_vistos) THEN
        RAISE EXCEPTION 'CT3C_ATIVO_EM_MAIS_DE_UMA_VIAGEM' USING ERRCODE='P0001',
          HINT='Cada ativo reservado pode estar em apenas uma viagem.';
      END IF;
      v_vistos := v_vistos || v_at;

      SELECT a.id, a.equipamento_id, a.status
        INTO v_ate
        FROM public.bd_solicitacao_item_atendimentos a
        JOIN public.bd_solicitacoes_itens si ON si.id = a.solicitacao_item_id
       WHERE a.id = v_at AND si.solicitacao_id = p_solicitacao_id
       FOR UPDATE OF a;

      IF v_ate.id IS NULL THEN
        RAISE EXCEPTION 'CT3C_ATENDIMENTO_INVALIDO' USING ERRCODE='P0001',
          HINT='Atendimento nao pertence a esta solicitacao.';
      END IF;
      IF v_ate.status NOT IN ('RESERVADO','EM_TRANSPORTE') THEN
        RAISE EXCEPTION 'CT3C_ATENDIMENTO_NAO_MOBILIZAVEL' USING ERRCODE='P0001',
          HINT='Somente atendimentos reservados ou em transporte podem ser mobilizados.';
      END IF;

      INSERT INTO public.bd_movimentacoes (
        solicitacao_id, solicitacao_planejamento_id, planejamento_id, viagem_id,
        atendimento_id, equipamento_id, origem_tipo, destino_tipo, destino_id,
        status, created_by
      ) VALUES (
        p_solicitacao_id, v_plan, v_plan, v_vid,
        v_at, v_ate.equipamento_id, 'CENTRO_CUSTO', 'CENTRO_CUSTO', v_cc,
        'RASCUNHO', v_uid
      );
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'replay', false,
    'planejamento_id', v_plan, 'versao', v_versao, 'status', 'RASCUNHO');
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_ct_mobilizacao_salvar_rascunho(uuid,jsonb,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_ct_mobilizacao_salvar_rascunho(uuid,jsonb,uuid,text) TO authenticated, service_role;

-- ---------- FASE H: programar ----------
CREATE OR REPLACE FUNCTION public.fn_ct_mobilizacao_programar(
  p_solicitacao_id uuid,
  p_planejamento_id uuid,
  p_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid  uuid := auth.uid();
  v_sa   boolean;
  v_plan record;
  v_pend integer;
  v_inc  integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT2_AUTH_REQUIRED' USING ERRCODE='P0001',
      HINT='Sessao expirada. Entre novamente para continuar.';
  END IF;
  IF p_solicitacao_id IS NULL OR p_planejamento_id IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'CT2_PARAMETROS_INVALIDOS' USING ERRCODE='P0001',
      HINT='Parametros obrigatorios ausentes.';
  END IF;

  v_sa := public.fn_is_super_admin(v_uid);
  IF NOT v_sa THEN
    IF NOT public.user_has_permission_action(v_uid,'gestao_maquinas_central_transporte_view','editar') THEN
      RAISE EXCEPTION 'CT2_FORBIDDEN' USING ERRCODE='P0001',
        HINT='Sem permissao para programar a mobilizacao.';
    END IF;
    IF NOT public.fn_ativos_can_access_solicitacao(p_solicitacao_id, v_uid) THEN
      RAISE EXCEPTION 'CT2_SCOPE_DENIED' USING ERRCODE='P0001',
        HINT='Solicitacao fora do seu escopo de acesso.';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('ct3c:plan:' || p_solicitacao_id::text, 0));

  SELECT * INTO v_plan
    FROM public.bd_solicitacoes_planejamento
   WHERE id = p_planejamento_id AND solicitacao_id = p_solicitacao_id
   FOR UPDATE;

  IF v_plan.id IS NULL THEN
    RAISE EXCEPTION 'CT3C_PLANEJAMENTO_NAO_ENCONTRADO' USING ERRCODE='P0001',
      HINT='Planejamento inexistente para esta solicitacao.';
  END IF;

  IF v_plan.status_planejamento = 'PROGRAMADO' THEN
    RETURN jsonb_build_object('ok', true, 'replay', true,
      'planejamento_id', v_plan.id, 'versao', v_plan.versao, 'status', 'PROGRAMADO');
  END IF;

  IF NOT v_plan.vigente THEN
    RAISE EXCEPTION 'CT3C_VERSAO_SUPERADA' USING ERRCODE='P0001',
      HINT='Esta versao do planejamento foi superada. Recarregue a pagina.';
  END IF;

  -- Todo ativo reservado precisa estar em exatamente uma viagem desta versao.
  SELECT count(*) INTO v_pend
    FROM public.bd_solicitacao_item_atendimentos a
    JOIN public.bd_solicitacoes_itens si ON si.id = a.solicitacao_item_id
   WHERE si.solicitacao_id = p_solicitacao_id
     AND a.status IN ('RESERVADO','EM_TRANSPORTE')
     AND NOT EXISTS (
       SELECT 1 FROM public.bd_movimentacoes m
        WHERE m.atendimento_id = a.id
          AND m.planejamento_id = v_plan.id
          AND coalesce(m.status,'') <> 'CANCELADA'
     );

  IF v_pend > 0 THEN
    RAISE EXCEPTION 'CT3C_ATIVOS_SEM_VIAGEM' USING ERRCODE='P0001',
      HINT='Existem ativos reservados sem viagem atribuida.';
  END IF;

  -- Toda viagem precisa de responsavel e datas previstas.
  SELECT count(*) INTO v_inc
    FROM public.bd_ct_viagens v
   WHERE v.planejamento_id = v_plan.id
     AND v.status <> 'CANCELADA'
     AND (coalesce(btrim(v.responsavel_transporte),'') = ''
          OR v.data_prevista_saida IS NULL
          OR v.data_prevista_entrega IS NULL);

  IF v_inc > 0 THEN
    RAISE EXCEPTION 'CT3C_VIAGEM_INCOMPLETA' USING ERRCODE='P0001',
      HINT='Informe responsavel, data de saida e data de entrega em todas as viagens.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.bd_ct_viagens v
                  WHERE v.planejamento_id = v_plan.id AND v.status <> 'CANCELADA') THEN
    RAISE EXCEPTION 'CT3C_SEM_VIAGENS' USING ERRCODE='P0001',
      HINT='Crie ao menos uma viagem antes de programar.';
  END IF;

  UPDATE public.bd_ct_viagens
     SET status = 'PROGRAMADA', updated_at = now()
   WHERE planejamento_id = v_plan.id AND status = 'RASCUNHO';

  UPDATE public.bd_movimentacoes
     SET status = 'PROGRAMADA', updated_at = now()
   WHERE planejamento_id = v_plan.id AND coalesce(status,'') = 'RASCUNHO';

  UPDATE public.bd_solicitacoes_planejamento
     SET status_planejamento = 'PROGRAMADO',
         programado_em = now(),
         programado_por = v_uid,
         updated_at = now()
   WHERE id = v_plan.id;

  RETURN jsonb_build_object('ok', true, 'replay', false,
    'planejamento_id', v_plan.id, 'versao', v_plan.versao, 'status', 'PROGRAMADO');
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_ct_mobilizacao_programar(uuid,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_ct_mobilizacao_programar(uuid,uuid,uuid) TO authenticated, service_role;

-- ---------- FASE C: trava de edicao da condicao operacional ----------
CREATE OR REPLACE FUNCTION public.fn_ct_ativo_edicao_permitida(p_equipamento_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_hoje date;
  v_c   record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT2_AUTH_REQUIRED' USING ERRCODE='P0001',
      HINT='Sessao expirada. Entre novamente para continuar.';
  END IF;
  IF p_equipamento_id IS NULL THEN
    RAISE EXCEPTION 'CT2_PARAMETROS_INVALIDOS' USING ERRCODE='P0001',
      HINT='Equipamento obrigatorio.';
  END IF;

  v_hoje := (now() AT TIME ZONE 'America/Sao_Paulo')::date;

  SELECT a.id, a.status, a.periodo_inicio, a.periodo_fim
    INTO v_c
    FROM public.bd_solicitacao_item_atendimentos a
   WHERE a.equipamento_id = p_equipamento_id
     AND a.status IN ('RESERVADO','EM_TRANSPORTE','ENTREGUE')
     AND a.periodo_fim >= v_hoje
   ORDER BY a.periodo_inicio
   LIMIT 1;

  IF v_c.id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', true, 'permitida', true, 'motivo', NULL,
      'compromisso_status', NULL, 'periodo_inicio', NULL, 'periodo_fim', NULL,
      'exige_justificativa', false);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'permitida', false,
    'motivo', 'CT25_ATIVO_COMPROMETIDO',
    'compromisso_status', v_c.status,
    'periodo_inicio', v_c.periodo_inicio,
    'periodo_fim', v_c.periodo_fim,
    'exige_justificativa', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_ct_ativo_edicao_permitida(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_ct_ativo_edicao_permitida(uuid) TO authenticated, service_role;

-- Upsert com trava CT-2.5 (assinatura ADITIVA: 9o parametro opcional)
CREATE OR REPLACE FUNCTION public.fn_ct_disponibilidade_upsert(
  p_equipamento_id uuid,
  p_status_operacional text,
  p_previsao_liberacao date DEFAULT NULL::date,
  p_centro_custo_id uuid DEFAULT NULL::uuid,
  p_confiabilidade text DEFAULT NULL::text,
  p_data_inicio date DEFAULT NULL::date,
  p_motivo_risco text DEFAULT NULL::text,
  p_observacao text DEFAULT NULL::text,
  p_justificativa_excecao text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid   uuid;
  v_sa    boolean;
  v_row   record;
  v_id    uuid;
  v_criou boolean := false;
  v_trava jsonb;
  v_just  text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT2_AUTH_REQUIRED' USING ERRCODE = 'P0001',
      HINT = 'Sessao expirada. Entre novamente para continuar.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_uid) THEN
    RAISE EXCEPTION 'CT2_PROFILE_NOT_FOUND' USING ERRCODE = 'P0001',
      HINT = 'Perfil de usuario inexistente.';
  END IF;

  IF p_equipamento_id IS NULL THEN
    RAISE EXCEPTION 'CT2_PARAMETROS_INVALIDOS' USING ERRCODE = 'P0001',
      HINT = 'Equipamento obrigatorio.';
  END IF;

  IF p_status_operacional IS NULL
     OR p_status_operacional NOT IN ('DISPONIVEL','ALOCADO','MANUTENCAO','INDISPONIVEL') THEN
    RAISE EXCEPTION 'CT2_STATUS_INVALIDO' USING ERRCODE = 'P0001',
      HINT = 'Escolha um status operacional valido.';
  END IF;

  IF p_confiabilidade IS NOT NULL AND p_confiabilidade NOT IN ('ALTA','MEDIA','BAIXA') THEN
    RAISE EXCEPTION 'CT2_PARAMETROS_INVALIDOS' USING ERRCODE = 'P0001',
      HINT = 'Confiabilidade invalida.';
  END IF;

  v_sa := public.fn_is_super_admin(v_uid);

  IF NOT v_sa THEN
    IF NOT public.user_has_permission_action(v_uid, 'gestao_maquinas_central_transporte_view', 'editar') THEN
      RAISE EXCEPTION 'CT2_FORBIDDEN' USING ERRCODE = 'P0001',
        HINT = 'Sem permissao para regularizar disponibilidade operacional.';
    END IF;
    IF NOT public.fn_ativos_can_access_equipamento(p_equipamento_id, v_uid) THEN
      RAISE EXCEPTION 'CT2_SCOPE_DENIED' USING ERRCODE = 'P0001',
        HINT = 'Equipamento fora do seu escopo de acesso.';
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.bd_caminhoes_equipamentos e WHERE e.id = p_equipamento_id) THEN
    RAISE EXCEPTION 'CT2_EQUIPAMENTO_NAO_ENCONTRADO' USING ERRCODE = 'P0001',
      HINT = 'O equipamento informado nao existe.';
  END IF;

  -- CT-2.5: ativo com compromisso vigente/futuro na Central so pode ser
  -- editado manualmente com justificativa de excecao registrada.
  v_trava := public.fn_ct_ativo_edicao_permitida(p_equipamento_id);
  v_just  := nullif(btrim(coalesce(p_justificativa_excecao,'')),'');

  IF (v_trava->>'permitida') = 'false' THEN
    IF v_just IS NULL THEN
      RAISE EXCEPTION 'CT25_ATIVO_COMPROMETIDO' USING ERRCODE = 'P0001',
        HINT = 'Este ativo possui compromisso na Central do Transporte. Encerre o compromisso ou informe uma justificativa de excecao.';
    END IF;
    IF length(v_just) < 20 THEN
      RAISE EXCEPTION 'CT25_JUSTIFICATIVA_INSUFICIENTE' USING ERRCODE = 'P0001',
        HINT = 'A justificativa de excecao precisa de ao menos 20 caracteres.';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('ct2:disp:' || p_equipamento_id::text, 0));

  SELECT d.id INTO v_row
    FROM public.bd_disponibilidade_equipamentos d
   WHERE d.equipamento_id = p_equipamento_id
   ORDER BY d.updated_at DESC NULLS LAST, d.created_at DESC NULLS LAST, d.id DESC
   LIMIT 1
   FOR UPDATE;

  IF v_row.id IS NULL THEN
    INSERT INTO public.bd_disponibilidade_equipamentos (
      equipamento_id, status_operacional, centro_custo_id, data_inicio,
      previsao_liberacao, confiabilidade_previsao, motivo_risco, observacao
    ) VALUES (
      p_equipamento_id, p_status_operacional::status_operacional_enum, p_centro_custo_id, p_data_inicio,
      p_previsao_liberacao, nullif(p_confiabilidade,'')::confiabilidade_previsao_enum,
      nullif(btrim(coalesce(p_motivo_risco,'')),''), nullif(btrim(coalesce(p_observacao,'')),'')
    )
    RETURNING id INTO v_id;
    v_criou := true;
  ELSE
    UPDATE public.bd_disponibilidade_equipamentos
       SET status_operacional      = p_status_operacional::status_operacional_enum,
           centro_custo_id         = p_centro_custo_id,
           data_inicio             = p_data_inicio,
           previsao_liberacao      = p_previsao_liberacao,
           confiabilidade_previsao = nullif(p_confiabilidade,'')::confiabilidade_previsao_enum,
           motivo_risco            = nullif(btrim(coalesce(p_motivo_risco,'')),''),
           observacao              = nullif(btrim(coalesce(p_observacao,'')),''),
           updated_at              = now()
     WHERE id = v_row.id
    RETURNING id INTO v_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'criou', v_criou,
    'disponibilidade_id', v_id,
    'equipamento_id', p_equipamento_id,
    'status_operacional', p_status_operacional,
    'excecao_registrada', (v_just IS NOT NULL AND (v_trava->>'permitida') = 'false')
  );
END;
$function$;