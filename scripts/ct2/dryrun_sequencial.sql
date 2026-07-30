-- =====================================================================
-- CT-2 — DRY-RUN SEQUENCIAL (cluster descartavel PG17)
-- Baseline COMMITADO: fixture (M1/M1.1) + M2 R4 + helpers/catalogo RBAC.
-- Transacao descartavel unica: M2.1 -> testes pre-M3 -> M3 R3 ->
-- testes pos-M3 -> testes de replay/escopo -> 2a execucao (validate_only)
-- -> ROLLBACK.
-- =====================================================================
\set ON_ERROR_STOP on
\timing off

-- ------------------------------------------------------------ SEED (baseline)
BEGIN;
TRUNCATE public.bd_user_roles, public.bd_user_permission_overrides,
  public.bd_role_permission_actions, public.bd_permissoes_acoes, public.bd_permissions,
  public.bd_solicitacao_item_atendimentos, public.bd_solicitacoes_itens,
  public.bd_solicitacoes_equipamento, public.profiles, public.bd_roles,
  public.bd_centros_custo, public.bd_catalogo_equipamentos,
  public.bd_caminhoes_equipamentos, public.bd_disponibilidade_equipamentos CASCADE;
DELETE FROM auth.users;

-- tabela de auditoria do catalogo (harness: alvo de delta em pg_stat_xact)
CREATE TABLE IF NOT EXISTS public.bd_permission_change_audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  evento text, payload jsonb, created_at timestamptz DEFAULT now());

ALTER TABLE public.bd_caminhoes_equipamentos ADD COLUMN IF NOT EXISTS tipo_equipamento_id uuid;

-- escopo por CC controlavel por deny-list (dry-run)
CREATE OR REPLACE FUNCTION public.fn_ativos_can_access_centro_custo(p_cc_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT NOT (coalesce(current_setting('ct2.deny_ccs', true), '') LIKE '%' || coalesce(p_cc_id::text,'-') || '%')
$$;

INSERT INTO public.bd_roles (nome) VALUES
 ('SuperAdm'),('AdmMaster'),('AdmTransporte'),('AdmEquipamentos'),('AdmSede'),
 ('DiretorOperacional'),('DiretorAdm'),('GerenteAdm'),('GerenteRegional'),
 ('AdmOBRA'),('Planejador'),('Operador');

INSERT INTO auth.users (id) VALUES
 ('11111111-1111-1111-1111-111111111111'),
 ('22222222-2222-2222-2222-222222222222'),
 ('33333333-3333-3333-3333-333333333333'),
 ('44444444-4444-4444-4444-444444444444');
INSERT INTO public.profiles (id, nome_completo, acesso_global) VALUES
 ('11111111-1111-1111-1111-111111111111','Super',   true),
 ('22222222-2222-2222-2222-222222222222','Transp',  false),
 ('33333333-3333-3333-3333-333333333333','Sede',    false),
 ('44444444-4444-4444-4444-444444444444','Planej',  false);
INSERT INTO public.bd_user_roles (user_id, role_id)
SELECT u.uid, r.id FROM (VALUES
 ('11111111-1111-1111-1111-111111111111'::uuid,'SuperAdm'),
 ('22222222-2222-2222-2222-222222222222'::uuid,'AdmTransporte'),
 ('33333333-3333-3333-3333-333333333333'::uuid,'AdmSede'),
 ('44444444-4444-4444-4444-444444444444'::uuid,'Planejador')
) u(uid,rn) JOIN public.bd_roles r ON r.nome = u.rn;

-- CCs: solicitacao / equipamento 1 / equipamento 2
INSERT INTO public.bd_centros_custo (id, codigo_centro_custo, nome_centro_custo) VALUES
 ('aaaaaaaa-0000-0000-0000-000000000001','CC-01','Obra Dry-Run'),
 ('aaaaaaaa-0000-0000-0000-000000000002','CC-EQ1','Patio 1'),
 ('aaaaaaaa-0000-0000-0000-000000000003','CC-EQ2','Patio 2');

INSERT INTO public.bd_catalogo_equipamentos (id) VALUES ('dddddddd-0000-0000-0000-000000000001');

INSERT INTO public.bd_caminhoes_equipamentos (id, frota, numero_frota, catalogo_equipamento_id) VALUES
 ('eeeeeeee-0000-0000-0000-000000000001','CAM','001','dddddddd-0000-0000-0000-000000000001'),
 ('eeeeeeee-0000-0000-0000-000000000002','CAM','002','dddddddd-0000-0000-0000-000000000001');
INSERT INTO public.bd_disponibilidade_equipamentos (equipamento_id, status_operacional, centro_custo_id) VALUES
 ('eeeeeeee-0000-0000-0000-000000000001','DISPONIVEL','aaaaaaaa-0000-0000-0000-000000000002'),
 ('eeeeeeee-0000-0000-0000-000000000002','DISPONIVEL','aaaaaaaa-0000-0000-0000-000000000003');

INSERT INTO public.bd_solicitacoes_equipamento (id, centro_custo_id, solicitante_id, data_inicio, tempo_previsto_dias)
VALUES ('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333', current_date, 5);
INSERT INTO public.bd_solicitacoes_itens (id, solicitacao_id, quantidade, catalogo_equipamento_id)
VALUES ('cccccccc-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001', 4,'dddddddd-0000-0000-0000-000000000001');
COMMIT;

\echo '### PASSO 0 — baseline COMMITADO: md5 das 10 funcoes da M2 R4'
SELECT p.proname, md5(p.prosrc) AS body_md5
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname LIKE 'fn_ct_%'
ORDER BY 1;

\echo '### PASSO 0b — ACLs e contagens iniciais'
SELECT p.proname, p.proacl::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname LIKE 'fn_ct_atendimento_%' ORDER BY 1;
SELECT (SELECT count(*) FROM public.bd_permissions) AS permissions,
       (SELECT count(*) FROM public.bd_permissoes_acoes) AS acoes,
       (SELECT count(*) FROM public.bd_role_permission_actions) AS pares,
       (SELECT count(*) FROM public.bd_solicitacao_item_atendimentos) AS atendimentos;

-- =====================================================================
BEGIN;   -- TRANSACAO DESCARTAVEL UNICA
-- =====================================================================

\echo '### PASSO 2 — aplicando M2.1'
\i /tmp/ct2_dryrun/m2a_notx.sql

\echo '### PASSO 3a — SuperAdm opera antes da M3'
SET LOCAL ct2.test_uid = '11111111-1111-1111-1111-111111111111';
SELECT (public.fn_ct_atendimento_listar('bbbbbbbb-0000-0000-0000-000000000001')->>'ok')::boolean AS superadm_ok;

\echo '### PASSO 3b — AdmTransporte recebe CT2_FORBIDDEN antes da M3'
SET LOCAL ct2.test_uid = '22222222-2222-2222-2222-222222222222';
DO $$
BEGIN
  PERFORM public.fn_ct_atendimento_listar('bbbbbbbb-0000-0000-0000-000000000001');
  RAISE EXCEPTION 'FALHA: nao-superadm deveria receber CT2_FORBIDDEN';
EXCEPTION WHEN SQLSTATE 'P0001' THEN
  IF SQLERRM <> 'CT2_FORBIDDEN' THEN
    RAISE EXCEPTION 'FALHA: erro inesperado %', SQLERRM;
  END IF;
  RAISE NOTICE 'OK: CT2_FORBIDDEN antes da M3';
END $$;

\echo '### PASSO 4 — aplicando M3 R3 (esperado modo create)'
\i /tmp/ct2_dryrun/m3r3_notx.sql

\echo '### PASSO 5 — matriz materializada'
SELECT r.nome AS role, string_agg(rpa.acao, ',' ORDER BY rpa.acao) AS acoes
FROM public.bd_role_permission_actions rpa
JOIN public.bd_roles r ON r.id = rpa.role_id
JOIN public.bd_permissions p ON p.id = rpa.permission_id
WHERE p.codigo='gestao_maquinas_central_transporte_view'
GROUP BY r.nome ORDER BY r.nome;

SELECT count(*) AS pares, count(DISTINCT role_id) AS roles
FROM public.bd_role_permission_actions rpa
JOIN public.bd_permissions p ON p.id=rpa.permission_id
WHERE p.codigo='gestao_maquinas_central_transporte_view';

\echo '### PASSO 6/7 — user_has_permission_action nas 22 concedidas e nas negadas'
DO $$
DECLARE
  v_uid uuid;
  v_rec record;
  v_ok  int := 0;
  v_bad int := 0;
BEGIN
  FOR v_rec IN SELECT r.id, r.nome FROM public.bd_roles r LOOP
    v_uid := md5(v_rec.nome)::uuid;
    INSERT INTO auth.users(id) VALUES (v_uid) ON CONFLICT DO NOTHING;
    INSERT INTO public.profiles(id, nome_completo, acesso_global)
      VALUES (v_uid, v_rec.nome, v_rec.nome = 'SuperAdm') ON CONFLICT DO NOTHING;
    INSERT INTO public.bd_user_roles(user_id, role_id) VALUES (v_uid, v_rec.id);
  END LOOP;

  FOR v_rec IN
    SELECT r.nome AS role_nome, a.acao,
           EXISTS (SELECT 1 FROM public.bd_role_permission_actions rpa
                   JOIN public.bd_permissions p ON p.id=rpa.permission_id
                   WHERE p.codigo='gestao_maquinas_central_transporte_view'
                     AND rpa.role_id=r.id AND rpa.acao=a.acao) AS esperado
    FROM public.bd_roles r
    CROSS JOIN (VALUES ('visualizar'),('criar'),('editar'),('aprovar')) a(acao)
  LOOP
    IF public.user_has_permission_action(md5(v_rec.role_nome)::uuid,
         'gestao_maquinas_central_transporte_view', v_rec.acao)
       = (v_rec.esperado OR v_rec.role_nome = 'SuperAdm')
    THEN v_ok := v_ok + 1;
    ELSE v_bad := v_bad + 1;
         RAISE WARNING 'DIVERGENCIA %/%', v_rec.role_nome, v_rec.acao;
    END IF;
  END LOOP;
  RAISE NOTICE 'user_has_permission_action: % combinacoes conformes, % divergentes', v_ok, v_bad;
  IF v_bad > 0 THEN RAISE EXCEPTION 'FALHA: matriz efetiva divergente'; END IF;
END $$;

\echo '### PASSO 8/9 — aprovar somente nos 4 operacionais'
SELECT r.nome
FROM public.bd_role_permission_actions rpa
JOIN public.bd_roles r ON r.id=rpa.role_id
JOIN public.bd_permissions p ON p.id=rpa.permission_id
WHERE p.codigo='gestao_maquinas_central_transporte_view' AND rpa.acao='aprovar'
ORDER BY 1;

\echo '### PASSO 8b — AdmTransporte agora opera (listar)'
SET LOCAL ct2.test_uid = '22222222-2222-2222-2222-222222222222';
SELECT (public.fn_ct_atendimento_listar('bbbbbbbb-0000-0000-0000-000000000001')->>'ok')::boolean AS admtransporte_ok;

\echo '### PASSO 10 — override DENY e ALLOW'
INSERT INTO public.bd_user_permission_overrides (user_id, permission_id, acao, permitido)
SELECT '22222222-2222-2222-2222-222222222222', p.id, 'visualizar', false
FROM public.bd_permissions p WHERE p.codigo='gestao_maquinas_central_transporte_view';
DO $$
BEGIN
  PERFORM set_config('ct2.test_uid','22222222-2222-2222-2222-222222222222', true);
  IF public.user_has_permission_action('22222222-2222-2222-2222-222222222222',
      'gestao_maquinas_central_transporte_view','visualizar') THEN
    RAISE EXCEPTION 'FALHA: override DENY ignorado';
  END IF;
  BEGIN
    PERFORM public.fn_ct_atendimento_listar('bbbbbbbb-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'FALHA: DENY deveria bloquear listar';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'CT2_FORBIDDEN' THEN RAISE EXCEPTION 'FALHA: %', SQLERRM; END IF;
  END;
  RAISE NOTICE 'OK: override DENY bloqueia';
END $$;

INSERT INTO public.bd_user_permission_overrides (user_id, permission_id, acao, permitido)
SELECT '44444444-4444-4444-4444-444444444444', p.id, 'visualizar', true
FROM public.bd_permissions p WHERE p.codigo='gestao_maquinas_central_transporte_view';
DO $$
BEGIN
  IF NOT public.user_has_permission_action('44444444-4444-4444-4444-444444444444',
      'gestao_maquinas_central_transporte_view','visualizar') THEN
    RAISE EXCEPTION 'FALHA: override ALLOW ignorado para Planejador';
  END IF;
  RAISE NOTICE 'OK: override ALLOW concede (Planejador sem grant de role)';
END $$;
DELETE FROM public.bd_user_permission_overrides;

-- ---------------------------------------------------------------------
\echo '### PASSO 10b — ORDEM DE SEGURANCA ANTES DE REPLAY (6 testes)'
-- ---------------------------------------------------------------------
SET LOCAL ct2.test_uid = '22222222-2222-2222-2222-222222222222';
SET LOCAL ct2.deny_ccs = '';

DO $$
DECLARE
  v_uid   uuid := '22222222-2222-2222-2222-222222222222';
  v_item  uuid := 'cccccccc-0000-0000-0000-000000000001';
  v_e1    uuid := 'eeeeeeee-0000-0000-0000-000000000001';
  v_e2    uuid := 'eeeeeeee-0000-0000-0000-000000000002';
  v_ccsol uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  v_cce1  uuid := 'aaaaaaaa-0000-0000-0000-000000000002';
  v_cce2  uuid := 'aaaaaaaa-0000-0000-0000-000000000003';
  r1 uuid := '10000000-0000-0000-0000-000000000001';
  r2 uuid := '10000000-0000-0000-0000-000000000002';
  r3 uuid := '10000000-0000-0000-0000-000000000003';
  r4 uuid := '10000000-0000-0000-0000-000000000004';
  v_res  jsonb;
  v_a1   uuid;
  v_a3   uuid;
  v_perm uuid;
  v_motivo text := 'Motivo operacional de teste do dry-run CT-2.';

BEGIN
  SELECT id INTO v_perm FROM public.bd_permissions WHERE codigo='gestao_maquinas_central_transporte_view';

  -- baseline operacional: atribuicao real (dentro do escopo)
  v_res := public.fn_ct_atendimento_atribuir(v_item, v_e1, 'INTERNO', r1);
  IF (v_res->>'replay')::boolean IS NOT FALSE THEN RAISE EXCEPTION 'FALHA: 1a atribuicao nao deveria ser replay'; END IF;
  v_a1 := (v_res#>>'{atendimento,id}')::uuid;

  -- sanity: replay legitimo devolve replay=true
  v_res := public.fn_ct_atendimento_atribuir(v_item, v_e1, 'INTERNO', r1);
  IF (v_res->>'replay')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALHA: replay legitimo nao reconhecido'; END IF;
  RAISE NOTICE 'OK: replay legitimo (usuario com action e no escopo) devolve replay=true';

  -- TESTE 1: replay existente, usuario SEM action -> CT2_FORBIDDEN
  INSERT INTO public.bd_user_permission_overrides (user_id, permission_id, acao, permitido)
  VALUES (v_uid, v_perm, 'criar', false);
  BEGIN
    v_res := public.fn_ct_atendimento_atribuir(v_item, v_e1, 'INTERNO', r1);
    RAISE EXCEPTION 'FALHA T1: replay devolvido sem action (%)', v_res;
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'CT2_FORBIDDEN' THEN RAISE EXCEPTION 'FALHA T1: erro %', SQLERRM; END IF;
    RAISE NOTICE 'OK T1: replay sem action -> CT2_FORBIDDEN';
  END;
  DELETE FROM public.bd_user_permission_overrides WHERE user_id=v_uid;

  -- TESTE 2: replay existente, action presente, SOLICITACAO fora do escopo
  PERFORM set_config('ct2.deny_ccs', v_ccsol::text, true);
  BEGIN
    v_res := public.fn_ct_atendimento_atribuir(v_item, v_e1, 'INTERNO', r1);
    RAISE EXCEPTION 'FALHA T2: replay devolvido fora do escopo (%)', v_res;
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'CT2_SCOPE_DENIED' THEN RAISE EXCEPTION 'FALHA T2: erro %', SQLERRM; END IF;
    RAISE NOTICE 'OK T2: replay com solicitacao fora do escopo -> CT2_SCOPE_DENIED';
  END;
  PERFORM set_config('ct2.deny_ccs', '', true);

  -- TESTE 3: replay de ATRIBUICAO com equipamento fora do escopo
  PERFORM set_config('ct2.deny_ccs', v_cce1::text, true);
  BEGIN
    v_res := public.fn_ct_atendimento_atribuir(v_item, v_e1, 'INTERNO', r1);
    RAISE EXCEPTION 'FALHA T3: replay devolvido com equipamento fora do escopo (%)', v_res;
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'CT2_SCOPE_DENIED' THEN RAISE EXCEPTION 'FALHA T3: erro %', SQLERRM; END IF;
    RAISE NOTICE 'OK T3: replay de atribuicao com equipamento fora do escopo -> CT2_SCOPE_DENIED';
  END;
  PERFORM set_config('ct2.deny_ccs', '', true);

  -- baseline de encerramento
  v_res := public.fn_ct_atendimento_encerrar(v_a1, 'LIBERADO', v_motivo, r2);
  IF (v_res->>'replay')::boolean IS NOT FALSE THEN RAISE EXCEPTION 'FALHA: encerramento inicial'; END IF;

  -- TESTE 4: replay de ENCERRAMENTO com equipamento fora do escopo
  PERFORM set_config('ct2.deny_ccs', v_cce1::text, true);
  BEGIN
    v_res := public.fn_ct_atendimento_encerrar(v_a1, 'LIBERADO', v_motivo, r2);
    RAISE EXCEPTION 'FALHA T4: replay devolvido (%)', v_res;
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'CT2_SCOPE_DENIED' THEN RAISE EXCEPTION 'FALHA T4: erro %', SQLERRM; END IF;
    RAISE NOTICE 'OK T4: replay de encerramento com equipamento fora do escopo -> CT2_SCOPE_DENIED';
  END;
  PERFORM set_config('ct2.deny_ccs', '', true);

  -- baseline de substituicao
  v_res := public.fn_ct_atendimento_atribuir(v_item, v_e1, 'INTERNO', r3);
  v_a3 := (v_res#>>'{atendimento,id}')::uuid;
  v_res := public.fn_ct_atendimento_substituir(v_a3, v_e2, 'INTERNO', v_motivo, r4);
  IF (v_res->>'replay')::boolean IS NOT FALSE THEN RAISE EXCEPTION 'FALHA: substituicao inicial'; END IF;

  -- TESTE 5: replay de SUBSTITUICAO com equipamento ANTIGO fora do escopo
  PERFORM set_config('ct2.deny_ccs', v_cce1::text, true);
  BEGIN
    v_res := public.fn_ct_atendimento_substituir(v_a3, v_e2, 'INTERNO', v_motivo, r4);
    RAISE EXCEPTION 'FALHA T5: replay devolvido (%)', v_res;
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'CT2_SCOPE_DENIED' THEN RAISE EXCEPTION 'FALHA T5: erro %', SQLERRM; END IF;
    RAISE NOTICE 'OK T5: replay de substituicao com equipamento antigo fora do escopo -> CT2_SCOPE_DENIED';
  END;
  PERFORM set_config('ct2.deny_ccs', '', true);

  -- TESTE 6: replay de SUBSTITUICAO com equipamento NOVO fora do escopo
  PERFORM set_config('ct2.deny_ccs', v_cce2::text, true);
  BEGIN
    v_res := public.fn_ct_atendimento_substituir(v_a3, v_e2, 'INTERNO', v_motivo, r4);
    RAISE EXCEPTION 'FALHA T6: replay devolvido (%)', v_res;
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'CT2_SCOPE_DENIED' THEN RAISE EXCEPTION 'FALHA T6: erro %', SQLERRM; END IF;
    RAISE NOTICE 'OK T6: replay de substituicao com equipamento novo fora do escopo -> CT2_SCOPE_DENIED';
  END;
  PERFORM set_config('ct2.deny_ccs', '', true);
END $$;

DELETE FROM public.bd_user_permission_overrides;

\echo '### PASSO 11 — 2a execucao da M3 R3 (validate_only): delta pg_stat_xact = 0'
CREATE TEMP TABLE ct2_stat_antes AS
SELECT relname, n_tup_ins, n_tup_upd, n_tup_del
FROM pg_stat_xact_user_tables
WHERE relname IN ('bd_permissions','bd_permissoes_acoes','bd_role_permission_actions',
                  'bd_user_permission_overrides','bd_permission_change_audit_logs');

CREATE OR REPLACE FUNCTION pg_temp.f_no_dml() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'DML_DETECTADO: % em %', TG_OP, TG_TABLE_NAME;
END $$;
CREATE TRIGGER trg_ct2_no_dml_perm BEFORE INSERT OR UPDATE OR DELETE ON public.bd_permissions
  FOR EACH ROW EXECUTE FUNCTION pg_temp.f_no_dml();
CREATE TRIGGER trg_ct2_no_dml_acoes BEFORE INSERT OR UPDATE OR DELETE ON public.bd_permissoes_acoes
  FOR EACH ROW EXECUTE FUNCTION pg_temp.f_no_dml();
CREATE TRIGGER trg_ct2_no_dml_rpa BEFORE INSERT OR UPDATE OR DELETE ON public.bd_role_permission_actions
  FOR EACH ROW EXECUTE FUNCTION pg_temp.f_no_dml();
CREATE TRIGGER trg_ct2_no_dml_ovr BEFORE INSERT OR UPDATE OR DELETE ON public.bd_user_permission_overrides
  FOR EACH ROW EXECUTE FUNCTION pg_temp.f_no_dml();
CREATE TRIGGER trg_ct2_no_dml_aud BEFORE INSERT OR UPDATE OR DELETE ON public.bd_permission_change_audit_logs
  FOR EACH ROW EXECUTE FUNCTION pg_temp.f_no_dml();

\i /tmp/ct2_dryrun/m3r3_notx.sql

SELECT a.relname,
       (d.n_tup_ins - a.n_tup_ins) AS delta_ins,
       (d.n_tup_upd - a.n_tup_upd) AS delta_upd,
       (d.n_tup_del - a.n_tup_del) AS delta_del
FROM ct2_stat_antes a
JOIN pg_stat_xact_user_tables d ON d.relname = a.relname
ORDER BY 1;

DO $$
DECLARE v_bad int;
BEGIN
  SELECT count(*) INTO v_bad
  FROM ct2_stat_antes a JOIN pg_stat_xact_user_tables d ON d.relname=a.relname
  WHERE (d.n_tup_ins - a.n_tup_ins) <> 0
     OR (d.n_tup_upd - a.n_tup_upd) <> 0
     OR (d.n_tup_del - a.n_tup_del) <> 0;
  IF v_bad > 0 THEN RAISE EXCEPTION 'FALHA: validate_only escreveu em % tabela(s)', v_bad; END IF;
  RAISE NOTICE 'OK: validate_only sem nenhuma escrita (deltas zero)';
END $$;

DROP TRIGGER trg_ct2_no_dml_perm ON public.bd_permissions;
DROP TRIGGER trg_ct2_no_dml_acoes ON public.bd_permissoes_acoes;
DROP TRIGGER trg_ct2_no_dml_rpa ON public.bd_role_permission_actions;
DROP TRIGGER trg_ct2_no_dml_ovr ON public.bd_user_permission_overrides;
DROP TRIGGER trg_ct2_no_dml_aud ON public.bd_permission_change_audit_logs;

-- =====================================================================
\echo '### PASSO 12 — ROLLBACK'
ROLLBACK;
-- =====================================================================

\echo '### PASSO 13 — prova pos-rollback'
SELECT count(*) AS permission_ct2 FROM public.bd_permissions
 WHERE codigo='gestao_maquinas_central_transporte_view';
SELECT count(*) AS acoes_ct2 FROM public.bd_permissoes_acoes;
SELECT count(*) AS pares_ct2 FROM public.bd_role_permission_actions;
SELECT count(*) AS overrides FROM public.bd_user_permission_overrides;
SELECT count(*) AS auditoria FROM public.bd_permission_change_audit_logs;
SELECT count(*) AS atendimentos FROM public.bd_solicitacao_item_atendimentos;

SELECT p.proname, md5(p.prosrc) AS body_md5_pos_rollback
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname LIKE 'fn_ct_%'
ORDER BY 1;

\echo '### PASSO 13b — conferencia dos 4 hashes M2 R4 informados'
DO $$
DECLARE v_bad int;
BEGIN
  SELECT count(*) INTO v_bad FROM (VALUES
    ('fn_ct_atendimento_atribuir','78b80f993fb73253c72666aa5a758304'),
    ('fn_ct_atendimento_encerrar','6c386e2efb798d3b6d6aa390b496e8f2'),
    ('fn_ct_atendimento_substituir','208069ee4b9c264929aac4fdf60a49d5'),
    ('fn_ct_atendimento_listar','7d5b760d3a414a71dc74f3786590c4b3')
  ) e(nome, md5esp)
  JOIN pg_proc p ON p.proname = e.nome
  JOIN pg_namespace n ON n.oid=p.pronamespace AND n.nspname='public'
  WHERE md5(p.prosrc) <> e.md5esp;
  IF v_bad > 0 THEN RAISE EXCEPTION 'FALHA: % funcao(oes) publica(s) fora do hash M2 R4', v_bad; END IF;
  RAISE NOTICE 'OK: as 4 publicas voltaram exatamente aos hashes M2 R4';
END $$;
