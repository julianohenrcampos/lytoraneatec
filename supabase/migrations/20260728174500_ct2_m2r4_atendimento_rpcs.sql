-- CT-2 / M2 R4 — RPCs transacionais de atendimento por item
-- Cria 10 funcoes (6 internas + 4 publicas) com preflight/postflight determinsticos.
-- Nao altera M1/M1.1, nao altera tabelas existentes, nao altera RLS.
--
-- NOTA DE LOCALIZACAO: o diretorio supabase/migrations/ e gerenciado pela ferramenta
-- de migration e nao aceita escrita direta de arquivos. Como esta rodada PROIBE
-- aplicar a migration no banco vivo, o arquivo integral fica aqui, pronto para ser
-- submetido tal e qual quando houver autorizacao explicita de aplicacao.

BEGIN;

DO $m2r4$
DECLARE
  v_contrato jsonb;
  c record;
  r record;
  g record;
  v_oid oid;
  v_cnt integer;
  v_found integer := 0;
  v_total integer := 0;
  v_mode text;
  v_rows_before bigint;
  v_rows_after bigint;
  v_defexpr text;
BEGIN
  ------------------------------------------------------------------
  -- 0. INVARIANTES M1 / M1.1
  ------------------------------------------------------------------
  IF to_regclass('public.bd_solicitacao_item_atendimentos') IS NULL THEN
    RAISE EXCEPTION 'CT2_M2R4: tabela da M1 ausente';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_attribute a
    WHERE a.attrelid = 'public.bd_solicitacao_item_atendimentos'::regclass
      AND a.attname = 'contexto_decisao'
      AND a.atthasdef
  ) THEN
    RAISE EXCEPTION 'CT2_M2R4: contexto_decisao voltou a ter DEFAULT';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.bd_solicitacao_item_atendimentos'::regclass
      AND conname = 'chk_sia_match_tipo'
      AND pg_get_constraintdef(oid) LIKE '%''EXATO''%'
  ) THEN
    RAISE EXCEPTION 'CT2_M2R4: chk_sia_match_tipo divergente';
  END IF;

  SELECT count(*) INTO v_rows_before FROM public.bd_solicitacao_item_atendimentos;

  ------------------------------------------------------------------
  -- 1. CONTRATO DECLARATIVO UNICO (somente memoria, sem tabela temporaria)
  ------------------------------------------------------------------
  v_contrato := jsonb_build_array(

  jsonb_build_object(
    'pos', 1,
    'proname', 'fn_ct_contadores_item',
    'assinatura', 'public.fn_ct_contadores_item(uuid)',
    'argnames_csv', 'p_item_id',
    'tipos_csv', 'uuid',
    'ndefaults', 0,
    'defaults_expr', NULL,
    'args_render', 'p_item_id uuid',
    'lang', 'sql',
    'vol', 's',
    'ret', 'jsonb',
    'publica', false,
    'args_create', 'p_item_id uuid',
    'corpo', $b1$
  SELECT jsonb_build_object(
    'reservado',     coalesce(c.reservado, 0),
    'em_transporte', coalesce(c.em_transporte, 0),
    'entregue',      coalesce(c.entregue, 0),
    'cancelado',     coalesce(c.cancelado, 0),
    'liberado',      coalesce(c.liberado, 0),
    'comprometidos', coalesce(c.comprometidos, 0),
    'historico',     coalesce(c.historico, 0),
    'pendentes',     greatest(coalesce(i.quantidade, 0) - coalesce(c.comprometidos, 0), 0)
  )
  FROM public.bd_solicitacoes_itens i
  LEFT JOIN LATERAL (
    SELECT
      count(*) FILTER (WHERE a.status = 'RESERVADO')::integer     AS reservado,
      count(*) FILTER (WHERE a.status = 'EM_TRANSPORTE')::integer AS em_transporte,
      count(*) FILTER (WHERE a.status = 'ENTREGUE')::integer      AS entregue,
      count(*) FILTER (WHERE a.status = 'CANCELADO')::integer     AS cancelado,
      count(*) FILTER (WHERE a.status = 'LIBERADO')::integer      AS liberado,
      count(*) FILTER (WHERE a.status IN ('RESERVADO','EM_TRANSPORTE','ENTREGUE'))::integer AS comprometidos,
      count(*)::integer                                            AS historico
    FROM public.bd_solicitacao_item_atendimentos a
    WHERE a.solicitacao_item_id = i.id
  ) c ON true
  WHERE i.id = p_item_id;
$b1$
  ),

  jsonb_build_object(
    'pos', 2,
    'proname', 'fn_ct_item_resumo_json',
    'assinatura', 'public.fn_ct_item_resumo_json(uuid)',
    'argnames_csv', 'p_solicitacao_item_id',
    'tipos_csv', 'uuid',
    'ndefaults', 0,
    'defaults_expr', NULL,
    'args_render', 'p_solicitacao_item_id uuid',
    'lang', 'sql',
    'vol', 's',
    'ret', 'jsonb',
    'publica', false,
    'args_create', 'p_solicitacao_item_id uuid',
    'corpo', $b2$
  SELECT jsonb_build_object(
    'solicitacao_item_id', i.id,
    'quantidade',          i.quantidade,
    'status_item',         i.status_item,
    'contadores',          public.fn_ct_contadores_item(i.id)
  )
  FROM public.bd_solicitacoes_itens i
  WHERE i.id = p_solicitacao_item_id;
$b2$
  ),

  jsonb_build_object(
    'pos', 3,
    'proname', 'fn_ct_avaliar_match',
    'assinatura', 'public.fn_ct_avaliar_match(uuid,uuid)',
    'argnames_csv', 'p_item_id,p_equipamento_id',
    'tipos_csv', 'uuid, uuid',
    'ndefaults', 0,
    'defaults_expr', NULL,
    'args_render', 'p_item_id uuid, p_equipamento_id uuid',
    'lang', 'plpgsql',
    'vol', 's',
    'ret', 'jsonb',
    'publica', false,
    'args_create', 'p_item_id uuid, p_equipamento_id uuid',
    'corpo', $b3$
DECLARE
  v_i               record;
  v_e               record;
  v_item_sub        uuid;
  v_item_cat        uuid;
  v_item_tipo       uuid;
  v_item_cap_valor  numeric;
  v_item_cap_unid   text;
  v_eq_sub          uuid;
  v_eq_cat          uuid;
  v_eq_tipo         uuid;
  v_eq_cap_valor    numeric;
  v_eq_cap_unid     text;
BEGIN
  SELECT i.id, i.subcategoria_id, i.catalogo_equipamento_id, i.catalogo_variacao_id,
         i.capacidade_valor, i.capacidade_unidade, i.solicitacao_id
    INTO v_i
    FROM public.bd_solicitacoes_itens i
   WHERE i.id = p_item_id;

  IF v_i.id IS NULL THEN
    RETURN jsonb_build_object('compativel', false, 'tipo', NULL, 'via', NULL,
                              'motivo', 'Item da solicitacao nao encontrado.');
  END IF;

  SELECT e.id, e.catalogo_equipamento_id, e.subcategoria_ativo_id,
         e.tipo_equipamento_id, e.capacidade_valor, e.capacidade_unidade
    INTO v_e
    FROM public.bd_caminhoes_equipamentos e
   WHERE e.id = p_equipamento_id;

  IF v_e.id IS NULL THEN
    RETURN jsonb_build_object('compativel', false, 'tipo', NULL, 'via', NULL,
                              'motivo', 'Equipamento nao encontrado.');
  END IF;

  -- Cadeia de fallback do item (fiel a CT-1)
  v_item_cat       := v_i.catalogo_equipamento_id;
  v_item_sub       := v_i.subcategoria_id;
  v_item_cap_valor := v_i.capacidade_valor;
  v_item_cap_unid  := nullif(upper(btrim(coalesce(v_i.capacidade_unidade, ''))), '');

  IF v_i.catalogo_variacao_id IS NOT NULL THEN
    SELECT coalesce(v_item_sub, cv.subcategoria_id),
           coalesce(v_item_cap_valor, cv.capacidade_valor),
           coalesce(v_item_cap_unid, nullif(upper(btrim(coalesce(cv.capacidade_unidade, ''))), ''))
      INTO v_item_sub, v_item_cap_valor, v_item_cap_unid
      FROM public.bd_catalogo_variacoes cv
     WHERE cv.id = v_i.catalogo_variacao_id;
  END IF;

  IF v_item_cat IS NOT NULL THEN
    SELECT coalesce(v_item_sub, ce.subcategoria_id), ce.tipo_equipamento_id
      INTO v_item_sub, v_item_tipo
      FROM public.bd_catalogo_equipamentos ce
     WHERE ce.id = v_item_cat;
  END IF;

  IF v_item_tipo IS NULL THEN
    SELECT s.tipo_equipamento_id INTO v_item_tipo
      FROM public.bd_solicitacoes_equipamento s
     WHERE s.id = v_i.solicitacao_id;
  END IF;

  -- Cadeia de fallback do ativo (fiel a CT-1)
  v_eq_cat       := v_e.catalogo_equipamento_id;
  v_eq_sub       := v_e.subcategoria_ativo_id;
  v_eq_tipo      := v_e.tipo_equipamento_id;
  v_eq_cap_valor := v_e.capacidade_valor;
  v_eq_cap_unid  := nullif(upper(btrim(coalesce(v_e.capacidade_unidade, ''))), '');

  IF v_eq_cat IS NOT NULL THEN
    SELECT coalesce(v_eq_sub, ce.subcategoria_id),
           coalesce(v_eq_tipo, ce.tipo_equipamento_id)
      INTO v_eq_sub, v_eq_tipo
      FROM public.bd_catalogo_equipamentos ce
     WHERE ce.id = v_eq_cat;
  END IF;

  -- 1) Catalogo identico => EXATO (NULL nunca e EXATO)
  IF v_item_cat IS NOT NULL AND v_eq_cat IS NOT NULL AND v_item_cat = v_eq_cat THEN
    RETURN jsonb_build_object('compativel', true, 'tipo', 'EXATO', 'via', 'catalogo',
                              'motivo', 'Mesmo item de catalogo.');
  END IF;

  -- 2) Subcategoria + capacidade (valor e unidade) => EXATO
  IF v_item_sub IS NOT NULL AND v_eq_sub IS NOT NULL AND v_item_sub = v_eq_sub
     AND v_item_cap_valor IS NOT NULL AND v_eq_cap_valor IS NOT NULL
     AND v_item_cap_valor = v_eq_cap_valor
     AND v_item_cap_unid IS NOT NULL AND v_eq_cap_unid IS NOT NULL
     AND v_item_cap_unid = v_eq_cap_unid THEN
    RETURN jsonb_build_object('compativel', true, 'tipo', 'EXATO', 'via', 'subcategoria+capacidade',
                              'motivo', 'Subcategoria e capacidade conferem.');
  END IF;

  -- 3) Subcategoria => PARCIAL
  IF v_item_sub IS NOT NULL AND v_eq_sub IS NOT NULL AND v_item_sub = v_eq_sub THEN
    RETURN jsonb_build_object('compativel', true, 'tipo', 'PARCIAL', 'via', 'subcategoria',
                              'motivo', 'Compatibilidade parcial: capacidade do ativo nao confirmada.');
  END IF;

  -- 4) Tipo generico => PARCIAL
  IF v_item_tipo IS NOT NULL AND v_eq_tipo IS NOT NULL AND v_item_tipo = v_eq_tipo THEN
    RETURN jsonb_build_object('compativel', true, 'tipo', 'PARCIAL', 'via', 'tipo_equipamento',
                              'motivo', 'Compatibilidade parcial: apenas o tipo generico coincide.');
  END IF;

  RETURN jsonb_build_object('compativel', false, 'tipo', NULL, 'via', NULL,
                            'motivo', 'Equipamento incompativel com o item solicitado.');
END;
$b3$
  ),

  jsonb_build_object(
    'pos', 4,
    'proname', 'fn_ct_avaliar_disponibilidade',
    'assinatura', 'public.fn_ct_avaliar_disponibilidade(uuid,text,date)',
    'argnames_csv', 'p_equipamento_id,p_modalidade,p_periodo_inicio',
    'tipos_csv', 'uuid, text, date',
    'ndefaults', 0,
    'defaults_expr', NULL,
    'args_render', 'p_equipamento_id uuid, p_modalidade text, p_periodo_inicio date',
    'lang', 'plpgsql',
    'vol', 's',
    'ret', 'jsonb',
    'publica', false,
    'args_create', 'p_equipamento_id uuid, p_modalidade text, p_periodo_inicio date',
    'corpo', $b4$
DECLARE
  v_d record;
BEGIN
  SELECT d.id, d.status_operacional::text AS status_operacional, d.previsao_liberacao,
         d.centro_custo_id, d.confiabilidade_previsao::text AS confiabilidade_previsao
    INTO v_d
    FROM public.bd_disponibilidade_equipamentos d
   WHERE d.equipamento_id = p_equipamento_id
   ORDER BY d.updated_at DESC NULLS LAST,
            d.created_at DESC NULLS LAST,
            d.id DESC
   LIMIT 1;

  -- Reconciliacao CT-1: ausencia de linha nao descarta o ativo.
  IF v_d.id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'SEM_REGISTRO',
      'ok', true,
      'override', false,
      'reconciliado', true,
      'previsao_liberacao', NULL,
      'confiabilidade', NULL,
      'centro_custo_id', NULL,
      'motivo', 'Ativo sem registro de disponibilidade; tratado como disponivel.'
    );
  END IF;

  IF v_d.status_operacional = 'DISPONIVEL' THEN
    RETURN jsonb_build_object(
      'status', v_d.status_operacional,
      'ok', true,
      'override', false,
      'reconciliado', false,
      'previsao_liberacao', v_d.previsao_liberacao,
      'confiabilidade', v_d.confiabilidade_previsao,
      'centro_custo_id', v_d.centro_custo_id,
      'motivo', 'Ativo disponivel.'
    );
  END IF;

  IF p_modalidade = 'RESERVA_FUTURA'
     AND v_d.previsao_liberacao IS NOT NULL
     AND p_periodo_inicio IS NOT NULL
     AND v_d.previsao_liberacao <= p_periodo_inicio THEN
    RETURN jsonb_build_object(
      'status', v_d.status_operacional,
      'ok', true,
      'override', false,
      'reconciliado', false,
      'previsao_liberacao', v_d.previsao_liberacao,
      'confiabilidade', v_d.confiabilidade_previsao,
      'centro_custo_id', v_d.centro_custo_id,
      'motivo', 'Reserva futura coberta pela previsao de liberacao.'
    );
  END IF;

  RETURN jsonb_build_object(
    'status', v_d.status_operacional,
    'ok', false,
    'override', true,
    'reconciliado', false,
    'previsao_liberacao', v_d.previsao_liberacao,
    'confiabilidade', v_d.confiabilidade_previsao,
    'centro_custo_id', v_d.centro_custo_id,
    'motivo', 'Ativo indisponivel para o periodo solicitado.'
  );
END;
$b4$
  ),

  jsonb_build_object(
    'pos', 5,
    'proname', 'fn_ct_atendimento_json',
    'assinatura', 'public.fn_ct_atendimento_json(uuid)',
    'argnames_csv', 'p_atendimento_id',
    'tipos_csv', 'uuid',
    'ndefaults', 0,
    'defaults_expr', NULL,
    'args_render', 'p_atendimento_id uuid',
    'lang', 'sql',
    'vol', 's',
    'ret', 'jsonb',
    'publica', false,
    'args_create', 'p_atendimento_id uuid',
    'corpo', $b5$
  SELECT jsonb_build_object(
    'id',                       a.id,
    'solicitacao_item_id',      a.solicitacao_item_id,
    'equipamento_id',           a.equipamento_id,
    'equipamento_frota',        e.frota,
    'equipamento_numero',       e.numero_frota,
    'equipamento_placa',        e.placa,
    'modalidade',               a.modalidade,
    'status',                   a.status,
    'periodo_inicio',           a.periodo_inicio,
    'periodo_fim',              a.periodo_fim,
    'janela_aprovada_inicio',   a.janela_aprovada_inicio,
    'janela_aprovada_fim',      a.janela_aprovada_fim,
    'override_periodo',         a.override_periodo,
    'override_disponibilidade', a.override_disponibilidade,
    'match_tipo',               a.match_tipo,
    'justificativa_override',   a.justificativa_override,
    'contexto_decisao',         a.contexto_decisao,
    'encerrado_em',             a.encerrado_em,
    'motivo_encerramento',      a.motivo_encerramento,
    'created_at',               a.created_at
  )
  FROM public.bd_solicitacao_item_atendimentos a
  LEFT JOIN public.bd_caminhoes_equipamentos e ON e.id = a.equipamento_id
  WHERE a.id = p_atendimento_id;
$b5$
  ),

  jsonb_build_object(
    'pos', 6,
    'proname', 'fn_ct_recalcular_status_item',
    'assinatura', 'public.fn_ct_recalcular_status_item(uuid)',
    'argnames_csv', 'p_solicitacao_item_id',
    'tipos_csv', 'uuid',
    'ndefaults', 0,
    'defaults_expr', NULL,
    'args_render', 'p_solicitacao_item_id uuid',
    'lang', 'plpgsql',
    'vol', 'v',
    'ret', 'text',
    'publica', false,
    'args_create', 'p_solicitacao_item_id uuid',
    'corpo', $b6$
DECLARE
  v_qtd    integer;
  v_atual  text;
  v_comp   integer;
  v_entr   integer;
  v_hist   integer;
  v_novo   text;
BEGIN
  SELECT i.quantidade, i.status_item
    INTO v_qtd, v_atual
    FROM public.bd_solicitacoes_itens i
   WHERE i.id = p_solicitacao_item_id
   FOR UPDATE;

  IF v_atual IS NULL AND v_qtd IS NULL THEN
    RAISE EXCEPTION 'CT2_ITEM_NAO_ENCONTRADO' USING ERRCODE = 'P0001',
      HINT = 'O item da solicitacao nao existe mais.';
  END IF;

  IF v_qtd IS NULL OR v_qtd <= 0 THEN
    RAISE EXCEPTION 'CT2_ITEM_QUANTIDADE_INVALIDA' USING ERRCODE = 'P0001',
      HINT = 'A quantidade do item precisa ser maior que zero.';
  END IF;

  SELECT
    count(*) FILTER (WHERE a.status IN ('RESERVADO','EM_TRANSPORTE','ENTREGUE'))::integer,
    count(*) FILTER (WHERE a.status = 'ENTREGUE')::integer,
    count(*)::integer
    INTO v_comp, v_entr, v_hist
    FROM public.bd_solicitacao_item_atendimentos a
   WHERE a.solicitacao_item_id = p_solicitacao_item_id;

  IF v_comp > v_qtd OR v_entr > v_qtd THEN
    RAISE EXCEPTION 'CT2_INVARIANTE_VIOLADA' USING ERRCODE = 'P0001',
      HINT = 'A operacao violou uma regra de integridade do atendimento.';
  END IF;

  IF v_entr = v_qtd THEN
    v_novo := 'ATENDIDO';
  ELSIF v_comp > 0 THEN
    v_novo := 'PLANEJADO';
  ELSIF v_hist > 0 THEN
    v_novo := 'EM_ANALISE';
  ELSE
    v_novo := v_atual;
  END IF;

  IF v_novo IS DISTINCT FROM v_atual THEN
    UPDATE public.bd_solicitacoes_itens
       SET status_item = v_novo,
           updated_at  = now()
     WHERE id = p_solicitacao_item_id;
  END IF;

  RETURN v_novo;
END;
$b6$
  ),

  jsonb_build_object(
    'pos', 7,
    'proname', 'fn_ct_atendimento_atribuir',
    'assinatura', 'public.fn_ct_atendimento_atribuir(uuid,uuid,text,uuid,date,date,text)',
    'argnames_csv', 'p_solicitacao_item_id,p_equipamento_id,p_modalidade,p_request_id,p_periodo_inicio,p_periodo_fim,p_justificativa_override',
    'tipos_csv', 'uuid, uuid, text, uuid, date, date, text',
    'ndefaults', 3,
    'defaults_expr', 'NULL::date, NULL::date, NULL::text',
    'args_render', 'p_solicitacao_item_id uuid, p_equipamento_id uuid, p_modalidade text, p_request_id uuid, p_periodo_inicio date DEFAULT NULL::date, p_periodo_fim date DEFAULT NULL::date, p_justificativa_override text DEFAULT NULL::text',
    'lang', 'plpgsql',
    'vol', 'v',
    'ret', 'jsonb',
    'publica', true,
    'args_create', 'p_solicitacao_item_id uuid, p_equipamento_id uuid, p_modalidade text, p_request_id uuid, p_periodo_inicio date DEFAULT NULL::date, p_periodo_fim date DEFAULT NULL::date, p_justificativa_override text DEFAULT NULL::text',
    'corpo', $b7$
DECLARE
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
    RAISE EXCEPTION 'CT2_NAO_AUTENTICADO' USING ERRCODE = 'P0001',
      HINT = 'Sessao expirada. Entre novamente para continuar.';
  END IF;

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

  IF NOT (public.fn_is_super_admin() OR public.fn_ativos_can_access_solicitacao(v_sol.id)) THEN
    RAISE EXCEPTION 'CT2_ACESSO_NEGADO' USING ERRCODE = 'P0001',
      HINT = 'Voce nao tem acesso a esta solicitacao.';
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
$b7$
  ),

  jsonb_build_object(
    'pos', 8,
    'proname', 'fn_ct_atendimento_encerrar',
    'assinatura', 'public.fn_ct_atendimento_encerrar(uuid,text,text,uuid)',
    'argnames_csv', 'p_atendimento_id,p_novo_status,p_motivo,p_request_id',
    'tipos_csv', 'uuid, text, text, uuid',
    'ndefaults', 0,
    'defaults_expr', NULL,
    'args_render', 'p_atendimento_id uuid, p_novo_status text, p_motivo text, p_request_id uuid',
    'lang', 'plpgsql',
    'vol', 'v',
    'ret', 'jsonb',
    'publica', true,
    'args_create', 'p_atendimento_id uuid, p_novo_status text, p_motivo text, p_request_id uuid',
    'corpo', $b8$
DECLARE
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
    RAISE EXCEPTION 'CT2_NAO_AUTENTICADO' USING ERRCODE = 'P0001',
      HINT = 'Sessao expirada. Entre novamente para continuar.';
  END IF;

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

  IF NOT (public.fn_is_super_admin() OR public.fn_ativos_can_access_solicitacao(v_sol.id)) THEN
    RAISE EXCEPTION 'CT2_ACESSO_NEGADO' USING ERRCODE = 'P0001',
      HINT = 'Voce nao tem acesso a esta solicitacao.';
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
$b8$
  ),

  jsonb_build_object(
    'pos', 9,
    'proname', 'fn_ct_atendimento_substituir',
    'assinatura', 'public.fn_ct_atendimento_substituir(uuid,uuid,text,text,uuid,text)',
    'argnames_csv', 'p_atendimento_id,p_novo_equipamento_id,p_modalidade,p_motivo,p_request_id,p_justificativa_override',
    'tipos_csv', 'uuid, uuid, text, text, uuid, text',
    'ndefaults', 1,
    'defaults_expr', 'NULL::text',
    'args_render', 'p_atendimento_id uuid, p_novo_equipamento_id uuid, p_modalidade text, p_motivo text, p_request_id uuid, p_justificativa_override text DEFAULT NULL::text',
    'lang', 'plpgsql',
    'vol', 'v',
    'ret', 'jsonb',
    'publica', true,
    'args_create', 'p_atendimento_id uuid, p_novo_equipamento_id uuid, p_modalidade text, p_motivo text, p_request_id uuid, p_justificativa_override text DEFAULT NULL::text',
    'corpo', $b9$
DECLARE
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
    RAISE EXCEPTION 'CT2_NAO_AUTENTICADO' USING ERRCODE = 'P0001',
      HINT = 'Sessao expirada. Entre novamente para continuar.';
  END IF;

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

  IF NOT (public.fn_is_super_admin() OR public.fn_ativos_can_access_solicitacao(v_sol.id)) THEN
    RAISE EXCEPTION 'CT2_ACESSO_NEGADO' USING ERRCODE = 'P0001',
      HINT = 'Voce nao tem acesso a esta solicitacao.';
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
$b9$
  ),

  jsonb_build_object(
    'pos', 10,
    'proname', 'fn_ct_atendimento_listar',
    'assinatura', 'public.fn_ct_atendimento_listar(uuid)',
    'argnames_csv', 'p_solicitacao_id',
    'tipos_csv', 'uuid',
    'ndefaults', 0,
    'defaults_expr', NULL,
    'args_render', 'p_solicitacao_id uuid',
    'lang', 'plpgsql',
    'vol', 's',
    'ret', 'jsonb',
    'publica', true,
    'args_create', 'p_solicitacao_id uuid',
    'corpo', $b10$
DECLARE
  v_uid   uuid;
  v_sol   record;
  v_itens jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'CT2_NAO_AUTENTICADO' USING ERRCODE = 'P0001',
      HINT = 'Sessao expirada. Entre novamente para continuar.';
  END IF;

  SELECT s.id INTO v_sol
    FROM public.bd_solicitacoes_equipamento s
   WHERE s.id = p_solicitacao_id;

  IF v_sol.id IS NULL THEN
    RAISE EXCEPTION 'CT2_SOLICITACAO_NAO_ENCONTRADA' USING ERRCODE = 'P0001',
      HINT = 'A solicitacao informada nao existe.';
  END IF;

  IF NOT (public.fn_is_super_admin() OR public.fn_ativos_can_access_solicitacao(p_solicitacao_id)) THEN
    RAISE EXCEPTION 'CT2_ACESSO_NEGADO' USING ERRCODE = 'P0001',
      HINT = 'Voce nao tem acesso a esta solicitacao.';
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
$b10$
  )

  );

  ------------------------------------------------------------------
  -- 2. PREFLIGHT POR OID
  ------------------------------------------------------------------
  FOR c IN
    SELECT * FROM jsonb_to_recordset(v_contrato) AS x(
      pos integer, proname text, assinatura text, argnames_csv text, tipos_csv text,
      ndefaults integer, defaults_expr text, args_render text, lang text, vol text,
      ret text, publica boolean, args_create text, corpo text
    )
    ORDER BY pos
  LOOP
    v_total := v_total + 1;
    v_oid := to_regprocedure(c.assinatura);

    SELECT count(*) INTO v_cnt
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = c.proname;

    IF v_oid IS NOT NULL THEN
      v_found := v_found + 1;
      IF v_cnt <> 1 THEN
        RAISE EXCEPTION 'CT2_M2R4_PREFLIGHT: % com % objetos (esperado 1)', c.proname, v_cnt;
      END IF;
    ELSIF v_cnt <> 0 THEN
      RAISE EXCEPTION 'CT2_M2R4_PREFLIGHT: % existe com assinatura divergente', c.proname;
    END IF;
  END LOOP;

  IF v_total <> 10 THEN
    RAISE EXCEPTION 'CT2_M2R4: contrato incompleto (% itens)', v_total;
  END IF;

  IF v_found = 0 THEN
    v_mode := 'create';
  ELSIF v_found = 10 THEN
    v_mode := 'validate_only';
  ELSE
    RAISE EXCEPTION 'CT2_M2R4_PREFLIGHT: estado parcial (%/10)', v_found;
  END IF;

  ------------------------------------------------------------------
  -- 3. DDL + ACL + COMMENT (somente no modo create)
  ------------------------------------------------------------------
  IF v_mode = 'create' THEN
    FOR c IN
      SELECT * FROM jsonb_to_recordset(v_contrato) AS x(
        pos integer, proname text, assinatura text, argnames_csv text, tipos_csv text,
        ndefaults integer, defaults_expr text, args_render text, lang text, vol text,
        ret text, publica boolean, args_create text, corpo text
      )
      ORDER BY pos
    LOOP
      EXECUTE format(
        'CREATE FUNCTION public.%I(%s) RETURNS %s LANGUAGE %s %s SECURITY DEFINER SET search_path = public AS %L',
        c.proname, c.args_create, c.ret, c.lang,
        CASE c.vol WHEN 's' THEN 'STABLE' ELSE 'VOLATILE' END,
        c.corpo
      );
      EXECUTE format('ALTER FUNCTION %s OWNER TO postgres', c.assinatura);
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', c.assinatura);

      FOR r IN SELECT rolname FROM pg_roles WHERE rolname <> 'postgres' LOOP
        BEGIN
          EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I', c.assinatura, r.rolname);
        EXCEPTION WHEN insufficient_privilege OR undefined_object THEN
          NULL;
        END;
      END LOOP;

      IF c.publica THEN
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', c.assinatura);
      END IF;

      EXECUTE format('COMMENT ON FUNCTION %s IS %L', c.assinatura,
                     'CT2_M2_R4 body_md5=' || md5(c.corpo));
    END LOOP;
  END IF;

  ------------------------------------------------------------------
  -- 4. VALIDACAO INTEGRAL
  ------------------------------------------------------------------
  FOR c IN
    SELECT * FROM jsonb_to_recordset(v_contrato) AS x(
      pos integer, proname text, assinatura text, argnames_csv text, tipos_csv text,
      ndefaults integer, defaults_expr text, args_render text, lang text, vol text,
      ret text, publica boolean, args_create text, corpo text
    )
    ORDER BY pos
  LOOP
    v_oid := to_regprocedure(c.assinatura);
    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'CT2_M2R4: assinatura ausente %', c.assinatura;
    END IF;

    SELECT count(*) INTO v_cnt
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = c.proname;
    IF v_cnt <> 1 THEN
      RAISE EXCEPTION 'CT2_M2R4: sobrecarga em % (% objetos)', c.proname, v_cnt;
    END IF;

    SELECT p.prosrc, p.prosecdef, p.proconfig, p.provolatile::text AS provolatile,
           p.pronargdefaults, p.proargdefaults, p.proacl,
           l.lanname, pg_get_userbyid(p.proowner) AS owner,
           pg_get_function_result(p.oid) AS ret_render,
           pg_get_function_arguments(p.oid) AS args_render,
           oidvectortypes(p.proargtypes) AS tipos_render,
           array_to_string(p.proargnames, ',') AS argnames_render
      INTO r
      FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang
     WHERE p.oid = v_oid;

    IF r.ret_render <> c.ret THEN
      RAISE EXCEPTION 'CT2_M2R4: retorno % em %', r.ret_render, c.proname;
    END IF;
    IF r.lanname <> c.lang THEN
      RAISE EXCEPTION 'CT2_M2R4: linguagem % em %', r.lanname, c.proname;
    END IF;
    IF r.provolatile <> c.vol THEN
      RAISE EXCEPTION 'CT2_M2R4: volatilidade % em %', r.provolatile, c.proname;
    END IF;
    IF NOT r.prosecdef THEN
      RAISE EXCEPTION 'CT2_M2R4: % sem SECURITY DEFINER', c.proname;
    END IF;
    IF r.owner <> 'postgres' THEN
      RAISE EXCEPTION 'CT2_M2R4: owner % em %', r.owner, c.proname;
    END IF;
    IF r.proconfig IS NULL OR array_length(r.proconfig, 1) <> 1
       OR r.proconfig[1] <> 'search_path=public' THEN
      RAISE EXCEPTION 'CT2_M2R4: search_path invalido em %', c.proname;
    END IF;
    IF r.argnames_render IS DISTINCT FROM c.argnames_csv THEN
      RAISE EXCEPTION 'CT2_M2R4: nomes de parametros divergentes em % (%)', c.proname, r.argnames_render;
    END IF;
    IF r.tipos_render <> c.tipos_csv THEN
      RAISE EXCEPTION 'CT2_M2R4: tipos/ordem divergentes em % (%)', c.proname, r.tipos_render;
    END IF;
    IF r.pronargdefaults <> c.ndefaults THEN
      RAISE EXCEPTION 'CT2_M2R4: ndefaults % em %', r.pronargdefaults, c.proname;
    END IF;
    IF c.ndefaults > 0 THEN
      v_defexpr := pg_get_expr(r.proargdefaults, 0);
      IF v_defexpr IS DISTINCT FROM c.defaults_expr THEN
        RAISE EXCEPTION 'CT2_M2R4: defaults % em %', v_defexpr, c.proname;
      END IF;
    ELSIF r.proargdefaults IS NOT NULL THEN
      RAISE EXCEPTION 'CT2_M2R4: default inesperado em %', c.proname;
    END IF;
    IF r.args_render <> c.args_render THEN
      RAISE EXCEPTION 'CT2_M2R4: contrato de argumentos divergente em % (%)', c.proname, r.args_render;
    END IF;
    IF md5(r.prosrc) <> md5(c.corpo) THEN
      RAISE EXCEPTION 'CT2_M2R4: corpo divergente em % (vivo=%, esperado=%)',
        c.proname, md5(r.prosrc), md5(c.corpo);
    END IF;

    RAISE NOTICE 'CT2_M2R4: % body_md5=%', c.proname, md5(c.corpo);

    FOR g IN
      SELECT coalesce(pg_get_userbyid(a.grantee), 'PUBLIC') AS grantee,
             a.privilege_type, a.is_grantable
        FROM aclexplode(coalesce(r.proacl, '{}'::aclitem[])) a
    LOOP
      IF g.is_grantable THEN
        RAISE EXCEPTION 'CT2_M2R4: GRANT OPTION em %', c.proname;
      END IF;
      IF g.privilege_type <> 'EXECUTE' THEN
        RAISE EXCEPTION 'CT2_M2R4: privilegio % em %', g.privilege_type, c.proname;
      END IF;
      IF g.grantee = 'postgres' THEN
        CONTINUE;
      END IF;
      IF c.publica THEN
        IF g.grantee <> 'authenticated' THEN
          RAISE EXCEPTION 'CT2_M2R4: grantee % em %', g.grantee, c.proname;
        END IF;
      ELSE
        RAISE EXCEPTION 'CT2_M2R4: funcao interna % com grantee %', c.proname, g.grantee;
      END IF;
    END LOOP;

    IF c.publica THEN
      IF NOT has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
        RAISE EXCEPTION 'CT2_M2R4: % sem EXECUTE para authenticated', c.proname;
      END IF;
    ELSE
      IF has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
        RAISE EXCEPTION 'CT2_M2R4: interna % executavel por authenticated', c.proname;
      END IF;
    END IF;

    IF has_function_privilege('anon', v_oid, 'EXECUTE')
       OR has_function_privilege('service_role', v_oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'CT2_M2R4: % executavel por anon/service_role', c.proname;
    END IF;
  END LOOP;

  ------------------------------------------------------------------
  -- 5. POSTFLIGHT ESTRUTURAL
  ------------------------------------------------------------------
  SELECT count(*) INTO v_rows_after FROM public.bd_solicitacao_item_atendimentos;
  IF v_rows_after <> v_rows_before THEN
    RAISE EXCEPTION 'CT2_M2R4_POSTFLIGHT: dados alterados (% -> %)', v_rows_before, v_rows_after;
  END IF;

  SELECT count(*) INTO v_cnt
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN (
       'fn_ct_contadores_item','fn_ct_item_resumo_json','fn_ct_avaliar_match',
       'fn_ct_avaliar_disponibilidade','fn_ct_atendimento_json','fn_ct_recalcular_status_item',
       'fn_ct_atendimento_atribuir','fn_ct_atendimento_encerrar',
       'fn_ct_atendimento_substituir','fn_ct_atendimento_listar'
     );
  IF v_cnt <> 10 THEN
    RAISE EXCEPTION 'CT2_M2R4_POSTFLIGHT: contagem de funcoes = % (esperado 10)', v_cnt;
  END IF;

  RAISE NOTICE 'CT2_M2R4 CONCLUIDO (modo=%): 10 assinaturas conformes; registros=%', v_mode, v_rows_after;
END
$m2r4$;

COMMIT;
