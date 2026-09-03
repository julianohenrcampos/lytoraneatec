-- ============================================================================
-- ROLLBACK — Finalizacao da consolidacao EZEQUIAS JOSE RUFINO
-- Reverte a migration 20260901040949_finalizar_consolidacao_ezequias_jose_rufino
-- ============================================================================
-- STATUS: PROPOSTA. **NAO APLICADA.**
--
-- Restaura o registro duplicado 0746c95a-c9ba-4b9d-bf9e-75973ecf1815
-- EXATAMENTE como estava, a partir do snapshot completo gravado em
-- bd_auditoria_log.dados_anteriores antes do DELETE.
--
-- O snapshot contem as duas linhas integrais:
--   dados_anteriores->'bd_funcionarios'
--   dados_anteriores->'bd_funcionarios_sensivel'
--
-- Confirmado antes do DELETE: snapshot_completo_para_rollback = true
--
-- ATENCAO: este rollback restaura o estado POSTERIOR a primeira migration
-- (duplicado existente e Inativo, com os 2 chamados ja no canonico).
-- Para reverter tambem a primeira migration, aplicar em seguida
-- ROLLBACK-MERGE-EZEQUIAS.sql.
-- ============================================================================

DO $$
DECLARE
  v_canonical uuid := 'aeac500e-3219-437a-a9bf-b52425ff6388';
  v_duplicate uuid := '0746c95a-c9ba-4b9d-bf9e-75973ecf1815';
  v_snap  jsonb;
  v_f     jsonb;
  v_s     jsonb;
  v_cnt   int;
BEGIN
  -- GUARD: o duplicado nao pode existir (senao nao ha o que restaurar)
  IF EXISTS (SELECT 1 FROM public.bd_funcionarios WHERE id = v_duplicate) THEN
    RAISE EXCEPTION 'ROLLBACK: duplicado ja existe — nada a restaurar';
  END IF;

  -- GUARD: localizar o snapshot
  SELECT dados_anteriores INTO v_snap
    FROM public.bd_auditoria_log
   WHERE dados_novos->>'acao' = 'CONSOLIDACAO_FUNCIONARIO_DUPLICADO'
     AND dados_novos->>'duplicate_id' = v_duplicate::text
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_snap IS NULL THEN
    RAISE EXCEPTION 'ROLLBACK: snapshot da consolidacao nao encontrado';
  END IF;

  v_f := v_snap->'bd_funcionarios';
  v_s := v_snap->'bd_funcionarios_sensivel';

  IF v_f IS NULL OR v_s IS NULL THEN
    RAISE EXCEPTION 'ROLLBACK: snapshot incompleto — restauracao confiavel impossivel';
  END IF;

  -- GUARD: o CPF do duplicado nao pode ter sido reutilizado por outro registro
  IF EXISTS (
    SELECT 1 FROM public.bd_funcionarios
     WHERE btrim(cpf) = btrim(v_f->>'cpf') AND id <> v_duplicate
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: o CPF do duplicado foi reutilizado por outro funcionario — abortando';
  END IF;

  -- 1. restaurar bd_funcionarios a partir do snapshot (todas as colunas)
  INSERT INTO public.bd_funcionarios
  SELECT * FROM jsonb_populate_record(null::public.bd_funcionarios, v_f);

  -- 2. restaurar bd_funcionarios_sensivel
  INSERT INTO public.bd_funcionarios_sensivel
  SELECT * FROM jsonb_populate_record(null::public.bd_funcionarios_sensivel, v_s);

  -- 3. remover o registro de auditoria da consolidacao
  DELETE FROM public.bd_auditoria_log
   WHERE dados_novos->>'acao' = 'CONSOLIDACAO_FUNCIONARIO_DUPLICADO'
     AND dados_novos->>'duplicate_id' = v_duplicate::text;

  -- VALIDACAO
  SELECT count(*) INTO v_cnt FROM public.bd_funcionarios WHERE id = v_duplicate;
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'ROLLBACK POS: duplicado nao restaurado'; END IF;

  SELECT count(*) INTO v_cnt FROM public.bd_funcionarios_sensivel WHERE funcionario_id = v_duplicate;
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'ROLLBACK POS: registro sensivel nao restaurado'; END IF;

  SELECT count(*) INTO v_cnt FROM public.bd_funcionarios
   WHERE upper(public.normalize_text(nome_completo)) LIKE '%EZEQUIAS%'
     AND upper(public.normalize_text(nome_completo)) LIKE '%RUFINO%';
  IF v_cnt <> 2 THEN RAISE EXCEPTION 'ROLLBACK POS: esperados 2 Ezequias, encontrados %', v_cnt; END IF;

  RAISE NOTICE 'ROLLBACK OK: duplicado % restaurado a partir do snapshot', v_duplicate;
END $$;

-- ============================================================================
-- CONFERENCIA POS-ROLLBACK (read-only)
-- ============================================================================
-- select id, status, data_admissao,
--        (length(regexp_replace(coalesce(cpf,''),'[^0-9]','','g'))) as cpf_digitos,
--        (select count(*) from bd_funcionarios_sensivel s where s.funcionario_id=f.id) as sensivel
-- from public.bd_funcionarios f
-- where upper(public.normalize_text(nome_completo)) like '%EZEQUIAS%'
--   and upper(public.normalize_text(nome_completo)) like '%RUFINO%';
-- ESPERADO: 2 linhas — canonico (11 dig, Ativo) e duplicado (10 dig, Inativo), ambos com 1 sensivel
-- ============================================================================
