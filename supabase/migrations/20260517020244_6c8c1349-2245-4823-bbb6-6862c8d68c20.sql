
SET LOCAL "request.jwt.claims" = '{"sub":"0920853d-44ab-4753-9f95-eea52153245a","role":"authenticated"}';

DO $$
DECLARE
  v_s1 uuid := gen_random_uuid();
  v_s2 uuid := gen_random_uuid();
  v_func_a uuid := '4d624d3b-b4a3-4a19-a5f3-44bacd5baf8c';
  v_func_b uuid := '18fa439e-5e66-449d-a1f7-2ee88155c342';
  v_cc1 uuid := '7f2a5bb8-5d6c-4f45-96bb-88e1a4401ca0';
  v_cc2 uuid := '6776e08b-5387-4d20-a393-13e735cf977f';
  v_funcao uuid := '50025f88-4f2b-4839-be5a-edba396dc174';
  v_cc1_lat numeric := -22.73340400;
  v_cc1_lng numeric := -43.38270100;
  v_cc2_lat numeric := -22.97918800;
  v_cc2_lng numeric := -43.66799000;
BEGIN
  IF EXISTS (SELECT 1 FROM public.bd_diaria_solicitacoes
             WHERE data_inicio <= '2026-06-07' AND data_fim >= '2026-06-01') THEN
    RAISE EXCEPTION 'SHADOW-TEST abort: solicitacoes ja existem na janela';
  END IF;
  IF EXISTS (SELECT 1 FROM public.bd_ponto_batidas
             WHERE data_operacional BETWEEN '2026-06-01' AND '2026-06-07') THEN
    RAISE EXCEPTION 'SHADOW-TEST abort: batidas ja existem na janela';
  END IF;

  INSERT INTO public.bd_diaria_solicitacoes
    (id, centro_custo_id, data_inicio, data_fim, status, status_fluxo,
     justificativa, observacao_gerente, numero_solicitacao, tipo_solicitacao,
     considera_fds_feriado, convocados_pre)
  VALUES (v_s1, v_cc1, '2026-06-02','2026-06-04','autorizada','documentos_gerados',
    '[SHADOW-TEST] Caso 1+2 auto/fora_dia', '[SHADOW-TEST]',
    'ST-001','normal', false,
    jsonb_build_array(jsonb_build_object(
      'funcionario_id', v_func_a::text,'cpf','193.567.917-16',
      'nome_funcionario','MARCUS VITOR FERREIRA LINS',
      'funcao_id', v_funcao::text,'nome_funcao','AJUDANTE DE OBRAS',
      'matricula','','valor_diaria',100,'valor_refeicao',36,
      'valor_diaria_exclusiva',150,'shadow_test', true)));

  INSERT INTO public.bd_diaria_solicitacoes
    (id, centro_custo_id, data_inicio, data_fim, status, status_fluxo,
     justificativa, observacao_gerente, numero_solicitacao, tipo_solicitacao,
     considera_fds_feriado, convocados_pre)
  VALUES (v_s2, v_cc2, '2026-06-03','2026-06-03','autorizada','documentos_gerados',
    '[SHADOW-TEST] Caso 4 fora_convocacao', '[SHADOW-TEST]',
    'ST-002','normal', false,
    jsonb_build_array(jsonb_build_object(
      'funcionario_id', v_func_a::text,'cpf','193.567.917-16',
      'nome_funcionario','MARCUS VITOR FERREIRA LINS',
      'funcao_id', v_funcao::text,'nome_funcao','AJUDANTE DE OBRAS',
      'matricula','','valor_diaria',100,'valor_refeicao',36,
      'valor_diaria_exclusiva',150,'shadow_test', true)));

  INSERT INTO public.bd_ponto_batidas
    (funcionario_id, centro_custo_id, tipo_batida, modo_registro,
     data_hora_dispositivo, data_hora_servidor, data_hora_considerada,
     data_operacional, latitude, longitude, dentro_raio, distancia_centro_metros,
     precisao_gps_metros, status_validacao, status_sync, origem_dados,
     tipo_registro, justificativa, score_risco)
  VALUES
    (v_func_a,v_cc1,'entrada','pwa_pessoal','2026-06-02 07:00-03','2026-06-02 07:00-03','2026-06-02 07:00-03','2026-06-02',v_cc1_lat,v_cc1_lng,true,10,5,'valida','sincronizado','online','presenca_diaria','[SHADOW-TEST] caso1',0),
    (v_func_a,v_cc1,'intervalo_inicio','pwa_pessoal','2026-06-02 12:00-03','2026-06-02 12:00-03','2026-06-02 12:00-03','2026-06-02',v_cc1_lat,v_cc1_lng,true,10,5,'valida','sincronizado','online','presenca_diaria','[SHADOW-TEST] caso1',0),
    (v_func_a,v_cc1,'intervalo_fim','pwa_pessoal','2026-06-02 13:00-03','2026-06-02 13:00-03','2026-06-02 13:00-03','2026-06-02',v_cc1_lat,v_cc1_lng,true,10,5,'valida','sincronizado','online','presenca_diaria','[SHADOW-TEST] caso1',0),
    (v_func_a,v_cc1,'saida','pwa_pessoal','2026-06-02 17:00-03','2026-06-02 17:00-03','2026-06-02 17:00-03','2026-06-02',v_cc1_lat,v_cc1_lng,true,10,5,'valida','sincronizado','online','presenca_diaria','[SHADOW-TEST] caso1',0),
    (v_func_a,v_cc1,'entrada','pwa_pessoal','2026-06-05 07:00-03','2026-06-05 07:00-03','2026-06-05 07:00-03','2026-06-05',v_cc1_lat,v_cc1_lng,true,10,5,'valida','sincronizado','online','presenca_diaria','[SHADOW-TEST] caso2',0),
    (v_func_a,v_cc1,'saida','pwa_pessoal','2026-06-04 17:00-03','2026-06-04 17:00-03','2026-06-04 17:00-03','2026-06-04',v_cc1_lat,v_cc1_lng,true,10,5,'valida','sincronizado','online','presenca_diaria','[SHADOW-TEST] caso3',0),
    (v_func_b,v_cc2,'entrada','pwa_pessoal','2026-06-03 07:00-03','2026-06-03 07:00-03','2026-06-03 07:00-03','2026-06-03',v_cc2_lat,v_cc2_lng,true,10,5,'valida','sincronizado','online','presenca_diaria','[SHADOW-TEST] caso4',0);

  RAISE NOTICE 'SHADOW-TEST: massa criada. S1=%, S2=%', v_s1, v_s2;
END $$;
