-- Consolidacao de cadastro duplicado — EZEQUIAS JOSE RUFINO
-- Aplicada em 2026-09-01 03:55:05 UTC
--
-- CANONICAL: aeac500e-3219-437a-a9bf-b52425ff6388 (CPF 11 digitos, possui profile/auth/role)
-- DUPLICATE: 0746c95a-c9ba-4b9d-bf9e-75973ecf1815 (CPF 10 digitos malformado, sem login)
--
-- Escopo: migra 2 chamados internos, inativa e marca o duplicado, registra auditoria.
-- NAO deleta. NAO altera dados financeiros/bancarios. NAO altera data_admissao.
-- NAO altera nenhum outro funcionario.
--
-- Auditoria de referencia: docs/claude-onboarding/23-MERGE-FUNCIONARIO-DUPLICADO-EZEQUIAS.md
-- Rollback: docs/claude-onboarding/hotfix/ROLLBACK-MERGE-EZEQUIAS.sql

DO $$
DECLARE
  v_canonical uuid := 'aeac500e-3219-437a-a9bf-b52425ff6388';
  v_duplicate uuid := '0746c95a-c9ba-4b9d-bf9e-75973ecf1815';
  v_cnt   int;
  v_moved int;
BEGIN
  ---------------------------------------------------------------- GUARDS
  IF NOT EXISTS (SELECT 1 FROM public.bd_funcionarios WHERE id = v_canonical) THEN
    RAISE EXCEPTION 'GUARD: CANONICAL_ID nao existe';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bd_funcionarios WHERE id = v_duplicate) THEN
    RAISE EXCEPTION 'GUARD: DUPLICATE_ID nao existe';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.bd_funcionarios
     WHERE id = v_canonical
       AND right(regexp_replace(coalesce(cpf,''),'[^0-9]','','g'),2) = '18'
       AND length(regexp_replace(coalesce(cpf,''),'[^0-9]','','g')) = 11
  ) THEN
    RAISE EXCEPTION 'GUARD: CPF do CANONICAL_ID nao confere (esperado 11 digitos terminando em 18)';
  END IF;

  SELECT count(*) INTO v_cnt FROM public.bd_funcionarios
   WHERE upper(public.normalize_text(nome_completo)) LIKE '%EZEQUIAS%'
     AND upper(public.normalize_text(nome_completo)) LIKE '%RUFINO%';
  IF v_cnt <> 2 THEN
    RAISE EXCEPTION 'GUARD: esperados 2 registros Ezequias, encontrados %', v_cnt;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bd_auditoria_log
     WHERE tabela = 'bd_funcionarios'
       AND dados_novos->>'acao' = 'MERGE_FUNCIONARIO'
       AND dados_novos->>'duplicate_id' = v_duplicate::text
  ) THEN
    RAISE EXCEPTION 'GUARD: merge ja executado anteriormente para este duplicado';
  END IF;

  SELECT count(*) INTO v_cnt FROM public.bd_chamados_internos
   WHERE solicitante_funcionario_id = v_duplicate;
  IF v_cnt <> 2 THEN
    RAISE EXCEPTION 'GUARD: esperados 2 chamados internos no duplicado, encontrados %', v_cnt;
  END IF;

  SELECT count(*) INTO v_cnt FROM public.profiles WHERE funcionario_id = v_duplicate;
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'GUARD: DUPLICATE_ID passou a ter profile vinculado (%)', v_cnt;
  END IF;

  SELECT count(*) INTO v_cnt FROM public.profiles WHERE funcionario_id = v_canonical;
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION 'GUARD: CANONICAL_ID deveria ter 1 profile, tem %', v_cnt;
  END IF;

  SELECT count(*) INTO v_cnt FROM public.bd_funcionarios_sensivel
   WHERE funcionario_id IN (v_canonical, v_duplicate);
  IF v_cnt <> 2 THEN
    RAISE EXCEPTION 'GUARD: bd_funcionarios_sensivel fora do esperado (%)', v_cnt;
  END IF;

  ---------------------------------------------------------------- LOCK
  PERFORM 1 FROM public.bd_funcionarios
   WHERE id IN (v_canonical, v_duplicate) FOR UPDATE;

  ---------------------------------------------- 1. MIGRAR REFERENCIAS
  UPDATE public.bd_chamados_internos
     SET solicitante_funcionario_id = v_canonical
   WHERE solicitante_funcionario_id = v_duplicate;
  GET DIAGNOSTICS v_moved = ROW_COUNT;
  IF v_moved <> 2 THEN
    RAISE EXCEPTION 'GUARD: esperava migrar 2 chamados, migrou %', v_moved;
  END IF;

  ------------------------------------- 2. INATIVAR E MARCAR DUPLICADO
  UPDATE public.bd_funcionarios
     SET status = 'Inativo',
         observacoes = concat_ws(E'\n', observacoes,
           'CONSOLIDADO em ' || v_canonical::text ||
           ' (cadastro duplicado) — ' || to_char(now(),'YYYY-MM-DD'))
   WHERE id = v_duplicate;

  ---------------------------------------------------- 3. AUDITORIA
  INSERT INTO public.bd_auditoria_log
    (tabela, operacao, registro_id, usuario_id, campos_alterados, dados_novos)
  VALUES
    ('bd_funcionarios','UPDATE', v_duplicate::text, auth.uid(),
     ARRAY['consolidacao_duplicado'],
     jsonb_build_object(
       'acao','MERGE_FUNCIONARIO',
       'duplicate_id', v_duplicate::text,
       'canonical_id', v_canonical::text,
       'motivo','Consolidacao de cadastro duplicado — Ezequias Jose Rufino',
       'referencias_migradas', jsonb_build_object('bd_chamados_internos', v_moved),
       'destino_duplicado','inativado_e_marcado',
       'nao_alterado', jsonb_build_array('data_admissao','banco','chave_pix','salario_base','centro_custo_id'),
       'origem_execucao','migration administrativa (service_role); auth.uid() pode ser nulo'
     ));

  ------------------------------------------------ VALIDACAO FINAL
  SELECT count(*) INTO v_cnt FROM public.bd_chamados_internos
   WHERE solicitante_funcionario_id = v_duplicate;
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'POS: restam % chamados no duplicado', v_cnt; END IF;

  SELECT count(*) INTO v_cnt FROM public.bd_chamados_internos
   WHERE solicitante_funcionario_id = v_canonical;
  IF v_cnt <> 2 THEN RAISE EXCEPTION 'POS: canonico deveria ter 2 chamados, tem %', v_cnt; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.bd_funcionarios
     WHERE id = v_canonical AND status = 'Ativo'
       AND right(regexp_replace(coalesce(cpf,''),'[^0-9]','','g'),2) = '18'
       AND length(regexp_replace(coalesce(cpf,''),'[^0-9]','','g')) = 11
  ) THEN
    RAISE EXCEPTION 'POS: canonico alterado indevidamente';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.bd_funcionarios WHERE id = v_duplicate AND status = 'Inativo') THEN
    RAISE EXCEPTION 'POS: duplicado nao foi inativado';
  END IF;

  RAISE NOTICE 'MERGE OK: % chamados migrados; duplicado % inativado', v_moved, v_duplicate;
END $$;
