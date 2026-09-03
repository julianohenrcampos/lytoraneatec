-- ============================================================================
-- ROLLBACK — Restauracao da autorizacao da Solicitacao 2026-570
-- Reverte a migration 20260902120000_restaurar_autorizacao_solicitacao_2026_570
-- ============================================================================
-- STATUS: PROPOSTA. **NAO APLICADA.**
--
-- Devolve bd_diaria_solicitacoes.status para 'reprovada' no UUID exato,
-- a partir do snapshot gravado em bd_auditoria_log.dados_anteriores.
--
-- Nada mais precisa ser revertido: a migration alterou UM unico campo.
-- Nao houve DELETE, nao houve INSERT em presencas/apontamentos/aditivos.
-- O apontamento pre-existente nao foi criado pela migration (o trigger
-- fn_criar_apontamento_apos_aprovacao caiu em ON CONFLICT DO NOTHING).
--
-- ATENCAO: apos o rollback a 2026-570 volta a NAO aparecer no filtro
-- "N Solicitacao" da tela Relatorio/Folha — que e exatamente o sintoma original.
-- As 4 presencas e os R$ 744,00 permanecem intactos em ambos os estados.
-- ============================================================================

DO $$
DECLARE
  v_sol     uuid := 'f2a074e4-af1c-41a0-a6ee-23d23b5cd0d3';
  v_snap    jsonb;
  v_status  text;
  v_cnt     int;
  v_total   numeric;
  v_upd     int;
BEGIN
  -- GUARD: a migration foi aplicada?
  SELECT dados_anteriores->'bd_diaria_solicitacoes' INTO v_snap
    FROM public.bd_auditoria_log
   WHERE tabela = 'bd_diaria_solicitacoes'
     AND dados_novos->>'acao' = 'RESTAURAR_AUTORIZACAO_SOLICITACAO'
     AND dados_novos->>'solicitacao_id' = v_sol::text
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_snap IS NULL THEN
    RAISE EXCEPTION 'ROLLBACK: registro de auditoria da restauracao nao encontrado';
  END IF;

  -- GUARD: estado atual precisa ser o produzido pela migration
  SELECT status INTO v_status
    FROM public.bd_diaria_solicitacoes WHERE id = v_sol;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ROLLBACK: solicitacao % nao encontrada', v_sol;
  END IF;
  IF v_status <> 'autorizada' THEN
    RAISE EXCEPTION 'ROLLBACK: status atual e "%" — esperado "autorizada"', v_status;
  END IF;

  -- GUARD: o snapshot precisa confirmar que o estado anterior era 'reprovada'
  IF COALESCE(v_snap->>'status','') <> 'reprovada' THEN
    RAISE EXCEPTION 'ROLLBACK: snapshot indica status anterior "%" — abortando',
      COALESCE(v_snap->>'status','<nulo>');
  END IF;

  -- GUARD: presencas precisam estar intactas antes de mexer
  SELECT count(*), COALESCE(sum(valor_diaria_aplicada + COALESCE(valor_refeicao_aplicado,0)),0)
    INTO v_cnt, v_total
    FROM public.bd_diaria_presencas WHERE solicitacao_id = v_sol;
  IF v_cnt <> 4 OR v_total <> 744.00 THEN
    RAISE EXCEPTION 'ROLLBACK: presencas divergentes (% linhas / %) — abortando', v_cnt, v_total;
  END IF;

  PERFORM 1 FROM public.bd_diaria_solicitacoes WHERE id = v_sol FOR UPDATE;

  -- 1. devolver o status
  UPDATE public.bd_diaria_solicitacoes
     SET status = 'reprovada'
   WHERE id = v_sol AND status = 'autorizada';
  GET DIAGNOSTICS v_upd = ROW_COUNT;
  IF v_upd <> 1 THEN
    RAISE EXCEPTION 'ROLLBACK: esperada 1 linha atualizada, foram %', v_upd;
  END IF;

  -- 2. remover o registro de auditoria da restauracao
  DELETE FROM public.bd_auditoria_log
   WHERE tabela = 'bd_diaria_solicitacoes'
     AND dados_novos->>'acao' = 'RESTAURAR_AUTORIZACAO_SOLICITACAO'
     AND dados_novos->>'solicitacao_id' = v_sol::text;

  -- VALIDACAO
  IF NOT EXISTS (
    SELECT 1 FROM public.bd_diaria_solicitacoes WHERE id = v_sol AND status = 'reprovada'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK POS: status nao voltou para reprovada';
  END IF;

  SELECT count(*), COALESCE(sum(valor_diaria_aplicada + COALESCE(valor_refeicao_aplicado,0)),0)
    INTO v_cnt, v_total
    FROM public.bd_diaria_presencas WHERE solicitacao_id = v_sol;
  IF v_cnt <> 4 OR v_total <> 744.00 THEN
    RAISE EXCEPTION 'ROLLBACK POS: presencas alteradas (% linhas / %)', v_cnt, v_total;
  END IF;

  RAISE NOTICE 'ROLLBACK OK: 2026-570 de volta a reprovada; 4 presencas / R$ 744,00 preservadas';
END $$;

-- ============================================================================
-- CONFERENCIA POS-ROLLBACK (read-only)
-- ============================================================================
-- select numero_solicitacao, status,
--        (select count(*) from bd_diaria_presencas p where p.solicitacao_id = s.id) as presencas,
--        (select sum(valor_diaria_aplicada + coalesce(valor_refeicao_aplicado,0))
--           from bd_diaria_presencas p where p.solicitacao_id = s.id) as total
--   from public.bd_diaria_solicitacoes s
--  where s.id = 'f2a074e4-af1c-41a0-a6ee-23d23b5cd0d3';
-- ESPERADO: 2026-570 | reprovada | 4 | 744.00
-- ============================================================================
