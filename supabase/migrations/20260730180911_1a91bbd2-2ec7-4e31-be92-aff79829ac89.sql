-- ============================================================
-- CT-2.2 — Integridade de reserva e estado efetivo dos ativos
-- ============================================================

-- ---------- 0. PRECHECK ----------
DO $precheck$
DECLARE
  v_conf   integer;
  v_pares  text;
  v_md5    text;
BEGIN
  SELECT count(*)::integer,
         string_agg(DISTINCT a.id::text || ' x ' || b.id::text, ', ')
    INTO v_conf, v_pares
    FROM public.bd_solicitacao_item_atendimentos a
    JOIN public.bd_solicitacao_item_atendimentos b
      ON b.equipamento_id = a.equipamento_id
     AND b.id > a.id
     AND daterange(a.periodo_inicio, a.periodo_fim, '[]')
      && daterange(b.periodo_inicio, b.periodo_fim, '[]')
   WHERE a.status IN ('RESERVADO','EM_TRANSPORTE','ENTREGUE')
     AND b.status IN ('RESERVADO','EM_TRANSPORTE','ENTREGUE');

  IF v_conf > 0 THEN
    RAISE EXCEPTION 'CT2_2_PRECHECK_SOBREPOSICAO_ATIVA: % par(es) em conflito: %', v_conf, v_pares;
  END IF;

  SELECT md5(p.prosrc) INTO v_md5
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'fn_ct_atendimento_atribuir';
  IF v_md5 IS DISTINCT FROM '3090aca2257b9850f046ada6156e272d' THEN
    RAISE EXCEPTION 'CT2_2_PRECHECK_HASH_DIVERGENTE: fn_ct_atendimento_atribuir (%).', coalesce(v_md5,'ausente');
  END IF;

  SELECT md5(p.prosrc) INTO v_md5
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'fn_ct_atendimento_substituir';
  IF v_md5 IS DISTINCT FROM '4bfdfb11776b5aefcbba02b52a38c858' THEN
    RAISE EXCEPTION 'CT2_2_PRECHECK_HASH_DIVERGENTE: fn_ct_atendimento_substituir (%).', coalesce(v_md5,'ausente');
  END IF;
END;
$precheck$;

-- ---------- 1. EXTENSAO + EXCLUSION CONSTRAINT ----------
CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $ext$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'btree_gist') THEN
    RAISE EXCEPTION 'CT2_2_BTREE_GIST_INDISPONIVEL: extensao btree_gist nao pode ser instalada; migration abortada.';
  END IF;
END;
$ext$;

ALTER TABLE public.bd_solicitacao_item_atendimentos
  DROP CONSTRAINT IF EXISTS excl_sia_equip_periodo_ativo;

ALTER TABLE public.bd_solicitacao_item_atendimentos
  ADD CONSTRAINT excl_sia_equip_periodo_ativo
  EXCLUDE USING gist (
    equipamento_id WITH =,
    daterange(periodo_inicio, periodo_fim, '[]') WITH &&
  ) WHERE (status IN ('RESERVADO','EM_TRANSPORTE','ENTREGUE'));

COMMENT ON CONSTRAINT excl_sia_equip_periodo_ativo ON public.bd_solicitacao_item_atendimentos
  IS 'CT2.2: impede dupla reserva do mesmo equipamento em periodos sobrepostos (status ativos).';

-- ---------- 2. fn_ct_atendimento_atribuir ----------
CREATE OR REPLACE FUNCTION public.fn_ct_atendimento_atribuir(
  p_solicitacao_item_id uuid,
  p_equipamento_id uuid,
  p_modalidade text,
  p_request_id uuid,
  p_periodo_inicio date DEFAULT NULL::date,
  p_periodo_fim date DEFAULT NULL::date,
  p_justificativa_override text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_sa         boolean;
  v_apr        boolean;
  v_uid        uuid;
  v_item       record;
  v_sol        record;
  v_equip      record;
  v_match      jsonb;
  v_disp       jsonb;
  v_dias       integer;
  v_jan_ini    date;
  v_jan_fim    date;
  v_per_ini    date;
  v_per_fim    date;
  v_ovr_per    boolean;
  v_ovr_disp   boolean;
  v_just       text;
  v_ctx        jsonb;
  v_new_id     uuid;
  v_exist      record;
  v_equiv      boolean;
  v_conflito   integer;
  v_constraint text;
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

  v_sa := public.fn_is_super_admin(v_uid);

  IF p_request_id IS NULL OR p_solicitacao_item_id IS NULL OR p_equipamento_id IS NULL THEN
    RAISE EXCEPTION 'CT2_PARAMETROS_INVALIDOS' USING ERRCODE = 'P0001',
      HINT = 'Dados obrigatorios ausentes na atribuicao.';
  END IF;

  IF p_modalidade IS NULL OR p_modalidade NOT IN ('INTERNO','RESERVA_FUTURA') THEN
    RAISE EXCEPTION 'CT2_MODALIDADE_INVALIDA' USING ERRCODE = 'P0001',
      HINT = 'Modalidade deve ser interna ou reserva futura.';
  END IF;

  -- Serializacao determinista da chave de idempotencia
  PERFORM pg_advisory_xact_lock(hashtextextended('ct2:req:' || p_request_id::text, 0));

  -- Matriz global de request_id: reuso entre criacao e encerramento e proibido
  IF EXISTS (
    SELECT 1 FROM public.bd_solicitacao_item_atendimentos x
     WHERE x.request_id_encerramento = p_request_id
  ) THEN
    RAISE EXCEPTION 'CT2_IDEMPOTENCY_KEY_REUSED' USING ERRCODE = 'P0001',
      HINT = 'Esta operacao ja foi registrada com parametros diferentes.';
  END IF;

  SELECT * INTO v_exist
    FROM public.bd_solicitacao_item_atendimentos x
   WHERE x.request_id_criacao = p_request_id
   FOR UPDATE;

  IF v_exist.id IS NOT NULL THEN
    v_equiv := v_exist.solicitacao_item_id = p_solicitacao_item_id
      AND v_exist.equipamento_id = p_equipamento_id
      AND v_exist.modalidade = p_modalidade
      AND v_exist.created_by = v_uid
      AND (p_periodo_inicio IS NULL OR v_exist.periodo_inicio = p_periodo_inicio)
      AND (p_periodo_fim IS NULL OR v_exist.periodo_fim = p_periodo_fim)
      AND coalesce(btrim(v_exist.justificativa_override), '') = coalesce(btrim(p_justificativa_override), '');
    IF v_equiv IS NOT TRUE THEN
      RAISE EXCEPTION 'CT2_IDEMPOTENCY_KEY_REUSED' USING ERRCODE = 'P0001',
        HINT = 'Esta operacao ja foi registrada com parametros diferentes.';
    END IF;
    -- GATE PRE-REPLAY: capability + escopo antes de devolver qualquer conteudo
    SELECT s.* INTO v_sol
      FROM public.bd_solicitacoes_equipamento s
      JOIN public.bd_solicitacoes_itens i ON i.solicitacao_id = s.id
     WHERE i.id = v_exist.solicitacao_item_id;
    IF NOT v_sa THEN
      IF NOT public.user_has_permission_action(v_uid, 'gestao_maquinas_central_transporte_view', 'criar') THEN
        RAISE EXCEPTION 'CT2_FORBIDDEN' USING ERRCODE = 'P0001',
          HINT = 'Sem permissao para atribuir equipamento na Central do Transporte.';
      END IF;
      IF v_sol.id IS NULL OR NOT public.fn_ativos_can_access_solicitacao(v_sol.id, v_uid) THEN
        RAISE EXCEPTION 'CT2_SCOPE_DENIED' USING ERRCODE = 'P0001',
          HINT = 'Solicitacao fora do seu escopo de acesso.';
      END IF;
      IF NOT public.fn_ativos_can_access_equipamento(v_exist.equipamento_id, v_uid)
         OR NOT public.fn_ativos_can_access_equipamento(p_equipamento_id, v_uid) THEN
        RAISE EXCEPTION 'CT2_SCOPE_DENIED' USING ERRCODE = 'P0001',
          HINT = 'Equipamento fora do seu escopo de acesso.';
      END IF;
    END IF;
    RETURN jsonb_build_object(
      'ok', true,
      'replay', true,
      'atendimento', public.fn_ct_atendimento_json(v_exist.id),
      'item', public.fn_ct_item_resumo_json(v_exist.solicitacao_item_id)
    );
  END IF;

  -- CT2.2: trava transacional por equipamento (anti dupla reserva concorrente)
  PERFORM pg_advisory_xact_lock(hashtextextended('ct2:equip:' || p_equipamento_id::text, 0));

  -- Locks antes das leituras de decisao (anti-TOCTOU)
  SELECT i.* INTO v_item
    FROM public.bd_solicitacoes_itens i
   WHERE i.id = p_solicitacao_item_id
   FOR UPDATE;

  IF v_item.id IS NULL THEN
    RAISE EXCEPTION 'CT2_ITEM_NAO_ENCONTRADO' USING ERRCODE = 'P0001',
      HINT = 'O item da solicitacao nao existe.';
  END IF;

  SELECT s.* INTO v_sol
    FROM public.bd_solicitacoes_equipamento s
   WHERE s.id = v_item.solicitacao_id;

  IF v_sol.id IS NULL THEN
    RAISE EXCEPTION 'CT2_SOLICITACAO_NAO_ENCONTRADA' USING ERRCODE = 'P0001',
      HINT = 'A solicitacao vinculada nao existe.';
  END IF;

  IF NOT v_sa THEN
    IF NOT public.user_has_permission_action(v_uid, 'gestao_maquinas_central_transporte_view', 'criar') THEN
      RAISE EXCEPTION 'CT2_FORBIDDEN' USING ERRCODE = 'P0001',
        HINT = 'Sem permissao para atribuir equipamento na Central do Transporte.';
    END IF;
    IF NOT public.fn_ativos_can_access_solicitacao(v_sol.id, v_uid) THEN
      RAISE EXCEPTION 'CT2_SCOPE_DENIED' USING ERRCODE = 'P0001',
        HINT = 'Solicitacao fora do seu escopo de acesso.';
    END IF;
    IF NOT public.fn_ativos_can_access_equipamento(p_equipamento_id, v_uid) THEN
      RAISE EXCEPTION 'CT2_SCOPE_DENIED' USING ERRCODE = 'P0001',
        HINT = 'Equipamento fora do seu escopo de acesso.';
    END IF;
  END IF;

  SELECT e.* INTO v_equip
    FROM public.bd_caminhoes_equipamentos e
   WHERE e.id = p_equipamento_id
   FOR UPDATE;

  IF v_equip.id IS NULL THEN
    RAISE EXCEPTION 'CT2_EQUIPAMENTO_NAO_ENCONTRADO' USING ERRCODE = 'P0001',
      HINT = 'O equipamento informado nao existe.';
  END IF;

  -- Janela aprovada: a primeira atribuicao do item fixa a janela
  v_dias := greatest(coalesce(v_item.tempo_previsto_dias, v_sol.tempo_previsto_dias, 1), 1);
  v_jan_ini := v_sol.data_inicio;
  IF v_jan_ini IS NULL THEN
    RAISE EXCEPTION 'CT2_JANELA_INDEFINIDA' USING ERRCODE = 'P0001',
      HINT = 'A solicitacao nao possui data de inicio definida.';
  END IF;
  v_jan_fim := v_jan_ini + (v_dias - 1);

  SELECT a.janela_aprovada_inicio, a.janela_aprovada_fim
    INTO v_per_ini, v_per_fim
    FROM public.bd_solicitacao_item_atendimentos a
   WHERE a.solicitacao_item_id = p_solicitacao_item_id
   ORDER BY a.created_at ASC, a.id ASC
   LIMIT 1;

  IF v_per_ini IS NOT NULL THEN
    v_jan_ini := v_per_ini;
    v_jan_fim := v_per_fim;
  END IF;

  v_per_ini := coalesce(p_periodo_inicio, v_jan_ini);
  v_per_fim := coalesce(p_periodo_fim, v_jan_fim);

  IF v_per_fim < v_per_ini THEN
    RAISE EXCEPTION 'CT2_PERIODO_INVALIDO' USING ERRCODE = 'P0001',
      HINT = 'A data final nao pode ser anterior a inicial.';
  END IF;

  v_ovr_per := (v_per_ini <> v_jan_ini) OR (v_per_fim <> v_jan_fim);

  v_match := public.fn_ct_avaliar_match(p_solicitacao_item_id, p_equipamento_id);
  IF (v_match->>'compativel')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'CT2_EQUIPAMENTO_INCOMPATIVEL' USING ERRCODE = 'P0001',
      HINT = 'Equipamento incompativel com o item solicitado.';
  END IF;

  v_disp := public.fn_ct_avaliar_disponibilidade(p_equipamento_id, p_modalidade, v_per_ini);
  v_ovr_disp := (v_disp->>'override')::boolean;

  -- G0/CT2: ativo sem linha operacional nunca e reservavel (fail-closed, sem override).
  IF coalesce(v_disp->>'status', 'SEM_REGISTRO') = 'SEM_REGISTRO' THEN
    RAISE EXCEPTION 'CT2_DISPONIBILIDADE_SEM_REGISTRO' USING ERRCODE = 'P0001',
      HINT = 'Regularize a disponibilidade operacional do ativo antes de continuar.';
  END IF;

  v_just := nullif(btrim(coalesce(p_justificativa_override, '')), '');
  v_apr := v_sa OR public.user_has_permission_action(v_uid, 'gestao_maquinas_central_transporte_view', 'aprovar');

  IF v_match->>'tipo' = 'PARCIAL' AND NOT v_apr THEN
    RAISE EXCEPTION 'CT2_MATCH_PARCIAL_BLOQUEADO' USING ERRCODE = 'P0001',
      HINT = 'Match PARCIAL exige permissao de aprovacao.';
  END IF;

  IF v_ovr_per AND NOT v_apr THEN
    RAISE EXCEPTION 'CT2_PERIODO_FORA_JANELA' USING ERRCODE = 'P0001',
      HINT = 'Periodo fora da janela aprovada exige permissao de aprovacao.';
  END IF;

  IF v_ovr_disp AND NOT v_apr THEN
    RAISE EXCEPTION 'CT2_DISPONIBILIDADE_BLOQUEADA' USING ERRCODE = 'P0001',
      HINT = 'Override de disponibilidade exige permissao de aprovacao.';
  END IF;

  IF (v_match->>'tipo' = 'PARCIAL' OR v_ovr_per OR v_ovr_disp)
     AND (v_just IS NULL OR length(v_just) < 20) THEN
    RAISE EXCEPTION 'CT2_JUSTIFICATIVA_OBRIGATORIA' USING ERRCODE = 'P0001',
      HINT = 'Informe uma justificativa com no minimo 20 caracteres.';
  END IF;

  -- Reserva por janela: overlap no mesmo equipamento (inclusivo, sob lock)
  SELECT count(*)::integer INTO v_conflito
    FROM public.bd_solicitacao_item_atendimentos a
   WHERE a.equipamento_id = p_equipamento_id
     AND a.status IN ('RESERVADO','EM_TRANSPORTE','ENTREGUE')
     AND a.periodo_inicio <= v_per_fim
     AND a.periodo_fim >= v_per_ini;

  IF v_conflito > 0 THEN
    RAISE EXCEPTION 'CT2_EQUIPAMENTO_EM_CONFLITO' USING ERRCODE = 'P0001',
      HINT = 'O equipamento ja possui um compromisso ativo no periodo informado.';
  END IF;

  v_ctx := jsonb_build_object(
    'versao', 'CT2_M2_R4',
    'operacao', 'ATRIBUICAO',
    'match', jsonb_build_object(
      'tipo', v_match->>'tipo',
      'via', v_match->>'via',
      'motivo', v_match->>'motivo'
    ),
    'disponibilidade', jsonb_build_object(
      'status', v_disp->>'status',
      'override', v_ovr_disp::text,
      'reconciliado', v_disp->>'reconciliado',
      'previsao_liberacao', v_disp->>'previsao_liberacao'
    ),
    'periodo', jsonb_build_object(
      'override', v_ovr_per::text,
      'periodo_inicio', v_per_ini::text,
      'periodo_fim', v_per_fim::text,
      'janela_aprovada_inicio', v_jan_ini::text,
      'janela_aprovada_fim', v_jan_fim::text
    )
  );

  BEGIN
    INSERT INTO public.bd_solicitacao_item_atendimentos (
      solicitacao_item_id, equipamento_id, modalidade, status,
      periodo_inicio, periodo_fim, janela_aprovada_inicio, janela_aprovada_fim,
      override_periodo, override_disponibilidade, match_tipo,
      justificativa_override, contexto_decisao, request_id_criacao, created_by
    ) VALUES (
      p_solicitacao_item_id, p_equipamento_id, p_modalidade, 'RESERVADO',
      v_per_ini, v_per_fim, v_jan_ini, v_jan_fim,
      v_ovr_per, v_ovr_disp, v_match->>'tipo',
      v_just, v_ctx, p_request_id, v_uid
    )
    RETURNING id INTO v_new_id;
  EXCEPTION
  WHEN exclusion_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint = 'excl_sia_equip_periodo_ativo' THEN
      RAISE EXCEPTION 'CT2_EQUIPAMENTO_EM_CONFLITO' USING ERRCODE = 'P0001',
        HINT = 'O equipamento ja possui um compromisso ativo no periodo informado.';
    ELSE
      RAISE;
    END IF;
  WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint = 'uq_sia_request_id_criacao' THEN
      SELECT * INTO v_exist
        FROM public.bd_solicitacao_item_atendimentos x
       WHERE x.request_id_criacao = p_request_id;
      v_equiv := v_exist.id IS NOT NULL
        AND v_exist.solicitacao_item_id = p_solicitacao_item_id
        AND v_exist.equipamento_id = p_equipamento_id
        AND v_exist.modalidade = p_modalidade
        AND v_exist.created_by = v_uid
        AND v_exist.periodo_inicio = v_per_ini
        AND v_exist.periodo_fim = v_per_fim
        AND coalesce(btrim(v_exist.justificativa_override), '') = coalesce(v_just, '');
      IF v_equiv IS NOT TRUE THEN
        RAISE EXCEPTION 'CT2_IDEMPOTENCY_KEY_REUSED' USING ERRCODE = 'P0001',
          HINT = 'Esta operacao ja foi registrada com parametros diferentes.';
      END IF;
      RETURN jsonb_build_object(
        'ok', true,
        'replay', true,
        'atendimento', public.fn_ct_atendimento_json(v_exist.id),
        'item', public.fn_ct_item_resumo_json(v_exist.solicitacao_item_id)
      );
    ELSIF v_constraint = 'uq_sia_item_equip_ativo' THEN
      RAISE EXCEPTION 'CT2_EQUIPAMENTO_EM_CONFLITO' USING ERRCODE = 'P0001',
        HINT = 'Este equipamento ja esta atribuido a este item.';
    ELSE
      RAISE EXCEPTION 'CT2_INVARIANTE_VIOLADA' USING ERRCODE = 'P0001',
        HINT = 'A operacao violou uma regra de integridade do atendimento.';
    END IF;
  END;

  PERFORM public.fn_ct_recalcular_status_item(p_solicitacao_item_id);

  RETURN jsonb_build_object(
    'ok', true,
    'replay', false,
    'atendimento', public.fn_ct_atendimento_json(v_new_id),
    'item', public.fn_ct_item_resumo_json(p_solicitacao_item_id)
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.fn_ct_atendimento_atribuir(uuid,uuid,text,uuid,date,date,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_ct_atendimento_atribuir(uuid,uuid,text,uuid,date,date,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_ct_atendimento_atribuir(uuid,uuid,text,uuid,date,date,text) TO authenticated;
COMMENT ON FUNCTION public.fn_ct_atendimento_atribuir(uuid,uuid,text,uuid,date,date,text)
  IS 'CT2_G0 hard block CT2_DISPONIBILIDADE_SEM_REGISTRO | CT2.2 advisory lock por equipamento + 23P01 -> CT2_EQUIPAMENTO_EM_CONFLITO';

-- ---------- 3. fn_ct_atendimento_substituir ----------
CREATE OR REPLACE FUNCTION public.fn_ct_atendimento_substituir(
  p_atendimento_id uuid,
  p_novo_equipamento_id uuid,
  p_modalidade text,
  p_motivo text,
  p_request_id uuid,
  p_justificativa_override text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_sa         boolean;
  v_apr        boolean;
  v_uid          uuid;
  v_ant          record;
  v_new          record;
  v_at0          record;
  v_item0        uuid;
  v_equip0       uuid;
  v_item         record;
  v_sol          record;
  v_equip        record;
  v_match        jsonb;
  v_disp         jsonb;
  v_ovr_disp     boolean;
  v_motivo       text;
  v_just_efetiva text;
  v_ctx          jsonb;
  v_new_id       uuid;
  v_ctxn         jsonb;
  v_par_ok       boolean;
  v_equiv        boolean;
  v_conflito     integer;
  v_constraint   text;
  v_locks        uuid[];
  v_lock_id      uuid;
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

  v_sa := public.fn_is_super_admin(v_uid);

  IF p_request_id IS NULL OR p_atendimento_id IS NULL OR p_novo_equipamento_id IS NULL THEN
    RAISE EXCEPTION 'CT2_PARAMETROS_INVALIDOS' USING ERRCODE = 'P0001',
      HINT = 'Dados obrigatorios ausentes na substituicao.';
  END IF;

  IF p_modalidade IS NULL OR p_modalidade NOT IN ('INTERNO','RESERVA_FUTURA') THEN
    RAISE EXCEPTION 'CT2_MODALIDADE_INVALIDA' USING ERRCODE = 'P0001',
      HINT = 'Modalidade deve ser interna ou reserva futura.';
  END IF;

  v_motivo := btrim(coalesce(p_motivo, ''));
  IF length(v_motivo) < 20 THEN
    RAISE EXCEPTION 'CT2_MOTIVO_OBRIGATORIO' USING ERRCODE = 'P0001',
      HINT = 'Informe um motivo com no minimo 20 caracteres.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('ct2:req:' || p_request_id::text, 0));

  SELECT a.solicitacao_item_id, a.equipamento_id, a.justificativa_override
    INTO v_at0
    FROM public.bd_solicitacao_item_atendimentos a
   WHERE a.id = p_atendimento_id
   FOR UPDATE;

  v_item0  := v_at0.solicitacao_item_id;
  v_equip0 := v_at0.equipamento_id;
  v_just_efetiva := nullif(btrim(coalesce(p_justificativa_override, v_at0.justificativa_override, '')), '');

  SELECT * INTO v_ant
    FROM public.bd_solicitacao_item_atendimentos x
   WHERE x.request_id_encerramento = p_request_id
   FOR UPDATE;

  SELECT * INTO v_new
    FROM public.bd_solicitacao_item_atendimentos x
   WHERE x.request_id_criacao = p_request_id
   FOR UPDATE;

  -- BLOCO UNICO DE REPLAY DE SUBSTITUICAO (identico ao do handler)
  v_ctxn := v_new.contexto_decisao;
  v_par_ok := v_ant.id IS NOT NULL AND v_new.id IS NOT NULL
    AND v_ant.request_id_encerramento = p_request_id
    AND v_new.request_id_criacao = p_request_id
    AND v_ant.status = 'LIBERADO'
    AND v_new.status = 'RESERVADO'
    AND v_ant.solicitacao_item_id = v_new.solicitacao_item_id
    AND v_ant.periodo_inicio = v_new.periodo_inicio
    AND v_ant.periodo_fim = v_new.periodo_fim
    AND v_ant.janela_aprovada_inicio = v_new.janela_aprovada_inicio
    AND v_ant.janela_aprovada_fim = v_new.janela_aprovada_fim
    AND v_ant.override_periodo = v_new.override_periodo
    AND v_ctxn IS NOT NULL AND jsonb_typeof(v_ctxn) = 'object'
    AND v_ctxn->>'versao' = 'CT2_M2_R4'
    AND jsonb_typeof(v_ctxn->'substituicao') = 'object'
    AND jsonb_typeof(v_ctxn->'match') = 'object'
    AND jsonb_typeof(v_ctxn->'disponibilidade') = 'object'
    AND jsonb_typeof(v_ctxn->'periodo') = 'object'
    AND v_new.match_tipo = (v_ctxn #>> '{match,tipo}')
    AND v_new.override_disponibilidade::text = (v_ctxn #>> '{disponibilidade,override}')
    AND v_new.override_periodo::text = (v_ctxn #>> '{periodo,override}')
    AND v_new.periodo_inicio::text = (v_ctxn #>> '{periodo,periodo_inicio}')
    AND v_new.periodo_fim::text = (v_ctxn #>> '{periodo,periodo_fim}')
    AND v_new.janela_aprovada_inicio::text = (v_ctxn #>> '{periodo,janela_aprovada_inicio}')
    AND v_new.janela_aprovada_fim::text = (v_ctxn #>> '{periodo,janela_aprovada_fim}')
    AND (v_ctxn #>> '{substituicao,atendimento_anterior_id}') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND (v_ctxn #>> '{substituicao,equipamento_anterior_id}') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND lower(v_ctxn #>> '{substituicao,atendimento_anterior_id}') = lower(v_ant.id::text)
    AND lower(v_ctxn #>> '{substituicao,equipamento_anterior_id}') = lower(v_ant.equipamento_id::text);

  IF (v_ant.id IS NOT NULL OR v_new.id IS NOT NULL) AND v_par_ok IS NOT TRUE THEN
    RAISE EXCEPTION 'CT2_IDEMPOTENCY_STATE_INCONSISTENT' USING ERRCODE = 'P0001',
      HINT = 'A substituicao anterior ficou incompleta ou inconsistente; recarregue a tela.';
  END IF;

  IF v_par_ok IS TRUE THEN
    v_equiv := v_ant.id = p_atendimento_id
      AND v_ant.equipamento_id = v_equip0
      AND v_new.equipamento_id = p_novo_equipamento_id
      AND v_new.solicitacao_item_id = v_item0
      AND v_new.modalidade = p_modalidade
      AND btrim(coalesce(v_ant.motivo_encerramento, '')) = v_motivo
      AND coalesce(btrim(v_new.justificativa_override), '') = coalesce(v_just_efetiva, '')
      AND v_ant.encerrado_por = v_uid
      AND v_new.created_by = v_uid;
    IF v_equiv IS NOT TRUE THEN
      RAISE EXCEPTION 'CT2_IDEMPOTENCY_KEY_REUSED' USING ERRCODE = 'P0001',
        HINT = 'Esta operacao ja foi registrada com parametros diferentes.';
    END IF;
    -- GATE PRE-REPLAY: capability + escopo antes de devolver qualquer conteudo
    SELECT s.* INTO v_sol
      FROM public.bd_solicitacoes_equipamento s
      JOIN public.bd_solicitacoes_itens i ON i.solicitacao_id = s.id
     WHERE i.id = v_new.solicitacao_item_id;
    IF NOT v_sa THEN
      IF NOT public.user_has_permission_action(v_uid, 'gestao_maquinas_central_transporte_view', 'criar')
         OR NOT public.user_has_permission_action(v_uid, 'gestao_maquinas_central_transporte_view', 'editar') THEN
        RAISE EXCEPTION 'CT2_FORBIDDEN' USING ERRCODE = 'P0001',
          HINT = 'Sem permissao para substituir atendimento na Central do Transporte.';
      END IF;
      IF v_sol.id IS NULL OR NOT public.fn_ativos_can_access_solicitacao(v_sol.id, v_uid) THEN
        RAISE EXCEPTION 'CT2_SCOPE_DENIED' USING ERRCODE = 'P0001',
          HINT = 'Solicitacao fora do seu escopo de acesso.';
      END IF;
      IF NOT public.fn_ativos_can_access_equipamento(v_ant.equipamento_id, v_uid) THEN
        RAISE EXCEPTION 'CT2_SCOPE_DENIED' USING ERRCODE = 'P0001',
          HINT = 'Equipamento anterior fora do seu escopo de acesso.';
      END IF;
      IF NOT public.fn_ativos_can_access_equipamento(v_new.equipamento_id, v_uid)
         OR NOT public.fn_ativos_can_access_equipamento(p_novo_equipamento_id, v_uid) THEN
        RAISE EXCEPTION 'CT2_SCOPE_DENIED' USING ERRCODE = 'P0001',
          HINT = 'Equipamento novo fora do seu escopo de acesso.';
      END IF;
    END IF;
    RETURN jsonb_build_object(
      'ok', true,
      'replay', true,
      'atendimento_encerrado', public.fn_ct_atendimento_json(v_ant.id),
      'atendimento_novo', public.fn_ct_atendimento_json(v_new.id),
      'item', public.fn_ct_item_resumo_json(v_new.solicitacao_item_id)
    );
  END IF;

  IF v_item0 IS NULL THEN
    RAISE EXCEPTION 'CT2_ATENDIMENTO_NAO_ENCONTRADO' USING ERRCODE = 'P0001',
      HINT = 'O atendimento informado nao existe.';
  END IF;

  -- CT2.2: locks por equipamento em ordem determinista (anterior + novo), evita deadlock cruzado
  SELECT array_agg(x ORDER BY x) INTO v_locks
    FROM (SELECT DISTINCT unnest(ARRAY[v_equip0, p_novo_equipamento_id]) AS x) s
   WHERE x IS NOT NULL;

  IF v_locks IS NOT NULL THEN
    FOREACH v_lock_id IN ARRAY v_locks LOOP
      PERFORM pg_advisory_xact_lock(hashtextextended('ct2:equip:' || v_lock_id::text, 0));
    END LOOP;
  END IF;

  SELECT * INTO v_ant
    FROM public.bd_solicitacao_item_atendimentos a
   WHERE a.id = p_atendimento_id;

  IF v_ant.status NOT IN ('RESERVADO','EM_TRANSPORTE','ENTREGUE') THEN
    RAISE EXCEPTION 'CT2_ATENDIMENTO_JA_ENCERRADO' USING ERRCODE = 'P0001',
      HINT = 'Este atendimento ja foi encerrado anteriormente.';
  END IF;

  IF p_novo_equipamento_id = v_equip0 THEN
    RAISE EXCEPTION 'CT2_SUBSTITUICAO_SEM_EFEITO' USING ERRCODE = 'P0001',
      HINT = 'Escolha um equipamento diferente do atual.';
  END IF;

  SELECT i.* INTO v_item
    FROM public.bd_solicitacoes_itens i
   WHERE i.id = v_item0
   FOR UPDATE;

  SELECT s.* INTO v_sol
    FROM public.bd_solicitacoes_equipamento s
   WHERE s.id = v_item.solicitacao_id;

  IF v_sol.id IS NULL THEN
    RAISE EXCEPTION 'CT2_SOLICITACAO_NAO_ENCONTRADA' USING ERRCODE = 'P0001',
      HINT = 'A solicitacao vinculada nao existe.';
  END IF;

  IF NOT v_sa THEN
    IF NOT public.user_has_permission_action(v_uid, 'gestao_maquinas_central_transporte_view', 'criar') THEN
      RAISE EXCEPTION 'CT2_FORBIDDEN' USING ERRCODE = 'P0001',
        HINT = 'Sem permissao para substituir atendimento na Central do Transporte.';
    END IF;
    IF NOT public.user_has_permission_action(v_uid, 'gestao_maquinas_central_transporte_view', 'editar') THEN
      RAISE EXCEPTION 'CT2_FORBIDDEN' USING ERRCODE = 'P0001',
        HINT = 'Sem permissao para substituir atendimento na Central do Transporte.';
    END IF;
    IF NOT public.fn_ativos_can_access_solicitacao(v_sol.id, v_uid) THEN
      RAISE EXCEPTION 'CT2_SCOPE_DENIED' USING ERRCODE = 'P0001',
        HINT = 'Solicitacao fora do seu escopo de acesso.';
    END IF;
    IF NOT public.fn_ativos_can_access_equipamento(v_equip0, v_uid) THEN
      RAISE EXCEPTION 'CT2_SCOPE_DENIED' USING ERRCODE = 'P0001',
        HINT = 'Equipamento anterior fora do seu escopo de acesso.';
    END IF;
    IF NOT public.fn_ativos_can_access_equipamento(p_novo_equipamento_id, v_uid) THEN
      RAISE EXCEPTION 'CT2_SCOPE_DENIED' USING ERRCODE = 'P0001',
        HINT = 'Equipamento novo fora do seu escopo de acesso.';
    END IF;
  END IF;

  SELECT e.* INTO v_equip
    FROM public.bd_caminhoes_equipamentos e
   WHERE e.id = p_novo_equipamento_id
   FOR UPDATE;

  IF v_equip.id IS NULL THEN
    RAISE EXCEPTION 'CT2_EQUIPAMENTO_NAO_ENCONTRADO' USING ERRCODE = 'P0001',
      HINT = 'O equipamento informado nao existe.';
  END IF;

  v_match := public.fn_ct_avaliar_match(v_item0, p_novo_equipamento_id);
  IF (v_match->>'compativel')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'CT2_EQUIPAMENTO_INCOMPATIVEL' USING ERRCODE = 'P0001',
      HINT = 'Equipamento incompativel com o item solicitado.';
  END IF;

  v_disp := public.fn_ct_avaliar_disponibilidade(p_novo_equipamento_id, p_modalidade, v_ant.periodo_inicio);
  v_ovr_disp := (v_disp->>'override')::boolean;

  -- G0/CT2: ativo sem linha operacional nunca e reservavel (fail-closed, sem override).
  IF coalesce(v_disp->>'status', 'SEM_REGISTRO') = 'SEM_REGISTRO' THEN
    RAISE EXCEPTION 'CT2_DISPONIBILIDADE_SEM_REGISTRO' USING ERRCODE = 'P0001',
      HINT = 'Regularize a disponibilidade operacional do ativo antes de continuar.';
  END IF;

  v_apr := v_sa OR public.user_has_permission_action(v_uid, 'gestao_maquinas_central_transporte_view', 'aprovar');

  IF v_match->>'tipo' = 'PARCIAL' AND NOT v_apr THEN
    RAISE EXCEPTION 'CT2_MATCH_PARCIAL_BLOQUEADO' USING ERRCODE = 'P0001',
      HINT = 'Match PARCIAL exige permissao de aprovacao.';
  END IF;

  IF v_ant.override_periodo AND NOT v_apr THEN
    RAISE EXCEPTION 'CT2_PERIODO_FORA_JANELA' USING ERRCODE = 'P0001',
      HINT = 'Periodo fora da janela aprovada exige permissao de aprovacao.';
  END IF;

  IF v_ovr_disp AND NOT v_apr THEN
    RAISE EXCEPTION 'CT2_DISPONIBILIDADE_BLOQUEADA' USING ERRCODE = 'P0001',
      HINT = 'Override de disponibilidade exige permissao de aprovacao.';
  END IF;

  IF (v_match->>'tipo' = 'PARCIAL' OR v_ant.override_periodo OR v_ovr_disp)
     AND (v_just_efetiva IS NULL OR length(v_just_efetiva) < 20) THEN
    RAISE EXCEPTION 'CT2_JUSTIFICATIVA_OBRIGATORIA' USING ERRCODE = 'P0001',
      HINT = 'Informe uma justificativa com no minimo 20 caracteres.';
  END IF;

  -- CT2.2: overlap do NOVO equipamento, excluindo apenas o atendimento encerrado nesta operacao
  SELECT count(*)::integer INTO v_conflito
    FROM public.bd_solicitacao_item_atendimentos a
   WHERE a.equipamento_id = p_novo_equipamento_id
     AND a.id <> p_atendimento_id
     AND a.status IN ('RESERVADO','EM_TRANSPORTE','ENTREGUE')
     AND a.periodo_inicio <= v_ant.periodo_fim
     AND a.periodo_fim >= v_ant.periodo_inicio;

  IF v_conflito > 0 THEN
    RAISE EXCEPTION 'CT2_EQUIPAMENTO_EM_CONFLITO' USING ERRCODE = 'P0001',
      HINT = 'O equipamento ja possui um compromisso ativo no periodo informado.';
  END IF;

  v_ctx := jsonb_build_object(
    'versao', 'CT2_M2_R4',
    'operacao', 'SUBSTITUICAO',
    'substituicao', jsonb_build_object(
      'atendimento_anterior_id', v_ant.id::text,
      'equipamento_anterior_id', v_ant.equipamento_id::text,
      'motivo', v_motivo
    ),
    'match', jsonb_build_object(
      'tipo', v_match->>'tipo',
      'via', v_match->>'via',
      'motivo', v_match->>'motivo'
    ),
    'disponibilidade', jsonb_build_object(
      'status', v_disp->>'status',
      'override', v_ovr_disp::text,
      'reconciliado', v_disp->>'reconciliado',
      'previsao_liberacao', v_disp->>'previsao_liberacao'
    ),
    'periodo', jsonb_build_object(
      'override', v_ant.override_periodo::text,
      'periodo_inicio', v_ant.periodo_inicio::text,
      'periodo_fim', v_ant.periodo_fim::text,
      'janela_aprovada_inicio', v_ant.janela_aprovada_inicio::text,
      'janela_aprovada_fim', v_ant.janela_aprovada_fim::text
    )
  );

  BEGIN
    UPDATE public.bd_solicitacao_item_atendimentos
       SET status                  = 'LIBERADO',
           request_id_encerramento = p_request_id,
           encerrado_em            = now(),
           encerrado_por           = v_uid,
           motivo_encerramento     = v_motivo,
           updated_at              = now()
     WHERE id = p_atendimento_id;

    INSERT INTO public.bd_solicitacao_item_atendimentos (
      solicitacao_item_id, equipamento_id, modalidade, status,
      periodo_inicio, periodo_fim, janela_aprovada_inicio, janela_aprovada_fim,
      override_periodo, override_disponibilidade, match_tipo,
      justificativa_override, contexto_decisao, request_id_criacao, created_by
    ) VALUES (
      v_item0, p_novo_equipamento_id, p_modalidade, 'RESERVADO',
      v_ant.periodo_inicio, v_ant.periodo_fim, v_ant.janela_aprovada_inicio, v_ant.janela_aprovada_fim,
      v_ant.override_periodo, v_ovr_disp, v_match->>'tipo',
      v_just_efetiva, v_ctx, p_request_id, v_uid
    )
    RETURNING id INTO v_new_id;
  EXCEPTION
  WHEN exclusion_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint = 'excl_sia_equip_periodo_ativo' THEN
      RAISE EXCEPTION 'CT2_EQUIPAMENTO_EM_CONFLITO' USING ERRCODE = 'P0001',
        HINT = 'O equipamento ja possui um compromisso ativo no periodo informado.';
    ELSE
      RAISE;
    END IF;
  WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint IN ('uq_sia_request_id_criacao','uq_sia_request_id_encerramento') THEN
      SELECT * INTO v_ant
        FROM public.bd_solicitacao_item_atendimentos x
       WHERE x.request_id_encerramento = p_request_id;
      SELECT * INTO v_new
        FROM public.bd_solicitacao_item_atendimentos x
       WHERE x.request_id_criacao = p_request_id;

      -- BLOCO UNICO DE REPLAY DE SUBSTITUICAO (identico ao do fluxo normal)
      v_ctxn := v_new.contexto_decisao;
      v_par_ok := v_ant.id IS NOT NULL AND v_new.id IS NOT NULL
        AND v_ant.request_id_encerramento = p_request_id
        AND v_new.request_id_criacao = p_request_id
        AND v_ant.status = 'LIBERADO'
        AND v_new.status = 'RESERVADO'
        AND v_ant.solicitacao_item_id = v_new.solicitacao_item_id
        AND v_ant.periodo_inicio = v_new.periodo_inicio
        AND v_ant.periodo_fim = v_new.periodo_fim
        AND v_ant.janela_aprovada_inicio = v_new.janela_aprovada_inicio
        AND v_ant.janela_aprovada_fim = v_new.janela_aprovada_fim
        AND v_ant.override_periodo = v_new.override_periodo
        AND v_ctxn IS NOT NULL AND jsonb_typeof(v_ctxn) = 'object'
        AND v_ctxn->>'versao' = 'CT2_M2_R4'
        AND jsonb_typeof(v_ctxn->'substituicao') = 'object'
        AND jsonb_typeof(v_ctxn->'match') = 'object'
        AND jsonb_typeof(v_ctxn->'disponibilidade') = 'object'
        AND jsonb_typeof(v_ctxn->'periodo') = 'object'
        AND v_new.match_tipo = (v_ctxn #>> '{match,tipo}')
        AND v_new.override_disponibilidade::text = (v_ctxn #>> '{disponibilidade,override}')
        AND v_new.override_periodo::text = (v_ctxn #>> '{periodo,override}')
        AND v_new.periodo_inicio::text = (v_ctxn #>> '{periodo,periodo_inicio}')
        AND v_new.periodo_fim::text = (v_ctxn #>> '{periodo,periodo_fim}')
        AND v_new.janela_aprovada_inicio::text = (v_ctxn #>> '{periodo,janela_aprovada_inicio}')
        AND v_new.janela_aprovada_fim::text = (v_ctxn #>> '{periodo,janela_aprovada_fim}')
        AND (v_ctxn #>> '{substituicao,atendimento_anterior_id}') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND (v_ctxn #>> '{substituicao,equipamento_anterior_id}') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND lower(v_ctxn #>> '{substituicao,atendimento_anterior_id}') = lower(v_ant.id::text)
        AND lower(v_ctxn #>> '{substituicao,equipamento_anterior_id}') = lower(v_ant.equipamento_id::text);

      IF (v_ant.id IS NOT NULL OR v_new.id IS NOT NULL) AND v_par_ok IS NOT TRUE THEN
        RAISE EXCEPTION 'CT2_IDEMPOTENCY_STATE_INCONSISTENT' USING ERRCODE = 'P0001',
          HINT = 'A substituicao anterior ficou incompleta ou inconsistente; recarregue a tela.';
      END IF;

      IF v_par_ok IS TRUE THEN
        v_equiv := v_ant.id = p_atendimento_id
          AND v_ant.equipamento_id = v_equip0
          AND v_new.equipamento_id = p_novo_equipamento_id
          AND v_new.solicitacao_item_id = v_item0
          AND v_new.modalidade = p_modalidade
          AND btrim(coalesce(v_ant.motivo_encerramento, '')) = v_motivo
          AND coalesce(btrim(v_new.justificativa_override), '') = coalesce(v_just_efetiva, '')
          AND v_ant.encerrado_por = v_uid
          AND v_new.created_by = v_uid;
        IF v_equiv IS NOT TRUE THEN
          RAISE EXCEPTION 'CT2_IDEMPOTENCY_KEY_REUSED' USING ERRCODE = 'P0001',
            HINT = 'Esta operacao ja foi registrada com parametros diferentes.';
        END IF;
        RETURN jsonb_build_object(
          'ok', true,
          'replay', true,
          'atendimento_encerrado', public.fn_ct_atendimento_json(v_ant.id),
          'atendimento_novo', public.fn_ct_atendimento_json(v_new.id),
          'item', public.fn_ct_item_resumo_json(v_new.solicitacao_item_id)
        );
      END IF;

      RAISE EXCEPTION 'CT2_IDEMPOTENCY_STATE_INCONSISTENT' USING ERRCODE = 'P0001',
        HINT = 'A substituicao anterior ficou incompleta ou inconsistente; recarregue a tela.';
    ELSIF v_constraint = 'uq_sia_item_equip_ativo' THEN
      RAISE EXCEPTION 'CT2_EQUIPAMENTO_EM_CONFLITO' USING ERRCODE = 'P0001',
        HINT = 'Este equipamento ja esta atribuido a este item.';
    ELSE
      RAISE EXCEPTION 'CT2_INVARIANTE_VIOLADA' USING ERRCODE = 'P0001',
        HINT = 'A operacao violou uma regra de integridade do atendimento.';
    END IF;
  END;

  PERFORM public.fn_ct_recalcular_status_item(v_item0);

  RETURN jsonb_build_object(
    'ok', true,
    'replay', false,
    'atendimento_encerrado', public.fn_ct_atendimento_json(p_atendimento_id),
    'atendimento_novo', public.fn_ct_atendimento_json(v_new_id),
    'item', public.fn_ct_item_resumo_json(v_item0)
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.fn_ct_atendimento_substituir(uuid,uuid,text,text,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_ct_atendimento_substituir(uuid,uuid,text,text,uuid,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_ct_atendimento_substituir(uuid,uuid,text,text,uuid,text) TO authenticated;
COMMENT ON FUNCTION public.fn_ct_atendimento_substituir(uuid,uuid,text,text,uuid,text)
  IS 'CT2_G0 hard block CT2_DISPONIBILIDADE_SEM_REGISTRO | CT2.2 locks ordenados por equipamento + overlap do novo equipamento + 23P01 -> CT2_EQUIPAMENTO_EM_CONFLITO';

-- ---------- 4. fn_ct_estado_efetivo_lote ----------
CREATE OR REPLACE FUNCTION public.fn_ct_estado_efetivo_lote(
  p_equipamento_ids uuid[],
  p_centro_custo_ids uuid[] DEFAULT NULL,
  p_periodo_inicio date DEFAULT NULL,
  p_periodo_fim date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid   uuid;
  v_sa    boolean;
  v_ids   uuid[];
  v_out   jsonb;
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

  v_sa := public.fn_is_super_admin(v_uid);

  SELECT array_agg(DISTINCT x) INTO v_ids
    FROM unnest(coalesce(p_equipamento_ids, ARRAY[]::uuid[])) x
   WHERE x IS NOT NULL;

  IF v_ids IS NULL OR array_length(v_ids, 1) IS NULL OR array_length(v_ids, 1) < 1 THEN
    RAISE EXCEPTION 'CT2_PARAMETROS_INVALIDOS' USING ERRCODE = 'P0001',
      HINT = 'Informe de 1 a 500 ativos para consultar o estado efetivo.';
  END IF;

  IF array_length(v_ids, 1) > 500 THEN
    RAISE EXCEPTION 'CT2_PARAMETROS_INVALIDOS' USING ERRCODE = 'P0001',
      HINT = 'Informe de 1 a 500 ativos para consultar o estado efetivo.';
  END IF;

  IF (p_periodo_inicio IS NULL) <> (p_periodo_fim IS NULL) THEN
    RAISE EXCEPTION 'CT2_PARAMETROS_INVALIDOS' USING ERRCODE = 'P0001',
      HINT = 'Informe as duas datas da janela ou nenhuma delas.';
  END IF;

  IF p_periodo_inicio IS NOT NULL AND p_periodo_fim < p_periodo_inicio THEN
    RAISE EXCEPTION 'CT2_PARAMETROS_INVALIDOS' USING ERRCODE = 'P0001',
      HINT = 'A data final nao pode ser anterior a inicial.';
  END IF;

  WITH escopo AS (
    SELECT e.id AS equipamento_id, e.centro_custo_id
      FROM public.bd_caminhoes_equipamentos e
     WHERE e.id = ANY(v_ids)
       AND (v_sa OR public.fn_ativos_can_access_equipamento(e.id, v_uid))
       AND (p_centro_custo_ids IS NULL OR e.centro_custo_id = ANY(p_centro_custo_ids))
  ),
  disp AS (
    SELECT DISTINCT ON (d.equipamento_id)
           d.equipamento_id,
           d.status_operacional::text AS status_operacional,
           d.previsao_liberacao,
           d.centro_custo_id
      FROM public.bd_disponibilidade_equipamentos d
     WHERE d.equipamento_id IN (SELECT equipamento_id FROM escopo)
     ORDER BY d.equipamento_id,
              d.updated_at DESC NULLS LAST,
              d.created_at DESC NULLS LAST,
              d.id DESC
  ),
  ativos AS (
    SELECT a.id, a.equipamento_id, a.status, a.periodo_inicio, a.periodo_fim,
           a.solicitacao_item_id, i.solicitacao_id
      FROM public.bd_solicitacao_item_atendimentos a
      JOIN public.bd_solicitacoes_itens i ON i.id = a.solicitacao_item_id
     WHERE a.equipamento_id IN (SELECT equipamento_id FROM escopo)
       AND a.status IN ('RESERVADO','EM_TRANSPORTE','ENTREGUE')
  ),
  anomalia AS (
    SELECT DISTINCT a.equipamento_id
      FROM ativos a
      JOIN ativos b
        ON b.equipamento_id = a.equipamento_id
       AND b.id > a.id
       AND daterange(a.periodo_inicio, a.periodo_fim, '[]')
        && daterange(b.periodo_inicio, b.periodo_fim, '[]')
  ),
  janela AS (
    SELECT a.*
      FROM ativos a
     WHERE p_periodo_inicio IS NOT NULL
       AND a.periodo_inicio <= p_periodo_fim
       AND a.periodo_fim >= p_periodo_inicio
  ),
  agg_janela AS (
    SELECT j.equipamento_id,
           count(*)::integer AS qtd,
           jsonb_agg(jsonb_build_object(
             'atendimento_id', j.id,
             'status', j.status,
             'periodo_inicio', j.periodo_inicio,
             'periodo_fim', j.periodo_fim,
             'solicitacao_id', j.solicitacao_id,
             'solicitacao_item_id', j.solicitacao_item_id
           ) ORDER BY j.periodo_inicio, j.id) AS itens
      FROM janela j
     GROUP BY j.equipamento_id
  ),
  atual AS (
    SELECT DISTINCT ON (a.equipamento_id) a.*
      FROM ativos a
     WHERE CURRENT_DATE BETWEEN a.periodo_inicio AND a.periodo_fim
     ORDER BY a.equipamento_id, a.periodo_inicio ASC, a.id ASC
  ),
  futuro AS (
    SELECT DISTINCT ON (a.equipamento_id) a.*
      FROM ativos a
     WHERE a.periodo_inicio > CURRENT_DATE
     ORDER BY a.equipamento_id, a.periodo_inicio ASC, a.id ASC
  ),
  futuro_qtd AS (
    SELECT a.equipamento_id, count(*)::integer AS qtd
      FROM ativos a
     WHERE a.periodo_inicio > CURRENT_DATE
     GROUP BY a.equipamento_id
  ),
  base AS (
    SELECT
      e.equipamento_id,
      coalesce(d.status_operacional, 'SEM_STATUS')          AS condicao_operacional,
      (d.equipamento_id IS NOT NULL)                        AS possui_registro_operacional,
      d.previsao_liberacao,
      coalesce(d.centro_custo_id, e.centro_custo_id)        AS centro_custo_id,
      (an.equipamento_id IS NOT NULL)                       AS possui_anomalia,
      at.id AS atual_id, at.status AS atual_status,
      at.periodo_inicio AS atual_ini, at.periodo_fim AS atual_fim,
      at.solicitacao_id AS atual_sol, at.solicitacao_item_id AS atual_item,
      fu.id AS prox_id, fu.status AS prox_status,
      fu.periodo_inicio AS prox_ini, fu.periodo_fim AS prox_fim,
      fu.solicitacao_id AS prox_sol, fu.solicitacao_item_id AS prox_item,
      coalesce(fq.qtd, 0) AS qtd_futuros,
      coalesce(aj.qtd, 0) AS qtd_janela,
      coalesce(aj.itens, '[]'::jsonb) AS itens_janela
    FROM escopo e
    LEFT JOIN disp d       ON d.equipamento_id = e.equipamento_id
    LEFT JOIN anomalia an  ON an.equipamento_id = e.equipamento_id
    LEFT JOIN atual at     ON at.equipamento_id = e.equipamento_id
    LEFT JOIN futuro fu    ON fu.equipamento_id = e.equipamento_id
    LEFT JOIN futuro_qtd fq ON fq.equipamento_id = e.equipamento_id
    LEFT JOIN agg_janela aj ON aj.equipamento_id = e.equipamento_id
  ),
  calc AS (
    SELECT b.*,
      CASE
        WHEN b.possui_anomalia THEN 'CONFLITO_MULTIPLO'
        WHEN p_periodo_inicio IS NOT NULL AND b.qtd_janela > 0
          THEN coalesce((b.itens_janela->0->>'status'), 'RESERVADO')
        WHEN p_periodo_inicio IS NULL AND b.atual_status IS NOT NULL THEN b.atual_status
        ELSE 'LIVRE'
      END AS compromisso_ativo
      FROM base b
  )
  SELECT jsonb_build_object(
    'ok', true,
    'gerado_em', now(),
    'periodo_inicio', p_periodo_inicio,
    'periodo_fim', p_periodo_fim,
    'total', count(*),
    'itens', coalesce(jsonb_agg(jsonb_build_object(
      'equipamento_id', c.equipamento_id,
      'centro_custo_id', c.centro_custo_id,
      'condicao_operacional', c.condicao_operacional,
      'possui_registro_operacional', c.possui_registro_operacional,
      'previsao_liberacao', c.previsao_liberacao,
      'compromisso_ativo', c.compromisso_ativo,
      'compromisso_atual', CASE WHEN c.atual_id IS NULL THEN NULL ELSE jsonb_build_object(
        'atendimento_id', c.atual_id, 'status', c.atual_status,
        'periodo_inicio', c.atual_ini, 'periodo_fim', c.atual_fim,
        'solicitacao_id', c.atual_sol, 'solicitacao_item_id', c.atual_item) END,
      'proximo_compromisso', CASE WHEN c.prox_id IS NULL THEN NULL ELSE jsonb_build_object(
        'atendimento_id', c.prox_id, 'status', c.prox_status,
        'periodo_inicio', c.prox_ini, 'periodo_fim', c.prox_fim,
        'solicitacao_id', c.prox_sol, 'solicitacao_item_id', c.prox_item) END,
      'quantidade_compromissos_futuros', c.qtd_futuros,
      'compromissos_na_janela', c.itens_janela,
      'quantidade_compromissos_na_janela', c.qtd_janela,
      'possui_anomalia_sobreposicao', c.possui_anomalia,
      'periodo_comprometido', CASE
        WHEN c.atual_id IS NOT NULL THEN jsonb_build_object('inicio', c.atual_ini, 'fim', c.atual_fim)
        WHEN c.prox_id IS NOT NULL THEN jsonb_build_object('inicio', c.prox_ini, 'fim', c.prox_fim)
        ELSE NULL END,
      'atendimento_id', coalesce(c.atual_id, c.prox_id),
      'solicitacao_id', coalesce(c.atual_sol, c.prox_sol),
      'solicitacao_item_id', coalesce(c.atual_item, c.prox_item),
      'estado_logistico', 'SEM_MOVIMENTACAO',
      'estado_exibicao', CASE
        WHEN c.possui_anomalia THEN 'CONFLITO_OPERACIONAL'
        WHEN NOT c.possui_registro_operacional THEN 'INDISPONIVEL_PARA_ATENDIMENTO'
        WHEN c.compromisso_ativo <> 'LIVRE' THEN 'COMPROMETIDO'
        WHEN c.condicao_operacional = 'DISPONIVEL' THEN 'DISPONIVEL'
        ELSE 'INDISPONIVEL_PARA_ATENDIMENTO'
      END,
      'alertas', (
        CASE WHEN c.possui_anomalia THEN jsonb_build_array('SOBREPOSICAO_DETECTADA') ELSE '[]'::jsonb END
        || CASE WHEN c.qtd_futuros > 0 THEN jsonb_build_array('POSSUI_COMPROMISSOS_FUTUROS') ELSE '[]'::jsonb END
      ),
      'bloqueios', (
        CASE WHEN NOT c.possui_registro_operacional THEN jsonb_build_array('SEM_STATUS_OPERACIONAL') ELSE '[]'::jsonb END
        || CASE WHEN c.possui_anomalia THEN jsonb_build_array('MULTIPLOS_COMPROMISSOS_ATIVOS') ELSE '[]'::jsonb END
        || CASE WHEN p_periodo_inicio IS NOT NULL AND c.qtd_janela > 0
                THEN jsonb_build_array('PERIODO_COMPROMETIDO') ELSE '[]'::jsonb END
        || CASE WHEN c.possui_registro_operacional AND c.condicao_operacional <> 'DISPONIVEL'
                THEN jsonb_build_array('CONDICAO_OPERACIONAL_RESTRITA') ELSE '[]'::jsonb END
      ),
      'origem_decisao', 'CT2_2_ESTADO_EFETIVO'
    ) ORDER BY c.equipamento_id), '[]'::jsonb)
  ) INTO v_out
  FROM calc c;

  RETURN coalesce(v_out, jsonb_build_object('ok', true, 'total', 0, 'itens', '[]'::jsonb));
END;
$fn$;

REVOKE ALL ON FUNCTION public.fn_ct_estado_efetivo_lote(uuid[],uuid[],date,date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_ct_estado_efetivo_lote(uuid[],uuid[],date,date) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_ct_estado_efetivo_lote(uuid[],uuid[],date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ct_estado_efetivo_lote(uuid[],uuid[],date,date) TO service_role;
COMMENT ON FUNCTION public.fn_ct_estado_efetivo_lote(uuid[],uuid[],date,date)
  IS 'CT2.2: estado efetivo em lote (1..500 ativos). Fail-closed sem disponibilidade; CONFLITO_MULTIPLO apenas com sobreposicao real; estado_logistico fixo SEM_MOVIMENTACAO ate CT-3C.';