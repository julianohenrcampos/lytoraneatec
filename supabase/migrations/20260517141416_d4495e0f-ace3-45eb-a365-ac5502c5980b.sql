DO $$
DECLARE
  v_cc        uuid := '677c90f8-27bf-401b-b6c4-76f3a3189976';
  v_func      uuid := 'a529331b-3119-4468-b85a-5b3329d78053';
  v_d1 date := current_date + 30;
  v_d2 date := current_date + 31;
  v_d3 date := current_date + 32;
  v_d4 date := current_date + 33;
  v_d5 date := current_date + 34;
  v_solic uuid;
  v_num text := 'SH' || lpad((extract(epoch from now())::bigint % 100000000)::text, 8, '0');
  v_bat record;
BEGIN
  PERFORM set_config('request.jwt.claims',
    '{"sub":"0920853d-44ab-4753-9f95-eea52153245a","role":"authenticated"}', true);

  INSERT INTO bd_diaria_solicitacoes(
    centro_custo_id, tipo_solicitacao, status, data_inicio, data_fim,
    convocados_pre, justificativa, numero_solicitacao, motor_aprovacao
  ) VALUES (
    v_cc, 'normal', 'autorizada', v_d1, v_d5,
    jsonb_build_array(jsonb_build_object(
      'funcionario_id', v_func,
      'dias_solicitados', jsonb_build_array(
        v_d1::text, v_d2::text, v_d3::text, v_d4::text, v_d5::text)
    )),
    '[SHADOW-TEST-ORDEM] solicitacao Rodada 3',
    v_num,
    'legado'
  ) RETURNING id INTO v_solic;

  INSERT INTO bd_ponto_batidas(funcionario_id, centro_custo_id, tipo_batida, modo_registro,
    data_hora_dispositivo, data_hora_considerada, dentro_raio, distancia_centro_metros,
    status_validacao, data_operacional, justificativa)
  VALUES
    (v_func, v_cc, 'saida','pwa_pessoal', (v_d1::text||' 17:00')::timestamptz, (v_d1::text||' 17:00')::timestamptz, true, 0, 'valida', v_d1, '[SHADOW-TEST-ORDEM][O1] saida isolada'),
    (v_func, v_cc, 'intervalo_inicio','pwa_pessoal', (v_d2::text||' 12:00')::timestamptz, (v_d2::text||' 12:00')::timestamptz, true, 0, 'valida', v_d2, '[SHADOW-TEST-ORDEM][O2] intervalo_inicio isolado'),
    (v_func, v_cc, 'intervalo_fim','pwa_pessoal', (v_d3::text||' 13:00')::timestamptz, (v_d3::text||' 13:00')::timestamptz, true, 0, 'valida', v_d3, '[SHADOW-TEST-ORDEM][O3] intervalo_fim isolado'),
    (v_func, v_cc, 'entrada','pwa_pessoal', (v_d4::text||' 07:00')::timestamptz, (v_d4::text||' 07:00')::timestamptz, true, 0, 'valida', v_d4, '[SHADOW-TEST-ORDEM][O4] entrada'),
    (v_func, v_cc, 'saida',  'pwa_pessoal', (v_d4::text||' 17:00')::timestamptz, (v_d4::text||' 17:00')::timestamptz, true, 0, 'valida', v_d4, '[SHADOW-TEST-ORDEM][O4] saida'),
    (v_func, v_cc, 'entrada',         'pwa_pessoal', (v_d5::text||' 07:00')::timestamptz, (v_d5::text||' 07:00')::timestamptz, true, 0, 'valida', v_d5, '[SHADOW-TEST-ORDEM][O5] entrada'),
    (v_func, v_cc, 'intervalo_inicio','pwa_pessoal', (v_d5::text||' 12:00')::timestamptz, (v_d5::text||' 12:00')::timestamptz, true, 0, 'valida', v_d5, '[SHADOW-TEST-ORDEM][O5] intervalo_inicio'),
    (v_func, v_cc, 'intervalo_fim',   'pwa_pessoal', (v_d5::text||' 13:00')::timestamptz, (v_d5::text||' 13:00')::timestamptz, true, 0, 'valida', v_d5, '[SHADOW-TEST-ORDEM][O5] intervalo_fim'),
    (v_func, v_cc, 'saida',           'pwa_pessoal', (v_d5::text||' 17:00')::timestamptz, (v_d5::text||' 17:00')::timestamptz, true, 0, 'valida', v_d5, '[SHADOW-TEST-ORDEM][O5] saida');

  FOR v_bat IN
    SELECT id FROM bd_ponto_batidas
    WHERE justificativa ILIKE '[SHADOW-TEST-ORDEM]%'
    ORDER BY data_hora_considerada
  LOOP
    PERFORM public.fn_ponto_diaria_simular_batida(v_bat.id);
  END LOOP;

  RAISE NOTICE 'Seed Rodada 3 OK. Solicitacao=% Numero=%', v_solic, v_num;
END $$;