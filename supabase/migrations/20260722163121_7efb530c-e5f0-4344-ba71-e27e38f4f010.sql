BEGIN;

-- ============================================================
-- §6  LOCK determinístico (antes de qualquer snapshot/fail-fast/DISABLE)
-- ============================================================
LOCK TABLE
  public.bd_permissions,
  public.bd_roles,
  public.bd_permissoes_acoes,
  public.bd_role_permissions,
  public.bd_role_permission_actions,
  public.bd_user_roles,
  public.bd_user_permission_overrides,
  public.bd_chamado_interno_atendentes
IN SHARE ROW EXCLUSIVE MODE;

DO $M7V5$
DECLARE
  r_baseline record;
  r_check    record;

  -- §4 validações total/ativas
  v_admobra_total   int; v_admobra_ativas   int;
  v_atend_total_b   int; v_atend_ativas_b   int;
  v_adm_total_b     int; v_adm_ativas_b     int;
  v_atend_total_a   int; v_atend_ativas_a   int;
  v_adm_total_a     int; v_adm_ativas_a     int;

  -- §11 contagens finais
  v_actions_total   int;
  v_mappings_total  int;
  v_map_admobra     int;
  v_map_atend       int;
  v_map_admchi      int;

  -- §10 invariantes
  v_atendentes_setoriais int;
  v_user_roles_novas     int;
  v_overrides_mod        int;
  v_role_perm_mod        int;

  -- §9 snapshots
  v_ext_roles_before        jsonb; v_ext_roles_after        jsonb;
  v_ext_mappings_before     jsonb; v_ext_mappings_after     jsonb;
  v_user_roles_before       jsonb; v_user_roles_after       jsonb;
  v_overrides_mod_before    jsonb; v_overrides_mod_after    jsonb;
  v_role_permissions_before jsonb; v_role_permissions_after jsonb;

  v_role_atend_id uuid;
  v_role_adm_id   uuid;
BEGIN
  -- ------------------------------------------------------------
  -- Fail-fast: catálogo das 4 permissions (individual)
  -- ------------------------------------------------------------
  IF EXISTS (
    WITH esperadas(codigo) AS (VALUES
      ('chamados_internos_view'),
      ('chamados_internos_abrir'),
      ('chamados_internos_atender'),
      ('chamados_internos_admin')),
    estado AS (
      SELECT e.codigo,
             count(p.id)                                AS total,
             count(p.id) FILTER (WHERE p.ativo IS TRUE) AS ativas
      FROM esperadas e
      LEFT JOIN public.bd_permissions p ON p.codigo = e.codigo
      GROUP BY e.codigo)
    SELECT 1 FROM estado WHERE total <> 1 OR ativas <> 1
  ) THEN
    RAISE EXCEPTION 'M7v5 abort: catálogo das permissions divergente';
  END IF;

  -- ------------------------------------------------------------
  -- §4  Fail-fast: AdmOBRA total=1, ativas=1
  -- ------------------------------------------------------------
  SELECT count(*), count(*) FILTER (WHERE ativo IS TRUE)
    INTO v_admobra_total, v_admobra_ativas
  FROM public.bd_roles WHERE lower(btrim(nome)) = 'admobra';
  IF v_admobra_total <> 1 OR v_admobra_ativas <> 1 THEN
    RAISE EXCEPTION 'M7v5 abort: AdmOBRA inválida; total=%, ativas=%',
      v_admobra_total, v_admobra_ativas;
  END IF;

  -- ------------------------------------------------------------
  -- §4  Fail-fast: roles-alvo (total ∈ {0,1}, ativas ∈ {0,1})
  -- ------------------------------------------------------------
  SELECT count(*), count(*) FILTER (WHERE ativo IS TRUE)
    INTO v_atend_total_b, v_atend_ativas_b
  FROM public.bd_roles WHERE lower(btrim(nome)) = 'atendentechamadosinternos';
  IF v_atend_total_b NOT IN (0,1) OR v_atend_ativas_b NOT IN (0,1)
     OR (v_atend_total_b = 1 AND v_atend_ativas_b = 0) THEN
    RAISE EXCEPTION 'M7v5 abort: AtendenteChamadosInternos inválida; total=%, ativas=%',
      v_atend_total_b, v_atend_ativas_b;
  END IF;

  SELECT count(*), count(*) FILTER (WHERE ativo IS TRUE)
    INTO v_adm_total_b, v_adm_ativas_b
  FROM public.bd_roles WHERE lower(btrim(nome)) = 'admchamadosinternos';
  IF v_adm_total_b NOT IN (0,1) OR v_adm_ativas_b NOT IN (0,1)
     OR (v_adm_total_b = 1 AND v_adm_ativas_b = 0) THEN
    RAISE EXCEPTION 'M7v5 abort: AdmChamadosInternos inválida; total=%, ativas=%',
      v_adm_total_b, v_adm_ativas_b;
  END IF;

  -- ------------------------------------------------------------
  -- §8  Baseline nominal dos 4 triggers (com validação de função esperada)
  -- ------------------------------------------------------------
  FOR r_baseline IN
    SELECT c.relname AS tabela, t.tgname AS trg,
           t.oid AS trg_oid, t.tgenabled, t.tgisinternal,
           p.oid AS func_oid, p.proname AS func_nome,
           p.oid::regprocedure AS assinatura,
           np.nspname AS func_schema,
           pg_get_userbyid(p.proowner) AS func_owner,
           p.prosecdef AS sec_def, p.proconfig AS proconfig,
           pg_get_triggerdef(t.oid) AS trg_def
    FROM pg_trigger t
    JOIN pg_class c   ON c.oid = t.tgrelid
    JOIN pg_namespace n  ON n.oid  = c.relnamespace
    JOIN pg_proc  p   ON p.oid = t.tgfoid
    JOIN pg_namespace np ON np.oid = p.pronamespace
    WHERE n.nspname='public' AND NOT t.tgisinternal
      AND ((c.relname='bd_roles'
            AND t.tgname IN ('trg_validate_role_catalog_change','trg_audit_bd_roles'))
        OR (c.relname='bd_role_permission_actions'
            AND t.tgname IN ('trg_validate_role_permission_action_change','trg_audit_bd_role_permission_actions')))
  LOOP
    IF r_baseline.tgenabled <> 'O' THEN
      RAISE EXCEPTION 'M7v5 abort: trigger %.% não habilitado (%)',
        r_baseline.tabela, r_baseline.trg, r_baseline.tgenabled;
    END IF;
    IF r_baseline.func_schema <> 'public' THEN
      RAISE EXCEPTION 'M7v5 abort: trigger %.% aponta para função fora de public',
        r_baseline.tabela, r_baseline.trg;
    END IF;

    -- nome esperado da função por trigger
    IF (r_baseline.trg = 'trg_validate_role_catalog_change'
        AND r_baseline.func_nome <> 'fn_validate_role_catalog_change')
    OR (r_baseline.trg = 'trg_validate_role_permission_action_change'
        AND r_baseline.func_nome <> 'fn_validate_role_permission_action_change')
    OR (r_baseline.trg IN ('trg_audit_bd_roles','trg_audit_bd_role_permission_actions')
        AND r_baseline.func_nome <> 'fn_audit_permission_change')
    THEN
      RAISE EXCEPTION 'M7v5 abort: trigger %.% usa função inesperada %',
        r_baseline.tabela, r_baseline.trg, r_baseline.func_nome;
    END IF;

    PERFORM set_config(
      'm7v5.trg.'||r_baseline.tabela||'.'||r_baseline.trg,
      r_baseline.trg_oid::text||'|'||r_baseline.func_oid::text||'|'||
      r_baseline.assinatura::text||'|'||r_baseline.func_schema||'|'||
      r_baseline.func_owner||'|'||r_baseline.sec_def::text||'|'||
      coalesce(array_to_string(r_baseline.proconfig,';'),'')||'|'||
      r_baseline.trg_def,
      true
    );
  END LOOP;

  IF (SELECT count(*) FROM pg_trigger t
        JOIN pg_class c ON c.oid=t.tgrelid
        JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND NOT t.tgisinternal
        AND ((c.relname='bd_roles'
              AND t.tgname IN ('trg_validate_role_catalog_change','trg_audit_bd_roles'))
          OR (c.relname='bd_role_permission_actions'
              AND t.tgname IN ('trg_validate_role_permission_action_change','trg_audit_bd_role_permission_actions')))
     ) <> 4 THEN
    RAISE EXCEPTION 'M7v5 abort: baseline não retornou os 4 triggers esperados';
  END IF;

  -- ------------------------------------------------------------
  -- §9  Snapshots BEFORE (ORDER BY determinístico)
  -- ------------------------------------------------------------
  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.id), '[]'::jsonb)
    INTO v_ext_roles_before
  FROM (SELECT id, nome, descricao, ativo
        FROM public.bd_roles
        WHERE lower(btrim(nome)) NOT IN ('atendentechamadosinternos','admchamadosinternos')) r;

  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id), '[]'::jsonb)
    INTO v_ext_mappings_before
  FROM (SELECT rpa.id, rpa.role_id, rpa.permission_id, rpa.acao
        FROM public.bd_role_permission_actions rpa
        WHERE rpa.permission_id NOT IN (
          SELECT id FROM public.bd_permissions
          WHERE codigo IN ('chamados_internos_view','chamados_internos_abrir',
                           'chamados_internos_atender','chamados_internos_admin'))) x;

  SELECT coalesce(jsonb_agg(to_jsonb(u) ORDER BY u.user_id, u.role_id), '[]'::jsonb)
    INTO v_user_roles_before
  FROM public.bd_user_roles u;

  SELECT coalesce(jsonb_agg(to_jsonb(o) ORDER BY o.user_id, o.permission_id, o.acao), '[]'::jsonb)
    INTO v_overrides_mod_before
  FROM public.bd_user_permission_overrides o
  WHERE o.permission_id IN (
    SELECT id FROM public.bd_permissions
    WHERE codigo IN ('chamados_internos_view','chamados_internos_abrir',
                     'chamados_internos_atender','chamados_internos_admin'));

  SELECT coalesce(jsonb_agg(to_jsonb(rp) ORDER BY rp.id), '[]'::jsonb)
    INTO v_role_permissions_before
  FROM public.bd_role_permissions rp;

  -- ============================================================
  -- §7  JANELA 1: trg_validate_role_catalog_change (roles)
  -- ============================================================
  ALTER TABLE public.bd_roles DISABLE TRIGGER trg_validate_role_catalog_change;

  INSERT INTO public.bd_roles (nome, descricao, ativo)
  SELECT 'AtendenteChamadosInternos',
         'Atendimento operacional de chamados internos, com escopo definido por vínculo setorial.',
         true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.bd_roles
    WHERE lower(btrim(nome)) = 'atendentechamadosinternos');

  INSERT INTO public.bd_roles (nome, descricao, ativo)
  SELECT 'AdmChamadosInternos',
         'Administração global do módulo de chamados internos, sem atendimento operacional automático.',
         true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.bd_roles
    WHERE lower(btrim(nome)) = 'admchamadosinternos');

  ALTER TABLE public.bd_roles ENABLE TRIGGER trg_validate_role_catalog_change;

  -- revalidação imediata (idêntico ao baseline)
  SELECT t.oid, t.tgenabled, p.oid AS func_oid, p.proname,
         p.oid::regprocedure AS assinatura,
         np.nspname AS func_schema,
         pg_get_userbyid(p.proowner) AS func_owner,
         p.prosecdef AS sec_def, p.proconfig AS proconfig,
         pg_get_triggerdef(t.oid) AS def
    INTO r_check
  FROM pg_trigger t
  JOIN pg_class c ON c.oid=t.tgrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace
  JOIN pg_proc p ON p.oid=t.tgfoid
  JOIN pg_namespace np ON np.oid=p.pronamespace
  WHERE n.nspname='public' AND c.relname='bd_roles'
    AND t.tgname='trg_validate_role_catalog_change';

  IF r_check.tgenabled <> 'O'
     OR current_setting('m7v5.trg.bd_roles.trg_validate_role_catalog_change', true)
        IS DISTINCT FROM (r_check.oid::text||'|'||r_check.func_oid::text||'|'||
                          r_check.assinatura::text||'|'||r_check.func_schema||'|'||
                          r_check.func_owner||'|'||r_check.sec_def::text||'|'||
                          coalesce(array_to_string(r_check.proconfig,';'),'')||'|'||r_check.def) THEN
    RAISE EXCEPTION 'M7v5 abort: trg_validate_role_catalog_change alterado';
  END IF;

  -- captura IDs
  SELECT id INTO v_role_atend_id FROM public.bd_roles
   WHERE lower(btrim(nome))='atendentechamadosinternos';
  SELECT id INTO v_role_adm_id FROM public.bd_roles
   WHERE lower(btrim(nome))='admchamadosinternos';

  IF v_role_atend_id IS NULL OR v_role_adm_id IS NULL THEN
    RAISE EXCEPTION 'M7v5 abort: roles-alvo ausentes após INSERT condicional';
  END IF;

  -- validação AFTER de cada role
  SELECT count(*), count(*) FILTER (WHERE ativo IS TRUE)
    INTO v_atend_total_a, v_atend_ativas_a
  FROM public.bd_roles WHERE lower(btrim(nome))='atendentechamadosinternos';
  IF v_atend_total_a <> 1 OR v_atend_ativas_a <> 1 THEN
    RAISE EXCEPTION 'M7v5 abort: AtendenteChamadosInternos pós-insert inválida; total=%, ativas=%',
      v_atend_total_a, v_atend_ativas_a;
  END IF;

  SELECT count(*), count(*) FILTER (WHERE ativo IS TRUE)
    INTO v_adm_total_a, v_adm_ativas_a
  FROM public.bd_roles WHERE lower(btrim(nome))='admchamadosinternos';
  IF v_adm_total_a <> 1 OR v_adm_ativas_a <> 1 THEN
    RAISE EXCEPTION 'M7v5 abort: AdmChamadosInternos pós-insert inválida; total=%, ativas=%',
      v_adm_total_a, v_adm_ativas_a;
  END IF;

  -- ============================================================
  -- §1  Actions declarativas canônicas (8 pares — visualizar/criar/editar)
  -- ============================================================
  WITH pares(codigo, acao) AS (VALUES
    ('chamados_internos_view',     'visualizar'),
    ('chamados_internos_abrir',    'criar'),
    ('chamados_internos_abrir',    'editar'),
    ('chamados_internos_atender',  'visualizar'),
    ('chamados_internos_atender',  'editar'),
    ('chamados_internos_admin',    'visualizar'),
    ('chamados_internos_admin',    'criar'),
    ('chamados_internos_admin',    'editar'))
  INSERT INTO public.bd_permissoes_acoes (id, permission_id, acao)
  SELECT gen_random_uuid(), p.id, x.acao
  FROM pares x
  JOIN public.bd_permissions p ON p.codigo = x.codigo
  WHERE NOT EXISTS (
    SELECT 1 FROM public.bd_permissoes_acoes pa
    WHERE pa.permission_id = p.id AND pa.acao = x.acao);

  -- ============================================================
  -- §7  JANELA 2: trg_validate_role_permission_action_change (mappings)
  -- ============================================================
  ALTER TABLE public.bd_role_permission_actions
    DISABLE TRIGGER trg_validate_role_permission_action_change;

  -- §2  10 mappings canônicos (AdmOBRA + Atendente + AdmChamados)
  WITH admobra AS (
    SELECT id FROM public.bd_roles WHERE lower(btrim(nome))='admobra'
  ),
  mapping(role_id, codigo, acao) AS (
    VALUES
      -- AdmOBRA (3)
      ((SELECT id FROM admobra), 'chamados_internos_view',    'visualizar'),
      ((SELECT id FROM admobra), 'chamados_internos_abrir',   'criar'),
      ((SELECT id FROM admobra), 'chamados_internos_abrir',   'editar'),
      -- AtendenteChamadosInternos (3)
      (v_role_atend_id,          'chamados_internos_view',    'visualizar'),
      (v_role_atend_id,          'chamados_internos_atender', 'visualizar'),
      (v_role_atend_id,          'chamados_internos_atender', 'editar'),
      -- AdmChamadosInternos (4)
      (v_role_adm_id,            'chamados_internos_view',    'visualizar'),
      (v_role_adm_id,            'chamados_internos_admin',   'visualizar'),
      (v_role_adm_id,            'chamados_internos_admin',   'criar'),
      (v_role_adm_id,            'chamados_internos_admin',   'editar')
  )
  INSERT INTO public.bd_role_permission_actions (id, role_id, permission_id, acao)
  SELECT gen_random_uuid(), m.role_id, p.id, m.acao
  FROM mapping m
  JOIN public.bd_permissions p ON p.codigo = m.codigo
  WHERE NOT EXISTS (
    SELECT 1 FROM public.bd_role_permission_actions rpa
    WHERE rpa.role_id = m.role_id
      AND rpa.permission_id = p.id
      AND rpa.acao = m.acao);

  ALTER TABLE public.bd_role_permission_actions
    ENABLE TRIGGER trg_validate_role_permission_action_change;

  -- revalidação imediata trg mappings
  SELECT t.oid, t.tgenabled, p.oid AS func_oid, p.proname,
         p.oid::regprocedure AS assinatura,
         np.nspname AS func_schema,
         pg_get_userbyid(p.proowner) AS func_owner,
         p.prosecdef AS sec_def, p.proconfig AS proconfig,
         pg_get_triggerdef(t.oid) AS def
    INTO r_check
  FROM pg_trigger t
  JOIN pg_class c ON c.oid=t.tgrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace
  JOIN pg_proc p ON p.oid=t.tgfoid
  JOIN pg_namespace np ON np.oid=p.pronamespace
  WHERE n.nspname='public' AND c.relname='bd_role_permission_actions'
    AND t.tgname='trg_validate_role_permission_action_change';

  IF r_check.tgenabled <> 'O'
     OR current_setting('m7v5.trg.bd_role_permission_actions.trg_validate_role_permission_action_change', true)
        IS DISTINCT FROM (r_check.oid::text||'|'||r_check.func_oid::text||'|'||
                          r_check.assinatura::text||'|'||r_check.func_schema||'|'||
                          r_check.func_owner||'|'||r_check.sec_def::text||'|'||
                          coalesce(array_to_string(r_check.proconfig,';'),'')||'|'||r_check.def) THEN
    RAISE EXCEPTION 'M7v5 abort: trg_validate_role_permission_action_change alterado';
  END IF;

  -- ------------------------------------------------------------
  -- §11  Contagens finais exatas
  -- ------------------------------------------------------------
  SELECT count(*) INTO v_actions_total
  FROM public.bd_permissoes_acoes pa
  JOIN public.bd_permissions p ON p.id=pa.permission_id
  WHERE p.codigo IN ('chamados_internos_view','chamados_internos_abrir',
                     'chamados_internos_atender','chamados_internos_admin');
  IF v_actions_total <> 8 THEN
    RAISE EXCEPTION 'M7v5 abort: esperado 8 actions, encontrado %', v_actions_total;
  END IF;

  SELECT count(*) INTO v_mappings_total
  FROM public.bd_role_permission_actions rpa
  JOIN public.bd_permissions p ON p.id=rpa.permission_id
  WHERE p.codigo IN ('chamados_internos_view','chamados_internos_abrir',
                     'chamados_internos_atender','chamados_internos_admin');
  IF v_mappings_total <> 10 THEN
    RAISE EXCEPTION 'M7v5 abort: esperado 10 mappings, encontrado %', v_mappings_total;
  END IF;

  -- Distribuição por role
  SELECT count(*) INTO v_map_admobra
  FROM public.bd_role_permission_actions rpa
  JOIN public.bd_permissions p ON p.id=rpa.permission_id
  JOIN public.bd_roles r ON r.id=rpa.role_id
  WHERE lower(btrim(r.nome))='admobra'
    AND p.codigo IN ('chamados_internos_view','chamados_internos_abrir',
                     'chamados_internos_atender','chamados_internos_admin');
  IF v_map_admobra <> 3 THEN
    RAISE EXCEPTION 'M7v5 abort: AdmOBRA deve ter 3 mappings do módulo, tem %', v_map_admobra;
  END IF;

  SELECT count(*) INTO v_map_atend
  FROM public.bd_role_permission_actions rpa
  JOIN public.bd_permissions p ON p.id=rpa.permission_id
  WHERE rpa.role_id = v_role_atend_id
    AND p.codigo IN ('chamados_internos_view','chamados_internos_abrir',
                     'chamados_internos_atender','chamados_internos_admin');
  IF v_map_atend <> 3 THEN
    RAISE EXCEPTION 'M7v5 abort: AtendenteChamadosInternos deve ter 3 mappings, tem %', v_map_atend;
  END IF;

  SELECT count(*) INTO v_map_admchi
  FROM public.bd_role_permission_actions rpa
  JOIN public.bd_permissions p ON p.id=rpa.permission_id
  WHERE rpa.role_id = v_role_adm_id
    AND p.codigo IN ('chamados_internos_view','chamados_internos_abrir',
                     'chamados_internos_atender','chamados_internos_admin');
  IF v_map_admchi <> 4 THEN
    RAISE EXCEPTION 'M7v5 abort: AdmChamadosInternos deve ter 4 mappings, tem %', v_map_admchi;
  END IF;

  -- Bidirecional actions
  IF EXISTS (
    WITH esperado(codigo, acao) AS (VALUES
      ('chamados_internos_view','visualizar'),
      ('chamados_internos_abrir','criar'),('chamados_internos_abrir','editar'),
      ('chamados_internos_atender','visualizar'),('chamados_internos_atender','editar'),
      ('chamados_internos_admin','visualizar'),('chamados_internos_admin','criar'),
      ('chamados_internos_admin','editar')),
    real AS (
      SELECT p.codigo, pa.acao
      FROM public.bd_permissoes_acoes pa
      JOIN public.bd_permissions p ON p.id=pa.permission_id
      WHERE p.codigo IN ('chamados_internos_view','chamados_internos_abrir',
                         'chamados_internos_atender','chamados_internos_admin'))
    SELECT 1 FROM (
      SELECT * FROM esperado EXCEPT SELECT * FROM real
      UNION ALL
      SELECT * FROM real EXCEPT SELECT * FROM esperado) d
  ) THEN
    RAISE EXCEPTION 'M7v5 abort: divergência em bd_permissoes_acoes';
  END IF;

  -- Bidirecional mappings (3 roles)
  IF EXISTS (
    WITH admobra AS (SELECT id FROM public.bd_roles WHERE lower(btrim(nome))='admobra'),
    esperado(role_id, codigo, acao) AS (VALUES
      ((SELECT id FROM admobra),'chamados_internos_view','visualizar'),
      ((SELECT id FROM admobra),'chamados_internos_abrir','criar'),
      ((SELECT id FROM admobra),'chamados_internos_abrir','editar'),
      (v_role_atend_id,'chamados_internos_view','visualizar'),
      (v_role_atend_id,'chamados_internos_atender','visualizar'),
      (v_role_atend_id,'chamados_internos_atender','editar'),
      (v_role_adm_id,'chamados_internos_view','visualizar'),
      (v_role_adm_id,'chamados_internos_admin','visualizar'),
      (v_role_adm_id,'chamados_internos_admin','criar'),
      (v_role_adm_id,'chamados_internos_admin','editar')),
    real AS (
      SELECT rpa.role_id, p.codigo, rpa.acao
      FROM public.bd_role_permission_actions rpa
      JOIN public.bd_permissions p ON p.id=rpa.permission_id
      WHERE p.codigo IN ('chamados_internos_view','chamados_internos_abrir',
                         'chamados_internos_atender','chamados_internos_admin'))
    SELECT 1 FROM (
      SELECT * FROM esperado EXCEPT SELECT * FROM real
      UNION ALL
      SELECT * FROM real EXCEPT SELECT * FROM esperado) d
  ) THEN
    RAISE EXCEPTION 'M7v5 abort: divergência em bd_role_permission_actions';
  END IF;

  -- ------------------------------------------------------------
  -- §10  Invariantes absolutos
  -- ------------------------------------------------------------
  SELECT count(*) INTO v_atendentes_setoriais FROM public.bd_chamado_interno_atendentes;
  IF v_atendentes_setoriais <> 0 THEN
    RAISE EXCEPTION 'M7v5 abort: bd_chamado_interno_atendentes deve estar vazio, tem %',
      v_atendentes_setoriais;
  END IF;

  SELECT count(*) INTO v_user_roles_novas
  FROM public.bd_user_roles
  WHERE role_id IN (v_role_atend_id, v_role_adm_id);
  IF v_user_roles_novas <> 0 THEN
    RAISE EXCEPTION 'M7v5 abort: bd_user_roles das novas roles deve ser 0, é %',
      v_user_roles_novas;
  END IF;

  SELECT count(*) INTO v_overrides_mod
  FROM public.bd_user_permission_overrides o
  WHERE o.permission_id IN (
    SELECT id FROM public.bd_permissions
    WHERE codigo IN ('chamados_internos_view','chamados_internos_abrir',
                     'chamados_internos_atender','chamados_internos_admin'));
  IF v_overrides_mod <> 0 THEN
    RAISE EXCEPTION 'M7v5 abort: overrides do módulo devem ser 0, são %', v_overrides_mod;
  END IF;

  SELECT count(*) INTO v_role_perm_mod
  FROM public.bd_role_permissions rp
  WHERE rp.permission_id IN (
    SELECT id FROM public.bd_permissions
    WHERE codigo IN ('chamados_internos_view','chamados_internos_abrir',
                     'chamados_internos_atender','chamados_internos_admin'));
  IF v_role_perm_mod <> 0 THEN
    RAISE EXCEPTION 'M7v5 abort: bd_role_permissions do módulo devem ser 0, são %',
      v_role_perm_mod;
  END IF;

  -- ------------------------------------------------------------
  -- Revalidações finais §4 (AdmOBRA + roles-alvo)
  -- ------------------------------------------------------------
  SELECT count(*), count(*) FILTER (WHERE ativo IS TRUE)
    INTO v_admobra_total, v_admobra_ativas
  FROM public.bd_roles WHERE lower(btrim(nome))='admobra';
  IF v_admobra_total <> 1 OR v_admobra_ativas <> 1 THEN
    RAISE EXCEPTION 'M7v5 abort: AdmOBRA alterada; total=%, ativas=%',
      v_admobra_total, v_admobra_ativas;
  END IF;

  -- Repetir fail-fast permissions
  IF EXISTS (
    WITH esperadas(codigo) AS (VALUES
      ('chamados_internos_view'),('chamados_internos_abrir'),
      ('chamados_internos_atender'),('chamados_internos_admin')),
    estado AS (
      SELECT e.codigo, count(p.id) AS total,
             count(p.id) FILTER (WHERE p.ativo IS TRUE) AS ativas
      FROM esperadas e
      LEFT JOIN public.bd_permissions p ON p.codigo=e.codigo
      GROUP BY e.codigo)
    SELECT 1 FROM estado WHERE total<>1 OR ativas<>1
  ) THEN
    RAISE EXCEPTION 'M7v5 abort: catálogo das permissions divergente (final)';
  END IF;

  -- ------------------------------------------------------------
  -- §9  Snapshots AFTER + comparação IS DISTINCT FROM
  -- ------------------------------------------------------------
  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.id), '[]'::jsonb)
    INTO v_ext_roles_after
  FROM (SELECT id, nome, descricao, ativo
        FROM public.bd_roles
        WHERE lower(btrim(nome)) NOT IN ('atendentechamadosinternos','admchamadosinternos')) r;
  IF v_ext_roles_before IS DISTINCT FROM v_ext_roles_after THEN
    RAISE EXCEPTION 'M7v5 abort: roles externas alteradas';
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id), '[]'::jsonb)
    INTO v_ext_mappings_after
  FROM (SELECT rpa.id, rpa.role_id, rpa.permission_id, rpa.acao
        FROM public.bd_role_permission_actions rpa
        WHERE rpa.permission_id NOT IN (
          SELECT id FROM public.bd_permissions
          WHERE codigo IN ('chamados_internos_view','chamados_internos_abrir',
                           'chamados_internos_atender','chamados_internos_admin'))) x;
  IF v_ext_mappings_before IS DISTINCT FROM v_ext_mappings_after THEN
    RAISE EXCEPTION 'M7v5 abort: mappings externos alterados';
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(u) ORDER BY u.user_id, u.role_id), '[]'::jsonb)
    INTO v_user_roles_after FROM public.bd_user_roles u;
  IF v_user_roles_before IS DISTINCT FROM v_user_roles_after THEN
    RAISE EXCEPTION 'M7v5 abort: bd_user_roles alterada';
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(o) ORDER BY o.user_id, o.permission_id, o.acao), '[]'::jsonb)
    INTO v_overrides_mod_after
  FROM public.bd_user_permission_overrides o
  WHERE o.permission_id IN (
    SELECT id FROM public.bd_permissions
    WHERE codigo IN ('chamados_internos_view','chamados_internos_abrir',
                     'chamados_internos_atender','chamados_internos_admin'));
  IF v_overrides_mod_before IS DISTINCT FROM v_overrides_mod_after
     OR jsonb_array_length(v_overrides_mod_after) <> 0 THEN
    RAISE EXCEPTION 'M7v5 abort: overrides do módulo alterados/não-zero';
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(rp) ORDER BY rp.id), '[]'::jsonb)
    INTO v_role_permissions_after
  FROM public.bd_role_permissions rp;
  IF v_role_permissions_before IS DISTINCT FROM v_role_permissions_after THEN
    RAISE EXCEPTION 'M7v5 abort: bd_role_permissions alterada (DML proibido)';
  END IF;

  -- ------------------------------------------------------------
  -- §8  Revalidação final dos 4 triggers
  -- ------------------------------------------------------------
  FOR r_check IN
    SELECT c.relname AS tabela, t.tgname AS trg, t.oid, t.tgenabled,
           p.oid AS func_oid, p.oid::regprocedure AS assinatura,
           np.nspname AS func_schema,
           pg_get_userbyid(p.proowner) AS func_owner,
           p.prosecdef AS sec_def, p.proconfig AS proconfig,
           pg_get_triggerdef(t.oid) AS def
    FROM pg_trigger t
    JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_proc p ON p.oid=t.tgfoid
    JOIN pg_namespace np ON np.oid=p.pronamespace
    WHERE n.nspname='public' AND NOT t.tgisinternal
      AND ((c.relname='bd_roles'
            AND t.tgname IN ('trg_validate_role_catalog_change','trg_audit_bd_roles'))
        OR (c.relname='bd_role_permission_actions'
            AND t.tgname IN ('trg_validate_role_permission_action_change','trg_audit_bd_role_permission_actions')))
  LOOP
    IF r_check.tgenabled <> 'O' THEN
      RAISE EXCEPTION 'M7v5 abort: trigger %.% desabilitado na revalidação final',
        r_check.tabela, r_check.trg;
    END IF;
    IF current_setting('m7v5.trg.'||r_check.tabela||'.'||r_check.trg, true)
       IS DISTINCT FROM (r_check.oid::text||'|'||r_check.func_oid::text||'|'||
                         r_check.assinatura::text||'|'||r_check.func_schema||'|'||
                         r_check.func_owner||'|'||r_check.sec_def::text||'|'||
                         coalesce(array_to_string(r_check.proconfig,';'),'')||'|'||r_check.def) THEN
      RAISE EXCEPTION 'M7v5 abort: trigger %.% divergente do baseline',
        r_check.tabela, r_check.trg;
    END IF;
  END LOOP;
END
$M7V5$;

COMMIT;