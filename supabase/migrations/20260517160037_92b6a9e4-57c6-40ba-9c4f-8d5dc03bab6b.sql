
DO $$
DECLARE
  v_sol uuid;
  v_bat uuid[];
  v_logs int; v_integ int; v_pres int; v_status int; v_batidas int; v_sols int;
BEGIN
  SELECT id INTO v_sol FROM bd_diaria_solicitacoes WHERE numero_solicitacao='FT22-001';
  SELECT array_agg(id) INTO v_bat FROM bd_ponto_batidas WHERE justificativa ILIKE '[FASE2-TEST]%';

  -- 1) logs
  DELETE FROM bd_diaria_logs
   WHERE solicitacao_id = v_sol OR justificativa ILIKE '[FASE2-TEST]%';
  GET DIAGNOSTICS v_logs = ROW_COUNT;

  -- 2) integração ponto×diária
  DELETE FROM bd_ponto_diaria_integracao WHERE batida_id = ANY(v_bat);
  GET DIAGNOSTICS v_integ = ROW_COUNT;

  -- 3) presenças (dispara trigger que escreve em bd_diaria_status, ok pois solic ainda existe)
  DELETE FROM bd_diaria_presencas WHERE solicitacao_id = v_sol;
  GET DIAGNOSTICS v_pres = ROW_COUNT;

  -- 4) status da diária
  DELETE FROM bd_diaria_status WHERE solicitacao_id = v_sol;
  GET DIAGNOSTICS v_status = ROW_COUNT;

  -- 5) batidas
  DELETE FROM bd_ponto_batidas WHERE id = ANY(v_bat);
  GET DIAGNOSTICS v_batidas = ROW_COUNT;

  -- 6) solicitação
  DELETE FROM bd_diaria_solicitacoes WHERE id = v_sol;
  GET DIAGNOSTICS v_sols = ROW_COUNT;

  RAISE NOTICE 'cleanup F2.2 → logs=%, integ=%, pres=%, status=%, batidas=%, sol=%',
    v_logs, v_integ, v_pres, v_status, v_batidas, v_sols;
END $$;
