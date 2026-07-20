-- =====================================================================
-- QA — Centro de Custo Atual (projeção autoritativa em bd_caminhoes_equipamentos)
-- Migration coberta: supabase/migrations/20260716145902_6be733ff-57a7-418e-b6af-c656e8a0412a.sql
-- Hotfix fail-closed: fn_trg_caminhoes_eq_after_insert_cc sem EXCEPTION WHEN OTHERS.
--
-- Como executar:
--   Supabase Dashboard → SQL Editor → colar este arquivo inteiro → RUN.
--   O script termina em ROLLBACK: nenhuma fixture é persistida.
--
-- Estrutura:
--   BEGIN
--     (a) contexto autenticado (SuperAdm real via claims JWT)
--     (b) fixtures reais (3 CCs ativos)
--     (c) guarda de pré-condição
--     (d) temp tables _qa_ctx e _qa_res
--     (e) 18 casos A..R
--     (f) consolidação + guarda de contagem
--   ROLLBACK
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- (a) CONTEXTO AUTENTICADO
--     Selecionar um SuperAdm real e injetar como auth.uid() via claims.
--     Não trocar o role do SQL Editor (mantém permissão para temp tables).
-- ---------------------------------------------------------------------

DO $ctx$
DECLARE
  v_uid uuid;
BEGIN
  SELECT u.id
    INTO v_uid
    FROM auth.users u
   WHERE public.fn_is_super_admin(u.id)
   ORDER BY u.created_at
   LIMIT 1;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Nenhum SuperAdm encontrado — impossível autenticar contexto QA.';
  END IF;

  PERFORM set_config('request.jwt.claim.sub',  v_uid::text,       true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated',   true);
END
$ctx$;

-- Comprovação (deve retornar uuid não nulo):
SELECT auth.uid() AS uid_autenticado;

-- ---------------------------------------------------------------------
-- (b) + (c) FIXTURES REAIS + GUARDA
-- ---------------------------------------------------------------------

CREATE TEMP TABLE _qa_ctx (
  slot            text PRIMARY KEY,
  valor_uuid      uuid,
  valor_text      text
) ON COMMIT DROP;

-- 3 Centros de Custo ativos (ordem determinística por codigo, id)
WITH ccs AS (
  SELECT
    id,
    codigo_centro_custo,
    row_number() OVER (ORDER BY codigo_centro_custo, id) AS rn
  FROM public.bd_centros_custo
  WHERE COALESCE(situacao, 'Ativo') = 'Ativo'
  ORDER BY codigo_centro_custo, id
  LIMIT 3
)
INSERT INTO _qa_ctx (slot, valor_uuid, valor_text)
SELECT
  CASE rn
    WHEN 1 THEN 'cc_a'
    WHEN 2 THEN 'cc_b'
    WHEN 3 THEN 'cc_c'
  END,
  id,
  codigo_centro_custo
FROM ccs
WHERE rn BETWEEN 1 AND 3;

DO $guard$
DECLARE
  v_qtd int;
BEGIN
  SELECT count(*) INTO v_qtd FROM _qa_ctx WHERE slot IN ('cc_a','cc_b','cc_c');
  IF v_qtd <> 3 THEN
    RAISE EXCEPTION 'São necessários três Centros de Custo ativos para o QA (encontrados: %)', v_qtd;
  END IF;
END
$guard$;


-- Epoch para identificadores únicos por execução
INSERT INTO _qa_ctx (slot, valor_text)
VALUES ('epoch', extract(epoch FROM clock_timestamp())::bigint::text);

-- ---------------------------------------------------------------------
-- (d) TABELA DE RESULTADOS
-- ---------------------------------------------------------------------

CREATE TEMP TABLE _qa_res (
  caso             text PRIMARY KEY,
  estado_anterior  text,
  operacao         text,
  esperado         text,
  obtido           text,
  status           text CHECK (status IN ('PASS','FAIL'))
) ON COMMIT DROP;

-- Helper: registra resultado comparando esperado x obtido textualmente
CREATE OR REPLACE FUNCTION pg_temp._qa_add(
  p_caso text, p_est text, p_op text, p_esp text, p_obt text
) RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
  INSERT INTO _qa_res (caso, estado_anterior, operacao, esperado, obtido, status)
  VALUES (p_caso, p_est, p_op, p_esp, p_obt,
          CASE WHEN p_esp = p_obt THEN 'PASS' ELSE 'FAIL' END);
END
$fn$;

-- Helper: gera identificador único
CREATE OR REPLACE FUNCTION pg_temp._qa_id(p_letra text) RETURNS text
LANGUAGE sql AS $fn$
  SELECT 'QA-CC-ATUAL-' || (SELECT valor_text FROM _qa_ctx WHERE slot='epoch') || '-' || p_letra;
$fn$;

-- Helper temporário: reproduz a resolução temporal do backfill da migration original,
-- restrita a UM equipamento. Não altera nada de produção; some com ROLLBACK/sessão.
CREATE OR REPLACE FUNCTION pg_temp._qa_replay_backfill(p_equipamento_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $qa$
BEGIN
  WITH eventos_apontamento AS (
    SELECT
      a.caminhao_equipamento_id AS equipamento_id,
      a.centro_custo_id,
      'APONTAMENTO_CE'::text AS origem,
      (a.data::timestamp + COALESCE(a.hora_inicial, '00:00'::time))
        AT TIME ZONE 'America/Sao_Paulo' AS evento_em,
      50 AS prioridade,
      a.id AS identificador
    FROM public.bd_registro_apontamento_cam_equipa a
    WHERE a.caminhao_equipamento_id = p_equipamento_id
      AND a.centro_custo_id IS NOT NULL
      AND a.data IS NOT NULL
  ),
  eventos_disponibilidade AS (
    SELECT
      d.equipamento_id,
      d.centro_custo_id,
      CASE
        WHEN d.centro_custo_id IS NULL THEN 'SEM_ALOCACAO'
        ELSE 'DISPONIBILIDADE'
      END::text AS origem,
      CASE
        WHEN d.data_inicio IS NOT NULL THEN
          (d.data_inicio::timestamp
            + (COALESCE(d.updated_at, d.created_at, now())
                 AT TIME ZONE 'America/Sao_Paulo')::time
          ) AT TIME ZONE 'America/Sao_Paulo'
        ELSE COALESCE(d.updated_at, d.created_at)
      END AS evento_em,
      CASE WHEN d.centro_custo_id IS NULL THEN 10 ELSE 30 END AS prioridade,
      d.id AS identificador
    FROM public.bd_disponibilidade_equipamentos d
    WHERE d.equipamento_id = p_equipamento_id
      AND (
        d.centro_custo_id IS NOT NULL
        OR (d.status_operacional = 'DISPONIVEL'::status_operacional_enum
            AND d.centro_custo_id IS NULL)
      )
  ),
  todos AS (
    SELECT * FROM eventos_apontamento
    UNION ALL
    SELECT * FROM eventos_disponibilidade
  ),
  resolvido AS (
    SELECT DISTINCT ON (equipamento_id)
      equipamento_id, centro_custo_id, origem, evento_em
    FROM todos
    ORDER BY equipamento_id, evento_em DESC NULLS LAST, prioridade DESC, identificador DESC
  )
  UPDATE public.bd_caminhoes_equipamentos ce
     SET centro_custo_atual_id      = r.centro_custo_id,
         centro_custo_atual_origem  = r.origem,
         centro_custo_atualizado_em = r.evento_em
    FROM resolvido r
   WHERE ce.id = r.equipamento_id
     AND ce.id = p_equipamento_id;
END;
$qa$;

-- ---------------------------------------------------------------------
-- (e) CASOS A..R
-- ---------------------------------------------------------------------


-- ========== CASO A: cadastro COM centro de custo ==========
DO $A$
DECLARE
  v_cc_a uuid; v_id uuid; v_atual uuid; v_origem text; v_atu timestamptz; v_disp int;
  v_esp text; v_obt text;
BEGIN
  SELECT valor_uuid INTO v_cc_a FROM _qa_ctx WHERE slot='cc_a';

  INSERT INTO public.bd_caminhoes_equipamentos
    (frota, numero_frota, situacao, tipo_ativo, centro_custo_atual_id)
  VALUES ('QA', pg_temp._qa_id('A'), 'Operando', 'equipamento', v_cc_a)
  RETURNING id INTO v_id;

  SELECT centro_custo_atual_id, centro_custo_atual_origem, centro_custo_atualizado_em
    INTO v_atual, v_origem, v_atu
    FROM public.bd_caminhoes_equipamentos WHERE id = v_id;

  SELECT count(*) INTO v_disp
    FROM public.bd_disponibilidade_equipamentos
   WHERE equipamento_id = v_id AND status_operacional = 'ALOCADO' AND centro_custo_id = v_cc_a;

  v_esp := 'cc=' || v_cc_a || '|origem=CADASTRO|atu=NOT_NULL|disp_alocado=1';
  v_obt := 'cc=' || COALESCE(v_atual::text,'NULL')
         || '|origem=' || v_origem
         || '|atu=' || CASE WHEN v_atu IS NULL THEN 'NULL' ELSE 'NOT_NULL' END
         || '|disp_alocado=' || v_disp;
  PERFORM pg_temp._qa_add('A','sem_ativo','INSERT ativo com CC_A', v_esp, v_obt);
END
$A$;

-- ========== CASO B: cadastro SEM centro de custo ==========
DO $B$
DECLARE
  v_id uuid; v_atual uuid; v_origem text; v_disp int; v_esp text; v_obt text;
BEGIN
  INSERT INTO public.bd_caminhoes_equipamentos
    (frota, numero_frota, situacao, tipo_ativo)
  VALUES ('QA', pg_temp._qa_id('B'), 'Operando', 'equipamento')
  RETURNING id INTO v_id;

  SELECT centro_custo_atual_id, centro_custo_atual_origem
    INTO v_atual, v_origem
    FROM public.bd_caminhoes_equipamentos WHERE id = v_id;
  SELECT count(*) INTO v_disp FROM public.bd_disponibilidade_equipamentos WHERE equipamento_id = v_id;

  v_esp := 'cc=NULL|origem=SEM_ALOCACAO|disp=0';
  v_obt := 'cc=' || COALESCE(v_atual::text,'NULL') || '|origem=' || v_origem || '|disp=' || v_disp;
  PERFORM pg_temp._qa_add('B','sem_ativo','INSERT ativo sem CC', v_esp, v_obt);
END
$B$;

-- ========== CASO C: apontamento em outro CC atualiza projeção ==========
DO $C$
DECLARE
  v_cc_a uuid; v_cc_b uuid; v_id uuid; v_atual uuid; v_origem text;
  v_esp text; v_obt text;
  v_evento_ts timestamptz := now() + interval '1 minute';
  v_evento_data date;
  v_evento_hora time;
BEGIN
  SELECT valor_uuid INTO v_cc_a FROM _qa_ctx WHERE slot='cc_a';
  SELECT valor_uuid INTO v_cc_b FROM _qa_ctx WHERE slot='cc_b';

  INSERT INTO public.bd_caminhoes_equipamentos
    (frota, numero_frota, situacao, tipo_ativo, centro_custo_atual_id)
  VALUES ('QA', pg_temp._qa_id('C'), 'Operando', 'equipamento', v_cc_a)
  RETURNING id INTO v_id;

  v_evento_data := (v_evento_ts AT TIME ZONE 'America/Sao_Paulo')::date;
  v_evento_hora := (v_evento_ts AT TIME ZONE 'America/Sao_Paulo')::time;

  INSERT INTO public.bd_registro_apontamento_cam_equipa
    (caminhao_equipamento_id, centro_custo_id, data, hora_inicial, hora_final, situacao)
  VALUES (v_id, v_cc_b, v_evento_data, v_evento_hora, v_evento_hora + interval '2 hour', 'Operando');

  SELECT centro_custo_atual_id, centro_custo_atual_origem INTO v_atual, v_origem
    FROM public.bd_caminhoes_equipamentos WHERE id = v_id;

  v_esp := 'cc=' || v_cc_b || '|origem=APONTAMENTO_CE';
  v_obt := 'cc=' || COALESCE(v_atual::text,'NULL') || '|origem=' || v_origem;
  PERFORM pg_temp._qa_add('C','CC_A/CADASTRO','INSERT apontamento em CC_B', v_esp, v_obt);
END
$C$;

-- ========== CASO D: apontamento retroativo é ignorado ==========
DO $D$
DECLARE
  v_cc_b uuid; v_cc_c uuid; v_id uuid;
  v_atual_pre uuid; v_atu_pre timestamptz;
  v_atual_pos uuid; v_atu_pos timestamptz; v_origem text;
  v_esp text; v_obt text;
BEGIN
  SELECT valor_uuid INTO v_cc_b FROM _qa_ctx WHERE slot='cc_b';
  SELECT valor_uuid INTO v_cc_c FROM _qa_ctx WHERE slot='cc_c';

  -- estado recente: apontamento em CC_B hoje
  INSERT INTO public.bd_caminhoes_equipamentos
    (frota, numero_frota, situacao, tipo_ativo)
  VALUES ('QA', pg_temp._qa_id('D'), 'Operando', 'equipamento')
  RETURNING id INTO v_id;

  INSERT INTO public.bd_registro_apontamento_cam_equipa
    (caminhao_equipamento_id, centro_custo_id, data, hora_inicial, hora_final, situacao)
  VALUES (v_id, v_cc_b, CURRENT_DATE, '08:00', '10:00', 'Operando');

  SELECT centro_custo_atual_id, centro_custo_atualizado_em INTO v_atual_pre, v_atu_pre
    FROM public.bd_caminhoes_equipamentos WHERE id = v_id;

  -- evento retroativo (30 dias atrás) em CC_C — não deve prevalecer
  INSERT INTO public.bd_registro_apontamento_cam_equipa
    (caminhao_equipamento_id, centro_custo_id, data, hora_inicial, hora_final, situacao)
  VALUES (v_id, v_cc_c, CURRENT_DATE - 30, '08:00', '10:00', 'Operando');

  SELECT centro_custo_atual_id, centro_custo_atualizado_em, centro_custo_atual_origem
    INTO v_atual_pos, v_atu_pos, v_origem
    FROM public.bd_caminhoes_equipamentos WHERE id = v_id;

  v_esp := 'cc=' || v_cc_b || '|atu_igual=true|origem=APONTAMENTO_CE';
  v_obt := 'cc=' || COALESCE(v_atual_pos::text,'NULL')
         || '|atu_igual=' || CASE WHEN v_atu_pre IS NOT DISTINCT FROM v_atu_pos THEN 'true' ELSE 'false' END
         || '|origem=' || v_origem;
  PERFORM pg_temp._qa_add('D','CC_B/APONTAMENTO_CE','INSERT apontamento retroativo em CC_C', v_esp, v_obt);
END
$D$;

-- ========== CASO E: nova disponibilidade em outro CC ==========
DO $E$
DECLARE
  v_cc_a uuid; v_cc_b uuid; v_id uuid; v_atual uuid; v_origem text;
  v_esp text; v_obt text;
  v_evento_ts timestamptz := now() + interval '1 minute';
  v_evento_data date;
BEGIN
  SELECT valor_uuid INTO v_cc_a FROM _qa_ctx WHERE slot='cc_a';
  SELECT valor_uuid INTO v_cc_b FROM _qa_ctx WHERE slot='cc_b';

  INSERT INTO public.bd_caminhoes_equipamentos
    (frota, numero_frota, situacao, tipo_ativo, centro_custo_atual_id)
  VALUES ('QA', pg_temp._qa_id('E'), 'Operando', 'equipamento', v_cc_a)
  RETURNING id INTO v_id;

  v_evento_data := (v_evento_ts AT TIME ZONE 'America/Sao_Paulo')::date;

  INSERT INTO public.bd_disponibilidade_equipamentos
    (equipamento_id, status_operacional, centro_custo_id, data_inicio, observacao, created_at, updated_at)
  VALUES (v_id, 'ALOCADO', v_cc_b, v_evento_data, 'QA-E nova disp', v_evento_ts, v_evento_ts);

  SELECT centro_custo_atual_id, centro_custo_atual_origem INTO v_atual, v_origem
    FROM public.bd_caminhoes_equipamentos WHERE id = v_id;

  v_esp := 'cc=' || v_cc_b || '|origem=DISPONIBILIDADE';
  v_obt := 'cc=' || COALESCE(v_atual::text,'NULL') || '|origem=' || v_origem;
  PERFORM pg_temp._qa_add('E','CC_A/CADASTRO','INSERT disponibilidade ALOCADO em CC_B', v_esp, v_obt);
END
$E$;

-- ========== CASO F: disponibilidade antiga não sobrescreve estado atual ==========
DO $F$
DECLARE
  v_cc_a uuid; v_cc_b uuid; v_id uuid;
  v_atual_pre uuid; v_atual_pos uuid; v_origem text;
  v_esp text; v_obt text;
BEGIN
  SELECT valor_uuid INTO v_cc_a FROM _qa_ctx WHERE slot='cc_a';
  SELECT valor_uuid INTO v_cc_b FROM _qa_ctx WHERE slot='cc_b';

  INSERT INTO public.bd_caminhoes_equipamentos
    (frota, numero_frota, situacao, tipo_ativo)
  VALUES ('QA', pg_temp._qa_id('F'), 'Operando', 'equipamento')
  RETURNING id INTO v_id;

  -- estado recente CC_B hoje
  INSERT INTO public.bd_disponibilidade_equipamentos
    (equipamento_id, status_operacional, centro_custo_id, data_inicio, observacao)
  VALUES (v_id, 'ALOCADO', v_cc_b, CURRENT_DATE, 'QA-F recente');

  SELECT centro_custo_atual_id INTO v_atual_pre
    FROM public.bd_caminhoes_equipamentos WHERE id = v_id;

  -- evento antigo em CC_A
  INSERT INTO public.bd_disponibilidade_equipamentos
    (equipamento_id, status_operacional, centro_custo_id, data_inicio, observacao)
  VALUES (v_id, 'ALOCADO', v_cc_a, CURRENT_DATE - 30, 'QA-F antiga');

  SELECT centro_custo_atual_id, centro_custo_atual_origem INTO v_atual_pos, v_origem
    FROM public.bd_caminhoes_equipamentos WHERE id = v_id;

  v_esp := 'cc=' || v_cc_b || '|origem=DISPONIBILIDADE';
  v_obt := 'cc=' || COALESCE(v_atual_pos::text,'NULL') || '|origem=' || v_origem;
  PERFORM pg_temp._qa_add('F','CC_B/DISPONIBILIDADE','INSERT disponibilidade antiga em CC_A', v_esp, v_obt);
END
$F$;

-- ========== CASO G: DISPONIVEL com CC NULL zera projeção ==========
DO $G$
DECLARE
  v_cc_a uuid; v_id uuid; v_atual uuid; v_origem text;
  v_esp text; v_obt text;
  v_evento_ts timestamptz := now() + interval '1 minute';
  v_evento_data date;
BEGIN
  SELECT valor_uuid INTO v_cc_a FROM _qa_ctx WHERE slot='cc_a';

  INSERT INTO public.bd_caminhoes_equipamentos
    (frota, numero_frota, situacao, tipo_ativo, centro_custo_atual_id)
  VALUES ('QA', pg_temp._qa_id('G'), 'Operando', 'equipamento', v_cc_a)
  RETURNING id INTO v_id;

  v_evento_data := (v_evento_ts AT TIME ZONE 'America/Sao_Paulo')::date;

  INSERT INTO public.bd_disponibilidade_equipamentos
    (equipamento_id, status_operacional, centro_custo_id, data_inicio, observacao, created_at, updated_at)
  VALUES (v_id, 'DISPONIVEL', NULL, v_evento_data, 'QA-G liberacao', v_evento_ts, v_evento_ts);

  SELECT centro_custo_atual_id, centro_custo_atual_origem INTO v_atual, v_origem
    FROM public.bd_caminhoes_equipamentos WHERE id = v_id;

  v_esp := 'cc=NULL|origem=SEM_ALOCACAO';
  v_obt := 'cc=' || COALESCE(v_atual::text,'NULL') || '|origem=' || v_origem;
  PERFORM pg_temp._qa_add('G','CC_A/CADASTRO','INSERT DISPONIVEL/CC=NULL', v_esp, v_obt);
END
$G$;

-- ========== CASO H: RPC reflete projeção persistida ==========
DO $H$
DECLARE
  v_cc_b uuid; v_id uuid; v_rpc_cc uuid; v_rpc_ori text; v_proj_cc uuid; v_proj_ori text;
  v_esp text; v_obt text;
BEGIN
  SELECT valor_uuid INTO v_cc_b FROM _qa_ctx WHERE slot='cc_b';

  INSERT INTO public.bd_caminhoes_equipamentos
    (frota, numero_frota, situacao, tipo_ativo, centro_custo_atual_id)
  VALUES ('QA', pg_temp._qa_id('H'), 'Operando', 'equipamento', v_cc_b)
  RETURNING id INTO v_id;

  SELECT centro_custo_atual_id, centro_custo_atual_origem INTO v_proj_cc, v_proj_ori
    FROM public.bd_caminhoes_equipamentos WHERE id = v_id;

  SELECT centro_custo_atual_id, centro_custo_origem INTO v_rpc_cc, v_rpc_ori
    FROM public.fn_veiculos_alocacao_atual(ARRAY[v_id]::uuid[])
   WHERE equipamento_id = v_id;

  v_esp := 'cc=' || COALESCE(v_proj_cc::text,'NULL') || '|origem=' || v_proj_ori;
  v_obt := 'cc=' || COALESCE(v_rpc_cc::text,'NULL')  || '|origem=' || COALESCE(v_rpc_ori,'NULL');
  PERFORM pg_temp._qa_add('H','projecao_CC_B','SELECT fn_veiculos_alocacao_atual', v_esp, v_obt);
END
$H$;

-- ========== CASO I: liberação persistente não ressuscita apontamento antigo ==========
DO $I$
DECLARE
  v_cc_a uuid; v_id uuid; v_rpc_ori text; v_esp text; v_obt text;
BEGIN
  SELECT valor_uuid INTO v_cc_a FROM _qa_ctx WHERE slot='cc_a';

  INSERT INTO public.bd_caminhoes_equipamentos
    (frota, numero_frota, situacao, tipo_ativo)
  VALUES ('QA', pg_temp._qa_id('I'), 'Operando', 'equipamento')
  RETURNING id INTO v_id;

  INSERT INTO public.bd_registro_apontamento_cam_equipa
    (caminhao_equipamento_id, centro_custo_id, data, hora_inicial, hora_final, situacao)
  VALUES (v_id, v_cc_a, CURRENT_DATE - 5, '08:00', '10:00', 'Operando');

  INSERT INTO public.bd_disponibilidade_equipamentos
    (equipamento_id, status_operacional, centro_custo_id, data_inicio, observacao)
  VALUES (v_id, 'DISPONIVEL', NULL, CURRENT_DATE, 'QA-I liberacao recente');

  SELECT centro_custo_origem INTO v_rpc_ori
    FROM public.fn_veiculos_alocacao_atual(ARRAY[v_id]::uuid[])
   WHERE equipamento_id = v_id;

  v_esp := 'origem=SEM_ALOCACAO';
  v_obt := 'origem=' || COALESCE(v_rpc_ori,'NULL');
  PERFORM pg_temp._qa_add('I','apont_antigo_CC_A + disp_recente_NULL','SELECT RPC', v_esp, v_obt);
END
$I$;

-- ========== CASO J: UPDATE só de observação não altera projeção ==========
DO $J$
DECLARE
  v_cc_b uuid; v_id uuid; v_disp_id uuid;
  v_cc_pre uuid; v_ori_pre text; v_atu_pre timestamptz;
  v_cc_pos uuid; v_ori_pos text; v_atu_pos timestamptz;
  v_esp text; v_obt text;
BEGIN
  SELECT valor_uuid INTO v_cc_b FROM _qa_ctx WHERE slot='cc_b';

  INSERT INTO public.bd_caminhoes_equipamentos
    (frota, numero_frota, situacao, tipo_ativo, centro_custo_atual_id)
  VALUES ('QA', pg_temp._qa_id('J'), 'Operando', 'equipamento', v_cc_b)
  RETURNING id INTO v_id;

  SELECT id INTO v_disp_id FROM public.bd_disponibilidade_equipamentos
   WHERE equipamento_id = v_id ORDER BY created_at DESC LIMIT 1;

  SELECT centro_custo_atual_id, centro_custo_atual_origem, centro_custo_atualizado_em
    INTO v_cc_pre, v_ori_pre, v_atu_pre
    FROM public.bd_caminhoes_equipamentos WHERE id = v_id;

  UPDATE public.bd_disponibilidade_equipamentos
     SET observacao = 'QA-J alterada'
   WHERE id = v_disp_id;

  SELECT centro_custo_atual_id, centro_custo_atual_origem, centro_custo_atualizado_em
    INTO v_cc_pos, v_ori_pos, v_atu_pos
    FROM public.bd_caminhoes_equipamentos WHERE id = v_id;

  v_esp := 'cc_igual=true|ori_igual=true|atu_igual=true';
  v_obt := 'cc_igual='  || CASE WHEN v_cc_pre  IS NOT DISTINCT FROM v_cc_pos  THEN 'true' ELSE 'false' END
        || '|ori_igual=' || CASE WHEN v_ori_pre IS NOT DISTINCT FROM v_ori_pos THEN 'true' ELSE 'false' END
        || '|atu_igual=' || CASE WHEN v_atu_pre IS NOT DISTINCT FROM v_atu_pos THEN 'true' ELSE 'false' END;
  PERFORM pg_temp._qa_add('J','projecao_CC_B','UPDATE observacao da disponibilidade', v_esp, v_obt);
END
$J$;

-- ========== CASO K: origem final permanece CADASTRO após disponibilidade inicial ==========
DO $K$
DECLARE
  v_cc_a uuid; v_id uuid; v_origem text; v_esp text; v_obt text;
BEGIN
  SELECT valor_uuid INTO v_cc_a FROM _qa_ctx WHERE slot='cc_a';

  INSERT INTO public.bd_caminhoes_equipamentos
    (frota, numero_frota, situacao, tipo_ativo, centro_custo_atual_id)
  VALUES ('QA', pg_temp._qa_id('K'), 'Operando', 'equipamento', v_cc_a)
  RETURNING id INTO v_id;

  SELECT centro_custo_atual_origem INTO v_origem
    FROM public.bd_caminhoes_equipamentos WHERE id = v_id;

  v_esp := 'origem=CADASTRO';
  v_obt := 'origem=' || v_origem;
  PERFORM pg_temp._qa_add('K','sem_ativo','INSERT ativo com CC + disp inicial', v_esp, v_obt);
END
$K$;

-- ========== CASO L: backfill interfontes — helper temporário replay ==========
DO $L$
DECLARE
  v_cc_a uuid; v_cc_b uuid; v_id uuid; v_cc uuid; v_origem text;
  v_esp text; v_obt text;
BEGIN
  SELECT valor_uuid INTO v_cc_a FROM _qa_ctx WHERE slot='cc_a';
  SELECT valor_uuid INTO v_cc_b FROM _qa_ctx WHERE slot='cc_b';

  INSERT INTO public.bd_caminhoes_equipamentos
    (frota, numero_frota, situacao, tipo_ativo)
  VALUES ('QA', pg_temp._qa_id('L'), 'Operando', 'equipamento')
  RETURNING id INTO v_id;

  -- apontamento antigo CC_A
  INSERT INTO public.bd_registro_apontamento_cam_equipa
    (caminhao_equipamento_id, centro_custo_id, data, hora_inicial, hora_final, situacao)
  VALUES (v_id, v_cc_a, CURRENT_DATE - 10, '08:00', '10:00', 'Operando');

  -- disponibilidade recente CC_B
  INSERT INTO public.bd_disponibilidade_equipamentos
    (equipamento_id, status_operacional, centro_custo_id, data_inicio, observacao)
  VALUES (v_id, 'ALOCADO', v_cc_b, CURRENT_DATE, 'QA-L recente');

  -- zerar projeção e replay via helper temporário
  UPDATE public.bd_caminhoes_equipamentos
     SET centro_custo_atual_id       = NULL,
         centro_custo_atual_origem   = 'SEM_ALOCACAO',
         centro_custo_atualizado_em  = NULL
   WHERE id = v_id;

  PERFORM pg_temp._qa_replay_backfill(v_id);

  SELECT centro_custo_atual_id, centro_custo_atual_origem INTO v_cc, v_origem
    FROM public.bd_caminhoes_equipamentos WHERE id = v_id;

  v_esp := 'cc=' || v_cc_b || '|origem=DISPONIBILIDADE';
  v_obt := 'cc=' || COALESCE(v_cc::text,'NULL') || '|origem=' || COALESCE(v_origem,'NULL');
  PERFORM pg_temp._qa_add('L','projecao zerada','replay backfill', v_esp, v_obt);
END
$L$;


-- ========== CASO M: backfill inverso — apontamento vence disponibilidade antiga ==========
DO $M$
DECLARE
  v_cc_a uuid; v_cc_b uuid; v_id uuid; v_cc uuid; v_origem text;
  v_esp text; v_obt text;
BEGIN
  SELECT valor_uuid INTO v_cc_a FROM _qa_ctx WHERE slot='cc_a';
  SELECT valor_uuid INTO v_cc_b FROM _qa_ctx WHERE slot='cc_b';

  INSERT INTO public.bd_caminhoes_equipamentos
    (frota, numero_frota, situacao, tipo_ativo)
  VALUES ('QA', pg_temp._qa_id('M'), 'Operando', 'equipamento')
  RETURNING id INTO v_id;

  INSERT INTO public.bd_disponibilidade_equipamentos
    (equipamento_id, status_operacional, centro_custo_id, data_inicio, observacao)
  VALUES (v_id, 'ALOCADO', v_cc_a, CURRENT_DATE - 10, 'QA-M antiga');

  INSERT INTO public.bd_registro_apontamento_cam_equipa
    (caminhao_equipamento_id, centro_custo_id, data, hora_inicial, hora_final, situacao)
  VALUES (v_id, v_cc_b, CURRENT_DATE, '08:00', '10:00', 'Operando');

  UPDATE public.bd_caminhoes_equipamentos
     SET centro_custo_atual_id       = NULL,
         centro_custo_atual_origem   = 'SEM_ALOCACAO',
         centro_custo_atualizado_em  = NULL
   WHERE id = v_id;

  PERFORM pg_temp._qa_replay_backfill(v_id);

  SELECT centro_custo_atual_id, centro_custo_atual_origem INTO v_cc, v_origem
    FROM public.bd_caminhoes_equipamentos WHERE id = v_id;

  v_esp := 'cc=' || v_cc_b || '|origem=APONTAMENTO_CE';
  v_obt := 'cc=' || COALESCE(v_cc::text,'NULL') || '|origem=' || COALESCE(v_origem,'NULL');
  PERFORM pg_temp._qa_add('M','projecao zerada','replay backfill (inverso)', v_esp, v_obt);
END
$M$;


-- ========== CASO N: mesmo dia — disponibilidade posterior vence ==========
DO $N$
DECLARE
  v_cc_a uuid; v_cc_b uuid; v_id uuid; v_cc uuid; v_origem text;
  v_esp text; v_obt text;
  v_ts_10 timestamptz := (CURRENT_DATE::timestamp + time '10:00') AT TIME ZONE 'America/Sao_Paulo';
  v_ts_16 timestamptz := (CURRENT_DATE::timestamp + time '16:00') AT TIME ZONE 'America/Sao_Paulo';
BEGIN
  SELECT valor_uuid INTO v_cc_a FROM _qa_ctx WHERE slot='cc_a';
  SELECT valor_uuid INTO v_cc_b FROM _qa_ctx WHERE slot='cc_b';

  INSERT INTO public.bd_caminhoes_equipamentos
    (frota, numero_frota, situacao, tipo_ativo)
  VALUES ('QA', pg_temp._qa_id('N'), 'Operando', 'equipamento')
  RETURNING id INTO v_id;

  -- apontamento 10h CC_A
  INSERT INTO public.bd_registro_apontamento_cam_equipa
    (caminhao_equipamento_id, centro_custo_id, data, hora_inicial, hora_final, situacao, created_at, updated_at)
  VALUES (v_id, v_cc_a, CURRENT_DATE, '10:00', '11:00', 'Operando', v_ts_10, v_ts_10);

  -- disponibilidade 16h CC_B
  INSERT INTO public.bd_disponibilidade_equipamentos
    (equipamento_id, status_operacional, centro_custo_id, data_inicio, observacao, created_at, updated_at)
  VALUES (v_id, 'ALOCADO', v_cc_b, CURRENT_DATE, 'QA-N tarde', v_ts_16, v_ts_16);

  SELECT centro_custo_atual_id, centro_custo_atual_origem INTO v_cc, v_origem
    FROM public.bd_caminhoes_equipamentos WHERE id = v_id;

  v_esp := 'cc=' || v_cc_b || '|origem=DISPONIBILIDADE';
  v_obt := 'cc=' || COALESCE(v_cc::text,'NULL') || '|origem=' || v_origem;
  PERFORM pg_temp._qa_add('N','apont_10h_CC_A','disp_16h_CC_B', v_esp, v_obt);
END
$N$;


-- ========== CASO O: mesmo dia — apontamento posterior vence ==========
DO $O$
DECLARE
  v_cc_a uuid; v_cc_b uuid; v_id uuid; v_cc uuid; v_origem text;
  v_esp text; v_obt text;
  v_ts_10 timestamptz := (CURRENT_DATE::timestamp + time '10:00') AT TIME ZONE 'America/Sao_Paulo';
  v_ts_16 timestamptz := (CURRENT_DATE::timestamp + time '16:00') AT TIME ZONE 'America/Sao_Paulo';
BEGIN
  SELECT valor_uuid INTO v_cc_a FROM _qa_ctx WHERE slot='cc_a';
  SELECT valor_uuid INTO v_cc_b FROM _qa_ctx WHERE slot='cc_b';

  INSERT INTO public.bd_caminhoes_equipamentos
    (frota, numero_frota, situacao, tipo_ativo)
  VALUES ('QA', pg_temp._qa_id('O'), 'Operando', 'equipamento')
  RETURNING id INTO v_id;

  INSERT INTO public.bd_disponibilidade_equipamentos
    (equipamento_id, status_operacional, centro_custo_id, data_inicio, observacao, created_at, updated_at)
  VALUES (v_id, 'ALOCADO', v_cc_a, CURRENT_DATE, 'QA-O manha', v_ts_10, v_ts_10);

  INSERT INTO public.bd_registro_apontamento_cam_equipa
    (caminhao_equipamento_id, centro_custo_id, data, hora_inicial, hora_final, situacao, created_at, updated_at)
  VALUES (v_id, v_cc_b, CURRENT_DATE, '16:00', '17:00', 'Operando', v_ts_16, v_ts_16);

  SELECT centro_custo_atual_id, centro_custo_atual_origem INTO v_cc, v_origem
    FROM public.bd_caminhoes_equipamentos WHERE id = v_id;

  v_esp := 'cc=' || v_cc_b || '|origem=APONTAMENTO_CE';
  v_obt := 'cc=' || COALESCE(v_cc::text,'NULL') || '|origem=' || v_origem;
  PERFORM pg_temp._qa_add('O','disp_10h_CC_A','apont_16h_CC_B', v_esp, v_obt);
END
$O$;

-- ========== CASO P: timestamp idêntico — desempate APONTAMENTO_CE (50) > DISPONIBILIDADE (30) ==========
DO $P$
DECLARE
  v_cc_a uuid; v_cc_b uuid; v_id uuid; v_cc uuid; v_origem text;
  v_esp text; v_obt text;
  v_ts timestamptz := (CURRENT_DATE::timestamp + time '12:00') AT TIME ZONE 'America/Sao_Paulo';
BEGIN
  SELECT valor_uuid INTO v_cc_a FROM _qa_ctx WHERE slot='cc_a';
  SELECT valor_uuid INTO v_cc_b FROM _qa_ctx WHERE slot='cc_b';

  INSERT INTO public.bd_caminhoes_equipamentos
    (frota, numero_frota, situacao, tipo_ativo)
  VALUES ('QA', pg_temp._qa_id('P'), 'Operando', 'equipamento')
  RETURNING id INTO v_id;

  -- 1º disponibilidade CC_A, timestamp comum
  INSERT INTO public.bd_disponibilidade_equipamentos
    (equipamento_id, status_operacional, centro_custo_id, data_inicio, observacao, created_at, updated_at)
  VALUES (v_id, 'ALOCADO', v_cc_a, CURRENT_DATE, 'QA-P disp', v_ts, v_ts);

  -- 2º apontamento CC_B, mesmo timestamp — desempate por prioridade (50 > 30)
  INSERT INTO public.bd_registro_apontamento_cam_equipa
    (caminhao_equipamento_id, centro_custo_id, data, hora_inicial, hora_final, situacao, created_at, updated_at)
  VALUES (v_id, v_cc_b, CURRENT_DATE, '12:00', '13:00', 'Operando', v_ts, v_ts);

  SELECT centro_custo_atual_id, centro_custo_atual_origem INTO v_cc, v_origem
    FROM public.bd_caminhoes_equipamentos WHERE id = v_id;

  v_esp := 'cc=' || v_cc_b || '|origem=APONTAMENTO_CE|atu=' || v_ts::text;
  v_obt := 'cc=' || COALESCE(v_cc::text,'NULL')
        || '|origem=' || COALESCE(v_origem,'NULL')
        || '|atu=' || (SELECT COALESCE(centro_custo_atualizado_em::text,'NULL')
                         FROM public.bd_caminhoes_equipamentos WHERE id = v_id);
  PERFORM pg_temp._qa_add('P','ts_identico','desempate 50>30 (projecao viva)', v_esp, v_obt);
END
$P$;


-- ========== CASO Q: edição irrelevante não altera nada ==========
DO $Q$
DECLARE
  v_cc_a uuid; v_id uuid; v_disp_id uuid;
  v_cc_pre uuid; v_ori_pre text; v_atu_pre timestamptz; v_por_pre uuid;
  v_cc_pos uuid; v_ori_pos text; v_atu_pos timestamptz; v_por_pos uuid;
  v_esp text; v_obt text;
BEGIN
  SELECT valor_uuid INTO v_cc_a FROM _qa_ctx WHERE slot='cc_a';

  INSERT INTO public.bd_caminhoes_equipamentos
    (frota, numero_frota, situacao, tipo_ativo, centro_custo_atual_id)
  VALUES ('QA', pg_temp._qa_id('Q'), 'Operando', 'equipamento', v_cc_a)
  RETURNING id INTO v_id;

  SELECT id INTO v_disp_id FROM public.bd_disponibilidade_equipamentos
   WHERE equipamento_id = v_id ORDER BY created_at DESC LIMIT 1;

  SELECT centro_custo_atual_id, centro_custo_atual_origem, centro_custo_atualizado_em, centro_custo_atualizado_por
    INTO v_cc_pre, v_ori_pre, v_atu_pre, v_por_pre
    FROM public.bd_caminhoes_equipamentos WHERE id = v_id;

  UPDATE public.bd_disponibilidade_equipamentos
     SET observacao = 'QA-Q edicao irrelevante'
   WHERE id = v_disp_id;

  SELECT centro_custo_atual_id, centro_custo_atual_origem, centro_custo_atualizado_em, centro_custo_atualizado_por
    INTO v_cc_pos, v_ori_pos, v_atu_pos, v_por_pos
    FROM public.bd_caminhoes_equipamentos WHERE id = v_id;

  v_esp := 'cc=eq|ori=eq|atu=eq|por=eq';
  v_obt := 'cc=' || CASE WHEN v_cc_pre  IS NOT DISTINCT FROM v_cc_pos  THEN 'eq' ELSE 'diff' END
        || '|ori=' || CASE WHEN v_ori_pre IS NOT DISTINCT FROM v_ori_pos THEN 'eq' ELSE 'diff' END
        || '|atu=' || CASE WHEN v_atu_pre IS NOT DISTINCT FROM v_atu_pos THEN 'eq' ELSE 'diff' END
        || '|por=' || CASE WHEN v_por_pre IS NOT DISTINCT FROM v_por_pos THEN 'eq' ELSE 'diff' END;
  PERFORM pg_temp._qa_add('Q','projecao_CC_A','UPDATE campo nao monitorado', v_esp, v_obt);
END
$Q$;

-- ========== CASO R: apontamento determinístico + localização real + RPC do mapa ==========
DO $R$
DECLARE
  v_cc_a uuid; v_id uuid; v_apont_id uuid;
  v_rpc_apont uuid; v_mapa jsonb;
  v_mapa_apont uuid; v_mapa_equip uuid; v_mapa_lat numeric; v_mapa_lng numeric;
  v_esp text; v_obt text;
BEGIN
  SELECT valor_uuid INTO v_cc_a FROM _qa_ctx WHERE slot='cc_a';

  INSERT INTO public.bd_caminhoes_equipamentos
    (frota, numero_frota, situacao, tipo_ativo)
  VALUES ('QA', pg_temp._qa_id('R'), 'Operando', 'equipamento')
  RETURNING id INTO v_id;

  INSERT INTO public.bd_registro_apontamento_cam_equipa
    (caminhao_equipamento_id, centro_custo_id, data, hora_inicial, hora_final, situacao)
  VALUES (v_id, v_cc_a, CURRENT_DATE, '08:00', '10:00', 'Operando')
  RETURNING id INTO v_apont_id;

  INSERT INTO public.bd_localizacao_equipamentos
    (equipamento_id, centro_custo_id, latitude, longitude, origem, data_registro, apontamento_id, precisao_gps)
  VALUES (v_id, v_cc_a, -19.9200, -43.9400, 'APONTAMENTO_CE', now(), v_apont_id, 15.0);

  SELECT ultimo_apontamento_id INTO v_rpc_apont
    FROM public.fn_veiculos_alocacao_atual(ARRAY[v_id]::uuid[])
   WHERE equipamento_id = v_id;

  -- RPC do mapa filtra por 'busca' (não aceita 'equipamento_ids')
  v_mapa := public.fn_mapa_operacional_ultimas_localizacoes(
              jsonb_build_object('busca', pg_temp._qa_id('R'))
            );

  SELECT (item->>'apontamento_id')::uuid,
         (item->>'equipamento_id')::uuid,
         NULLIF(item->>'latitude','')::numeric,
         NULLIF(item->>'longitude','')::numeric
    INTO v_mapa_apont, v_mapa_equip, v_mapa_lat, v_mapa_lng
    FROM jsonb_array_elements(COALESCE(v_mapa->'ativos', '[]'::jsonb)) AS item
   WHERE (item->>'equipamento_id')::uuid = v_id
   LIMIT 1;

  v_esp := 'rpc_apont=' || v_apont_id
        || '|mapa_apont=' || v_apont_id
        || '|mapa_equip=' || v_id
        || '|lat=-19.9200|lng=-43.9400';
  v_obt := 'rpc_apont=' || COALESCE(v_rpc_apont::text,'NULL')
        || '|mapa_apont=' || COALESCE(v_mapa_apont::text,'NULL')
        || '|mapa_equip=' || COALESCE(v_mapa_equip::text,'NULL')
        || '|lat=' || COALESCE(v_mapa_lat::text,'NULL')
        || '|lng=' || COALESCE(v_mapa_lng::text,'NULL');
  PERFORM pg_temp._qa_add('R','ativo sem eventos','apontamento + localizacao + RPC mapa (chave ativos)', v_esp, v_obt);
END
$R$;

-- ---------------------------------------------------------------------
-- (f) CONSOLIDAÇÃO + GUARDA DE CONTAGEM E FALHAS
-- ---------------------------------------------------------------------

SELECT * FROM _qa_res ORDER BY caso;

SELECT count(*)                                    AS total,
       count(*) FILTER (WHERE status = 'PASS')     AS pass,
       count(*) FILTER (WHERE status = 'FAIL')     AS fail
  FROM _qa_res;

DO $done$
DECLARE
  v_total integer;
  v_fail  integer;
BEGIN
  SELECT count(*),
         count(*) FILTER (WHERE status = 'FAIL')
    INTO v_total, v_fail
    FROM _qa_res;

  IF v_total <> 18 THEN
    RAISE EXCEPTION 'Suite incompleta: esperado 18 casos, obtido %', v_total;
  END IF;
  IF v_fail > 0 THEN
    RAISE EXCEPTION 'Suite A-R concluída com % falha(s)', v_fail;
  END IF;
END
$done$;


ROLLBACK;
