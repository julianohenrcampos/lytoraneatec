
-- ============================================================================
-- BLOCO 1 (retry): bypass do trigger de catálogo via session_replication_role
-- ============================================================================

-- ---------- 1) Catálogo (permissão + ação) ----------
DO $mig$
BEGIN
  SET LOCAL session_replication_role = 'replica';

  INSERT INTO public.bd_permissions (codigo, nome, descricao, rota, tipo, modulo, ativo)
  VALUES (
    'equipamentos_solicitacoes_aprovar',
    'Aprovar Solicitações de Equipamento',
    'Permite avaliar e decidir (aprovar/negar) solicitações de equipamento na Central de Aprovações. Escopo por Centro de Custo, respeitando aprovador do CC ou acesso operacional.',
    NULL, 'action', 'gestao_maquinas', true
  )
  ON CONFLICT (codigo) DO NOTHING;

  INSERT INTO public.bd_permissoes_acoes (permission_id, acao, descricao)
  SELECT p.id, 'aprovar', 'Decidir (aprovar/negar) solicitações de equipamento'
  FROM public.bd_permissions p
  WHERE p.codigo = 'equipamentos_solicitacoes_aprovar'
    AND NOT EXISTS (
      SELECT 1 FROM public.bd_permissoes_acoes pa
      WHERE pa.permission_id = p.id AND pa.acao = 'aprovar'
    );
END
$mig$;

-- ---------- 2) fn_solic_equip_criar ----------
CREATE OR REPLACE FUNCTION public.fn_solic_equip_criar(
  p_solicitacao_id            uuid,
  p_centro_custo_id           uuid,
  p_tipo_equipamento_id       uuid,
  p_data_inicio               date,
  p_tempo_previsto_dias       integer,
  p_regime_trabalho           text,
  p_com_operador              boolean,
  p_prioridade                text,
  p_justificativa             text,
  p_engenheiro_solicitante_id uuid,
  p_apontador_responsavel_id  uuid,
  p_itens                     jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid                uuid := auth.uid();
  v_is_super           boolean;
  v_lock_key           bigint;
  v_cc_exists          boolean;
  v_cc_aprov_func_id   uuid;
  v_aprov_func_status  text;
  v_aprov_profile_id   uuid;
  v_aprov_profile_cnt  integer;
  v_eng_func_id        uuid;
  v_eng_func_status    text;
  v_eng_func_nome      text;
  v_eng_func_ok        boolean;
  v_apo_func_id        uuid;
  v_apo_func_status    text;
  v_justificativa_norm text;
  v_itens_norm         jsonb;
  v_qtd_total          integer;
  v_qtd_itens          integer;
  v_existing           record;
  v_sig_new            jsonb;
  v_items_old_arr      jsonb;
  v_items_new_arr      jsonb;
  v_items_count_old    integer;
  v_new_id             uuid;
  v_new_aprov_id       uuid;
  v_prio               text;
  v_reg                text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_NAO_AUTENTICADO' USING ERRCODE='42501';
  END IF;
  IF p_solicitacao_id IS NULL THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_ID_OBRIGATORIO' USING ERRCODE='22004';
  END IF;

  v_is_super := public.fn_is_super_admin(v_uid);
  v_lock_key := hashtextextended(p_solicitacao_id::text, 42);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  v_prio := COALESCE(NULLIF(btrim(p_prioridade), ''), 'NORMAL');
  IF v_prio NOT IN ('NORMAL','ALTA','URGENTE') THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_PRIORIDADE_INVALIDA'
      USING DETAIL = jsonb_build_object('prioridade', v_prio)::text;
  END IF;

  v_reg := NULLIF(btrim(p_regime_trabalho), '');
  IF v_reg IS NOT NULL AND v_reg NOT IN ('SEGUNDA_SEXTA','SEGUNDA_SABADO','TODOS_DIAS','PERSONALIZADO') THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_REGIME_INVALIDO'
      USING DETAIL = jsonb_build_object('regime_trabalho', v_reg)::text;
  END IF;

  v_justificativa_norm := regexp_replace(btrim(COALESCE(p_justificativa,'')), '\s+', ' ', 'g');
  IF char_length(v_justificativa_norm) < 1 THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_JUSTIFICATIVA_OBRIGATORIA' USING ERRCODE='22004';
  END IF;

  IF p_data_inicio IS NULL THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_DATA_INICIO_OBRIGATORIA' USING ERRCODE='22004';
  END IF;

  IF p_tempo_previsto_dias IS NOT NULL AND p_tempo_previsto_dias <= 0 THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_TEMPO_PREVISTO_INVALIDO' USING ERRCODE='22004';
  END IF;

  IF NOT v_is_super THEN
    IF NOT public.fn_ativos_has_operational_access(v_uid) THEN
      RAISE EXCEPTION 'EQUIP_SOLIC_SEM_ACESSO_OPERACIONAL' USING ERRCODE='42501';
    END IF;
    IF NOT public.fn_ativos_can_access_centro_custo(p_centro_custo_id, v_uid) THEN
      RAISE EXCEPTION 'EQUIP_SOLIC_SEM_ACESSO_CC' USING ERRCODE='42501';
    END IF;
  END IF;

  -- CC + aprovador (funcionario -> profile)
  SELECT true, cc.aprovador_diarias_id
    INTO v_cc_exists, v_cc_aprov_func_id
  FROM public.bd_centros_custo cc
  WHERE cc.id = p_centro_custo_id;
  IF NOT COALESCE(v_cc_exists,false) THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_CC_INEXISTENTE' USING ERRCODE='P0002';
  END IF;
  IF v_cc_aprov_func_id IS NULL THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_CC_SEM_APROVADOR'
      USING DETAIL = jsonb_build_object('centro_custo_id', p_centro_custo_id)::text;
  END IF;

  SELECT f.status INTO v_aprov_func_status
    FROM public.bd_funcionarios f WHERE f.id = v_cc_aprov_func_id;
  IF v_aprov_func_status IS NULL THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_APROVADOR_FUNC_INEXISTENTE'
      USING DETAIL = jsonb_build_object('funcionario_id', v_cc_aprov_func_id)::text;
  END IF;
  IF v_aprov_func_status NOT IN ('Ativo','Ativo sem Registro') THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_APROVADOR_INATIVO'
      USING DETAIL = jsonb_build_object('funcionario_id', v_cc_aprov_func_id, 'status', v_aprov_func_status)::text;
  END IF;

  SELECT count(*) INTO v_aprov_profile_cnt
    FROM public.profiles pr WHERE pr.funcionario_id = v_cc_aprov_func_id;
  IF v_aprov_profile_cnt = 0 THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_APROVADOR_SEM_PROFILE'
      USING DETAIL = jsonb_build_object('funcionario_id', v_cc_aprov_func_id)::text;
  ELSIF v_aprov_profile_cnt > 1 THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_APROVADOR_MULTIPLOS_PROFILES'
      USING DETAIL = jsonb_build_object('funcionario_id', v_cc_aprov_func_id, 'qtd', v_aprov_profile_cnt)::text;
  END IF;
  SELECT pr.id INTO v_aprov_profile_id
    FROM public.profiles pr WHERE pr.funcionario_id = v_cc_aprov_func_id LIMIT 1;

  -- Engenheiro
  IF p_engenheiro_solicitante_id IS NULL THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_ENGENHEIRO_OBRIGATORIO' USING ERRCODE='22004';
  END IF;
  SELECT p.funcionario_id, f.status, fu.nome_funcao
    INTO v_eng_func_id, v_eng_func_status, v_eng_func_nome
  FROM public.profiles p
  LEFT JOIN public.bd_funcionarios f ON f.id = p.funcionario_id
  LEFT JOIN public.bd_funcoes fu     ON fu.id = f.funcao_id
  WHERE p.id = p_engenheiro_solicitante_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_ENGENHEIRO_SEM_PROFILE'
      USING DETAIL = jsonb_build_object('profile_id', p_engenheiro_solicitante_id)::text;
  END IF;
  IF v_eng_func_id IS NULL THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_ENGENHEIRO_SEM_FUNCIONARIO'
      USING DETAIL = jsonb_build_object('profile_id', p_engenheiro_solicitante_id)::text;
  END IF;
  IF v_eng_func_status IS NULL THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_ENGENHEIRO_FUNCIONARIO_INEXISTENTE'
      USING DETAIL = jsonb_build_object('funcionario_id', v_eng_func_id)::text;
  END IF;
  IF v_eng_func_status NOT IN ('Ativo','Ativo sem Registro') THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_ENGENHEIRO_INATIVO'
      USING DETAIL = jsonb_build_object('funcionario_id', v_eng_func_id, 'status', v_eng_func_status)::text;
  END IF;
  v_eng_func_ok := (
    v_eng_func_nome IS NOT NULL AND (
      lower(public.unaccent(v_eng_func_nome)) LIKE '%engenheiro%'
      OR lower(public.unaccent(v_eng_func_nome)) LIKE '%gerente regional%'
    )
  );
  IF NOT v_eng_func_ok THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_ENGENHEIRO_FUNCAO_INVALIDA'
      USING DETAIL = jsonb_build_object('funcao', v_eng_func_nome)::text;
  END IF;

  -- Apontador
  IF p_apontador_responsavel_id IS NULL THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_APONTADOR_OBRIGATORIO' USING ERRCODE='22004';
  END IF;
  SELECT p.funcionario_id, f.status
    INTO v_apo_func_id, v_apo_func_status
  FROM public.profiles p
  LEFT JOIN public.bd_funcionarios f ON f.id = p.funcionario_id
  WHERE p.id = p_apontador_responsavel_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_APONTADOR_SEM_PROFILE'
      USING DETAIL = jsonb_build_object('profile_id', p_apontador_responsavel_id)::text;
  END IF;
  IF v_apo_func_id IS NULL THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_APONTADOR_SEM_FUNCIONARIO'
      USING DETAIL = jsonb_build_object('profile_id', p_apontador_responsavel_id)::text;
  END IF;
  IF v_apo_func_status IS NULL THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_APONTADOR_FUNCIONARIO_INEXISTENTE'
      USING DETAIL = jsonb_build_object('funcionario_id', v_apo_func_id)::text;
  END IF;
  IF v_apo_func_status NOT IN ('Ativo','Ativo sem Registro') THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_APONTADOR_INATIVO'
      USING DETAIL = jsonb_build_object('funcionario_id', v_apo_func_id, 'status', v_apo_func_status)::text;
  END IF;

  -- Itens
  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_ITENS_OBRIGATORIOS' USING ERRCODE='22004';
  END IF;
  v_qtd_itens := jsonb_array_length(p_itens);
  IF v_qtd_itens < 1 THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_ITENS_VAZIOS' USING ERRCODE='22004';
  END IF;
  IF v_qtd_itens > 50 THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_ITENS_LIMITE_EXCEDIDO'
      USING DETAIL = jsonb_build_object('qtd', v_qtd_itens, 'max', 50)::text;
  END IF;

  WITH raw AS (
    SELECT ordinality AS ord0, x.*
    FROM jsonb_to_recordset(p_itens) WITH ORDINALITY AS x(
      tipo_item               text,
      catalogo_equipamento_id uuid,
      catalogo_variacao_id    uuid,
      subcategoria_id         uuid,
      item_nao_catalogado     boolean,
      descricao_livre         text,
      capacidade_descricao    text,
      capacidade_valor        numeric,
      capacidade_unidade      text,
      quantidade              integer,
      com_operador            boolean,
      regime_trabalho         text,
      regime_personalizado    text,
      tempo_previsto_dias     integer,
      observacoes             text
    )
  ),
  norm AS (
    SELECT
      ord0,
      tipo_item,
      catalogo_equipamento_id,
      catalogo_variacao_id,
      subcategoria_id,
      COALESCE(item_nao_catalogado, false)                        AS item_nao_catalogado,
      NULLIF(btrim(COALESCE(descricao_livre,      '')), '')       AS descricao_livre,
      NULLIF(btrim(COALESCE(capacidade_descricao, '')), '')       AS capacidade_descricao,
      capacidade_valor,
      NULLIF(btrim(COALESCE(capacidade_unidade,   '')), '')       AS capacidade_unidade,
      COALESCE(quantidade, 1)                                     AS quantidade,
      COALESCE(com_operador, false)                               AS com_operador,
      NULLIF(btrim(COALESCE(regime_trabalho,      '')), '')       AS regime_trabalho,
      NULLIF(btrim(COALESCE(regime_personalizado, '')), '')       AS regime_personalizado,
      tempo_previsto_dias,
      NULLIF(btrim(COALESCE(observacoes,          '')), '')       AS observacoes
    FROM raw
  )
  SELECT
    jsonb_agg(to_jsonb(n) - 'ord0' ORDER BY
      n.tipo_item,
      coalesce(n.catalogo_equipamento_id::text,''),
      coalesce(n.catalogo_variacao_id::text,''),
      coalesce(n.subcategoria_id::text,''),
      coalesce(n.descricao_livre,''),
      coalesce(n.capacidade_descricao,''),
      coalesce(n.capacidade_valor::text,''),
      coalesce(n.capacidade_unidade,''),
      n.quantidade, n.com_operador,
      coalesce(n.regime_trabalho,''),
      coalesce(n.regime_personalizado,''),
      coalesce(n.tempo_previsto_dias::text,''),
      coalesce(n.observacoes,''),
      n.item_nao_catalogado, n.ord0
    ),
    COALESCE(sum(n.quantidade), 0)
  INTO v_itens_norm, v_qtd_total
  FROM norm n;

  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_itens_norm) e
             WHERE (e->>'tipo_item') NOT IN ('VEICULO','EQUIPAMENTO')) THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_ITEM_TIPO_INVALIDO';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_itens_norm) e
             WHERE COALESCE((e->>'quantidade')::int, 0) < 1) THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_ITEM_QUANTIDADE_INVALIDA';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_itens_norm) e
             WHERE (e->>'capacidade_valor') IS NOT NULL
               AND (e->>'capacidade_valor')::numeric < 0) THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_ITEM_CAPACIDADE_NEGATIVA';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_itens_norm) e
             WHERE (e->>'regime_trabalho') IS NOT NULL
               AND (e->>'regime_trabalho') NOT IN ('SEGUNDA_SEXTA','SEGUNDA_SABADO','TODOS_DIAS','PERSONALIZADO')) THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_ITEM_REGIME_INVALIDO';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_itens_norm) e
             WHERE (e->>'regime_trabalho') = 'PERSONALIZADO'
               AND COALESCE(e->>'regime_personalizado','') = '') THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_ITEM_REGIME_PERSONALIZADO_OBRIGATORIO';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_itens_norm) e
             WHERE COALESCE((e->>'item_nao_catalogado')::boolean, false) = false
               AND (e->>'catalogo_equipamento_id') IS NULL) THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_ITEM_CATALOGO_OBRIGATORIO';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_itens_norm) e
             WHERE COALESCE((e->>'item_nao_catalogado')::boolean, false) = true
               AND COALESCE(e->>'descricao_livre','') = '') THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_ITEM_DESCRICAO_LIVRE_OBRIGATORIA';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_itens_norm) e
             WHERE COALESCE((e->>'item_nao_catalogado')::boolean, false) = true
               AND (e->>'catalogo_equipamento_id') IS NOT NULL) THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_ITEM_NAO_CATALOGADO_CONFLITO';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_itens_norm) e
             WHERE (e->>'tempo_previsto_dias') IS NOT NULL
               AND (e->>'tempo_previsto_dias')::int <= 0) THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_ITEM_TEMPO_PREVISTO_INVALIDO';
  END IF;

  IF v_qtd_total < 1 THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_QUANTIDADE_TOTAL_INVALIDA'
      USING DETAIL = jsonb_build_object('quantidade_total', v_qtd_total)::text;
  END IF;

  v_sig_new := jsonb_build_object(
    'centro_custo_id',            p_centro_custo_id,
    'tipo_equipamento_id',        p_tipo_equipamento_id,
    'data_inicio',                p_data_inicio,
    'tempo_previsto_dias',        p_tempo_previsto_dias,
    'regime_trabalho',            v_reg,
    'com_operador',               COALESCE(p_com_operador, false),
    'prioridade',                 v_prio,
    'justificativa',              v_justificativa_norm,
    'engenheiro_solicitante_id',  p_engenheiro_solicitante_id,
    'apontador_responsavel_id',   p_apontador_responsavel_id,
    'aprovador_centro_custo_id',  v_aprov_profile_id,
    'quantidade',                 v_qtd_total,
    'solicitante_id',             v_uid
  );

  SELECT s.id, s.status::text AS status, s.status_fluxo, s.solicitante_id,
         s.aprovador_centro_custo_id, s.quantidade,
         jsonb_build_object(
           'centro_custo_id',            s.centro_custo_id,
           'tipo_equipamento_id',        s.tipo_equipamento_id,
           'data_inicio',                s.data_inicio,
           'tempo_previsto_dias',        s.tempo_previsto_dias,
           'regime_trabalho',            s.regime_trabalho,
           'com_operador',               COALESCE(s.com_operador, false),
           'prioridade',                 s.prioridade::text,
           'justificativa',              regexp_replace(btrim(s.justificativa),'\s+',' ','g'),
           'engenheiro_solicitante_id',  s.engenheiro_solicitante_id,
           'apontador_responsavel_id',   s.apontador_responsavel_id,
           'aprovador_centro_custo_id',  s.aprovador_centro_custo_id,
           'quantidade',                 s.quantidade,
           'solicitante_id',             s.solicitante_id
         ) AS sig
    INTO v_existing
    FROM public.bd_solicitacoes_equipamento s
   WHERE s.id = p_solicitacao_id
   FOR UPDATE;

  IF FOUND THEN
    IF v_existing.solicitante_id IS DISTINCT FROM v_uid THEN
      RAISE EXCEPTION 'EQUIP_SOLIC_CREATE_IDEMPOTENCY_CONFLICT'
        USING DETAIL = jsonb_build_object('motivo','solicitante_divergente')::text;
    END IF;
    IF v_existing.status <> 'ABERTO' OR v_existing.status_fluxo IS DISTINCT FROM 'PENDENTE_APROVACAO' THEN
      RAISE EXCEPTION 'EQUIP_SOLIC_CREATE_IDEMPOTENCY_CONFLICT'
        USING DETAIL = jsonb_build_object('motivo','estado_incompativel',
                                          'status', v_existing.status,
                                          'status_fluxo', v_existing.status_fluxo)::text;
    END IF;
    IF v_existing.sig IS DISTINCT FROM v_sig_new THEN
      RAISE EXCEPTION 'EQUIP_SOLIC_CREATE_IDEMPOTENCY_CONFLICT'
        USING DETAIL = jsonb_build_object('motivo','header_divergente')::text;
    END IF;

    WITH ex AS (
      SELECT
        i.tipo_item, i.catalogo_equipamento_id, i.catalogo_variacao_id, i.subcategoria_id,
        COALESCE(i.item_nao_catalogado, false)                     AS item_nao_catalogado,
        NULLIF(btrim(COALESCE(i.descricao_livre,      '')), '')    AS descricao_livre,
        NULLIF(btrim(COALESCE(i.capacidade_descricao, '')), '')    AS capacidade_descricao,
        i.capacidade_valor,
        NULLIF(btrim(COALESCE(i.capacidade_unidade,   '')), '')    AS capacidade_unidade,
        COALESCE(i.quantidade, 1)                                  AS quantidade,
        COALESCE(i.com_operador, false)                            AS com_operador,
        i.regime_trabalho,
        NULLIF(btrim(COALESCE(i.regime_personalizado,'')), '')     AS regime_personalizado,
        i.tempo_previsto_dias,
        NULLIF(btrim(COALESCE(i.observacoes,          '')), '')    AS observacoes
      FROM public.bd_solicitacoes_itens i
      WHERE i.solicitacao_id = p_solicitacao_id
    )
    SELECT
      jsonb_agg(to_jsonb(ex) ORDER BY
        ex.tipo_item,
        coalesce(ex.catalogo_equipamento_id::text,''),
        coalesce(ex.catalogo_variacao_id::text,''),
        coalesce(ex.subcategoria_id::text,''),
        coalesce(ex.descricao_livre,''),
        coalesce(ex.capacidade_descricao,''),
        coalesce(ex.capacidade_valor::text,''),
        coalesce(ex.capacidade_unidade,''),
        ex.quantidade, ex.com_operador,
        coalesce(ex.regime_trabalho,''),
        coalesce(ex.regime_personalizado,''),
        coalesce(ex.tempo_previsto_dias::text,''),
        coalesce(ex.observacoes,''),
        ex.item_nao_catalogado
      ),
      count(*)
    INTO v_items_old_arr, v_items_count_old
    FROM ex;

    v_items_new_arr := (
      SELECT jsonb_agg(e ORDER BY
        (e->>'tipo_item'),
        coalesce(e->>'catalogo_equipamento_id',''),
        coalesce(e->>'catalogo_variacao_id',''),
        coalesce(e->>'subcategoria_id',''),
        coalesce(e->>'descricao_livre',''),
        coalesce(e->>'capacidade_descricao',''),
        coalesce(e->>'capacidade_valor',''),
        coalesce(e->>'capacidade_unidade',''),
        (e->>'quantidade')::int,
        (e->>'com_operador')::boolean,
        coalesce(e->>'regime_trabalho',''),
        coalesce(e->>'regime_personalizado',''),
        coalesce(e->>'tempo_previsto_dias',''),
        coalesce(e->>'observacoes',''),
        (e->>'item_nao_catalogado')::boolean
      )
      FROM jsonb_array_elements(v_itens_norm) e
    );

    IF COALESCE(v_items_count_old,0) <> v_qtd_itens THEN
      RAISE EXCEPTION 'EQUIP_SOLIC_CREATE_IDEMPOTENCY_CONFLICT'
        USING DETAIL = jsonb_build_object('motivo','itens_count_divergente',
                                          'old', v_items_count_old, 'new', v_qtd_itens)::text;
    END IF;
    IF v_items_old_arr IS DISTINCT FROM v_items_new_arr THEN
      RAISE EXCEPTION 'EQUIP_SOLIC_CREATE_IDEMPOTENCY_CONFLICT'
        USING DETAIL = jsonb_build_object('motivo','itens_conteudo_divergente')::text;
    END IF;

    IF (SELECT count(*) FROM public.bd_solicitacoes_equip_aprovacoes a
         WHERE a.solicitacao_id = p_solicitacao_id
           AND a.etapa_aprovacao = 'CENTRO_CUSTO') <> 1 THEN
      RAISE EXCEPTION 'EQUIP_SOLIC_CREATE_IDEMPOTENCY_CONFLICT'
        USING DETAIL = jsonb_build_object('motivo','aprovacao_count_divergente')::text;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.bd_solicitacoes_equip_aprovacoes a
      WHERE a.solicitacao_id = p_solicitacao_id
        AND a.etapa_aprovacao = 'CENTRO_CUSTO'
        AND a.status = 'PENDENTE'
        AND a.aprovador_id = v_aprov_profile_id
    ) THEN
      RAISE EXCEPTION 'EQUIP_SOLIC_CREATE_IDEMPOTENCY_CONFLICT'
        USING DETAIL = jsonb_build_object('motivo','aprovacao_divergente')::text;
    END IF;

    INSERT INTO public.bd_ativos_auditoria(
      actor_user_id, acao, recurso_tipo, recurso_id, contexto, filtros, detalhes
    ) VALUES (
      v_uid, 'solic_equip_criar_reused', 'bd_solicitacoes_equipamento', p_solicitacao_id,
      'central_aprovacoes_bloco1', '{}'::jsonb,
      jsonb_build_object('reused', true, 'quantidade_total', v_qtd_total)
    );

    RETURN jsonb_build_object(
      'solicitacao_id', p_solicitacao_id,
      'reused', true,
      'quantidade', v_qtd_total,
      'aprovador_profile_id', v_aprov_profile_id
    );
  END IF;

  INSERT INTO public.bd_solicitacoes_equipamento(
    id, centro_custo_id, solicitante_id, tipo_equipamento_id,
    quantidade, data_inicio, tempo_previsto_dias, regime_trabalho, com_operador,
    prioridade, justificativa, status, status_fluxo,
    engenheiro_solicitante_id, apontador_responsavel_id, aprovador_centro_custo_id
  ) VALUES (
    p_solicitacao_id, p_centro_custo_id, v_uid, p_tipo_equipamento_id,
    v_qtd_total, p_data_inicio, p_tempo_previsto_dias, v_reg, COALESCE(p_com_operador,false),
    v_prio::prioridade_solicitacao_enum, v_justificativa_norm,
    'ABERTO'::status_solicitacao_equip_enum, 'PENDENTE_APROVACAO',
    p_engenheiro_solicitante_id, p_apontador_responsavel_id, v_aprov_profile_id
  )
  RETURNING id INTO v_new_id;

  INSERT INTO public.bd_solicitacoes_itens(
    solicitacao_id, tipo_item, catalogo_equipamento_id, catalogo_variacao_id, subcategoria_id,
    item_nao_catalogado, descricao_livre, capacidade_descricao, capacidade_valor, capacidade_unidade,
    quantidade, com_operador, regime_trabalho, regime_personalizado, tempo_previsto_dias, observacoes,
    status_item
  )
  SELECT
    v_new_id,
    (e->>'tipo_item')::text,
    NULLIF(e->>'catalogo_equipamento_id','')::uuid,
    NULLIF(e->>'catalogo_variacao_id','')::uuid,
    NULLIF(e->>'subcategoria_id','')::uuid,
    COALESCE((e->>'item_nao_catalogado')::boolean, false),
    NULLIF(e->>'descricao_livre',''),
    NULLIF(e->>'capacidade_descricao',''),
    NULLIF(e->>'capacidade_valor','')::numeric,
    NULLIF(e->>'capacidade_unidade',''),
    COALESCE((e->>'quantidade')::int, 1),
    COALESCE((e->>'com_operador')::boolean, false),
    NULLIF(e->>'regime_trabalho',''),
    NULLIF(e->>'regime_personalizado',''),
    NULLIF(e->>'tempo_previsto_dias','')::int,
    NULLIF(e->>'observacoes',''),
    'PENDENTE'
  FROM jsonb_array_elements(v_itens_norm) e;

  INSERT INTO public.bd_solicitacoes_equip_aprovacoes(
    solicitacao_id, etapa_aprovacao, aprovador_id, status
  ) VALUES (v_new_id, 'CENTRO_CUSTO', v_aprov_profile_id, 'PENDENTE')
  RETURNING id INTO v_new_aprov_id;

  INSERT INTO public.bd_ativos_auditoria(
    actor_user_id, acao, recurso_tipo, recurso_id, contexto, filtros, detalhes
  ) VALUES (
    v_uid, 'solic_equip_criar', 'bd_solicitacoes_equipamento', v_new_id,
    'central_aprovacoes_bloco1', '{}'::jsonb,
    jsonb_build_object(
      'aprovador_profile_id', v_aprov_profile_id,
      'quantidade_total', v_qtd_total,
      'itens', v_qtd_itens,
      'centro_custo_id', p_centro_custo_id
    )
  );

  RETURN jsonb_build_object(
    'solicitacao_id', v_new_id,
    'reused', false,
    'quantidade', v_qtd_total,
    'aprovador_profile_id', v_aprov_profile_id,
    'aprovacao_id', v_new_aprov_id
  );
END
$function$;

-- ---------- 3) fn_solic_equip_listar_central ----------
CREATE OR REPLACE FUNCTION public.fn_solic_equip_listar_central(
  p_limit  integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  solicitacao_id           uuid,
  aprovacao_id             uuid,
  centro_custo_id          uuid,
  centro_custo_codigo      text,
  centro_custo_nome        text,
  solicitante_id           uuid,
  solicitante_nome         text,
  aprovador_id             uuid,
  aprovador_nome           text,
  prioridade               text,
  data_inicio              date,
  quantidade               integer,
  tempo_previsto_dias      integer,
  justificativa            text,
  itens_count              integer,
  created_at               timestamptz,
  total_pendentes          bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid      uuid := auth.uid();
  v_is_super boolean;
  v_lim      integer;
  v_off      integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'EQUIP_CENTRAL_NAO_AUTENTICADO' USING ERRCODE='42501';
  END IF;
  v_is_super := public.fn_is_super_admin(v_uid);

  IF NOT v_is_super THEN
    IF NOT ( public.fn_has_permission('central_aprovacoes_view',  v_uid)
          OR public.fn_has_permission('acesso_gestao_aprovacoes', v_uid) ) THEN
      RAISE EXCEPTION 'EQUIP_CENTRAL_SEM_ACESSO' USING ERRCODE='42501';
    END IF;
    IF NOT public.user_has_permission_action(v_uid, 'equipamentos_solicitacoes_aprovar', 'aprovar') THEN
      RAISE EXCEPTION 'EQUIP_CENTRAL_SEM_ACAO_APROVAR' USING ERRCODE='42501';
    END IF;
  END IF;

  v_lim := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  v_off := GREATEST(COALESCE(p_offset, 0), 0);

  RETURN QUERY
  WITH base AS (
    SELECT
      s.id AS solicitacao_id,
      a.id AS aprovacao_id,
      s.centro_custo_id,
      cc.codigo_centro_custo::text AS centro_custo_codigo,
      cc.nome_centro_custo::text   AS centro_custo_nome,
      s.solicitante_id,
      psol.nome_completo::text     AS solicitante_nome,
      a.aprovador_id,
      papr.nome_completo::text     AS aprovador_nome,
      s.prioridade::text           AS prioridade,
      s.data_inicio,
      s.quantidade,
      s.tempo_previsto_dias,
      s.justificativa,
      (SELECT count(*)::int FROM public.bd_solicitacoes_itens i WHERE i.solicitacao_id = s.id) AS itens_count,
      s.created_at
    FROM public.bd_solicitacoes_equipamento s
    JOIN public.bd_solicitacoes_equip_aprovacoes a
      ON a.solicitacao_id = s.id
     AND a.etapa_aprovacao = 'CENTRO_CUSTO'
     AND a.status = 'PENDENTE'
    LEFT JOIN public.bd_centros_custo cc ON cc.id = s.centro_custo_id
    LEFT JOIN public.profiles psol       ON psol.id = s.solicitante_id
    LEFT JOIN public.profiles papr       ON papr.id = a.aprovador_id
    WHERE s.status_fluxo = 'PENDENTE_APROVACAO'
      AND (
        v_is_super
        OR s.aprovador_centro_custo_id = v_uid
        OR EXISTS (
          SELECT 1 FROM public.fn_ativos_user_centros_custo(v_uid) e
          WHERE e.centro_custo_id = s.centro_custo_id
        )
      )
  ),
  totals AS (SELECT count(*)::bigint AS total_pendentes FROM base)
  SELECT
    b.solicitacao_id, b.aprovacao_id, b.centro_custo_id, b.centro_custo_codigo, b.centro_custo_nome,
    b.solicitante_id, b.solicitante_nome, b.aprovador_id, b.aprovador_nome,
    b.prioridade, b.data_inicio, b.quantidade, b.tempo_previsto_dias, b.justificativa,
    b.itens_count, b.created_at, t.total_pendentes
  FROM base b, totals t
  ORDER BY
    CASE b.prioridade WHEN 'URGENTE' THEN 0 WHEN 'ALTA' THEN 1 ELSE 2 END,
    b.created_at ASC
  LIMIT v_lim OFFSET v_off;
END
$function$;

-- ---------- 4) fn_solic_equip_capacidades_aprovacao ----------
CREATE OR REPLACE FUNCTION public.fn_solic_equip_capacidades_aprovacao(
  p_ids uuid[]
)
RETURNS TABLE (
  solicitacao_id   uuid,
  pode_aprovar     boolean,
  pode_negar       boolean,
  auto_aprovacao   boolean,
  motivo_bloqueio  text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid       uuid := auth.uid();
  v_is_super  boolean;
  v_has_route boolean;
  v_has_act   boolean;
  v_ids       uuid[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'EQUIP_CAP_NAO_AUTENTICADO' USING ERRCODE='42501';
  END IF;
  v_is_super := public.fn_is_super_admin(v_uid);
  v_has_route := v_is_super
    OR public.fn_has_permission('central_aprovacoes_view',  v_uid)
    OR public.fn_has_permission('acesso_gestao_aprovacoes', v_uid);
  v_has_act := v_is_super
    OR public.user_has_permission_action(v_uid, 'equipamentos_solicitacoes_aprovar', 'aprovar');

  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RETURN;
  END IF;
  v_ids := (SELECT array_agg(DISTINCT x) FROM unnest(p_ids) x WHERE x IS NOT NULL);
  IF array_length(v_ids, 1) > 200 THEN
    RAISE EXCEPTION 'EQUIP_CAP_LIMITE_EXCEDIDO'
      USING DETAIL = jsonb_build_object('qtd', array_length(v_ids,1), 'max', 200)::text;
  END IF;

  RETURN QUERY
  SELECT
    s.id AS solicitacao_id,
    (v_has_route AND v_has_act
      AND s.status_fluxo = 'PENDENTE_APROVACAO'
      AND (
        v_is_super
        OR (
          s.solicitante_id <> v_uid
          AND (
            s.aprovador_centro_custo_id = v_uid
            OR EXISTS (
              SELECT 1 FROM public.fn_ativos_user_centros_custo(v_uid) e
              WHERE e.centro_custo_id = s.centro_custo_id
            )
          )
        )
      )
    ) AS pode_aprovar,
    (v_has_route AND v_has_act
      AND s.status_fluxo = 'PENDENTE_APROVACAO'
      AND (
        v_is_super
        OR (
          s.solicitante_id <> v_uid
          AND (
            s.aprovador_centro_custo_id = v_uid
            OR EXISTS (
              SELECT 1 FROM public.fn_ativos_user_centros_custo(v_uid) e
              WHERE e.centro_custo_id = s.centro_custo_id
            )
          )
        )
      )
    ) AS pode_negar,
    (v_is_super AND s.solicitante_id = v_uid) AS auto_aprovacao,
    CASE
      WHEN NOT v_has_route THEN 'sem_acesso_central'
      WHEN NOT v_has_act   THEN 'sem_acao_aprovar'
      WHEN s.status_fluxo IS DISTINCT FROM 'PENDENTE_APROVACAO' THEN 'nao_pendente'
      WHEN s.solicitante_id = v_uid AND NOT v_is_super THEN 'auto_aprovacao_bloqueada'
      WHEN NOT v_is_super
        AND s.aprovador_centro_custo_id <> v_uid
        AND NOT EXISTS (
          SELECT 1 FROM public.fn_ativos_user_centros_custo(v_uid) e
          WHERE e.centro_custo_id = s.centro_custo_id
        ) THEN 'fora_do_escopo'
      ELSE NULL
    END AS motivo_bloqueio
  FROM public.bd_solicitacoes_equipamento s
  WHERE s.id = ANY(v_ids);
END
$function$;

-- ---------- 5) fn_solic_equip_decidir ----------
CREATE OR REPLACE FUNCTION public.fn_solic_equip_decidir(
  p_solicitacao_id uuid,
  p_decisao        text,
  p_comentario     text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid           uuid := auth.uid();
  v_is_super      boolean;
  v_h_status      text;
  v_h_fluxo       text;
  v_h_aprovador   uuid;
  v_h_solicitante uuid;
  v_h_cc          uuid;
  v_pend_count    integer;
  v_pend_id       uuid;
  v_pend_aprov    uuid;
  v_com_norm      text;
  v_new_status    text;
  v_new_fluxo     text;
  v_auto_aprov    boolean;
  v_in_scope      boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_DECISAO_NAO_AUTENTICADO' USING ERRCODE='42501';
  END IF;
  IF p_solicitacao_id IS NULL THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_DECISAO_ID_OBRIGATORIO' USING ERRCODE='22004';
  END IF;
  IF p_decisao IS NULL OR p_decisao NOT IN ('APROVADO','NEGADO') THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_DECISAO_INVALIDA' USING ERRCODE='22004';
  END IF;

  v_is_super := public.fn_is_super_admin(v_uid);
  v_com_norm := regexp_replace(btrim(COALESCE(p_comentario,'')), '\s+', ' ', 'g');

  IF NOT v_is_super THEN
    IF NOT ( public.fn_has_permission('central_aprovacoes_view',  v_uid)
          OR public.fn_has_permission('acesso_gestao_aprovacoes', v_uid) ) THEN
      RAISE EXCEPTION 'EQUIP_CENTRAL_SEM_ACESSO' USING ERRCODE='42501';
    END IF;
    IF NOT public.user_has_permission_action(v_uid, 'equipamentos_solicitacoes_aprovar', 'aprovar') THEN
      RAISE EXCEPTION 'EQUIP_CENTRAL_SEM_ACAO_APROVAR' USING ERRCODE='42501';
    END IF;
  END IF;

  SELECT s.status::text, s.status_fluxo, s.aprovador_centro_custo_id,
         s.solicitante_id, s.centro_custo_id
    INTO v_h_status, v_h_fluxo, v_h_aprovador, v_h_solicitante, v_h_cc
    FROM public.bd_solicitacoes_equipamento s
   WHERE s.id = p_solicitacao_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_INEXISTENTE' USING ERRCODE='P0002';
  END IF;
  IF v_h_fluxo IS DISTINCT FROM 'PENDENTE_APROVACAO' THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_DECISAO_JA_TOMADA'
      USING ERRCODE='55000',
            DETAIL = jsonb_build_object('status', v_h_status, 'status_fluxo', v_h_fluxo)::text;
  END IF;

  v_auto_aprov := (v_h_solicitante = v_uid);
  IF v_auto_aprov AND NOT v_is_super THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_AUTOAPROVACAO_BLOQUEADA' USING ERRCODE='42501';
  END IF;
  IF v_auto_aprov AND v_is_super AND char_length(v_com_norm) < 10 THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_AUTOAPROVACAO_COMENTARIO_OBRIGATORIO' USING ERRCODE='22004';
  END IF;

  v_in_scope := v_is_super
    OR v_h_aprovador = v_uid
    OR EXISTS (
      SELECT 1 FROM public.fn_ativos_user_centros_custo(v_uid) e
      WHERE e.centro_custo_id = v_h_cc
    );
  IF NOT v_in_scope THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_DECISAO_FORA_DO_ESCOPO' USING ERRCODE='42501';
  END IF;

  IF p_decisao = 'NEGADO' AND char_length(v_com_norm) < 10 THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_NEGACAO_COMENTARIO_OBRIGATORIO' USING ERRCODE='22004';
  END IF;

  PERFORM 1
    FROM public.bd_solicitacoes_equip_aprovacoes
   WHERE solicitacao_id  = p_solicitacao_id
     AND etapa_aprovacao = 'CENTRO_CUSTO'
     AND status          = 'PENDENTE'
   FOR UPDATE;

  SELECT count(*) INTO v_pend_count
    FROM public.bd_solicitacoes_equip_aprovacoes
   WHERE solicitacao_id  = p_solicitacao_id
     AND etapa_aprovacao = 'CENTRO_CUSTO'
     AND status          = 'PENDENTE';

  IF v_pend_count = 0 THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_DECISAO_SEM_APROVACAO_PENDENTE' USING ERRCODE='P0002';
  ELSIF v_pend_count > 1 THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_DECISAO_MULTIPLAS_APROVACOES'
      USING ERRCODE='P0003', DETAIL = jsonb_build_object('qtd', v_pend_count)::text;
  END IF;

  SELECT id, aprovador_id
    INTO STRICT v_pend_id, v_pend_aprov
    FROM public.bd_solicitacoes_equip_aprovacoes
   WHERE solicitacao_id  = p_solicitacao_id
     AND etapa_aprovacao = 'CENTRO_CUSTO'
     AND status          = 'PENDENTE';

  IF v_pend_aprov IS DISTINCT FROM v_h_aprovador THEN
    RAISE EXCEPTION 'EQUIP_SOLIC_DECISAO_APROVADOR_DIVERGENTE'
      USING ERRCODE='P0004',
            DETAIL = jsonb_build_object('header', v_h_aprovador, 'aprovacao', v_pend_aprov)::text;
  END IF;

  IF p_decisao = 'APROVADO' THEN
    v_new_status := 'EM_ANALISE'; v_new_fluxo := 'APROVADO';
  ELSE
    v_new_status := 'NEGADO';     v_new_fluxo := 'NEGADO';
  END IF;

  UPDATE public.bd_solicitacoes_equip_aprovacoes
     SET status = p_decisao,
         comentario = NULLIF(v_com_norm, ''),
         data_decisao = now()
   WHERE id = v_pend_id;

  UPDATE public.bd_solicitacoes_equipamento
     SET status = v_new_status::status_solicitacao_equip_enum,
         status_fluxo = v_new_fluxo,
         updated_at = now()
   WHERE id = p_solicitacao_id;

  INSERT INTO public.bd_ativos_auditoria(
    actor_user_id, acao, recurso_tipo, recurso_id, contexto, filtros, detalhes
  ) VALUES (
    v_uid,
    CASE WHEN v_auto_aprov AND v_is_super THEN 'solic_equip_decidir_superadmin_self'
         ELSE 'solic_equip_decidir' END,
    'bd_solicitacoes_equipamento', p_solicitacao_id,
    'central_aprovacoes_bloco1', '{}'::jsonb,
    jsonb_build_object(
      'decisao', p_decisao,
      'aprovacao_id', v_pend_id,
      'aprovador_id', v_pend_aprov,
      'comentario_len', char_length(v_com_norm),
      'auto_aprovacao', v_auto_aprov
    )
  );

  RETURN jsonb_build_object(
    'solicitacao_id', p_solicitacao_id,
    'decisao', p_decisao,
    'status', v_new_status,
    'status_fluxo', v_new_fluxo,
    'aprovacao_id', v_pend_id,
    'auto_aprovacao', v_auto_aprov
  );
END
$function$;

-- ---------- 6) GRANTs ----------
REVOKE ALL ON FUNCTION public.fn_solic_equip_criar(uuid,uuid,uuid,date,integer,text,boolean,text,text,uuid,uuid,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_solic_equip_listar_central(integer,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_solic_equip_capacidades_aprovacao(uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_solic_equip_decidir(uuid,text,text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.fn_solic_equip_criar(uuid,uuid,uuid,date,integer,text,boolean,text,text,uuid,uuid,jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_solic_equip_listar_central(integer,integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_solic_equip_capacidades_aprovacao(uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_solic_equip_decidir(uuid,text,text) TO authenticated, service_role;
