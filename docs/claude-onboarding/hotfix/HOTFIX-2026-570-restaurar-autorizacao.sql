-- Restauracao da autorizacao — Solicitacao de Diarias 2026-570
--
-- CONTEXTO
--   A solicitacao 2026-570 (id f2a074e4-af1c-41a0-a6ee-23d23b5cd0d3) foi reprovada
--   integralmente em 29/08/2026 11:12 UTC. O valor correto e aprovado era R$ 744,00
--   (4 diarias de JOSUE B. M. DE OLIVEIRA, 25 a 28/08, R$150 diaria + R$36 refeicao).
--   O aditivo de 29/08 (adicionar_dia) foi CORRETAMENTE reprovado e permanece reprovado.
--   Consequencia do status: o filtro "N Solicitacao" da tela Relatorio/Folha lista
--   apenas solicitacoes 'autorizada' (src/pages/DiariasRelatorio.tsx:273), de modo que
--   a 2026-570 nao podia ser selecionada. Os dados nunca foram perdidos.
--
-- ESCOPO
--   Altera EXCLUSIVAMENTE bd_diaria_solicitacoes.status de 'reprovada' para 'autorizada'
--   no UUID exato. Nao altera aditivo, presencas, apontamentos, convocados_pre,
--   autorizado_por, autorizado_em nem qualquer outra solicitacao.
--   updated_at e alterado automaticamente pelo trigger update_updated_at_column.
--
-- TRIGGERS VERIFICADOS ANTES DA EXECUCAO (todos passam; ver guards abaixo)
--   check_solicitacao_periodo_overlap   BEFORE — reativa ao sair de 'reprovada'; 0 conflitos
--   check_convocados_pre_duplicidade    BEFORE — delta-check: OLD=NEW, nenhuma data nova
--   fn_criar_apontamento_apos_aprovacao AFTER  — ON CONFLICT (solicitacao_id) DO NOTHING
--   trg_diaria_notificar_aprovador      AFTER  — so dispara para status='enviada'; nao dispara
--   _mark_mv_relatorio_diarias_dirty    AFTER  — marca a MV para refresh (desejado)
--   fn_auditoria_log                    AFTER  — auditoria automatica
--
-- Rollback: docs/claude-onboarding/hotfix/ROLLBACK-2026-570.sql

DO $$
DECLARE
  v_sol        uuid := 'f2a074e4-af1c-41a0-a6ee-23d23b5cd0d3';
  v_status_old text;
  v_cnt        int;
  v_total      numeric;
  v_snap       jsonb;
  v_upd        int;
BEGIN
  ---------------------------------------------------------------- GUARDS
  SELECT status INTO v_status_old
    FROM public.bd_diaria_solicitacoes WHERE id = v_sol;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GUARD: solicitacao % nao encontrada', v_sol;
  END IF;

  -- Defesa dupla: UUID + numero. Nunca operar por numero ou nome isoladamente.
  IF NOT EXISTS (
    SELECT 1 FROM public.bd_diaria_solicitacoes
     WHERE id = v_sol AND numero_solicitacao = '2026-570'
  ) THEN
    RAISE EXCEPTION 'GUARD: numero_solicitacao nao confere com o UUID alvo';
  END IF;

  IF v_status_old <> 'reprovada' THEN
    RAISE EXCEPTION 'GUARD: status atual e "%" — esperado "reprovada"', v_status_old;
  END IF;

  -- Presencas intactas ANTES (o objetivo e preserva-las integralmente)
  SELECT count(*), COALESCE(sum(valor_diaria_aplicada + COALESCE(valor_refeicao_aplicado,0)),0)
    INTO v_cnt, v_total
    FROM public.bd_diaria_presencas WHERE solicitacao_id = v_sol;
  IF v_cnt <> 4 THEN
    RAISE EXCEPTION 'GUARD: esperadas 4 presencas, encontradas %', v_cnt;
  END IF;
  IF v_total <> 744.00 THEN
    RAISE EXCEPTION 'GUARD: total esperado 744.00, encontrado %', v_total;
  END IF;

  -- O aditivo deve permanecer reprovado — nao faz parte do escopo
  SELECT count(*) INTO v_cnt
    FROM public.bd_diaria_aditivos
   WHERE solicitacao_id = v_sol AND status = 'reprovado';
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION 'GUARD: esperado 1 aditivo reprovado, encontrados %', v_cnt;
  END IF;

  -- Pre-checagem do trigger BEFORE de sobreposicao (fica ativo ao sair de 'reprovada')
  SELECT count(*) INTO v_cnt
    FROM public.bd_diaria_solicitacoes s, public.bd_diaria_solicitacoes a
   WHERE a.id = v_sol
     AND s.centro_custo_id = a.centro_custo_id
     AND s.id <> a.id
     AND s.status NOT IN ('cancelado','reprovada','cancelada')
     AND daterange(s.data_inicio, s.data_fim, '[]')
         && daterange(a.data_inicio, a.data_fim, '[]');
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'GUARD: % solicitacao(oes) sobrepoem o periodo no mesmo CC — abortando', v_cnt;
  END IF;

  ---------------------------------------------------------------- LOCK
  PERFORM 1 FROM public.bd_diaria_solicitacoes WHERE id = v_sol FOR UPDATE;

  -------------------------------------------------------------- SNAPSHOT
  SELECT to_jsonb(s) INTO v_snap
    FROM public.bd_diaria_solicitacoes s WHERE s.id = v_sol;

  IF v_snap IS NULL THEN
    RAISE EXCEPTION 'GUARD: snapshot vazio — rollback confiavel impossivel';
  END IF;

  INSERT INTO public.bd_auditoria_log
    (tabela, operacao, registro_id, usuario_id, campos_alterados, dados_anteriores, dados_novos)
  VALUES
    ('bd_diaria_solicitacoes','UPDATE', v_sol::text, auth.uid(),
     ARRAY['status'],
     jsonb_build_object('bd_diaria_solicitacoes', v_snap),
     jsonb_build_object(
       'acao','RESTAURAR_AUTORIZACAO_SOLICITACAO',
       'solicitacao_id', v_sol::text,
       'numero_solicitacao','2026-570',
       'status_anterior', v_status_old,
       'status_novo','autorizada',
       'motivo','Reprovacao integral indevida em 29/08/2026. O valor aprovado correto '
              ||'(R$ 744,00 — 4 diarias de 25 a 28/08) permanecia integro em '
              ||'bd_diaria_presencas, mas o status impedia a selecao no filtro do '
              ||'Relatorio/Folha, que lista apenas solicitacoes autorizadas.',
       'presencas_preservadas', 4,
       'valor_preservado', 744.00,
       'aditivo','mantido reprovado — fora de escopo',
       'nao_alterado', jsonb_build_array(
         'bd_diaria_presencas','bd_diaria_apontamentos','bd_diaria_aditivos',
         'convocados_pre','autorizado_por','autorizado_em'),
       'origem_execucao','migration administrativa (service_role); auth.uid() pode ser nulo'
     ));

  ---------------------------------------------------------------- UPDATE
  UPDATE public.bd_diaria_solicitacoes
     SET status = 'autorizada'
   WHERE id = v_sol
     AND status = 'reprovada';
  GET DIAGNOSTICS v_upd = ROW_COUNT;
  IF v_upd <> 1 THEN
    RAISE EXCEPTION 'POS: esperada 1 linha atualizada, foram %', v_upd;
  END IF;

  ------------------------------------------------------- VALIDACAO FINAL
  IF NOT EXISTS (
    SELECT 1 FROM public.bd_diaria_solicitacoes
     WHERE id = v_sol AND status = 'autorizada'
  ) THEN
    RAISE EXCEPTION 'POS: status nao ficou autorizada';
  END IF;

  -- Presencas e valor DEVEM permanecer identicos
  SELECT count(*), COALESCE(sum(valor_diaria_aplicada + COALESCE(valor_refeicao_aplicado,0)),0)
    INTO v_cnt, v_total
    FROM public.bd_diaria_presencas WHERE solicitacao_id = v_sol;
  IF v_cnt <> 4 THEN
    RAISE EXCEPTION 'POS: presencas alteradas — esperadas 4, encontradas %', v_cnt;
  END IF;
  IF v_total <> 744.00 THEN
    RAISE EXCEPTION 'POS: valor alterado — esperado 744.00, encontrado %', v_total;
  END IF;

  -- Aditivo intocado
  IF NOT EXISTS (
    SELECT 1 FROM public.bd_diaria_aditivos
     WHERE solicitacao_id = v_sol AND status = 'reprovado'
  ) THEN
    RAISE EXCEPTION 'POS: aditivo deixou de estar reprovado';
  END IF;

  RAISE NOTICE 'OK: 2026-570 restaurada para autorizada; 4 presencas / R$ 744,00 preservadas';
END $$;
