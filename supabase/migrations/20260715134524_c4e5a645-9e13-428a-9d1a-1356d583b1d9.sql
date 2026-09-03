
-- =====================================================================
-- BLOCO 1 — Encerramento técnico B1-CORR-1 (Central de Aprovações)
-- Alvo: 3 RPCs privilegiadas de Solicitações de Equipamento
--   * fn_solic_equip_decidir              (CREATE OR REPLACE)
--   * fn_solic_equip_listar_central       (DROP + CREATE — assinatura muda)
--   * fn_solic_equip_capacidades_aprovacao(DROP + CREATE — retorno muda)
-- NÃO altera: tabelas, colunas, dados, RLS, policies, roles, permissões.
-- NÃO toca: SOL-6ACD6FBA nem qualquer dado existente.
-- =====================================================================

-- Etapa 1 — Guard de dependências antes dos DROPs
DO $b1corr1_dep$
DECLARE r record; BEGIN
  FOR r IN
    SELECT DISTINCT d.classid::regclass::text AS tipo,
                    d.objid                    AS objid,
                    d.deptype                  AS deptype
    FROM pg_depend d
    WHERE d.refobjid IN (
      'public.fn_solic_equip_listar_central(integer,integer)'::regprocedure,
      'public.fn_solic_equip_capacidades_aprovacao(uuid[])'::regprocedure
    )
      AND d.deptype IN ('n','a')
      AND d.classid <> 'pg_proc'::regclass
  LOOP
    RAISE EXCEPTION 'B1CORR1_DEP_ENCONTRADA: tipo=% objid=% deptype=%',
      r.tipo, r.objid, r.deptype;
  END LOOP;
END
$b1corr1_dep$;

-- =====================================================================
-- Etapa 2 — fn_solic_equip_decidir
--   Preserva 100% da lógica: auth, permission-first, escopo, FOR UPDATE,
--   count 0/1/>1, aprovador vs header, autoaprovação SuperAdm+comentário,
--   comentário obrigatório em NEGADO, auditoria.
--   Correção: UPDATE do header altera SOMENTE status_fluxo (+ updated_at).
--   Retorno JSONB expandido: status_anterior, decidido_por, decidido_em,
--   authorization_source.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.fn_solic_equip_decidir(
  p_solicitacao_id uuid,
  p_decisao        text,
  p_comentario     text
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $fn_dec$
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
  v_new_fluxo     text;
  v_auto_aprov    boolean;
  v_in_scope      boolean;
  v_auth_source   text;
  v_now           timestamptz := now();
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

  v_new_fluxo := CASE p_decisao WHEN 'APROVADO' THEN 'APROVADO'
                                WHEN 'NEGADO'   THEN 'NEGADO' END;

  IF v_is_super AND v_auto_aprov THEN
    v_auth_source := 'superadmin_self_approval';
  ELSIF v_is_super THEN
    v_auth_source := 'superadmin';
  ELSE
    v_auth_source := 'permission_stage';
  END IF;

  -- CORREÇÃO CIRÚRGICA: preservar 'status', alterar somente 'status_fluxo'.
  UPDATE public.bd_solicitacoes_equipamento
     SET status_fluxo = v_new_fluxo,
         updated_at   = v_now
   WHERE id = p_solicitacao_id;

  UPDATE public.bd_solicitacoes_equip_aprovacoes
     SET status       = p_decisao,
         comentario   = NULLIF(v_com_norm, ''),
         data_decisao = v_now
   WHERE id = v_pend_id;

  INSERT INTO public.bd_ativos_auditoria(
    actor_user_id, acao, recurso_tipo, recurso_id, contexto, filtros, detalhes
  ) VALUES (
    v_uid,
    CASE WHEN v_auto_aprov AND v_is_super THEN 'solic_equip_decidir_superadmin_self'
         ELSE 'solic_equip_decidir' END,
    'bd_solicitacoes_equipamento', p_solicitacao_id,
    'central_aprovacoes_b1_corr1', '{}'::jsonb,
    jsonb_build_object(
      'decisao', p_decisao,
      'status_anterior', v_h_status,
      'status_fluxo', v_new_fluxo,
      'aprovacao_id', v_pend_id,
      'aprovador_id', v_pend_aprov,
      'comentario_len', char_length(v_com_norm),
      'auto_aprovacao', v_auto_aprov,
      'authorization_source', v_auth_source
    )
  );

  RETURN jsonb_build_object(
    'solicitacao_id',        p_solicitacao_id,
    'aprovacao_id',          v_pend_id,
    'status_anterior',       v_h_status,
    'status_fluxo',          v_new_fluxo,
    'decidido_por',          v_uid,
    'decidido_em',           v_now,
    'authorization_source',  v_auth_source
  );
END
$fn_dec$;

-- =====================================================================
-- Etapa 3 — fn_solic_equip_listar_central (DROP + CREATE)
-- =====================================================================
DROP FUNCTION public.fn_solic_equip_listar_central(integer, integer);

CREATE FUNCTION public.fn_solic_equip_listar_central(
  p_status_fluxo      text[]  DEFAULT ARRAY['PENDENTE_APROVACAO'],
  p_centro_custo_ids  uuid[]  DEFAULT NULL,
  p_solicitante_id    uuid    DEFAULT NULL,
  p_busca             text    DEFAULT NULL,
  p_apenas_minha_acao boolean DEFAULT false,
  p_periodo_inicio    date    DEFAULT NULL,
  p_periodo_fim       date    DEFAULT NULL,
  p_limit             integer DEFAULT 50,
  p_offset            integer DEFAULT 0
) RETURNS TABLE (
  solicitacao_id            uuid,
  centro_custo_id           uuid,
  codigo_cc                 text,
  nome_cc                   text,
  solicitante_id            uuid,
  solicitante_nome          text,
  aprovador_centro_custo_id uuid,
  status                    text,
  status_fluxo              text,
  prioridade                text,
  data_inicio               date,
  created_at                timestamptz,
  updated_at                timestamptz,
  quantidade                integer,
  qtd_itens                 integer,
  itens_resumo              text,
  can_approve               boolean,
  can_reject                boolean,
  auto_approval             boolean,
  block_reason              text,
  authorization_source      text,
  total_count               bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn_list$
DECLARE
  v_uid        uuid := auth.uid();
  v_is_super   boolean;
  v_lim        integer;
  v_off        integer;
  v_busca      text;
  v_busca_norm text;
  v_qtd_status integer;
  v_qtd_cc     integer;
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

  -- Validações de entrada
  v_lim := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  v_off := GREATEST(COALESCE(p_offset, 0), 0);

  IF p_status_fluxo IS NULL THEN
    RAISE EXCEPTION 'EQUIP_CENTRAL_STATUS_OBRIGATORIO' USING ERRCODE='22004';
  END IF;
  v_qtd_status := COALESCE(array_length(p_status_fluxo, 1), 0);
  IF v_qtd_status = 0 OR v_qtd_status > 10 THEN
    RAISE EXCEPTION 'EQUIP_CENTRAL_STATUS_LIMITE' USING ERRCODE='22004',
      DETAIL = jsonb_build_object('qtd', v_qtd_status, 'min', 1, 'max', 10)::text;
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_status_fluxo) x WHERE x IS NULL) THEN
    RAISE EXCEPTION 'EQUIP_CENTRAL_STATUS_NULL' USING ERRCODE='22004';
  END IF;

  IF p_centro_custo_ids IS NOT NULL THEN
    v_qtd_cc := COALESCE(array_length(p_centro_custo_ids, 1), 0);
    IF v_qtd_cc > 200 THEN
      RAISE EXCEPTION 'EQUIP_CENTRAL_CC_LIMITE' USING ERRCODE='22004',
        DETAIL = jsonb_build_object('qtd', v_qtd_cc, 'max', 200)::text;
    END IF;
  END IF;

  IF p_periodo_inicio IS NOT NULL AND p_periodo_fim IS NOT NULL
     AND p_periodo_inicio > p_periodo_fim THEN
    RAISE EXCEPTION 'EQUIP_CENTRAL_PERIODO_INVALIDO' USING ERRCODE='22004';
  END IF;

  v_busca := NULLIF(btrim(left(COALESCE(p_busca, ''), 120)), '');
  v_busca_norm := CASE WHEN v_busca IS NULL THEN NULL
                       ELSE '%' || public.unaccent(lower(v_busca)) || '%' END;

  RETURN QUERY
  WITH base AS (
    SELECT
      s.id                              AS solicitacao_id,
      s.centro_custo_id                 AS centro_custo_id,
      cc.codigo_centro_custo::text      AS codigo_cc,
      cc.nome_centro_custo::text        AS nome_cc,
      s.solicitante_id                  AS solicitante_id,
      psol.nome_completo::text          AS solicitante_nome,
      s.aprovador_centro_custo_id       AS aprovador_centro_custo_id,
      s.status::text                    AS status,
      s.status_fluxo::text              AS status_fluxo,
      s.prioridade::text                AS prioridade,
      s.data_inicio                     AS data_inicio,
      s.created_at                      AS created_at,
      s.updated_at                      AS updated_at,
      s.quantidade                      AS quantidade,
      s.justificativa                   AS justificativa,
      (SELECT count(*)::int
         FROM public.bd_solicitacoes_itens i
        WHERE i.solicitacao_id = s.id)  AS qtd_itens,
      (
        SELECT string_agg(
                 substr(
                   COALESCE(NULLIF(btrim(i.descricao_livre), ''),
                            NULLIF(btrim(i.capacidade_descricao), ''),
                            i.tipo_item, ''
                 ), 1, 80),
                 ' • '
                 ORDER BY i.created_at ASC
               )
          FROM (
            SELECT i2.*
              FROM public.bd_solicitacoes_itens i2
             WHERE i2.solicitacao_id = s.id
             ORDER BY i2.created_at ASC
             LIMIT 5
          ) i
      )                                  AS itens_resumo
    FROM public.bd_solicitacoes_equipamento s
    LEFT JOIN public.bd_centros_custo cc ON cc.id = s.centro_custo_id
    LEFT JOIN public.profiles       psol ON psol.id = s.solicitante_id
    WHERE s.status_fluxo = ANY(p_status_fluxo)
      AND (p_centro_custo_ids IS NULL OR s.centro_custo_id = ANY(p_centro_custo_ids))
      AND (p_solicitante_id  IS NULL OR s.solicitante_id  = p_solicitante_id)
      AND (p_periodo_inicio  IS NULL OR s.data_inicio    >= p_periodo_inicio)
      AND (p_periodo_fim     IS NULL OR s.data_inicio    <= p_periodo_fim)
      AND (
        v_is_super
        OR s.aprovador_centro_custo_id = v_uid
        OR EXISTS (
          SELECT 1 FROM public.fn_ativos_user_centros_custo(v_uid) e
           WHERE e.centro_custo_id = s.centro_custo_id
        )
      )
      AND (
        v_busca_norm IS NULL
        OR public.unaccent(lower(COALESCE(cc.codigo_centro_custo::text,''))) LIKE v_busca_norm
        OR public.unaccent(lower(COALESCE(cc.nome_centro_custo::text,'')))   LIKE v_busca_norm
        OR public.unaccent(lower(COALESCE(psol.nome_completo::text,'')))     LIKE v_busca_norm
        OR public.unaccent(lower(COALESCE(s.justificativa,'')))              LIKE v_busca_norm
      )
  ),
  scored AS (
    SELECT b.*,
      -- Capacidades por linha
      CASE
        WHEN b.status_fluxo <> 'PENDENTE_APROVACAO' THEN false
        WHEN v_is_super THEN true
        WHEN b.solicitante_id = v_uid THEN false
        ELSE true
      END AS can_approve,
      CASE
        WHEN b.status_fluxo <> 'PENDENTE_APROVACAO' THEN false
        WHEN v_is_super THEN true
        WHEN b.solicitante_id = v_uid THEN false
        ELSE true
      END AS can_reject,
      (b.solicitante_id = v_uid) AS auto_approval,
      CASE
        WHEN b.status_fluxo <> 'PENDENTE_APROVACAO'
          THEN 'nao_pendente'
        WHEN NOT v_is_super AND b.solicitante_id = v_uid
          THEN 'auto_aprovacao_bloqueada'
        ELSE NULL
      END AS block_reason,
      CASE
        WHEN v_is_super AND b.solicitante_id = v_uid
          THEN 'superadmin_self_approval'
        WHEN v_is_super
          THEN 'superadmin'
        ELSE 'permission_stage'
      END AS authorization_source
    FROM base b
  ),
  filtered AS (
    SELECT sc.*
      FROM scored sc
     WHERE (NOT p_apenas_minha_acao) OR sc.can_approve = true
  )
  SELECT
    f.solicitacao_id, f.centro_custo_id, f.codigo_cc, f.nome_cc,
    f.solicitante_id, f.solicitante_nome, f.aprovador_centro_custo_id,
    f.status, f.status_fluxo, f.prioridade, f.data_inicio,
    f.created_at, f.updated_at,
    f.quantidade, f.qtd_itens, f.itens_resumo,
    f.can_approve, f.can_reject, f.auto_approval,
    f.block_reason, f.authorization_source,
    count(*) OVER()::bigint AS total_count
  FROM filtered f
  ORDER BY CASE f.prioridade
             WHEN 'URGENTE' THEN 0
             WHEN 'ALTA'    THEN 1
             ELSE 2
           END,
           f.created_at ASC,
           f.solicitacao_id ASC
  LIMIT v_lim OFFSET v_off;
END
$fn_list$;

-- =====================================================================
-- Etapa 4 — fn_solic_equip_capacidades_aprovacao (DROP + CREATE)
-- =====================================================================
DROP FUNCTION public.fn_solic_equip_capacidades_aprovacao(uuid[]);

CREATE FUNCTION public.fn_solic_equip_capacidades_aprovacao(
  p_ids uuid[]
) RETURNS TABLE (
  solicitacao_id       uuid,
  exists_visible       boolean,
  can_approve          boolean,
  can_reject           boolean,
  auto_approval        boolean,
  block_reason         text,
  authorization_source text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn_cap$
DECLARE
  v_uid      uuid := auth.uid();
  v_is_super boolean;
  v_ids      uuid[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'EQUIP_CAP_NAO_AUTENTICADO' USING ERRCODE='42501';
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

  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RETURN;
  END IF;
  v_ids := (SELECT array_agg(DISTINCT x) FROM unnest(p_ids) x WHERE x IS NOT NULL);
  IF array_length(v_ids, 1) > 200 THEN
    RAISE EXCEPTION 'EQUIP_CAP_LIMITE_EXCEDIDO'
      USING ERRCODE='22004',
            DETAIL = jsonb_build_object('qtd', array_length(v_ids,1), 'max', 200)::text;
  END IF;

  RETURN QUERY
  WITH visible AS (
    SELECT s.id                        AS sid,
           s.status_fluxo              AS fluxo,
           s.solicitante_id            AS solic_id,
           s.aprovador_centro_custo_id AS aprov_cc,
           s.centro_custo_id           AS cc_id
      FROM public.bd_solicitacoes_equipamento s
     WHERE s.id = ANY(v_ids)
       AND (
         v_is_super
         OR s.aprovador_centro_custo_id = v_uid
         OR EXISTS (
           SELECT 1 FROM public.fn_ativos_user_centros_custo(v_uid) e
            WHERE e.centro_custo_id = s.centro_custo_id
         )
       )
  )
  SELECT
    u.x AS solicitacao_id,
    (v.sid IS NOT NULL) AS exists_visible,
    CASE
      WHEN v.sid IS NULL THEN false
      WHEN v.fluxo <> 'PENDENTE_APROVACAO' THEN false
      WHEN v_is_super THEN true
      WHEN v.solic_id = v_uid THEN false
      ELSE true
    END AS can_approve,
    CASE
      WHEN v.sid IS NULL THEN false
      WHEN v.fluxo <> 'PENDENTE_APROVACAO' THEN false
      WHEN v_is_super THEN true
      WHEN v.solic_id = v_uid THEN false
      ELSE true
    END AS can_reject,
    CASE
      WHEN v.sid IS NULL THEN false
      ELSE (v.solic_id = v_uid)
    END AS auto_approval,
    CASE
      WHEN v.sid IS NULL THEN 'not_available'
      WHEN v.fluxo <> 'PENDENTE_APROVACAO' THEN 'nao_pendente'
      WHEN NOT v_is_super AND v.solic_id = v_uid THEN 'auto_aprovacao_bloqueada'
      ELSE NULL
    END AS block_reason,
    CASE
      WHEN v.sid IS NULL THEN 'denied'
      WHEN v_is_super AND v.solic_id = v_uid THEN 'superadmin_self_approval'
      WHEN v_is_super THEN 'superadmin'
      ELSE 'permission_stage'
    END AS authorization_source
  FROM unnest(v_ids) AS u(x)
  LEFT JOIN visible v ON v.sid = u.x;
END
$fn_cap$;

-- =====================================================================
-- Etapa 5 — ACLs explícitas (revoke PUBLIC/anon; grant authenticated/service_role)
-- Nenhum grant a role de aplicação (Apontador/Engenheiro/...).
-- =====================================================================
REVOKE ALL ON FUNCTION public.fn_solic_equip_listar_central(text[],uuid[],uuid,text,boolean,date,date,integer,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_solic_equip_listar_central(text[],uuid[],uuid,text,boolean,date,date,integer,integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_solic_equip_listar_central(text[],uuid[],uuid,text,boolean,date,date,integer,integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_solic_equip_capacidades_aprovacao(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_solic_equip_capacidades_aprovacao(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_solic_equip_capacidades_aprovacao(uuid[]) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_solic_equip_decidir(uuid,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_solic_equip_decidir(uuid,text,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_solic_equip_decidir(uuid,text,text) TO authenticated, service_role;

-- =====================================================================
-- Etapa 6 — Garantia de assinatura única + reload do PostgREST
-- =====================================================================
DO $b1corr1_unique$
DECLARE v_qtd int; BEGIN
  SELECT count(*) INTO v_qtd
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'fn_solic_equip_listar_central';
  IF v_qtd <> 1 THEN
    RAISE EXCEPTION 'B1CORR1_MULT_ASSIN_LISTAR: %', v_qtd;
  END IF;

  SELECT count(*) INTO v_qtd
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'fn_solic_equip_capacidades_aprovacao';
  IF v_qtd <> 1 THEN
    RAISE EXCEPTION 'B1CORR1_MULT_ASSIN_CAPACIDADES: %', v_qtd;
  END IF;
END
$b1corr1_unique$;

NOTIFY pgrst, 'reload schema';
