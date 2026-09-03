BEGIN;
SET LOCAL statement_timeout = '5min';
SET LOCAL lock_timeout      = '30s';

-- (1) LOCKS DETERMINÍSTICOS (9 tabelas) ------------------------------------
LOCK TABLE public.bd_permissions                IN SHARE MODE;
LOCK TABLE public.bd_permissoes_acoes           IN SHARE MODE;
LOCK TABLE public.bd_role_permissions           IN SHARE MODE;
LOCK TABLE public.bd_user_permission_overrides  IN SHARE MODE;
LOCK TABLE public.profiles                      IN SHARE MODE;
LOCK TABLE public.bd_funcionarios               IN SHARE MODE;
LOCK TABLE public.bd_roles                      IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.bd_role_permission_actions    IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.bd_user_roles                 IN SHARE ROW EXCLUSIVE MODE;

-- (2) BASELINE INTEGRAL DOS 6 TRIGGERS -------------------------------------
CREATE TEMP TABLE _m8b_trg_baseline ON COMMIT DROP AS
SELECT
  t.oid                        AS trigger_oid,
  t.tgrelid                    AS tabela_oid,
  c.relname                    AS tabela,
  t.tgname                     AS tgname,
  t.tgenabled                  AS tgenabled,
  t.tgisinternal               AS tgisinternal,
  pg_get_triggerdef(t.oid)     AS def,
  p.oid                        AS function_oid,
  n.nspname                    AS func_schema,
  p.proname                    AS func_name,
  p.oid::regprocedure::text    AS func_signature,
  pg_get_userbyid(p.proowner)  AS func_owner,
  p.prosecdef                  AS func_secdef,
  p.proconfig                  AS func_config
FROM pg_trigger t
JOIN pg_class     c ON c.oid = t.tgrelid
JOIN pg_proc      p ON p.oid = t.tgfoid
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE t.tgrelid IN (
        'public.bd_roles'::regclass,
        'public.bd_role_permission_actions'::regclass,
        'public.bd_user_roles'::regclass)
  AND NOT t.tgisinternal
  AND t.tgname IN (
        'trg_validate_role_catalog_change','trg_audit_bd_roles',
        'trg_validate_role_permission_action_change','trg_audit_bd_role_permission_actions',
        'trg_validate_user_role_assignment','trg_audit_bd_user_roles');

DO $$ BEGIN
  IF (SELECT count(*) FROM _m8b_trg_baseline) <> 6 THEN
    RAISE EXCEPTION 'baseline triggers <> 6';
  END IF;
  IF EXISTS (SELECT 1 FROM _m8b_trg_baseline WHERE tgenabled <> 'O' OR tgisinternal) THEN
    RAISE EXCEPTION 'baseline triggers com estado inválido';
  END IF;
END $$;

-- Função helper para snapshot atual dos triggers (usa view materializada temporária)
CREATE OR REPLACE FUNCTION pg_temp._m8b_trg_atual() RETURNS TABLE (
  trigger_oid oid, tabela_oid oid, tabela name, tgname name, tgenabled "char",
  tgisinternal boolean, def text, function_oid oid, func_schema name,
  func_name name, func_signature text, func_owner name, func_secdef boolean,
  func_config text[]
) LANGUAGE sql AS $$
  SELECT t.oid, t.tgrelid, c.relname, t.tgname, t.tgenabled, t.tgisinternal,
         pg_get_triggerdef(t.oid), p.oid, n.nspname, p.proname,
         p.oid::regprocedure::text, pg_get_userbyid(p.proowner),
         p.prosecdef, p.proconfig
  FROM pg_trigger t
  JOIN pg_class c ON c.oid=t.tgrelid
  JOIN pg_proc  p ON p.oid=t.tgfoid
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE t.tgrelid IN ('public.bd_roles'::regclass,
                      'public.bd_role_permission_actions'::regclass,
                      'public.bd_user_roles'::regclass)
    AND NOT t.tgisinternal
    AND t.tgname IN (
      'trg_validate_role_catalog_change','trg_audit_bd_roles',
      'trg_validate_role_permission_action_change','trg_audit_bd_role_permission_actions',
      'trg_validate_user_role_assignment','trg_audit_bd_user_roles');
$$;

-- (3) VALIDAR PERMISSION E ACTION DECLARATIVA -----------------------------
DO $$
DECLARE n int; v_perm uuid;
BEGIN
  SELECT count(*) INTO n FROM public.bd_permissions
   WHERE codigo='chamados_internos_view';
  IF n<>1 THEN RAISE EXCEPTION 'permission total <> 1 (%)', n; END IF;

  SELECT count(*) INTO n FROM public.bd_permissions
   WHERE codigo='chamados_internos_view' AND ativo=true;
  IF n<>1 THEN RAISE EXCEPTION 'permission ativa <> 1 (%)', n; END IF;

  SELECT id INTO v_perm FROM public.bd_permissions WHERE codigo='chamados_internos_view';

  SELECT count(*) INTO n FROM public.bd_permissoes_acoes
   WHERE permission_id=v_perm AND acao='visualizar';
  IF n<>1 THEN RAISE EXCEPTION 'action declarativa view/visualizar <> 1 (%)', n; END IF;
END $$;

-- (4) BASELINE M7 (8 actions / 10 mappings) --------------------------------
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM public.bd_permissoes_acoes pa
    JOIN public.bd_permissions p ON p.id=pa.permission_id
   WHERE p.codigo IN ('chamados_internos_view','chamados_internos_abrir',
                      'chamados_internos_atender','chamados_internos_admin');
  IF n<>8 THEN RAISE EXCEPTION 'M7 actions <> 8 (%)', n; END IF;

  SELECT count(*) INTO n FROM public.bd_role_permission_actions rpa
    JOIN public.bd_permissions p ON p.id=rpa.permission_id
   WHERE p.codigo IN ('chamados_internos_view','chamados_internos_abrir',
                      'chamados_internos_atender','chamados_internos_admin');
  IF n<>10 THEN RAISE EXCEPTION 'M7 mappings <> 10 (%)', n; END IF;
END $$;

-- (5) OVERRIDES DO MÓDULO = 0 (antes) --------------------------------------
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM public.bd_user_permission_overrides o
    JOIN public.bd_permissions p ON p.id=o.permission_id
   WHERE p.codigo IN ('chamados_internos_view','chamados_internos_abrir',
                      'chamados_internos_atender','chamados_internos_admin');
  IF n<>0 THEN RAISE EXCEPTION 'overrides módulo antes <> 0 (%). Baseline quebrado.', n; END IF;
END $$;

-- (6) SNAPSHOTS EXTERNOS ---------------------------------------------------
CREATE TEMP TABLE _m8b_roles_ext_before ON COMMIT DROP AS
SELECT id,nome,descricao,ativo FROM public.bd_roles
WHERE lower(btrim(nome)) <> 'solicitantechamadosinternos';

CREATE TEMP TABLE _m8b_rpa_ext_before ON COMMIT DROP AS
SELECT rpa.id,rpa.role_id,rpa.permission_id,rpa.acao
FROM public.bd_role_permission_actions rpa
JOIN public.bd_roles r ON r.id=rpa.role_id
WHERE lower(btrim(r.nome)) <> 'solicitantechamadosinternos';

CREATE TEMP TABLE _m8b_role_perm_before ON COMMIT DROP AS
SELECT * FROM public.bd_role_permissions;

CREATE TEMP TABLE _m8b_ur_before ON COMMIT DROP AS
SELECT id,user_id,role_id FROM public.bd_user_roles;

CREATE TEMP TABLE _m8b_actions_decl_before ON COMMIT DROP AS
SELECT pa.id,pa.permission_id,pa.acao
FROM public.bd_permissoes_acoes pa
JOIN public.bd_permissions p ON p.id=pa.permission_id
WHERE p.codigo IN ('chamados_internos_view','chamados_internos_abrir',
                   'chamados_internos_atender','chamados_internos_admin');

-- (7) BASELINE FECHADO: role/mapping/associações inexistentes --------------
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM public.bd_roles
   WHERE lower(btrim(nome))='solicitantechamadosinternos';
  IF n<>0 THEN RAISE EXCEPTION 'role já existe (n=%). Baseline mudou — abortar para nova auditoria.', n; END IF;
END $$;

-- (8) CONJUNTO-ALVO CONGELADO = 91 -----------------------------------------
CREATE TEMP TABLE _m8b_alvo (user_id uuid PRIMARY KEY) ON COMMIT DROP;
INSERT INTO _m8b_alvo(user_id)
SELECT p.id
FROM public.profiles p
JOIN public.bd_funcionarios f ON f.id=p.funcionario_id
WHERE p.funcionario_id IS NOT NULL
  AND COALESCE(p.acesso_global,false)=false
  AND f.status IN ('Ativo','Ativo sem Registro')
  AND public.user_has_permission_action(p.id,'chamados_internos_view','visualizar') IS NOT TRUE
ORDER BY p.id;

DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM _m8b_alvo;
  IF n<>91 THEN RAISE EXCEPTION 'conjunto-alvo <> 91 (%). Abortar.', n; END IF;
END $$;

-- ==========================================================================
-- JANELA 1 — INSERT CONDICIONAL DA ROLE
-- ==========================================================================
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM pg_trigger
   WHERE tgrelid='public.bd_roles'::regclass
     AND tgname='trg_validate_role_catalog_change'
     AND NOT tgisinternal AND tgenabled='O';
  IF n<>1 THEN RAISE EXCEPTION 'validador da role ausente/desabilitado'; END IF;
END $$;

ALTER TABLE public.bd_roles DISABLE TRIGGER trg_validate_role_catalog_change;

INSERT INTO public.bd_roles(nome, descricao, ativo)
VALUES (
  'SolicitanteChamadosInternos',
  'Acesso de autosserviço para acompanhar e interagir com os próprios chamados internos.',
  true
);

ALTER TABLE public.bd_roles ENABLE TRIGGER trg_validate_role_catalog_change;

-- Unicidade e ativação
DO $$ DECLARE n int; v_ativo boolean; BEGIN
  SELECT count(*) INTO n FROM public.bd_roles
   WHERE lower(btrim(nome))='solicitantechamadosinternos';
  IF n<>1 THEN RAISE EXCEPTION 'após INSERT role count <> 1 (%)', n; END IF;

  SELECT ativo INTO v_ativo FROM public.bd_roles
   WHERE lower(btrim(nome))='solicitantechamadosinternos';
  IF v_ativo IS NOT TRUE THEN RAISE EXCEPTION 'role recém-criada não está ativa'; END IF;
END $$;

-- Comparação integral do validador
DO $$ DECLARE a int; b int; BEGIN
  IF (SELECT count(*) FROM pg_temp._m8b_trg_atual() WHERE tgname='trg_validate_role_catalog_change') <> 1
  THEN RAISE EXCEPTION 'validador role ausente após janela 1'; END IF;

  SELECT count(*) INTO a FROM (
    SELECT * FROM _m8b_trg_baseline WHERE tgname='trg_validate_role_catalog_change'
    EXCEPT SELECT * FROM pg_temp._m8b_trg_atual() WHERE tgname='trg_validate_role_catalog_change'
  ) x;
  SELECT count(*) INTO b FROM (
    SELECT * FROM pg_temp._m8b_trg_atual() WHERE tgname='trg_validate_role_catalog_change'
    EXCEPT SELECT * FROM _m8b_trg_baseline WHERE tgname='trg_validate_role_catalog_change'
  ) x;
  IF a<>0 OR b<>0 THEN RAISE EXCEPTION 'trg_validate_role_catalog_change divergente (a=%,b=%)',a,b; END IF;
END $$;

-- ==========================================================================
-- JANELA 2 — INSERT DO MAPPING ÚNICO
-- ==========================================================================
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM pg_trigger
   WHERE tgrelid='public.bd_role_permission_actions'::regclass
     AND tgname='trg_validate_role_permission_action_change'
     AND NOT tgisinternal AND tgenabled='O';
  IF n<>1 THEN RAISE EXCEPTION 'validador RPA ausente/desabilitado'; END IF;
END $$;

ALTER TABLE public.bd_role_permission_actions DISABLE TRIGGER trg_validate_role_permission_action_change;

INSERT INTO public.bd_role_permission_actions (id, role_id, permission_id, acao)
SELECT gen_random_uuid(), r.id, p.id, 'visualizar'
FROM public.bd_roles r
JOIN public.bd_permissions p ON p.codigo='chamados_internos_view'
WHERE lower(btrim(r.nome))='solicitantechamadosinternos';

ALTER TABLE public.bd_role_permission_actions ENABLE TRIGGER trg_validate_role_permission_action_change;

DO $$ DECLARE n int; v_role uuid; v_perm uuid; BEGIN
  SELECT id INTO v_role FROM public.bd_roles WHERE lower(btrim(nome))='solicitantechamadosinternos';
  SELECT id INTO v_perm FROM public.bd_permissions WHERE codigo='chamados_internos_view';
  SELECT count(*) INTO n FROM public.bd_role_permission_actions
   WHERE role_id=v_role AND permission_id=v_perm AND acao='visualizar';
  IF n<>1 THEN RAISE EXCEPTION 'mapping recém-criado <> 1 (%)', n; END IF;
  SELECT count(*) INTO n FROM public.bd_role_permission_actions WHERE role_id=v_role;
  IF n<>1 THEN RAISE EXCEPTION 'role possui mappings extras (%)', n; END IF;
END $$;

DO $$ DECLARE a int; b int; BEGIN
  IF (SELECT count(*) FROM pg_temp._m8b_trg_atual() WHERE tgname='trg_validate_role_permission_action_change') <> 1
  THEN RAISE EXCEPTION 'validador RPA ausente após janela 2'; END IF;

  SELECT count(*) INTO a FROM (
    SELECT * FROM _m8b_trg_baseline WHERE tgname='trg_validate_role_permission_action_change'
    EXCEPT SELECT * FROM pg_temp._m8b_trg_atual() WHERE tgname='trg_validate_role_permission_action_change'
  ) x;
  SELECT count(*) INTO b FROM (
    SELECT * FROM pg_temp._m8b_trg_atual() WHERE tgname='trg_validate_role_permission_action_change'
    EXCEPT SELECT * FROM _m8b_trg_baseline WHERE tgname='trg_validate_role_permission_action_change'
  ) x;
  IF a<>0 OR b<>0 THEN RAISE EXCEPTION 'trg_validate_role_permission_action_change divergente (a=%,b=%)',a,b; END IF;
END $$;

-- ==========================================================================
-- JANELA 3 — INSERT DAS 91 ASSOCIAÇÕES
-- ==========================================================================
CREATE TEMP TABLE _m8b_associacoes_antes ON COMMIT DROP AS
SELECT user_id, role_id FROM public.bd_user_roles
WHERE role_id = (SELECT id FROM public.bd_roles
                  WHERE lower(btrim(nome))='solicitantechamadosinternos');

DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM _m8b_associacoes_antes;
  IF n<>0 THEN RAISE EXCEPTION 'associações preexistentes <> 0 (%). Baseline quebrado.', n; END IF;

  SELECT count(*) INTO n FROM pg_trigger
   WHERE tgrelid='public.bd_user_roles'::regclass
     AND tgname='trg_validate_user_role_assignment'
     AND NOT tgisinternal AND tgenabled='O';
  IF n<>1 THEN RAISE EXCEPTION 'validador user_role ausente/desabilitado'; END IF;
END $$;

ALTER TABLE public.bd_user_roles DISABLE TRIGGER trg_validate_user_role_assignment;

INSERT INTO public.bd_user_roles(user_id, role_id)
SELECT a.user_id, r.id
FROM _m8b_alvo a
CROSS JOIN public.bd_roles r
WHERE lower(btrim(r.nome))='solicitantechamadosinternos'
ON CONFLICT (user_id, role_id) DO NOTHING;

ALTER TABLE public.bd_user_roles ENABLE TRIGGER trg_validate_user_role_assignment;

CREATE TEMP TABLE _m8b_associacoes_inseridas ON COMMIT DROP AS
SELECT ur.user_id, ur.role_id
FROM public.bd_user_roles ur
WHERE ur.role_id = (SELECT id FROM public.bd_roles
                     WHERE lower(btrim(nome))='solicitantechamadosinternos')
EXCEPT
SELECT user_id, role_id FROM _m8b_associacoes_antes;

DO $$
DECLARE n_esperado int; n_inseridas int;
BEGIN
  SELECT count(*) INTO n_esperado FROM _m8b_alvo a
   WHERE NOT EXISTS (
     SELECT 1 FROM _m8b_associacoes_antes b
     WHERE b.user_id=a.user_id
       AND b.role_id=(SELECT id FROM public.bd_roles
                       WHERE lower(btrim(nome))='solicitantechamadosinternos'));
  SELECT count(*) INTO n_inseridas FROM _m8b_associacoes_inseridas;
  IF n_esperado<>91 THEN RAISE EXCEPTION 'esperado inserir <> 91 (%). Baseline quebrado.', n_esperado; END IF;
  IF n_inseridas<>n_esperado THEN
    RAISE EXCEPTION 'inseridas (%) <> esperado (%)', n_inseridas, n_esperado;
  END IF;
END $$;

DO $$ DECLARE a int; b int; BEGIN
  IF (SELECT count(*) FROM pg_temp._m8b_trg_atual() WHERE tgname='trg_validate_user_role_assignment') <> 1
  THEN RAISE EXCEPTION 'validador user_role ausente após janela 3'; END IF;

  SELECT count(*) INTO a FROM (
    SELECT * FROM _m8b_trg_baseline WHERE tgname='trg_validate_user_role_assignment'
    EXCEPT SELECT * FROM pg_temp._m8b_trg_atual() WHERE tgname='trg_validate_user_role_assignment'
  ) x;
  SELECT count(*) INTO b FROM (
    SELECT * FROM pg_temp._m8b_trg_atual() WHERE tgname='trg_validate_user_role_assignment'
    EXCEPT SELECT * FROM _m8b_trg_baseline WHERE tgname='trg_validate_user_role_assignment'
  ) x;
  IF a<>0 OR b<>0 THEN RAISE EXCEPTION 'trg_validate_user_role_assignment divergente (a=%,b=%)',a,b; END IF;
END $$;

-- ==========================================================================
-- INVARIANTES FINAIS + COMPARAÇÕES BIDIRECIONAIS
-- ==========================================================================
DO $$
DECLARE v_role uuid; v_perm uuid; n int; a int; b int;
BEGIN
  SELECT id INTO v_role FROM public.bd_roles
   WHERE lower(btrim(nome))='solicitantechamadosinternos' AND ativo=true;
  IF v_role IS NULL THEN RAISE EXCEPTION 'role ausente/inativa no fechamento'; END IF;
  SELECT id INTO v_perm FROM public.bd_permissions WHERE codigo='chamados_internos_view';

  -- Mapping único correto
  SELECT count(*) INTO n FROM public.bd_role_permission_actions WHERE role_id=v_role;
  IF n<>1 THEN RAISE EXCEPTION 'mappings da role <> 1 (%)', n; END IF;
  SELECT count(*) INTO n FROM public.bd_role_permission_actions
   WHERE role_id=v_role AND permission_id=v_perm AND acao='visualizar';
  IF n<>1 THEN RAISE EXCEPTION 'mapping view/visualizar ausente'; END IF;
  SELECT count(*) INTO n FROM public.bd_role_permission_actions rpa
    JOIN public.bd_permissions p ON p.id=rpa.permission_id
   WHERE rpa.role_id=v_role
     AND p.codigo IN ('chamados_internos_abrir','chamados_internos_atender','chamados_internos_admin');
  IF n<>0 THEN RAISE EXCEPTION 'role possui mapping proibido (%)', n; END IF;

  -- M7 preservado
  SELECT count(*) INTO n FROM public.bd_permissoes_acoes pa
    JOIN public.bd_permissions p ON p.id=pa.permission_id
   WHERE p.codigo IN ('chamados_internos_view','chamados_internos_abrir',
                      'chamados_internos_atender','chamados_internos_admin');
  IF n<>8 THEN RAISE EXCEPTION 'M7 actions <> 8 (%)', n; END IF;

  SELECT count(*) INTO n FROM public.bd_role_permission_actions rpa
    JOIN public.bd_permissions p ON p.id=rpa.permission_id
   WHERE p.codigo IN ('chamados_internos_view','chamados_internos_abrir',
                      'chamados_internos_atender','chamados_internos_admin')
     AND rpa.role_id <> v_role;
  IF n<>10 THEN RAISE EXCEPTION 'M7 mappings anteriores <> 10 (%)', n; END IF;

  -- Roles externas bidirecional
  SELECT count(*) INTO a FROM (
    SELECT id,nome,descricao,ativo FROM _m8b_roles_ext_before
    EXCEPT SELECT id,nome,descricao,ativo FROM public.bd_roles WHERE id<>v_role) x;
  SELECT count(*) INTO b FROM (
    SELECT id,nome,descricao,ativo FROM public.bd_roles WHERE id<>v_role
    EXCEPT SELECT id,nome,descricao,ativo FROM _m8b_roles_ext_before) x;
  IF a<>0 OR b<>0 THEN RAISE EXCEPTION 'roles externas alteradas (a=%,b=%)',a,b; END IF;

  -- Mappings externos bidirecional
  SELECT count(*) INTO a FROM (
    SELECT id,role_id,permission_id,acao FROM _m8b_rpa_ext_before
    EXCEPT SELECT id,role_id,permission_id,acao FROM public.bd_role_permission_actions WHERE role_id<>v_role) x;
  SELECT count(*) INTO b FROM (
    SELECT id,role_id,permission_id,acao FROM public.bd_role_permission_actions WHERE role_id<>v_role
    EXCEPT SELECT id,role_id,permission_id,acao FROM _m8b_rpa_ext_before) x;
  IF a<>0 OR b<>0 THEN RAISE EXCEPTION 'mappings externos alterados (a=%,b=%)',a,b; END IF;

  -- bd_role_permissions integral bidirecional
  SELECT count(*) INTO a FROM (SELECT * FROM _m8b_role_perm_before EXCEPT SELECT * FROM public.bd_role_permissions) x;
  SELECT count(*) INTO b FROM (SELECT * FROM public.bd_role_permissions EXCEPT SELECT * FROM _m8b_role_perm_before) x;
  IF a<>0 OR b<>0 THEN RAISE EXCEPTION 'bd_role_permissions alterada (a=%,b=%)',a,b; END IF;

  -- Overrides módulo pós-execução = 0
  SELECT count(*) INTO n FROM public.bd_user_permission_overrides o
    JOIN public.bd_permissions p ON p.id=o.permission_id
   WHERE p.codigo IN ('chamados_internos_view','chamados_internos_abrir',
                      'chamados_internos_atender','chamados_internos_admin');
  IF n<>0 THEN RAISE EXCEPTION 'overrides módulo depois <> 0 (%)', n; END IF;

  -- Actions declarativas do módulo bidirecional
  SELECT count(*) INTO a FROM (
    SELECT id,permission_id,acao FROM _m8b_actions_decl_before
    EXCEPT
    SELECT pa.id,pa.permission_id,pa.acao FROM public.bd_permissoes_acoes pa
    JOIN public.bd_permissions p ON p.id=pa.permission_id
    WHERE p.codigo IN ('chamados_internos_view','chamados_internos_abrir',
                       'chamados_internos_atender','chamados_internos_admin')) x;
  SELECT count(*) INTO b FROM (
    SELECT pa.id,pa.permission_id,pa.acao FROM public.bd_permissoes_acoes pa
    JOIN public.bd_permissions p ON p.id=pa.permission_id
    WHERE p.codigo IN ('chamados_internos_view','chamados_internos_abrir',
                       'chamados_internos_atender','chamados_internos_admin')
    EXCEPT SELECT id,permission_id,acao FROM _m8b_actions_decl_before) x;
  IF a<>0 OR b<>0 THEN RAISE EXCEPTION 'actions declarativas módulo alteradas (a=%,b=%)',a,b; END IF;

  -- bd_user_roles preexistentes intactos
  IF EXISTS (SELECT id,user_id,role_id FROM _m8b_ur_before
             EXCEPT SELECT id,user_id,role_id FROM public.bd_user_roles)
  THEN RAISE EXCEPTION 'associações prévias sumiram/alteradas'; END IF;

  IF EXISTS (
    SELECT ur.id,ur.user_id,ur.role_id FROM public.bd_user_roles ur
     WHERE ur.role_id <> v_role
    EXCEPT SELECT id,user_id,role_id FROM _m8b_ur_before
  ) THEN RAISE EXCEPTION 'associação nova fora do alvo detectada'; END IF;

  -- Cobertura da role
  SELECT count(*) INTO n FROM _m8b_alvo a
   WHERE NOT EXISTS (SELECT 1 FROM public.bd_user_roles ur
                      WHERE ur.user_id=a.user_id AND ur.role_id=v_role);
  IF n<>0 THEN RAISE EXCEPTION 'alvo sem role: %', n; END IF;

  SELECT count(*) INTO n FROM public.bd_user_roles ur
   WHERE ur.role_id=v_role
     AND ur.user_id NOT IN (SELECT user_id FROM _m8b_alvo);
  IF n<>0 THEN RAISE EXCEPTION 'role fora do alvo (%)', n; END IF;

  -- Cobertura operacional total = 0 bloqueados
  SELECT count(*) INTO n
  FROM public.profiles p
  JOIN public.bd_funcionarios f ON f.id=p.funcionario_id
  WHERE p.funcionario_id IS NOT NULL
    AND COALESCE(p.acesso_global,false)=false
    AND f.status IN ('Ativo','Ativo sem Registro')
    AND public.user_has_permission_action(p.id,'chamados_internos_view','visualizar') IS NOT TRUE;
  IF n<>0 THEN RAISE EXCEPTION 'bloqueados operacionais pós-M8 <> 0 (%)', n; END IF;

  -- Comparação integral bidirecional dos 6 triggers
  IF (SELECT count(*) FROM pg_temp._m8b_trg_atual()) <> 6
  THEN RAISE EXCEPTION 'triggers atuais <> 6 no fechamento'; END IF;

  SELECT count(*) INTO a FROM (
    SELECT * FROM _m8b_trg_baseline EXCEPT SELECT * FROM pg_temp._m8b_trg_atual()
  ) x;
  SELECT count(*) INTO b FROM (
    SELECT * FROM pg_temp._m8b_trg_atual() EXCEPT SELECT * FROM _m8b_trg_baseline
  ) x;
  IF a<>0 OR b<>0 THEN RAISE EXCEPTION 'triggers divergentes bidirecional (a=%,b=%)',a,b; END IF;

  IF EXISTS (SELECT 1 FROM pg_temp._m8b_trg_atual() WHERE tgenabled<>'O' OR tgisinternal)
  THEN RAISE EXCEPTION 'trigger em estado inválido no fechamento'; END IF;
END $$;

COMMIT;