-- ============================================================================
-- ROLLBACK — Consolidacao de cadastro duplicado EZEQUIAS JOSE RUFINO
-- ============================================================================
-- Reverte a migration 20260901035505_merge_funcionario_duplicado_ezequias_jose_rufino
--
-- STATUS: PROPOSTA. **NAO APLICADA.**
--
-- Restaura exatamente o estado anterior:
--   1. devolve os 2 chamados internos ao registro duplicado
--   2. reativa o duplicado (status 'Ativo') e remove a marcacao de consolidacao
--   3. remove o registro de auditoria da consolidacao
--
-- Nada mais precisa ser revertido: a migration nao deletou nada,
-- nao alterou dados financeiros, nao alterou data_admissao,
-- nao alterou profiles nem bd_funcionarios_sensivel.
-- ============================================================================

DO $$
DECLARE
  v_canonical uuid := 'aeac500e-3219-437a-a9bf-b52425ff6388';
  v_duplicate uuid := '0746c95a-c9ba-4b9d-bf9e-75973ecf1815';
  v_cnt int;
BEGIN
  -- GUARD: o merge realmente foi aplicado?
  IF NOT EXISTS (
    SELECT 1 FROM public.bd_auditoria_log
     WHERE tabela='bd_funcionarios'
       AND dados_novos->>'acao'='MERGE_FUNCIONARIO'
       AND dados_novos->>'duplicate_id'=v_duplicate::text
  ) THEN
    RAISE EXCEPTION 'ROLLBACK: nao ha registro de merge para reverter';
  END IF;

  -- GUARD: os 2 chamados esperados estao no canonico?
  SELECT count(*) INTO v_cnt FROM public.bd_chamados_internos
   WHERE solicitante_funcionario_id = v_canonical
     AND protocolo IN ('CHI-2026-000092','CHI-2026-000097');
  IF v_cnt <> 2 THEN
    RAISE EXCEPTION 'ROLLBACK: esperados 2 chamados (CHI-2026-000092/000097) no canonico, encontrados %', v_cnt;
  END IF;

  -- 1. devolver os chamados ao duplicado (por protocolo — precisao maxima)
  UPDATE public.bd_chamados_internos
     SET solicitante_funcionario_id = v_duplicate
   WHERE protocolo IN ('CHI-2026-000092','CHI-2026-000097');

  -- 2. reativar o duplicado e remover a marcacao de consolidacao
  UPDATE public.bd_funcionarios
     SET status = 'Ativo',
         observacoes = nullif(
           regexp_replace(coalesce(observacoes,''),
             E'\\n?CONSOLIDADO em [0-9a-f-]+ \\(cadastro duplicado\\) — [0-9-]+', '', 'g'),
           '')
   WHERE id = v_duplicate;

  -- 3. remover o registro de auditoria da consolidacao
  DELETE FROM public.bd_auditoria_log
   WHERE tabela='bd_funcionarios'
     AND dados_novos->>'acao'='MERGE_FUNCIONARIO'
     AND dados_novos->>'duplicate_id'=v_duplicate::text;

  -- VALIDACAO
  SELECT count(*) INTO v_cnt FROM public.bd_chamados_internos
   WHERE solicitante_funcionario_id = v_duplicate;
  IF v_cnt <> 2 THEN RAISE EXCEPTION 'ROLLBACK POS: duplicado deveria ter 2 chamados, tem %', v_cnt; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.bd_funcionarios WHERE id=v_duplicate AND status='Ativo') THEN
    RAISE EXCEPTION 'ROLLBACK POS: duplicado nao voltou para Ativo';
  END IF;

  RAISE NOTICE 'ROLLBACK OK: estado anterior restaurado';
END $$;

-- ============================================================================
-- CONFERENCIA POS-ROLLBACK (read-only)
-- ============================================================================
-- select id, status,
--        (select count(*) from bd_chamados_internos ci where ci.solicitante_funcionario_id=f.id) as chamados,
--        right(coalesce(observacoes,''),60) as obs
-- from public.bd_funcionarios f
-- where id in ('aeac500e-3219-437a-a9bf-b52425ff6388','0746c95a-c9ba-4b9d-bf9e-75973ecf1815');
-- ESPERADO: canonico Ativo/0 chamados ; duplicado Ativo/2 chamados ; obs sem marcacao
-- ============================================================================
