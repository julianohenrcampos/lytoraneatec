-- =====================================================================
-- CT-2 / M3 R3 — RBAC DA CENTRAL DO TRANSPORTE
-- ---------------------------------------------------------------------
-- Arquivo.............: docs/ct2/20260728202000_ct2_m3r3_central_transporte_rbac.sql
-- Gerado em...........: 2026-07-28
-- Estado..............: ARTEFATO — NAO APLICADO NO BANCO VIVO
-- Substitui...........: docs/ct2/20260728201000_ct2_m3_central_transporte_rbac.sql
--                       (M3 R2, SHA-256 9feff1dfd3e5105f1f79e4756c65685a57a6ec53150cf0931b5d02d0813efce1,
--                        artefato reprovado quanto a matriz RBAC, NUNCA aplicado)
-- Depende de..........: CT-2 / M2.1 (docs/ct2/20260728200000_ct2_m2a_permission_guards.sql)
-- ---------------------------------------------------------------------
-- ESCOPO
--   Cria EXCLUSIVAMENTE o catalogo RBAC da permission
--   gestao_maquinas_central_transporte_view, suas 4 actions e os
--   22 pares role/action da matriz aprovada (10 roles).
--
-- NAO FAZ
--   - Nao cria, altera ou remove funcoes.
--   - Nao toca nas 4 RPCs publicas nem nas 6 funcoes internas da M2.
--   - Nao toca em RLS, grants de tabela, views ou dados operacionais.
--   - Nao altera overrides individuais (bd_user_permission_overrides).
--   - Nao usa UPSERT. Nao apaga grants. Nao corrige divergencias em silencio.
--
-- MODOS
--   create        -> permission, actions e grants integralmente ausentes.
--   validate_only -> tudo integralmente conforme. NENHUM DML e executado.
--   abort         -> qualquer divergencia parcial (RAISE EXCEPTION).
--
-- Todo o bloco de escrita esta contido em IF v_mode = 'create' THEN ... END IF;
-- inclusive o SET LOCAL session_replication_role. Em validate_only o SQL
-- nao executa INSERT, UPDATE, DELETE, UPSERT nem troca de replication role.
-- =====================================================================

BEGIN;

SET LOCAL statement_timeout = '120s';
SET LOCAL lock_timeout = '15s';

-- ---------------------------------------------------------------------
-- 0. CONJUNTOS ESPERADOS (views temporarias — DDL, sem DML)
-- ---------------------------------------------------------------------

CREATE TEMP VIEW v_ct2_m3_permission AS
SELECT
  'gestao_maquinas_central_transporte_view'::text AS codigo,
  'Central do Transporte'::text                   AS nome,
  'Visualizar e operar os atendimentos físicos de solicitações na Central do Transporte.'::text AS descricao,
  '/gestao-maquinas/central-transporte'::text     AS rota,
  NULL::text                                      AS modulo,
  'page'::text                                    AS tipo,
  true::boolean                                   AS ativo;

CREATE TEMP VIEW v_ct2_m3_expected_actions AS
SELECT * FROM (VALUES
  ('visualizar'::text, 'Acessar a Central do Transporte e a listagem de atendimentos.'::text),
  ('criar'::text,      'Atribuir ou reservar equipamento físico a um item.'::text),
  ('editar'::text,     'Cancelar, liberar ou substituir atendimento reservado.'::text),
  ('aprovar'::text,    'Autorizar match PARCIAL, período fora da janela ou override de disponibilidade.'::text)
) AS t(acao, descricao);

CREATE TEMP VIEW v_ct2_m3_expected_grants AS
SELECT * FROM (VALUES
  -- operacao plena (4 roles x 4 actions = 16 pares)
  ('SuperAdm'::text,           'visualizar'::text),
  ('SuperAdm'::text,           'criar'::text),
  ('SuperAdm'::text,           'editar'::text),
  ('SuperAdm'::text,           'aprovar'::text),
  ('AdmMaster'::text,          'visualizar'::text),
  ('AdmMaster'::text,          'criar'::text),
  ('AdmMaster'::text,          'editar'::text),
  ('AdmMaster'::text,          'aprovar'::text),
  ('AdmTransporte'::text,      'visualizar'::text),
  ('AdmTransporte'::text,      'criar'::text),
  ('AdmTransporte'::text,      'editar'::text),
  ('AdmTransporte'::text,      'aprovar'::text),
  ('AdmEquipamentos'::text,    'visualizar'::text),
  ('AdmEquipamentos'::text,    'criar'::text),
  ('AdmEquipamentos'::text,    'editar'::text),
  ('AdmEquipamentos'::text,    'aprovar'::text),
  -- somente leitura (6 roles x 1 action = 6 pares)
  ('AdmSede'::text,            'visualizar'::text),
  ('DiretorOperacional'::text, 'visualizar'::text),
  ('DiretorAdm'::text,         'visualizar'::text),
  ('GerenteAdm'::text,         'visualizar'::text),
  ('GerenteRegional'::text,    'visualizar'::text),
  ('AdmOBRA'::text,            'visualizar'::text)
) AS t(role_nome, acao);
-- Planejador e todas as demais roles: NENHUMA action.

-- ---------------------------------------------------------------------
-- 1. PREFLIGHT — classifica o modo ou aborta
-- ---------------------------------------------------------------------

DO $preflight$
DECLARE
  v_codigo        text := 'gestao_maquinas_central_transporte_view';
  v_rota          text := '/gestao-maquinas/central-transporte';
  v_perm_id       uuid;
  v_perm_count    int;
  v_rota_conflito text;
  v_meta_ok       boolean := false;
  v_act_total     int := 0;
  v_act_missing   int := 0;
  v_act_extra     int := 0;
  v_grant_total   int := 0;
  v_grant_missing int := 0;
  v_grant_extra   int := 0;
  v_roles_faltantes text;
  v_mode          text;
  v_ovr_count     int;
  v_ovr_hash      text;
BEGIN
  -- 1.1 roles da matriz: todas devem existir e estar ativas
  SELECT string_agg(e.role_nome, ', ' ORDER BY e.role_nome)
    INTO v_roles_faltantes
  FROM (SELECT DISTINCT role_nome FROM v_ct2_m3_expected_grants) e
  LEFT JOIN public.bd_roles r
         ON r.nome = e.role_nome AND r.ativo IS TRUE
  WHERE r.id IS NULL;

  IF v_roles_faltantes IS NOT NULL THEN
    RAISE EXCEPTION 'CT2_M3_ABORT: roles ausentes ou inativas: %', v_roles_faltantes
      USING ERRCODE = 'raise_exception';
  END IF;

  -- 1.2 rota nao pode estar ocupada por outro codigo
  SELECT p.codigo INTO v_rota_conflito
  FROM public.bd_permissions p
  WHERE p.rota = v_rota AND p.codigo <> v_codigo
  LIMIT 1;

  IF v_rota_conflito IS NOT NULL THEN
    RAISE EXCEPTION 'CT2_M3_ABORT: rota % ja ocupada pela permission %', v_rota, v_rota_conflito
      USING ERRCODE = 'raise_exception';
  END IF;

  -- 1.3 permission por codigo
  SELECT count(*) INTO v_perm_count
  FROM public.bd_permissions WHERE codigo = v_codigo;

  IF v_perm_count > 1 THEN
    RAISE EXCEPTION 'CT2_M3_ABORT: % linhas em bd_permissions para o codigo %', v_perm_count, v_codigo
      USING ERRCODE = 'raise_exception';
  END IF;

  SELECT id INTO v_perm_id
  FROM public.bd_permissions WHERE codigo = v_codigo;

  -- 1.4 snapshot de overrides (fingerprint transacional; nao altera nada)
  SELECT count(*),
         md5(coalesce(string_agg(
           o.user_id::text || '|' || o.permission_id::text || '|' || o.acao || '|' || o.permitido::text,
           E'\n' ORDER BY o.user_id, o.permission_id, o.acao), ''))
    INTO v_ovr_count, v_ovr_hash
  FROM public.bd_user_permission_overrides o;

  PERFORM set_config('ct2.m3_ovr_count', v_ovr_count::text, true);
  PERFORM set_config('ct2.m3_ovr_hash',  v_ovr_hash,        true);

  IF v_perm_id IS NULL THEN
    -- 1.5 CENARIO A — nada existe
    v_mode := 'create';
    RAISE NOTICE 'CT2_M3 PREFLIGHT: permission ausente -> modo create';
  ELSE
    -- 1.6 metadados campo a campo
    SELECT (p.nome IS NOT DISTINCT FROM e.nome)
       AND (p.descricao IS NOT DISTINCT FROM e.descricao)
       AND (p.rota IS NOT DISTINCT FROM e.rota)
       AND (p.modulo IS NOT DISTINCT FROM e.modulo)
       AND (p.tipo IS NOT DISTINCT FROM e.tipo)
       AND (p.ativo IS NOT DISTINCT FROM e.ativo)
      INTO v_meta_ok
    FROM public.bd_permissions p
    CROSS JOIN v_ct2_m3_permission e
    WHERE p.id = v_perm_id;

    IF NOT v_meta_ok THEN
      RAISE EXCEPTION 'CT2_M3_ABORT: metadados divergentes na permission % (cenario C)', v_codigo
        USING ERRCODE = 'raise_exception';
    END IF;

    -- 1.7 actions: presenca e descricao
    SELECT count(*) INTO v_act_total
    FROM public.bd_permissoes_acoes a WHERE a.permission_id = v_perm_id;

    SELECT count(*) INTO v_act_missing FROM (
      SELECT e.acao, e.descricao FROM v_ct2_m3_expected_actions e
      EXCEPT
      SELECT a.acao, a.descricao FROM public.bd_permissoes_acoes a WHERE a.permission_id = v_perm_id
    ) d;

    SELECT count(*) INTO v_act_extra FROM (
      SELECT a.acao, a.descricao FROM public.bd_permissoes_acoes a WHERE a.permission_id = v_perm_id
      EXCEPT
      SELECT e.acao, e.descricao FROM v_ct2_m3_expected_actions e
    ) d;

    -- 1.8 grants role/action
    SELECT count(*) INTO v_grant_total
    FROM public.bd_role_permission_actions rpa WHERE rpa.permission_id = v_perm_id;

    SELECT count(*) INTO v_grant_missing FROM (
      SELECT e.role_nome, e.acao FROM v_ct2_m3_expected_grants e
      EXCEPT
      SELECT r.nome, rpa.acao
        FROM public.bd_role_permission_actions rpa
        JOIN public.bd_roles r ON r.id = rpa.role_id
       WHERE rpa.permission_id = v_perm_id
    ) d;

    SELECT count(*) INTO v_grant_extra FROM (
      SELECT r.nome, rpa.acao
        FROM public.bd_role_permission_actions rpa
        JOIN public.bd_roles r ON r.id = rpa.role_id
       WHERE rpa.permission_id = v_perm_id
      EXCEPT
      SELECT e.role_nome, e.acao FROM v_ct2_m3_expected_grants e
    ) d;

    IF v_act_total = 0 AND v_grant_total = 0 THEN
      -- permission existe conforme, mas actions/grants ausentes: estado parcial
      RAISE EXCEPTION 'CT2_M3_ABORT: permission existe sem actions nem grants (estado parcial, cenario C)'
        USING ERRCODE = 'raise_exception';
    END IF;

    IF v_act_missing <> 0 OR v_act_extra <> 0 THEN
      RAISE EXCEPTION 'CT2_M3_ABORT: actions divergentes (faltando=%, extras=%) — cenario C',
        v_act_missing, v_act_extra USING ERRCODE = 'raise_exception';
    END IF;

    IF v_grant_missing <> 0 OR v_grant_extra <> 0 THEN
      RAISE EXCEPTION 'CT2_M3_ABORT: grants divergentes (faltando=%, extras=%) — cenario D',
        v_grant_missing, v_grant_extra USING ERRCODE = 'raise_exception';
    END IF;

    -- CENARIO B — tudo integralmente conforme
    v_mode := 'validate_only';
    RAISE NOTICE 'CT2_M3 PREFLIGHT: estado integralmente conforme -> modo validate_only (sem DML)';
  END IF;

  PERFORM set_config('ct2.m3_mode', v_mode, true);
END
$preflight$;

-- ---------------------------------------------------------------------
-- 2. BLOCO DE ESCRITA — executado SOMENTE em modo 'create'
-- ---------------------------------------------------------------------

DO $write$
DECLARE
  v_mode    text := current_setting('ct2.m3_mode', true);
  v_codigo  text := 'gestao_maquinas_central_transporte_view';
  v_perm_id uuid;
  v_n_perm  int := 0;
  v_n_act   int := 0;
  v_n_grant int := 0;
BEGIN
  IF v_mode = 'create' THEN

    SET LOCAL session_replication_role = 'replica';

    -- 2.1 permission
    INSERT INTO public.bd_permissions (codigo, nome, descricao, rota, modulo, tipo, ativo)
    SELECT e.codigo, e.nome, e.descricao, e.rota, e.modulo, e.tipo, e.ativo
    FROM v_ct2_m3_permission e
    WHERE NOT EXISTS (
      SELECT 1 FROM public.bd_permissions p WHERE p.codigo = e.codigo
    );
    GET DIAGNOSTICS v_n_perm = ROW_COUNT;

    SELECT id INTO v_perm_id FROM public.bd_permissions WHERE codigo = v_codigo;
    IF v_perm_id IS NULL THEN
      RAISE EXCEPTION 'CT2_M3_ABORT: permission % nao materializada', v_codigo
        USING ERRCODE = 'raise_exception';
    END IF;

    -- 2.2 actions
    INSERT INTO public.bd_permissoes_acoes (permission_id, acao, descricao)
    SELECT v_perm_id, e.acao, e.descricao
    FROM v_ct2_m3_expected_actions e
    WHERE NOT EXISTS (
      SELECT 1 FROM public.bd_permissoes_acoes a
      WHERE a.permission_id = v_perm_id AND a.acao = e.acao
    );
    GET DIAGNOSTICS v_n_act = ROW_COUNT;

    -- 2.3 grants role/action
    INSERT INTO public.bd_role_permission_actions (role_id, permission_id, acao)
    SELECT r.id, v_perm_id, e.acao
    FROM v_ct2_m3_expected_grants e
    JOIN public.bd_roles r ON r.nome = e.role_nome AND r.ativo IS TRUE
    WHERE NOT EXISTS (
      SELECT 1 FROM public.bd_role_permission_actions rpa
      WHERE rpa.role_id = r.id AND rpa.permission_id = v_perm_id AND rpa.acao = e.acao
    );
    GET DIAGNOSTICS v_n_grant = ROW_COUNT;

    SET LOCAL session_replication_role = 'origin';

    RAISE NOTICE 'CT2_M3 WRITE: permission=% actions=% grants=%', v_n_perm, v_n_act, v_n_grant;

    IF v_n_perm <> 1 OR v_n_act <> 4 OR v_n_grant <> 22 THEN
      RAISE EXCEPTION 'CT2_M3_ABORT: escrita inesperada (permission=%, actions=%, grants=%)',
        v_n_perm, v_n_act, v_n_grant USING ERRCODE = 'raise_exception';
    END IF;

  ELSE
    RAISE NOTICE 'CT2_M3 WRITE: ignorado (modo=%) — nenhum INSERT/UPDATE/DELETE executado', v_mode;
  END IF;
END
$write$;

-- ---------------------------------------------------------------------
-- 3. POSTFLIGHT — validacao por conjunto (EXCEPT bidirecional)
-- ---------------------------------------------------------------------

DO $postflight$
DECLARE
  v_codigo    text := 'gestao_maquinas_central_transporte_view';
  v_perm_id   uuid;
  v_n         int;
  v_diff      text;
  v_ovr_count int;
  v_ovr_hash  text;
BEGIN
  -- 3.1 exatamente uma permission
  SELECT count(*) INTO v_n FROM public.bd_permissions WHERE codigo = v_codigo;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'CT2_M3_POSTFLIGHT: esperava 1 permission, encontrou %', v_n
      USING ERRCODE = 'raise_exception';
  END IF;

  SELECT id INTO v_perm_id FROM public.bd_permissions WHERE codigo = v_codigo;

  -- 3.2 metadados exatos
  PERFORM 1
  FROM public.bd_permissions p
  CROSS JOIN v_ct2_m3_permission e
  WHERE p.id = v_perm_id
    AND p.nome      IS NOT DISTINCT FROM e.nome
    AND p.descricao IS NOT DISTINCT FROM e.descricao
    AND p.rota      IS NOT DISTINCT FROM e.rota
    AND p.modulo    IS NOT DISTINCT FROM e.modulo
    AND p.tipo      IS NOT DISTINCT FROM e.tipo
    AND p.ativo     IS NOT DISTINCT FROM e.ativo;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CT2_M3_POSTFLIGHT: metadados da permission divergentes'
      USING ERRCODE = 'raise_exception';
  END IF;

  -- 3.3 actions: esperadas EXCEPT atuais
  SELECT string_agg(d.acao || '=' || coalesce(d.descricao, '<null>'), '; ') INTO v_diff FROM (
    SELECT e.acao, e.descricao FROM v_ct2_m3_expected_actions e
    EXCEPT
    SELECT a.acao, a.descricao FROM public.bd_permissoes_acoes a WHERE a.permission_id = v_perm_id
  ) d;
  IF v_diff IS NOT NULL THEN
    RAISE EXCEPTION 'CT2_M3_POSTFLIGHT: actions esperadas ausentes -> %', v_diff
      USING ERRCODE = 'raise_exception';
  END IF;

  -- 3.4 actions: atuais EXCEPT esperadas
  SELECT string_agg(d.acao || '=' || coalesce(d.descricao, '<null>'), '; ') INTO v_diff FROM (
    SELECT a.acao, a.descricao FROM public.bd_permissoes_acoes a WHERE a.permission_id = v_perm_id
    EXCEPT
    SELECT e.acao, e.descricao FROM v_ct2_m3_expected_actions e
  ) d;
  IF v_diff IS NOT NULL THEN
    RAISE EXCEPTION 'CT2_M3_POSTFLIGHT: actions inesperadas/descricao divergente -> %', v_diff
      USING ERRCODE = 'raise_exception';
  END IF;

  -- 3.5 exatamente 4 actions, e nenhuma 'excluir'
  SELECT count(*) INTO v_n FROM public.bd_permissoes_acoes WHERE permission_id = v_perm_id;
  IF v_n <> 4 THEN
    RAISE EXCEPTION 'CT2_M3_POSTFLIGHT: esperava 4 actions, encontrou %', v_n
      USING ERRCODE = 'raise_exception';
  END IF;
  IF EXISTS (SELECT 1 FROM public.bd_permissoes_acoes WHERE permission_id = v_perm_id AND acao = 'excluir') THEN
    RAISE EXCEPTION 'CT2_M3_POSTFLIGHT: action excluir nao deveria existir'
      USING ERRCODE = 'raise_exception';
  END IF;

  -- 3.6 grants: esperados EXCEPT atuais
  SELECT string_agg(d.role_nome || '/' || d.acao, '; ') INTO v_diff FROM (
    SELECT e.role_nome, e.acao FROM v_ct2_m3_expected_grants e
    EXCEPT
    SELECT r.nome, rpa.acao
      FROM public.bd_role_permission_actions rpa
      JOIN public.bd_roles r ON r.id = rpa.role_id
     WHERE rpa.permission_id = v_perm_id
  ) d;
  IF v_diff IS NOT NULL THEN
    RAISE EXCEPTION 'CT2_M3_POSTFLIGHT: grants esperados ausentes -> %', v_diff
      USING ERRCODE = 'raise_exception';
  END IF;

  -- 3.7 grants: atuais EXCEPT esperados
  SELECT string_agg(d.nome || '/' || d.acao, '; ') INTO v_diff FROM (
    SELECT r.nome, rpa.acao
      FROM public.bd_role_permission_actions rpa
      JOIN public.bd_roles r ON r.id = rpa.role_id
     WHERE rpa.permission_id = v_perm_id
    EXCEPT
    SELECT e.role_nome, e.acao FROM v_ct2_m3_expected_grants e
  ) d;
  IF v_diff IS NOT NULL THEN
    RAISE EXCEPTION 'CT2_M3_POSTFLIGHT: grants inesperados -> %', v_diff
      USING ERRCODE = 'raise_exception';
  END IF;

  -- 3.8 exatamente 22 pares e 10 roles distintas
  SELECT count(*) INTO v_n
  FROM public.bd_role_permission_actions WHERE permission_id = v_perm_id;
  IF v_n <> 22 THEN
    RAISE EXCEPTION 'CT2_M3_POSTFLIGHT: esperava 22 pares role/action, encontrou %', v_n
      USING ERRCODE = 'raise_exception';
  END IF;

  SELECT count(DISTINCT role_id) INTO v_n
  FROM public.bd_role_permission_actions WHERE permission_id = v_perm_id;
  IF v_n <> 10 THEN
    RAISE EXCEPTION 'CT2_M3_POSTFLIGHT: esperava 10 roles vinculadas, encontrou %', v_n
      USING ERRCODE = 'raise_exception';
  END IF;

  -- 3.9 aprovar restrito aos 4 perfis operacionais; Planejador sem nada
  SELECT string_agg(r.nome, ', ' ORDER BY r.nome) INTO v_diff
  FROM public.bd_role_permission_actions rpa
  JOIN public.bd_roles r ON r.id = rpa.role_id
  WHERE rpa.permission_id = v_perm_id
    AND rpa.acao = 'aprovar'
    AND r.nome NOT IN ('SuperAdm', 'AdmMaster', 'AdmTransporte', 'AdmEquipamentos');
  IF v_diff IS NOT NULL THEN
    RAISE EXCEPTION 'CT2_M3_POSTFLIGHT: aprovar concedido indevidamente a %', v_diff
      USING ERRCODE = 'raise_exception';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bd_role_permission_actions rpa
    JOIN public.bd_roles r ON r.id = rpa.role_id
    WHERE rpa.permission_id = v_perm_id AND r.nome = 'Planejador'
  ) THEN
    RAISE EXCEPTION 'CT2_M3_POSTFLIGHT: Planejador nao pode ter action nesta permission'
      USING ERRCODE = 'raise_exception';
  END IF;

  -- 3.10 overrides individuais inalterados (contagem + conteudo)
  SELECT count(*),
         md5(coalesce(string_agg(
           o.user_id::text || '|' || o.permission_id::text || '|' || o.acao || '|' || o.permitido::text,
           E'\n' ORDER BY o.user_id, o.permission_id, o.acao), ''))
    INTO v_ovr_count, v_ovr_hash
  FROM public.bd_user_permission_overrides o;

  IF v_ovr_count <> current_setting('ct2.m3_ovr_count', true)::int
     OR v_ovr_hash <> current_setting('ct2.m3_ovr_hash', true) THEN
    RAISE EXCEPTION 'CT2_M3_POSTFLIGHT: overrides individuais foram alterados (antes=%/%, depois=%/%)',
      current_setting('ct2.m3_ovr_count', true), current_setting('ct2.m3_ovr_hash', true),
      v_ovr_count, v_ovr_hash USING ERRCODE = 'raise_exception';
  END IF;

  RAISE NOTICE 'CT2_M3 POSTFLIGHT OK: modo=% | 1 permission | 4 actions | 10 roles | 22 pares | overrides intactos',
    current_setting('ct2.m3_mode', true);
END
$postflight$;

DROP VIEW IF EXISTS v_ct2_m3_expected_grants;
DROP VIEW IF EXISTS v_ct2_m3_expected_actions;
DROP VIEW IF EXISTS v_ct2_m3_permission;

COMMIT;

-- =====================================================================
-- FIM — CT-2 / M3 R3
-- =====================================================================
