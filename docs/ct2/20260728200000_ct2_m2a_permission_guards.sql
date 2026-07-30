-- =====================================================================
-- CT-2 / M2.1 — CORRECAO DOS GUARDS DAS 4 RPCs PUBLICAS (permission-first)
-- =====================================================================
-- Versao alvo........: CT2_M2A
-- Estado de origem...: CT2_M2_R4 (4 publicas + 6 internas aplicadas)
-- Escopo.............: SOMENTE as 4 funcoes publicas.
--                      As 6 internas NAO sao alteradas (hash verificado).
-- Efeito intencional.: enquanto a permission
--                      gestao_maquinas_central_transporte_view nao existir,
--                      SuperAdm continua autorizado e todos os demais
--                      usuarios recebem CT2_FORBIDDEN.
--                      Apos a M3, os grants passam a produzir efeito.
-- Nao altera: assinaturas, nomes de parametros, defaults, retorno, owner,
--             SECURITY DEFINER, search_path, volatilidade, ACL, transicoes
--             de status, recalculo, locks, idempotencia.
-- Revisao b (2026-07-28): ordem de seguranca antes de replay. Os ramos de
--             replay idempotente de atribuir/encerrar/substituir passaram a
--             executar capability + escopo (solicitacao e equipamentos
--             aplicaveis) ANTES de devolver qualquer conteudo persistido.
--             SHA-256 anterior (revisao a, nunca aplicada):
--             0da3ab76333b62edeeb74036b039cb83a28b3f1554391546339112eaf2f4deec
-- =====================================================================

BEGIN;

SET LOCAL statement_timeout = '120s';
SET LOCAL lock_timeout = '15s';

-- ---------------------------------------------------------------------
-- PREFLIGHT BLOQUEANTE — estado de origem integral
-- ---------------------------------------------------------------------
DO $preflight$
DECLARE
  v_esperado jsonb := $j$[
  {
    "assinatura": "public.fn_ct_atendimento_atribuir(uuid,uuid,text,uuid,date,date,text)",
    "args": "p_solicitacao_item_id uuid, p_equipamento_id uuid, p_modalidade text, p_request_id uuid, p_periodo_inicio date DEFAULT NULL::date, p_periodo_fim date DEFAULT NULL::date, p_justificativa_override text DEFAULT NULL::text",
    "ret": "jsonb",
    "vol": "v",
    "body_md5": "78b80f993fb73253c72666aa5a758304",
    "publica": true
  },
  {
    "assinatura": "public.fn_ct_atendimento_encerrar(uuid,text,text,uuid)",
    "args": "p_atendimento_id uuid, p_novo_status text, p_motivo text, p_request_id uuid",
    "ret": "jsonb",
    "vol": "v",
    "body_md5": "6c386e2efb798d3b6d6aa390b496e8f2",
    "publica": true
  },
  {
    "assinatura": "public.fn_ct_atendimento_substituir(uuid,uuid,text,text,uuid,text)",
    "args": "p_atendimento_id uuid, p_novo_equipamento_id uuid, p_modalidade text, p_motivo text, p_request_id uuid, p_justificativa_override text DEFAULT NULL::text",
    "ret": "jsonb",
    "vol": "v",
    "body_md5": "208069ee4b9c264929aac4fdf60a49d5",
    "publica": true
  },
  {
    "assinatura": "public.fn_ct_atendimento_listar(uuid)",
    "args": "p_solicitacao_id uuid",
    "ret": "jsonb",
    "vol": "s",
    "body_md5": "7d5b760d3a414a71dc74f3786590c4b3",
    "publica": true
  }
]$j$;
  v_f        jsonb;
  v_oid      oid;
  v_acl      text;
BEGIN
  FOR v_f IN SELECT * FROM jsonb_array_elements(v_esperado)
  LOOP
    v_oid := to_regprocedure(v_f->>'assinatura');
    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'CT2_M2A_DRIFT: funcao ausente %', v_f->>'assinatura';
    END IF;

    PERFORM 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE p.oid = v_oid
       AND n.nspname = 'public'
       AND md5(p.prosrc) = (v_f->>'body_md5')
       AND pg_get_function_arguments(p.oid) = (v_f->>'args')
       AND pg_get_function_result(p.oid) = (v_f->>'ret')
       AND pg_get_userbyid(p.proowner) = 'postgres'
       AND p.prosecdef
       AND p.proconfig @> ARRAY['search_path=public']
       AND p.provolatile = (v_f->>'vol');
    IF NOT FOUND THEN
      RAISE EXCEPTION 'CT2_M2A_DRIFT: estado divergente em % (hash/args/ret/owner/secdef/search_path/volatilidade)',
        v_f->>'assinatura';
    END IF;

    IF coalesce(obj_description(v_oid, 'pg_proc'), '') NOT LIKE 'CT2_M2_R4%' THEN
      RAISE EXCEPTION 'CT2_M2A_DRIFT: COMMENT fora da versao CT2_M2_R4 em %', v_f->>'assinatura';
    END IF;

    IF (v_f->>'publica')::boolean THEN
      SELECT coalesce(array_to_string(p.proacl::text[], '|'), '') INTO v_acl
        FROM pg_proc p WHERE p.oid = v_oid;
      IF v_acl <> 'postgres=X/postgres|authenticated=X/postgres' THEN
        RAISE EXCEPTION 'CT2_M2A_DRIFT: ACL divergente em % -> %', v_f->>'assinatura', v_acl;
      END IF;
    END IF;
  END LOOP;

  RAISE NOTICE 'CT2_M2A preflight OK: 4 publicas + 6 internas conformes.';
END;
$preflight$;

DO $preflight_int$
DECLARE
  v_int jsonb := $j$[
  {
    "assinatura": "fn_ct_atendimento_json(uuid)",
    "body_md5": "0d790707051a0d346fec43f89735893b"
  },
  {
    "assinatura": "fn_ct_avaliar_disponibilidade(uuid,text,date)",
    "body_md5": "91a89bde623538a7a8c65b344798445c"
  },
  {
    "assinatura": "fn_ct_avaliar_match(uuid,uuid)",
    "body_md5": "f20f2c64c625c581d665efa1d5846d23"
  },
  {
    "assinatura": "fn_ct_contadores_item(uuid)",
    "body_md5": "f1e9a6f52221d4b97c421d6fa4a4b08e"
  },
  {
    "assinatura": "fn_ct_item_resumo_json(uuid)",
    "body_md5": "8082882b3bf9fbb3ff2f92e2d0f01413"
  },
  {
    "assinatura": "fn_ct_recalcular_status_item(uuid)",
    "body_md5": "12ece44549d5fcb0261cd033289cc15a"
  }
]$j$;
  v_f jsonb;
  v_oid oid;
  v_md5 text;
BEGIN
  FOR v_f IN SELECT * FROM jsonb_array_elements(v_int) LOOP
    v_oid := to_regprocedure('public.' || (v_f->>'assinatura'));
    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'CT2_M2A_DRIFT: interna ausente %', v_f->>'assinatura';
    END IF;
    SELECT md5(p.prosrc) INTO v_md5 FROM pg_proc p WHERE p.oid = v_oid;
    IF v_md5 <> (v_f->>'body_md5') THEN
      RAISE EXCEPTION 'CT2_M2A_DRIFT: interna divergente % (% <> %)',
        v_f->>'assinatura', v_md5, v_f->>'body_md5';
    END IF;
  END LOOP;
END;
$preflight_int$;

-- ---------------------------------------------------------------------
-- fn_ct_atendimento_listar — guard permission-first
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_ct_atendimento_listar(p_solicitacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_sa         boolean;
  v_apr        boolean;
  v_uid   uuid;
  v_sol   record;
  v_itens jsonb;
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

  SELECT s.id INTO v_sol
    FROM public.bd_solicitacoes_equipamento s
   WHERE s.id = p_solicitacao_id;

  IF v_sol.id IS NULL THEN
    RAISE EXCEPTION 'CT2_SOLICITACAO_NAO_ENCONTRADA' USING ERRCODE = 'P0001',
      HINT = 'A solicitacao informada nao existe.';
  END IF;

  IF NOT v_sa THEN
    IF NOT public.user_has_permission_action(v_uid, 'gestao_maquinas_central_transporte_view', 'visualizar') THEN
      RAISE EXCEPTION 'CT2_FORBIDDEN' USING ERRCODE = 'P0001',
        HINT = 'Sem permissao para visualizar a Central do Transporte.';
    END IF;
    IF NOT public.fn_ativos_can_access_solicitacao(p_solicitacao_id, v_uid) THEN
      RAISE EXCEPTION 'CT2_SCOPE_DENIED' USING ERRCODE = 'P0001',
        HINT = 'Solicitacao fora do seu escopo de acesso.';
    END IF;
  END IF;

  SELECT coalesce(jsonb_agg(item_json ORDER BY ord), '[]'::jsonb)
    INTO v_itens
    FROM (
      SELECT i.created_at AS ord,
             public.fn_ct_item_resumo_json(i.id) || jsonb_build_object(
               'atendimentos',
               coalesce((
                 SELECT jsonb_agg(public.fn_ct_atendimento_json(a.id) ORDER BY a.created_at)
                   FROM public.bd_solicitacao_item_atendimentos a
                  WHERE a.solicitacao_item_id = i.id
               ), '[]'::jsonb)
             ) AS item_json
        FROM public.bd_solicitacoes_itens i
       WHERE i.solicitacao_id = p_solicitacao_id
    ) t;

  RETURN jsonb_build_object(
    'ok', true,
    'solicitacao_id', p_solicitacao_id,
    'itens', v_itens
  );
END;
$fn$;

ALTER FUNCTION public.fn_ct_atendimento_listar(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_ct_atendimento_listar(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_ct_atendimento_listar(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_ct_atendimento_listar(uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- fn_ct_atendimento_atribuir — guard permission-first
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_ct_atendimento_atribuir(p_solicitacao_item_id uuid, p_equipamento_id uuid, p_modalidade text, p_request_id uuid, p_periodo_inicio date DEFAULT NULL::date, p_periodo_fim date DEFAULT NULL::date, p_justificativa_override text DEFAULT NULL::text)
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

  -- Reserva por janela: overlap no mesmo equipamento
  SELECT count(*)::integer INTO v_conflito
    FROM public.bd_solicitacao_item_atendimentos a
   WHERE a.equipamento_id = p_equipamento_id
     AND a.status IN ('RESERVADO','EM_TRANSPORTE','ENTREGUE')
     AND a.periodo_inicio <= v_per_fim
     AND a.periodo_fim >= v_per_ini;

  IF v_conflito > 0 THEN
    RAISE EXCEPTION 'CT2_EQUIPAMENTO_EM_CONFLITO' USING ERRCODE = 'P0001',
      HINT = 'Este equipamento ja possui reserva ativa no periodo informado.';
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
  EXCEPTION WHEN unique_violation THEN
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

ALTER FUNCTION public.fn_ct_atendimento_atribuir(uuid,uuid,text,uuid,date,date,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_ct_atendimento_atribuir(uuid,uuid,text,uuid,date,date,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_ct_atendimento_atribuir(uuid,uuid,text,uuid,date,date,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_ct_atendimento_atribuir(uuid,uuid,text,uuid,date,date,text) TO authenticated;

-- ---------------------------------------------------------------------
-- fn_ct_atendimento_encerrar — guard permission-first
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_ct_atendimento_encerrar(p_atendimento_id uuid, p_novo_status text, p_motivo text, p_request_id uuid)
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
  v_at         record;
  v_item       record;
  v_sol        record;
  v_motivo     text;
  v_exist      record;
  v_equiv      boolean;
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

  IF p_request_id IS NULL OR p_atendimento_id IS NULL THEN
    RAISE EXCEPTION 'CT2_PARAMETROS_INVALIDOS' USING ERRCODE = 'P0001',
      HINT = 'Dados obrigatorios ausentes no encerramento.';
  END IF;

  IF p_novo_status IS NULL OR p_novo_status NOT IN ('CANCELADO','LIBERADO') THEN
    RAISE EXCEPTION 'CT2_STATUS_INVALIDO' USING ERRCODE = 'P0001',
      HINT = 'O encerramento aceita apenas cancelamento ou liberacao.';
  END IF;

  v_motivo := btrim(coalesce(p_motivo, ''));
  IF length(v_motivo) < 20 THEN
    RAISE EXCEPTION 'CT2_MOTIVO_OBRIGATORIO' USING ERRCODE = 'P0001',
      HINT = 'Informe um motivo com no minimo 20 caracteres.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('ct2:req:' || p_request_id::text, 0));

  IF EXISTS (
    SELECT 1 FROM public.bd_solicitacao_item_atendimentos x
     WHERE x.request_id_criacao = p_request_id
  ) THEN
    RAISE EXCEPTION 'CT2_IDEMPOTENCY_KEY_REUSED' USING ERRCODE = 'P0001',
      HINT = 'Esta operacao ja foi registrada com parametros diferentes.';
  END IF;

  SELECT * INTO v_exist
    FROM public.bd_solicitacao_item_atendimentos x
   WHERE x.request_id_encerramento = p_request_id
   FOR UPDATE;

  IF v_exist.id IS NOT NULL THEN
    v_equiv := v_exist.id = p_atendimento_id
      AND v_exist.status = p_novo_status
      AND btrim(coalesce(v_exist.motivo_encerramento, '')) = v_motivo
      AND v_exist.encerrado_por = v_uid;
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
      IF NOT public.user_has_permission_action(v_uid, 'gestao_maquinas_central_transporte_view', 'editar') THEN
        RAISE EXCEPTION 'CT2_FORBIDDEN' USING ERRCODE = 'P0001',
          HINT = 'Sem permissao para encerrar atendimento na Central do Transporte.';
      END IF;
      IF v_sol.id IS NULL OR NOT public.fn_ativos_can_access_solicitacao(v_sol.id, v_uid) THEN
        RAISE EXCEPTION 'CT2_SCOPE_DENIED' USING ERRCODE = 'P0001',
          HINT = 'Solicitacao fora do seu escopo de acesso.';
      END IF;
      IF NOT public.fn_ativos_can_access_equipamento(v_exist.equipamento_id, v_uid) THEN
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

  SELECT * INTO v_at
    FROM public.bd_solicitacao_item_atendimentos a
   WHERE a.id = p_atendimento_id
   FOR UPDATE;

  IF v_at.id IS NULL THEN
    RAISE EXCEPTION 'CT2_ATENDIMENTO_NAO_ENCONTRADO' USING ERRCODE = 'P0001',
      HINT = 'O atendimento informado nao existe.';
  END IF;

  IF v_at.status NOT IN ('RESERVADO','EM_TRANSPORTE','ENTREGUE') THEN
    RAISE EXCEPTION 'CT2_ATENDIMENTO_JA_ENCERRADO' USING ERRCODE = 'P0001',
      HINT = 'Este atendimento ja foi encerrado anteriormente.';
  END IF;

  SELECT i.* INTO v_item
    FROM public.bd_solicitacoes_itens i
   WHERE i.id = v_at.solicitacao_item_id
   FOR UPDATE;

  SELECT s.* INTO v_sol
    FROM public.bd_solicitacoes_equipamento s
   WHERE s.id = v_item.solicitacao_id;

  IF v_sol.id IS NULL THEN
    RAISE EXCEPTION 'CT2_SOLICITACAO_NAO_ENCONTRADA' USING ERRCODE = 'P0001',
      HINT = 'A solicitacao vinculada nao existe.';
  END IF;

  IF NOT v_sa THEN
    IF NOT public.user_has_permission_action(v_uid, 'gestao_maquinas_central_transporte_view', 'editar') THEN
      RAISE EXCEPTION 'CT2_FORBIDDEN' USING ERRCODE = 'P0001',
        HINT = 'Sem permissao para encerrar atendimento na Central do Transporte.';
    END IF;
    IF NOT public.fn_ativos_can_access_solicitacao(v_sol.id, v_uid) THEN
      RAISE EXCEPTION 'CT2_SCOPE_DENIED' USING ERRCODE = 'P0001',
        HINT = 'Solicitacao fora do seu escopo de acesso.';
    END IF;
    IF NOT public.fn_ativos_can_access_equipamento(v_at.equipamento_id, v_uid) THEN
      RAISE EXCEPTION 'CT2_SCOPE_DENIED' USING ERRCODE = 'P0001',
        HINT = 'Equipamento fora do seu escopo de acesso.';
    END IF;
  END IF;

  BEGIN
    UPDATE public.bd_solicitacao_item_atendimentos
       SET status                  = p_novo_status,
           request_id_encerramento = p_request_id,
           encerrado_em            = now(),
           encerrado_por           = v_uid,
           motivo_encerramento     = v_motivo,
           updated_at              = now()
     WHERE id = p_atendimento_id;
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint = 'uq_sia_request_id_encerramento' THEN
      SELECT * INTO v_exist
        FROM public.bd_solicitacao_item_atendimentos x
       WHERE x.request_id_encerramento = p_request_id;
      v_equiv := v_exist.id IS NOT NULL
        AND v_exist.id = p_atendimento_id
        AND v_exist.status = p_novo_status
        AND btrim(coalesce(v_exist.motivo_encerramento, '')) = v_motivo
        AND v_exist.encerrado_por = v_uid;
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
    ELSE
      RAISE EXCEPTION 'CT2_INVARIANTE_VIOLADA' USING ERRCODE = 'P0001',
        HINT = 'A operacao violou uma regra de integridade do atendimento.';
    END IF;
  END;

  PERFORM public.fn_ct_recalcular_status_item(v_at.solicitacao_item_id);

  RETURN jsonb_build_object(
    'ok', true,
    'replay', false,
    'atendimento', public.fn_ct_atendimento_json(p_atendimento_id),
    'item', public.fn_ct_item_resumo_json(v_at.solicitacao_item_id)
  );
END;
$fn$;

ALTER FUNCTION public.fn_ct_atendimento_encerrar(uuid,text,text,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_ct_atendimento_encerrar(uuid,text,text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_ct_atendimento_encerrar(uuid,text,text,uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_ct_atendimento_encerrar(uuid,text,text,uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- fn_ct_atendimento_substituir — guard permission-first
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_ct_atendimento_substituir(p_atendimento_id uuid, p_novo_equipamento_id uuid, p_modalidade text, p_motivo text, p_request_id uuid, p_justificativa_override text DEFAULT NULL::text)
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

  SELECT count(*)::integer INTO v_conflito
    FROM public.bd_solicitacao_item_atendimentos a
   WHERE a.equipamento_id = p_novo_equipamento_id
     AND a.status IN ('RESERVADO','EM_TRANSPORTE','ENTREGUE')
     AND a.periodo_inicio <= v_ant.periodo_fim
     AND a.periodo_fim >= v_ant.periodo_inicio;

  IF v_conflito > 0 THEN
    RAISE EXCEPTION 'CT2_EQUIPAMENTO_EM_CONFLITO' USING ERRCODE = 'P0001',
      HINT = 'Este equipamento ja possui reserva ativa no periodo informado.';
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
  EXCEPTION WHEN unique_violation THEN
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

ALTER FUNCTION public.fn_ct_atendimento_substituir(uuid,uuid,text,text,uuid,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_ct_atendimento_substituir(uuid,uuid,text,text,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_ct_atendimento_substituir(uuid,uuid,text,text,uuid,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_ct_atendimento_substituir(uuid,uuid,text,text,uuid,text) TO authenticated;

-- ---------------------------------------------------------------------
-- POSTFLIGHT — assinatura, metadados, ACL, COMMENT e integridade interna
-- ---------------------------------------------------------------------
DO $postflight$
DECLARE
  v_pub  jsonb := $j$[
  {
    "assinatura": "public.fn_ct_atendimento_atribuir(uuid,uuid,text,uuid,date,date,text)",
    "args": "p_solicitacao_item_id uuid, p_equipamento_id uuid, p_modalidade text, p_request_id uuid, p_periodo_inicio date DEFAULT NULL::date, p_periodo_fim date DEFAULT NULL::date, p_justificativa_override text DEFAULT NULL::text",
    "ret": "jsonb",
    "vol": "v",
    "body_md5_origem": "78b80f993fb73253c72666aa5a758304"
  },
  {
    "assinatura": "public.fn_ct_atendimento_encerrar(uuid,text,text,uuid)",
    "args": "p_atendimento_id uuid, p_novo_status text, p_motivo text, p_request_id uuid",
    "ret": "jsonb",
    "vol": "v",
    "body_md5_origem": "6c386e2efb798d3b6d6aa390b496e8f2"
  },
  {
    "assinatura": "public.fn_ct_atendimento_substituir(uuid,uuid,text,text,uuid,text)",
    "args": "p_atendimento_id uuid, p_novo_equipamento_id uuid, p_modalidade text, p_motivo text, p_request_id uuid, p_justificativa_override text DEFAULT NULL::text",
    "ret": "jsonb",
    "vol": "v",
    "body_md5_origem": "208069ee4b9c264929aac4fdf60a49d5"
  },
  {
    "assinatura": "public.fn_ct_atendimento_listar(uuid)",
    "args": "p_solicitacao_id uuid",
    "ret": "jsonb",
    "vol": "s",
    "body_md5_origem": "7d5b760d3a414a71dc74f3786590c4b3"
  }
]$j$;
  v_int  jsonb := $j$[
  {
    "assinatura": "fn_ct_atendimento_json(uuid)",
    "body_md5": "0d790707051a0d346fec43f89735893b"
  },
  {
    "assinatura": "fn_ct_avaliar_disponibilidade(uuid,text,date)",
    "body_md5": "91a89bde623538a7a8c65b344798445c"
  },
  {
    "assinatura": "fn_ct_avaliar_match(uuid,uuid)",
    "body_md5": "f20f2c64c625c581d665efa1d5846d23"
  },
  {
    "assinatura": "fn_ct_contadores_item(uuid)",
    "body_md5": "f1e9a6f52221d4b97c421d6fa4a4b08e"
  },
  {
    "assinatura": "fn_ct_item_resumo_json(uuid)",
    "body_md5": "8082882b3bf9fbb3ff2f92e2d0f01413"
  },
  {
    "assinatura": "fn_ct_recalcular_status_item(uuid)",
    "body_md5": "12ece44549d5fcb0261cd033289cc15a"
  }
]$j$;
  v_f    jsonb;
  v_oid  oid;
  v_acl  text;
  v_md5  text;
BEGIN
  FOR v_f IN SELECT * FROM jsonb_array_elements(v_pub)
  LOOP
    v_oid := to_regprocedure(v_f->>'assinatura');
    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'CT2_M2A_POSTFLIGHT: funcao ausente %', v_f->>'assinatura';
    END IF;

    PERFORM 1 FROM pg_proc p
     WHERE p.oid = v_oid
       AND pg_get_function_arguments(p.oid) = (v_f->>'args')
       AND pg_get_function_result(p.oid) = (v_f->>'ret')
       AND pg_get_userbyid(p.proowner) = 'postgres'
       AND p.prosecdef
       AND p.proconfig @> ARRAY['search_path=public']
       AND p.provolatile = (v_f->>'vol');
    IF NOT FOUND THEN
      RAISE EXCEPTION 'CT2_M2A_POSTFLIGHT: contrato divergente em %', v_f->>'assinatura';
    END IF;

    SELECT coalesce(array_to_string(p.proacl::text[], '|'), ''), md5(p.prosrc)
      INTO v_acl, v_md5
      FROM pg_proc p WHERE p.oid = v_oid;

    IF v_acl <> 'postgres=X/postgres|authenticated=X/postgres' THEN
      RAISE EXCEPTION 'CT2_M2A_POSTFLIGHT: ACL divergente em % -> %', v_f->>'assinatura', v_acl;
    END IF;

    IF v_md5 = (v_f->>'body_md5_origem') THEN
      RAISE EXCEPTION 'CT2_M2A_POSTFLIGHT: corpo nao foi alterado em %', v_f->>'assinatura';
    END IF;

    EXECUTE format('COMMENT ON FUNCTION %s IS %L', v_f->>'assinatura',
                   'CT2_M2A body_md5=' || v_md5);

    IF position('user_has_permission_action' in (SELECT p.prosrc FROM pg_proc p WHERE p.oid = v_oid)) = 0
       OR position('CT2_FORBIDDEN' in (SELECT p.prosrc FROM pg_proc p WHERE p.oid = v_oid)) = 0
       OR position('CT2_SCOPE_DENIED' in (SELECT p.prosrc FROM pg_proc p WHERE p.oid = v_oid)) = 0 THEN
      RAISE EXCEPTION 'CT2_M2A_POSTFLIGHT: guards permission-first ausentes em %', v_f->>'assinatura';
    END IF;
  END LOOP;

  -- as 6 internas devem permanecer byte a byte identicas
  FOR v_f IN SELECT * FROM jsonb_array_elements(v_int)
  LOOP
    v_oid := to_regprocedure('public.' || (v_f->>'assinatura'));
    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'CT2_M2A_POSTFLIGHT: interna ausente %', v_f->>'assinatura';
    END IF;
    SELECT md5(p.prosrc), coalesce(array_to_string(p.proacl::text[], '|'), '')
      INTO v_md5, v_acl FROM pg_proc p WHERE p.oid = v_oid;
    IF v_md5 <> (v_f->>'body_md5') THEN
      RAISE EXCEPTION 'CT2_M2A_POSTFLIGHT: interna alterada % (% <> %)',
        v_f->>'assinatura', v_md5, v_f->>'body_md5';
    END IF;
    IF v_acl <> 'postgres=X/postgres' THEN
      RAISE EXCEPTION 'CT2_M2A_POSTFLIGHT: ACL de interna divergente % -> %', v_f->>'assinatura', v_acl;
    END IF;
  END LOOP;

  RAISE NOTICE 'CT2_M2A postflight OK: 4 publicas endurecidas, 6 internas intactas.';
END;
$postflight$;

COMMIT;
