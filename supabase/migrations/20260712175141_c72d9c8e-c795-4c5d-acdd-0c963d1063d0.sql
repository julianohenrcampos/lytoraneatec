DO $guard$
BEGIN
  IF pg_catalog.to_regprocedure('public.fn_diaria_capacidades_aprovacao(uuid[])') IS NOT NULL THEN
    RAISE EXCEPTION
      'public.fn_diaria_capacidades_aprovacao(uuid[]) já existe — abortando migration 2A-2.';
  END IF;
END
$guard$;

CREATE FUNCTION public.fn_diaria_capacidades_aprovacao(p_solicitacao_ids uuid[])
RETURNS TABLE (
  solicitacao_id uuid,
  can_view boolean,
  can_approve boolean,
  can_reject boolean,
  current_stage_exec_id uuid,
  current_stage_code text,
  current_stage_label text,
  actionable_stage_ids uuid[],
  actionable_stage_count integer,
  has_parallel_stages boolean,
  is_requester boolean,
  is_in_scope boolean,
  approval_requires_signature boolean,
  has_signature boolean,
  approve_block_reason text,
  reject_block_reason text,
  authorization_source text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_card integer;
  v_ids uuid[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth.uid() ausente'
      USING ERRCODE = '28000';
  END IF;

  IF p_solicitacao_ids IS NULL THEN
    RETURN;
  END IF;

  v_card := pg_catalog.cardinality(p_solicitacao_ids);

  IF v_card IS NULL OR v_card = 0 THEN
    RETURN;
  END IF;

  IF v_card > 200 THEN
    RAISE EXCEPTION 'Máximo de 200 IDs por chamada antes da deduplicação. Recebido: %',
      v_card
      USING ERRCODE = '22023';
  END IF;

  SELECT pg_catalog.array_agg(DISTINCT u.id)
  INTO v_ids
  FROM pg_catalog.unnest(p_solicitacao_ids) AS u(id)
  WHERE u.id IS NOT NULL;

  IF v_ids IS NULL OR pg_catalog.cardinality(v_ids) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH
  ctx AS MATERIALIZED (
    SELECT
      v_uid AS uid,
      COALESCE(public.check_is_super_admin(v_uid), false) AS sa_legacy,
      EXISTS (
        SELECT 1
        FROM public.bd_user_roles ur
        JOIN public.bd_roles r ON r.id = ur.role_id
        WHERE ur.user_id = v_uid
          AND btrim(r.nome) = 'SuperAdm'
      ) AS sa_dynamic,
      COALESCE(
        public.user_has_permission_action(
          v_uid,
          'diarias_aprovar',
          'aprovar'
        ),
        false
      ) AS perm_action,
      EXISTS (
        SELECT 1
        FROM public.bd_assinaturas_usuarios au
        WHERE au.usuario_id = v_uid
          AND au.ativo IS TRUE
      ) AS has_signature,
      EXISTS (
        SELECT 1
        FROM public.bd_user_permission_overrides o
        JOIN public.bd_permissions p ON p.id = o.permission_id
        WHERE o.user_id = v_uid
          AND p.codigo = 'diarias_aprovar'
          AND o.acao = 'aprovar'
          AND o.permitido = false
      ) AS override_deny
  ),
  escopo_user AS MATERIALIZED (
    SELECT scoped.cc
    FROM public.fn_diaria_scope_centros_custo(v_uid) AS scoped(cc)
  ),
  visiveis AS (
    SELECT s.id
    FROM pg_catalog.unnest(v_ids) AS input_ids(id)
    JOIN public.bd_diaria_solicitacoes s ON s.id = input_ids.id
    WHERE public.fn_diaria_can_select_row(s.id, v_uid)
  ),
  base AS (
    SELECT
      s.id AS solicitacao_id,
      s.motor_aprovacao,
      s.status_fluxo,
      s.centro_custo_id,
      s.criado_por,
      (s.status_fluxo = 'finalizado') AS is_terminal,
      (s.motor_aprovacao NOT IN ('legado', 'dinamico')) AS is_motor_invalid,
      (s.status_fluxo IN ('documentos_gerados', 'ajuste_solicitado_adm')) AS is_known_non_actionable
    FROM public.bd_diaria_solicitacoes s
    JOIN visiveis v ON v.id = s.id
  ),
  legacy_stage AS (
    SELECT
      b.solicitacao_id,
      CASE
        WHEN b.status_fluxo = 'aguardando_aprovacao_gerenteadm'          THEN 'GerenteAdm'
        WHEN b.status_fluxo = 'aguardando_aprovacao_diretor_operacional' THEN 'DiretorOperacional'
        WHEN b.status_fluxo = 'aguardando_aprovacao_diretor_adm'         THEN 'DiretorAdm'
        ELSE NULL
      END AS required_role,
      CASE
        WHEN b.status_fluxo = 'aguardando_aprovacao_gerenteadm'          THEN 'gerente_adm'
        WHEN b.status_fluxo = 'aguardando_aprovacao_diretor_operacional' THEN 'diretor_operacional'
        WHEN b.status_fluxo = 'aguardando_aprovacao_diretor_adm'         THEN 'diretor_adm'
        WHEN b.status_fluxo = 'finalizado'                                THEN 'finalizado'
        WHEN b.status_fluxo = 'documentos_gerados'                        THEN 'documentos_gerados'
        WHEN b.status_fluxo = 'ajuste_solicitado_adm'                     THEN 'ajuste_solicitado_adm'
        ELSE 'status_invalido'
      END AS current_stage_code_legacy,
      CASE
        WHEN b.status_fluxo = 'aguardando_aprovacao_gerenteadm'          THEN 'Aprovação Gerente Administrativo'
        WHEN b.status_fluxo = 'aguardando_aprovacao_diretor_operacional' THEN 'Aprovação Diretor Operacional'
        WHEN b.status_fluxo = 'aguardando_aprovacao_diretor_adm'         THEN 'Aprovação Diretor Administrativo'
        WHEN b.status_fluxo = 'finalizado'                                THEN 'Finalizado'
        WHEN b.status_fluxo = 'documentos_gerados'                        THEN 'Documentos gerados'
        WHEN b.status_fluxo = 'ajuste_solicitado_adm'                     THEN 'Ajuste solicitado ADM'
        ELSE COALESCE(NULLIF(b.status_fluxo, ''), 'Status inconsistente')
      END AS current_stage_label_legacy,
      (b.status_fluxo IN (
        'aguardando_aprovacao_gerenteadm',
        'aguardando_aprovacao_diretor_operacional',
        'aguardando_aprovacao_diretor_adm'
      )) AS legacy_stage_active
    FROM base b
    WHERE b.motor_aprovacao = 'legado'
  ),
  legacy_role AS (
    SELECT
      ls.solicitacao_id,
      ls.required_role,
      ls.current_stage_code_legacy,
      ls.current_stage_label_legacy,
      ls.legacy_stage_active,
      CASE
        WHEN ls.required_role IS NULL THEN false
        ELSE EXISTS (
          SELECT 1
          FROM public.bd_user_roles ur
          JOIN public.bd_roles r ON r.id = ur.role_id
          WHERE ur.user_id = v_uid
            AND btrim(r.nome) = ls.required_role
        )
      END AS role_ok_legacy
    FROM legacy_stage ls
  ),
  din_candidatas AS (
    SELECT
      b.solicitacao_id,
      e.id AS exec_id,
      e.ordem AS exec_ordem,
      e.created_at AS exec_created_at,
      e.etapa_nome_snapshot,
      fe.nome_tecnico,
      fe.nome_exibicao,
      fe.tipo_aprovador,
      public._map_tipo_aprovador_to_role(fe.tipo_aprovador) AS required_role
    FROM base b
    JOIN public.bd_aprovacoes_fluxo_exec e
      ON e.solicitacao_id = b.solicitacao_id
    LEFT JOIN public.bd_fluxo_etapas fe
      ON fe.id = e.etapa_id
    WHERE b.motor_aprovacao = 'dinamico'
      AND b.is_terminal IS NOT TRUE
      AND b.is_known_non_actionable IS NOT TRUE
      AND e.status = 'pendente'
      AND e.pode_aprovar IS TRUE
      AND NOT EXISTS (
        SELECT 1
        FROM public.bd_aprovacoes_fluxo_exec e_prev
        WHERE e_prev.solicitacao_id = e.solicitacao_id
          AND e_prev.ordem < e.ordem
          AND e_prev.status <> 'aprovado'
      )
  ),
  din_roles AS (
    SELECT
      dc.*,
      CASE
        WHEN dc.required_role IS NULL THEN false
        ELSE EXISTS (
          SELECT 1
          FROM public.bd_user_roles ur
          JOIN public.bd_roles r ON r.id = ur.role_id
          WHERE ur.user_id = v_uid
            AND btrim(r.nome) = dc.required_role
        )
      END AS role_ok_dyn,
      EXISTS (
        SELECT 1
        FROM public.bd_aprovacoes_fluxo_exec e_done
        WHERE e_done.id = dc.exec_id
          AND e_done.usuario_id = v_uid
          AND e_done.status = 'aprovado'
      ) AS already_approved_by_user
    FROM din_candidatas dc
  ),
  din_enriquecidas AS (
    SELECT
      dr.*,
      ((SELECT c.sa_dynamic FROM ctx c) OR dr.role_ok_dyn) AS stage_role_ok,
      (
        ((SELECT c.sa_dynamic FROM ctx c) OR dr.role_ok_dyn)
        AND NOT dr.already_approved_by_user
      ) AS stage_has_responsibility,
      (
        ((SELECT c.sa_dynamic FROM ctx c) OR dr.role_ok_dyn)
        AND NOT dr.already_approved_by_user
        AND (SELECT c.has_signature FROM ctx c)
        AND ((SELECT c.sa_dynamic FROM ctx c) OR (SELECT c.perm_action FROM ctx c))
        AND ((SELECT c.sa_dynamic FROM ctx c) OR NOT (SELECT c.override_deny FROM ctx c))
      ) AS stage_can_approve
    FROM din_roles dr
  ),
  din_agg_raw AS (
    SELECT
      de.solicitacao_id,
      pg_catalog.count(*)::integer AS valid_candidate_count,
      (pg_catalog.count(*) > 0) AS dyn_has_candidate,
      pg_catalog.bool_or(de.role_ok_dyn) AS dyn_has_role_match,
      pg_catalog.bool_or(de.stage_has_responsibility) AS dyn_has_responsibility,
      pg_catalog.bool_or(de.stage_can_approve) AS dyn_can_approve,
      COALESCE(
        pg_catalog.array_agg(de.exec_id ORDER BY de.exec_ordem ASC NULLS LAST, de.exec_created_at ASC, de.exec_id ASC)
          FILTER (WHERE de.stage_can_approve),
        ARRAY[]::uuid[]
      ) AS actionable_stage_ids_dyn,
      (
        pg_catalog.array_agg(de.exec_id ORDER BY de.exec_ordem ASC NULLS LAST, de.exec_created_at ASC, de.exec_id ASC)
          FILTER (WHERE de.stage_can_approve)
      )[1] AS first_actionable_stage_id,
      (
        pg_catalog.array_agg(de.exec_id ORDER BY de.exec_ordem ASC NULLS LAST, de.exec_created_at ASC, de.exec_id ASC)
      )[1] AS first_candidate_stage_id
    FROM din_enriquecidas de
    GROUP BY de.solicitacao_id
  ),
  din_agg AS (
    SELECT
      dar.solicitacao_id,
      dar.valid_candidate_count,
      dar.dyn_has_candidate,
      dar.dyn_has_role_match,
      dar.dyn_has_responsibility,
      dar.dyn_can_approve,
      dar.actionable_stage_ids_dyn,
      pg_catalog.cardinality(dar.actionable_stage_ids_dyn)::integer AS actionable_stage_count_dyn,
      (dar.valid_candidate_count >= 2) AS has_parallel_stages_dyn,
      COALESCE(dar.first_actionable_stage_id, dar.first_candidate_stage_id) AS current_stage_exec_id_dyn
    FROM din_agg_raw dar
  ),
  din_presented AS (
    SELECT
      da.solicitacao_id,
      da.valid_candidate_count,
      da.dyn_has_candidate,
      da.dyn_has_role_match,
      da.dyn_has_responsibility,
      da.dyn_can_approve,
      da.actionable_stage_ids_dyn,
      da.actionable_stage_count_dyn,
      da.has_parallel_stages_dyn,
      da.current_stage_exec_id_dyn,
      COALESCE(NULLIF(de.nome_tecnico, ''), 'dinamico') AS current_stage_code_dyn,
      COALESCE(
        NULLIF(de.etapa_nome_snapshot, ''),
        NULLIF(de.nome_exibicao, ''),
        'Etapa dinâmica'
      ) AS current_stage_label_dyn
    FROM din_agg da
    LEFT JOIN din_enriquecidas de
      ON de.exec_id = da.current_stage_exec_id_dyn
  )
  SELECT
    b.solicitacao_id,
    true AS can_view,
    COALESCE(
      CASE
        WHEN b.is_motor_invalid THEN false
        WHEN b.is_terminal THEN false
        WHEN b.motor_aprovacao = 'legado' THEN
          COALESCE(lr.legacy_stage_active, false)
          AND ((SELECT c.sa_legacy FROM ctx c) OR COALESCE(lr.role_ok_legacy, false))
          AND (SELECT c.has_signature FROM ctx c)
          AND ((SELECT c.sa_legacy FROM ctx c) OR (SELECT c.perm_action FROM ctx c))
          AND ((SELECT c.sa_legacy FROM ctx c) OR NOT (SELECT c.override_deny FROM ctx c))
        WHEN b.motor_aprovacao = 'dinamico' THEN
          COALESCE(dp.dyn_can_approve, false)
        ELSE false
      END,
      false
    ) AS can_approve,
    COALESCE(
      CASE
        WHEN b.is_motor_invalid THEN false
        WHEN b.is_terminal THEN false
        WHEN b.motor_aprovacao = 'legado' THEN
          COALESCE(lr.legacy_stage_active, false)
          AND ((SELECT c.sa_legacy FROM ctx c) OR COALESCE(lr.role_ok_legacy, false))
          AND ((SELECT c.sa_legacy FROM ctx c) OR (SELECT c.perm_action FROM ctx c))
          AND ((SELECT c.sa_legacy FROM ctx c) OR NOT (SELECT c.override_deny FROM ctx c))
        WHEN b.motor_aprovacao = 'dinamico' THEN false
        ELSE false
      END,
      false
    ) AS can_reject,
    CASE
      WHEN b.is_terminal THEN NULL::uuid
      WHEN b.motor_aprovacao = 'dinamico' THEN dp.current_stage_exec_id_dyn
      ELSE NULL::uuid
    END AS current_stage_exec_id,
    CASE
      WHEN b.is_terminal THEN 'finalizado'
      WHEN b.motor_aprovacao = 'legado' THEN COALESCE(lr.current_stage_code_legacy, 'status_invalido')
      WHEN b.motor_aprovacao = 'dinamico' AND COALESCE(dp.dyn_has_candidate, false) THEN COALESCE(dp.current_stage_code_dyn, 'dinamico')
      WHEN b.motor_aprovacao = 'dinamico' AND b.status_fluxo = 'documentos_gerados' THEN 'documentos_gerados'
      WHEN b.motor_aprovacao = 'dinamico' AND b.status_fluxo = 'ajuste_solicitado_adm' THEN 'ajuste_solicitado_adm'
      WHEN b.motor_aprovacao = 'dinamico' THEN COALESCE(NULLIF(b.status_fluxo, ''), 'fluxo_sem_etapa_ativa')
      ELSE 'status_invalido'
    END AS current_stage_code,
    CASE
      WHEN b.is_terminal THEN 'Finalizado'
      WHEN b.motor_aprovacao = 'legado' THEN COALESCE(lr.current_stage_label_legacy, 'Status inconsistente')
      WHEN b.motor_aprovacao = 'dinamico' AND COALESCE(dp.dyn_has_candidate, false) THEN COALESCE(dp.current_stage_label_dyn, 'Etapa dinâmica')
      WHEN b.motor_aprovacao = 'dinamico' AND b.status_fluxo = 'documentos_gerados' THEN 'Documentos gerados'
      WHEN b.motor_aprovacao = 'dinamico' AND b.status_fluxo = 'ajuste_solicitado_adm' THEN 'Ajuste solicitado ADM'
      WHEN b.motor_aprovacao = 'dinamico' THEN 'Fluxo sem etapa ativa'
      ELSE 'Status inconsistente'
    END AS current_stage_label,
    CASE
      WHEN b.is_terminal THEN ARRAY[]::uuid[]
      WHEN b.is_known_non_actionable THEN ARRAY[]::uuid[]
      WHEN b.motor_aprovacao = 'dinamico' THEN COALESCE(dp.actionable_stage_ids_dyn, ARRAY[]::uuid[])
      ELSE ARRAY[]::uuid[]
    END AS actionable_stage_ids,
    CASE
      WHEN b.is_terminal THEN 0
      WHEN b.is_known_non_actionable THEN 0
      WHEN b.motor_aprovacao = 'dinamico' THEN COALESCE(dp.actionable_stage_count_dyn, 0)
      ELSE 0
    END AS actionable_stage_count,
    CASE
      WHEN b.is_terminal THEN false
      WHEN b.is_known_non_actionable THEN false
      WHEN b.motor_aprovacao = 'dinamico' THEN COALESCE(dp.has_parallel_stages_dyn, false)
      ELSE false
    END AS has_parallel_stages,
    COALESCE(b.criado_por = v_uid, false) AS is_requester,
    COALESCE(
      EXISTS (
        SELECT 1
        FROM escopo_user eu
        WHERE eu.cc = b.centro_custo_id
      ),
      false
    ) AS is_in_scope,
    COALESCE(
      CASE
        WHEN b.is_motor_invalid THEN false
        WHEN b.is_terminal THEN false
        WHEN b.is_known_non_actionable THEN false
        WHEN b.motor_aprovacao = 'legado' THEN COALESCE(lr.legacy_stage_active, false)
        WHEN b.motor_aprovacao = 'dinamico' THEN COALESCE(dp.dyn_has_candidate, false)
        ELSE false
      END,
      false
    ) AS approval_requires_signature,
    COALESCE((SELECT c.has_signature FROM ctx c), false) AS has_signature,
    CASE
      WHEN b.is_motor_invalid
        THEN 'motor_invalido'
      WHEN b.is_terminal
        THEN 'already_decided'
      WHEN b.motor_aprovacao = 'legado' AND b.is_known_non_actionable
        THEN 'estado_nao_acionavel'
      WHEN b.motor_aprovacao = 'legado' AND NOT COALESCE(lr.legacy_stage_active, false)
        THEN 'status_invalido'
      WHEN b.motor_aprovacao = 'legado'
       AND (SELECT c.override_deny FROM ctx c)
       AND NOT (SELECT c.sa_legacy FROM ctx c)
        THEN 'override_deny'
      WHEN b.motor_aprovacao = 'legado'
       AND NOT ((SELECT c.sa_legacy FROM ctx c) OR (SELECT c.perm_action FROM ctx c))
        THEN 'sem_permissao_aprovar'
      WHEN b.motor_aprovacao = 'legado'
       AND NOT ((SELECT c.sa_legacy FROM ctx c) OR COALESCE(lr.role_ok_legacy, false))
        THEN 'role_incompativel_backend_legado'
      WHEN b.motor_aprovacao = 'legado'
       AND NOT (SELECT c.has_signature FROM ctx c)
        THEN 'assinatura_ausente'
      WHEN b.motor_aprovacao = 'dinamico' AND b.is_known_non_actionable
        THEN 'estado_nao_acionavel'
      WHEN b.motor_aprovacao = 'dinamico'
       AND (SELECT c.override_deny FROM ctx c)
       AND NOT (SELECT c.sa_dynamic FROM ctx c)
        THEN 'override_deny'
      WHEN b.motor_aprovacao = 'dinamico'
       AND NOT ((SELECT c.sa_dynamic FROM ctx c) OR (SELECT c.perm_action FROM ctx c))
        THEN 'sem_permissao_aprovar'
      WHEN b.motor_aprovacao = 'dinamico'
       AND NOT COALESCE(dp.dyn_has_candidate, false)
        THEN 'fluxo_sem_etapa_ativa'
      WHEN b.motor_aprovacao = 'dinamico'
       AND NOT ((SELECT c.sa_dynamic FROM ctx c) OR COALESCE(dp.dyn_has_role_match, false))
        THEN 'role_incompativel_backend_dinamico'
      WHEN b.motor_aprovacao = 'dinamico'
       AND NOT COALESCE(dp.dyn_has_responsibility, false)
        THEN 'responsabilidade_ja_consumida'
      WHEN b.motor_aprovacao = 'dinamico'
       AND NOT (SELECT c.has_signature FROM ctx c)
        THEN 'assinatura_ausente'
      ELSE NULL
    END AS approve_block_reason,
    CASE
      WHEN b.is_motor_invalid
        THEN 'motor_invalido'
      WHEN b.is_terminal
        THEN 'already_decided'
      WHEN b.motor_aprovacao = 'dinamico' AND b.is_known_non_actionable
        THEN 'estado_nao_acionavel'
      WHEN b.motor_aprovacao = 'dinamico'
       AND NOT COALESCE(dp.dyn_has_candidate, false)
        THEN 'fluxo_sem_etapa_ativa'
      WHEN b.motor_aprovacao = 'dinamico'
       AND COALESCE(dp.dyn_has_candidate, false)
        THEN 'backend_rejeicao_dinamica_indisponivel'
      WHEN b.motor_aprovacao = 'legado' AND b.is_known_non_actionable
        THEN 'estado_nao_acionavel'
      WHEN b.motor_aprovacao = 'legado'
       AND NOT COALESCE(lr.legacy_stage_active, false)
        THEN 'status_invalido'
      WHEN b.motor_aprovacao = 'legado'
       AND (SELECT c.override_deny FROM ctx c)
       AND NOT (SELECT c.sa_legacy FROM ctx c)
        THEN 'override_deny'
      WHEN b.motor_aprovacao = 'legado'
       AND NOT ((SELECT c.sa_legacy FROM ctx c) OR (SELECT c.perm_action FROM ctx c))
        THEN 'sem_permissao_aprovar'
      WHEN b.motor_aprovacao = 'legado'
       AND NOT ((SELECT c.sa_legacy FROM ctx c) OR COALESCE(lr.role_ok_legacy, false))
        THEN 'role_incompativel_backend_legado'
      ELSE NULL
    END AS reject_block_reason,
    CASE
      WHEN b.motor_aprovacao = 'legado'
       AND COALESCE(lr.legacy_stage_active, false)
       AND (SELECT c.sa_legacy FROM ctx c)
        THEN 'superadmin'
      WHEN b.motor_aprovacao = 'dinamico'
       AND COALESCE(dp.dyn_has_candidate, false)
       AND (SELECT c.sa_dynamic FROM ctx c)
        THEN 'superadmin'
      WHEN b.motor_aprovacao = 'legado'
       AND COALESCE(lr.legacy_stage_active, false)
       AND COALESCE(lr.role_ok_legacy, false)
        THEN 'legacy_role'
      WHEN b.motor_aprovacao = 'dinamico'
       AND COALESCE(dp.dyn_has_candidate, false)
       AND COALESCE(dp.dyn_has_role_match, false)
        THEN 'dynamic_stage'
      ELSE 'denied'
    END AS authorization_source
  FROM base b
  LEFT JOIN legacy_role lr ON lr.solicitacao_id = b.solicitacao_id
  LEFT JOIN din_presented dp ON dp.solicitacao_id = b.solicitacao_id;
END
$fn$;

COMMENT ON FUNCTION public.fn_diaria_capacidades_aprovacao(uuid[]) IS
'Fase 2A-2 v6 — Capacidades read-only de aprovação/rejeição de diárias em batch. Motores legado/dinamico; estados finalizado/documentos_gerados/ajuste_solicitado_adm neutralizam ação; motor dinâmico determinado por bd_aprovacoes_fluxo_exec; sa_legacy via check_is_super_admin, sa_dynamic via role literal SuperAdm; permissão diarias_aprovar:aprovar; override DENY por EXISTS; escopo materializado; booleanos fail-closed via COALESCE; máximo 200 elementos por cardinality antes da deduplicação; ACL somente authenticated; sem escrita; rejeição dinâmica bloqueada.';

REVOKE ALL ON FUNCTION public.fn_diaria_capacidades_aprovacao(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_diaria_capacidades_aprovacao(uuid[]) FROM anon;
REVOKE ALL ON FUNCTION public.fn_diaria_capacidades_aprovacao(uuid[]) FROM service_role;
GRANT EXECUTE ON FUNCTION public.fn_diaria_capacidades_aprovacao(uuid[]) TO authenticated;