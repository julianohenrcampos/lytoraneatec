
DO $$
DECLARE
  v_cc      uuid := '677c90f8-27bf-401b-b6c4-76f3a3189976';
  v_func    uuid := 'a529331b-3119-4468-b85a-5b3329d78053';
  v_sa      uuid := 'ca393c6a-3b12-4403-b57a-068096a7a474';
  v_sol_main uuid := gen_random_uuid();
  v_sol_f5   uuid := gen_random_uuid();
  v_d1 date := '2026-05-25'; v_d2 date := '2026-05-26';
  v_d3 date := '2026-05-27'; v_d4 date := '2026-05-28';
  v_d5 date := '2026-05-29';
  v_convoc jsonb;
  r record; v_status text; v_first_f1_id uuid; v_re_status text;
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_sa::text, 'role','authenticated')::text, true);

  v_convoc := jsonb_build_array(jsonb_build_object(
    'funcionario_id', v_func,
    'nome', 'GABRIEL (FASE2-TEST)',
    'dias_solicitados', jsonb_build_array(v_d1::text, v_d2::text, v_d3::text, v_d4::text)
  ));

  INSERT INTO bd_diaria_solicitacoes(
    id, numero_solicitacao, centro_custo_id, data_inicio, data_fim,
    justificativa, status, status_fluxo, tipo_solicitacao, motor_aprovacao,
    convocados_pre, regras_operacionais_snapshot
  ) VALUES (
    v_sol_main, 'FT2-001', v_cc, v_d1, v_d4,
    '[FASE2-TEST] Fase 2.1 integracao ativa controlada',
    'autorizada', 'autorizada', 'normal', 'legado',
    v_convoc, '{}'::jsonb
  );

  INSERT INTO bd_diaria_solicitacoes(
    id, numero_solicitacao, centro_custo_id, data_inicio, data_fim,
    justificativa, status, status_fluxo, tipo_solicitacao, motor_aprovacao,
    flag_extraordinaria, justificativa_extraordinaria,
    convocados_pre, regras_operacionais_snapshot
  ) VALUES (
    v_sol_f5, 'FT2-F5', v_cc, v_d5, v_d5,
    'F5 solicitacao SEM tag de massa, usada apenas para testar gate fora_massa_teste',
    'autorizada', 'autorizada', 'extraordinaria', 'legado',
    true, 'F5 extraordinaria criada exclusivamente para validar gate fora_massa_teste na Fase 2.1',
    '[]'::jsonb, '{}'::jsonb
  );

  INSERT INTO bd_diaria_presencas(
    solicitacao_id, funcionario_id, data, presente,
    hora_entrada, origem, valor_diaria_aplicada, turno
  ) VALUES (v_sol_main, v_func, v_d4, true, '08:00'::time, 'manual', 100, 'diurno');

  INSERT INTO bd_ponto_batidas(funcionario_id, centro_custo_id, tipo_batida, modo_registro,
    data_hora_dispositivo, data_hora_considerada, data_operacional,
    dentro_raio, distancia_centro_metros, status_validacao, justificativa)
  VALUES
    (v_func, v_cc, 'entrada','pwa_pessoal',(v_d1+time '08:00') AT TIME ZONE 'America/Sao_Paulo',(v_d1+time '08:00') AT TIME ZONE 'America/Sao_Paulo',v_d1,true,10,'valida','[FASE2-TEST] F1 entrada'),
    (v_func, v_cc, 'saida','pwa_pessoal',(v_d1+time '17:00') AT TIME ZONE 'America/Sao_Paulo',(v_d1+time '17:00') AT TIME ZONE 'America/Sao_Paulo',v_d1,true,10,'valida','[FASE2-TEST] F1 saida'),
    (v_func, v_cc, 'entrada','pwa_pessoal',(v_d2+time '08:00') AT TIME ZONE 'America/Sao_Paulo',(v_d2+time '08:00') AT TIME ZONE 'America/Sao_Paulo',v_d2,true,10,'valida','[FASE2-TEST] F2 entrada'),
    (v_func, v_cc, 'intervalo_inicio','pwa_pessoal',(v_d2+time '12:00') AT TIME ZONE 'America/Sao_Paulo',(v_d2+time '12:00') AT TIME ZONE 'America/Sao_Paulo',v_d2,true,10,'valida','[FASE2-TEST] F2 int_inicio'),
    (v_func, v_cc, 'intervalo_fim','pwa_pessoal',(v_d2+time '13:00') AT TIME ZONE 'America/Sao_Paulo',(v_d2+time '13:00') AT TIME ZONE 'America/Sao_Paulo',v_d2,true,10,'valida','[FASE2-TEST] F2 int_fim'),
    (v_func, v_cc, 'saida','pwa_pessoal',(v_d2+time '17:00') AT TIME ZONE 'America/Sao_Paulo',(v_d2+time '17:00') AT TIME ZONE 'America/Sao_Paulo',v_d2,true,10,'valida','[FASE2-TEST] F2 saida'),
    (v_func, v_cc, 'saida','pwa_pessoal',(v_d3+time '17:00') AT TIME ZONE 'America/Sao_Paulo',(v_d3+time '17:00') AT TIME ZONE 'America/Sao_Paulo',v_d3,true,10,'valida','[FASE2-TEST] F3 saida_isolada'),
    (v_func, v_cc, 'entrada','pwa_pessoal',(v_d4+time '08:00') AT TIME ZONE 'America/Sao_Paulo',(v_d4+time '08:00') AT TIME ZONE 'America/Sao_Paulo',v_d4,true,10,'valida','[FASE2-TEST] F4 entrada'),
    (v_func, v_cc, 'saida','pwa_pessoal',(v_d4+time '17:00') AT TIME ZONE 'America/Sao_Paulo',(v_d4+time '17:00') AT TIME ZONE 'America/Sao_Paulo',v_d4,true,10,'valida','[FASE2-TEST] F4 saida'),
    (v_func, v_cc, 'entrada','pwa_pessoal',(v_d5+time '08:00') AT TIME ZONE 'America/Sao_Paulo',(v_d5+time '08:00') AT TIME ZONE 'America/Sao_Paulo',v_d5,true,10,'valida','[FASE2-TEST] F5 entrada'),
    (v_func, v_cc, 'saida','pwa_pessoal',(v_d5+time '17:00') AT TIME ZONE 'America/Sao_Paulo',(v_d5+time '17:00') AT TIME ZONE 'America/Sao_Paulo',v_d5,true,10,'valida','[FASE2-TEST] F5 saida');

  FOR r IN
    SELECT id, justificativa FROM bd_ponto_batidas
    WHERE justificativa LIKE '[FASE2-TEST]%'
    ORDER BY data_hora_considerada, justificativa
  LOOP
    v_status := public.fn_ponto_diaria_integrar_batida(r.id);
    RAISE NOTICE 'FASE2-TEST % => %', r.justificativa, v_status;
    IF v_first_f1_id IS NULL AND r.justificativa = '[FASE2-TEST] F1 entrada' THEN
      v_first_f1_id := r.id;
    END IF;
  END LOOP;

  IF v_first_f1_id IS NOT NULL THEN
    v_re_status := public.fn_ponto_diaria_integrar_batida(v_first_f1_id);
    RAISE NOTICE 'FASE2-TEST reexec F1 entrada => %', v_re_status;
  END IF;
END $$;
