-- FINALIZACAO da consolidacao de cadastro duplicado — EZEQUIAS JOSE RUFINO
-- Aplicada em 2026-09-01 04:09:49 UTC
-- Continuacao incremental de 20260901035505_merge_funcionario_duplicado_ezequias_jose_rufino
--
-- CANONICAL: aeac500e-3219-437a-a9bf-b52425ff6388  (permanece, unico)
-- DUPLICATE: 0746c95a-c9ba-4b9d-bf9e-75973ecf1815  (removido fisicamente)
--
-- NAO reexecuta o merge anterior. NAO altera frontend/RLS/policies/Auth/RBAC.
-- NAO altera data_admissao (evidencia INCONCLUSIVA — ver docs 23).
-- NAO sobrescreve campos financeiros divergentes — registrados no snapshot.
--
-- Passo 7: bd_auditoria_log possui CHECK em operacao que NAO permite
-- 'CONSOLIDACAO_FUNCIONARIO_DUPLICADO'. A constraint NAO foi alterada.
-- Usada a operacao existente apropriada 'DELETE', com marcador semantico
-- em dados_novos->>'acao'.
--
-- Rollback: docs/claude-onboarding/hotfix/ROLLBACK-FINALIZACAO-EZEQUIAS.sql
-- Auditoria: docs/claude-onboarding/23-MERGE-FUNCIONARIO-DUPLICADO-EZEQUIAS.md

DO $$
DECLARE
  v_canonical uuid := 'aeac500e-3219-437a-a9bf-b52425ff6388';
  v_duplicate uuid := '0746c95a-c9ba-4b9d-bf9e-75973ecf1815';
  v_cnt      int;
  v_del      int;
  v_snap_f   jsonb;
  v_snap_s   jsonb;
BEGIN
  ------------------------------------------------------------------ GUARDS
  IF NOT EXISTS (SELECT 1 FROM public.bd_funcionarios WHERE id = v_canonical) THEN
    RAISE EXCEPTION 'GUARD: CANONICAL_ID nao existe';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bd_funcionarios WHERE id = v_duplicate) THEN
    RAISE EXCEPTION 'GUARD: DUPLICATE_ID nao existe (finalizacao ja executada?)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.bd_funcionarios
     WHERE id = v_canonical AND status = 'Ativo'
       AND right(regexp_replace(coalesce(cpf,''),'[^0-9]','','g'),2) = '18'
       AND length(regexp_replace(coalesce(cpf,''),'[^0-9]','','g')) = 11
  ) THEN
    RAISE EXCEPTION 'GUARD: canonico nao esta Ativo com CPF de 11 digitos terminando em 18';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.bd_funcionarios WHERE id = v_duplicate AND status = 'Inativo') THEN
    RAISE EXCEPTION 'GUARD: duplicado nao esta Inativo — estado inesperado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.bd_auditoria_log
     WHERE dados_novos->>'acao' = 'MERGE_FUNCIONARIO'
       AND dados_novos->>'duplicate_id' = v_duplicate::text
  ) THEN
    RAISE EXCEPTION 'GUARD: migration anterior de merge nao encontrada — estado inesperado';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bd_auditoria_log
     WHERE dados_novos->>'acao' = 'CONSOLIDACAO_FUNCIONARIO_DUPLICADO'
       AND dados_novos->>'duplicate_id' = v_duplicate::text
  ) THEN
    RAISE EXCEPTION 'GUARD: finalizacao ja executada anteriormente';
  END IF;

  SELECT count(*) INTO v_cnt FROM public.bd_funcionarios
   WHERE upper(public.normalize_text(nome_completo)) LIKE '%EZEQUIAS%'
     AND upper(public.normalize_text(nome_completo)) LIKE '%RUFINO%';
  IF v_cnt <> 2 THEN
    RAISE EXCEPTION 'GUARD: esperados 2 registros Ezequias, encontrados %', v_cnt;
  END IF;

  ------------------------- GUARD: referencias FK ON DELETE CASCADE = 0
  SELECT
    (SELECT count(*) FROM public.bd_aprovacoes_inclusao_funcionario WHERE funcionario_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_auditoria_biometria              WHERE funcionario_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_auditoria_leitura_funcionario_sensivel WHERE funcionario_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_desligamentos                    WHERE funcionario_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_diaria_presencas                 WHERE funcionario_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_funcionario_status_historico     WHERE funcionario_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_funcionarios_biometria_facial    WHERE funcionario_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_historico_funcional              WHERE funcionario_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_ponto_vinculos_operacionais      WHERE funcionario_id=v_duplicate)
  INTO v_cnt;
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'GUARD: % referencias ON DELETE CASCADE ainda existem — DELETE apagaria dados', v_cnt;
  END IF;

  ------------------------- GUARD: referencias FK ON DELETE SET NULL = 0
  SELECT
    (SELECT count(*) FROM public.bd_centros_custo WHERE adm_obra_funcionario_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_centros_custo WHERE adm_sede_funcionario_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_centros_custo WHERE aprovador_diarias_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_centros_custo WHERE engenheiro_responsavel_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_equipes WHERE apontador_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_equipes WHERE encarregado_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_ordens_diarias_obra WHERE responsavel_funcionario_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_ordens_diarias_obra_itens WHERE responsavel_item_funcionario_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_solicitacao_desligamento_itens WHERE funcionario_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_solicitacao_transferencia_itens WHERE funcionario_id=v_duplicate)
  INTO v_cnt;
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'GUARD: % referencias ON DELETE SET NULL ainda existem — DELETE anularia dados', v_cnt;
  END IF;

  ------------------------- GUARD: referencias FK RESTRICT/NO ACTION = 0
  SELECT
    (SELECT count(*) FROM public.bd_chamados_internos WHERE solicitante_funcionario_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_atestados_medicos WHERE funcionario_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_diaria_aditivos WHERE funcionario_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_ponto_ajustes WHERE funcionario_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_ponto_batidas WHERE funcionario_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_funcionario_classificacao_solicitacoes WHERE funcionario_id=v_duplicate)
  + (SELECT count(*) FROM public.profiles WHERE funcionario_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_apontamento_equipe WHERE colaborador_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_apontamento_equipe WHERE registrado_por=v_duplicate)
  + (SELECT count(*) FROM public.bd_arquivo_morto WHERE funcionario_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_avaliacao_equipe WHERE colaborador_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_chamados_os WHERE solicitante_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_ct_puxada_caminhoes WHERE motorista_funcionario_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_ct_viagem_paradas WHERE recebedor_previsto_funcionario_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_ct_viagens WHERE motorista_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_ct_viagens WHERE recebedor_previsto_funcionario_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_diaria_apontamentos WHERE responsavel_campo_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_diaria_excecao_solicitacoes WHERE funcionario_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_diaria_solicitacoes WHERE engenheiro_solicitante_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_diaria_solicitacoes WHERE responsavel_campo_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_diretorias WHERE diretor_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_lista_programacao_entrega WHERE apontador_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_log_comunicacao WHERE funcionario_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_ordens_servico WHERE mecanico_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_planejamento_atividade_equipe WHERE funcionario_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_ponto_diaria_integracao WHERE funcionario_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_registro_apontamento_cam_equipa WHERE operador_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_requisicoes WHERE engenheiro_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_sso_ver_agir WHERE engenheiro_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_sso_ver_agir WHERE tecnico_seguranca_id=v_duplicate)
  INTO v_cnt;
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'GUARD: % referencias RESTRICT/NO ACTION ainda existem', v_cnt;
  END IF;

  ------------------------- GUARD: referencias sem FK = 0
  SELECT
    (SELECT count(*) FROM public.bd_atestados_nonces_utilizados WHERE funcionario_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_auditoria_sync_equipe_funcionario WHERE funcionario_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_ct_checklists WHERE realizado_por_funcionario_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_ct_recebimentos WHERE recebedor_previsto_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_ct_recebimentos WHERE recebedor_real_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_diaria_lote_funcionarios WHERE funcionario_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_movimentacao_transporte WHERE motorista_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_ordens_diarias_obra_apontamentos WHERE registrado_por_funcionario_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_ponto_match_log WHERE funcionario_confirmado_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_ponto_match_log WHERE top1_funcionario_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_ponto_match_log WHERE top2_funcionario_id=v_duplicate)
  + (SELECT count(*) FROM public.bd_ponto_relatorio_auditoria WHERE funcionario_id=v_duplicate)
  INTO v_cnt;
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'GUARD: % referencias SEM FK ainda existem', v_cnt;
  END IF;

  ------------------------- GUARD: sensivel — 1 no duplicado e 1 no canonico
  SELECT count(*) INTO v_cnt FROM public.bd_funcionarios_sensivel WHERE funcionario_id=v_duplicate;
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'GUARD: bd_funcionarios_sensivel do duplicado = % (esperado 1)', v_cnt; END IF;
  SELECT count(*) INTO v_cnt FROM public.bd_funcionarios_sensivel WHERE funcionario_id=v_canonical;
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'GUARD: bd_funcionarios_sensivel do canonico = % (esperado 1)', v_cnt; END IF;

  ---------------------------------------------------------------- LOCK
  PERFORM 1 FROM public.bd_funcionarios WHERE id IN (v_canonical, v_duplicate) FOR UPDATE;

  ------------------- PASSO 7: SNAPSHOT COMPLETO ANTES DO DELETE
  SELECT to_jsonb(f) INTO v_snap_f FROM public.bd_funcionarios f WHERE f.id = v_duplicate;
  SELECT to_jsonb(s) INTO v_snap_s FROM public.bd_funcionarios_sensivel s WHERE s.funcionario_id = v_duplicate;

  IF v_snap_f IS NULL THEN RAISE EXCEPTION 'GUARD: snapshot do duplicado vazio — abortando'; END IF;
  IF v_snap_s IS NULL THEN RAISE EXCEPTION 'GUARD: snapshot sensivel vazio — abortando'; END IF;

  INSERT INTO public.bd_auditoria_log
    (tabela, operacao, registro_id, usuario_id, campos_alterados, dados_anteriores, dados_novos)
  VALUES
    ('bd_funcionarios','DELETE', v_duplicate::text, auth.uid(),
     ARRAY['consolidacao_funcionario_duplicado'],
     jsonb_build_object(
       'bd_funcionarios', v_snap_f,
       'bd_funcionarios_sensivel', v_snap_s
     ),
     jsonb_build_object(
       'acao','CONSOLIDACAO_FUNCIONARIO_DUPLICADO',
       'duplicate_id', v_duplicate::text,
       'canonical_id', v_canonical::text,
       'funcionario_final', v_canonical::text,
       'motivo','Consolidacao de cadastro duplicado — Ezequias Jose Rufino',
       'operacao_semantica','CONSOLIDACAO_FUNCIONARIO_DUPLICADO',
       'nota_constraint','bd_auditoria_log.operacao possui CHECK que nao permite o codigo semantico; usada operacao DELETE',
       'divergencias_preservadas_no_snapshot',
         jsonb_build_array('cpf','email','banco','chave_pix','salario_base','refeicao',
                           'centro_custo_id','data_admissao','matricula','endereco_completo'),
       'campos_complementados_no_canonico', jsonb_build_array(),
       'data_admissao_canonico_mantida','2026-03-04',
       'data_admissao_duplicado_descartada','2023-11-21',
       'data_admissao_fundamento','INCONCLUSIVO: sem historico funcional, sem status_historico, sem desligamento, sem registro em bd_importacao_alterdata. Duplicado criado por INSERT manual em 2026-08-18 com CPF malformado.',
       'referencias_migradas_migration_anterior', jsonb_build_object('bd_chamados_internos', 2),
       'origem_execucao','migration administrativa (service_role); auth.uid() pode ser nulo'
     ));

  ------------------- PASSO 8: remover registro sensivel do duplicado
  DELETE FROM public.bd_funcionarios_sensivel WHERE funcionario_id = v_duplicate;
  GET DIAGNOSTICS v_del = ROW_COUNT;
  IF v_del <> 1 THEN
    RAISE EXCEPTION 'GUARD: esperado remover 1 registro sensivel, removidos %', v_del;
  END IF;

  ------------------- PASSO 9: DELETE fisico do duplicado (por UUID exato)
  DELETE FROM public.bd_funcionarios WHERE id = v_duplicate;
  GET DIAGNOSTICS v_del = ROW_COUNT;
  IF v_del <> 1 THEN
    RAISE EXCEPTION 'DELETE_COUNT = % (esperado 1)', v_del;
  END IF;

  ------------------------------------------------ VALIDACOES FINAIS
  SELECT count(*) INTO v_cnt FROM public.bd_funcionarios
   WHERE upper(public.normalize_text(nome_completo)) LIKE '%EZEQUIAS%'
     AND upper(public.normalize_text(nome_completo)) LIKE '%RUFINO%';
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'POS: esperado 1 Ezequias, encontrados %', v_cnt; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.bd_funcionarios
     WHERE id = v_canonical AND status = 'Ativo'
       AND right(regexp_replace(coalesce(cpf,''),'[^0-9]','','g'),2)='18'
       AND length(regexp_replace(coalesce(cpf,''),'[^0-9]','','g'))=11
  ) THEN
    RAISE EXCEPTION 'POS: canonico alterado indevidamente';
  END IF;

  SELECT count(*) INTO v_cnt FROM public.bd_chamados_internos WHERE solicitante_funcionario_id = v_canonical;
  IF v_cnt <> 2 THEN RAISE EXCEPTION 'POS: canonico deveria manter 2 chamados, tem %', v_cnt; END IF;

  SELECT count(*) INTO v_cnt FROM public.bd_funcionarios_sensivel WHERE funcionario_id = v_canonical;
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'POS: canonico deveria ter 1 registro sensivel, tem %', v_cnt; END IF;

  SELECT count(*) INTO v_cnt FROM public.profiles WHERE funcionario_id = v_canonical;
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'POS: canonico deveria ter 1 profile, tem %', v_cnt; END IF;

  SELECT count(*) INTO v_cnt FROM public.profiles p
   WHERE p.funcionario_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.bd_funcionarios f WHERE f.id = p.funcionario_id);
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'POS: % profiles orfaos', v_cnt; END IF;

  RAISE NOTICE 'CONSOLIDACAO FINALIZADA: duplicado % removido; canonico % unico', v_duplicate, v_canonical;
END $$;
