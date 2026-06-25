DO $$
DECLARE v_int int; v_bat int; v_adi int; v_sol int;
BEGIN
  DELETE FROM bd_ponto_diaria_integracao
    WHERE presenca_diaria_id IS NULL
      AND data_operacional BETWEEN '2026-06-08' AND '2026-06-12';
  GET DIAGNOSTICS v_int = ROW_COUNT;

  DELETE FROM bd_ponto_batidas
    WHERE justificativa ILIKE '%[SHADOW-TEST-R2]%';
  GET DIAGNOSTICS v_bat = ROW_COUNT;

  DELETE FROM bd_diaria_aditivos
    WHERE justificativa ILIKE '%[SHADOW-TEST-R2]%';
  GET DIAGNOSTICS v_adi = ROW_COUNT;

  DELETE FROM bd_diaria_solicitacoes
    WHERE justificativa ILIKE '%[SHADOW-TEST-R2]%';
  GET DIAGNOSTICS v_sol = ROW_COUNT;

  RAISE NOTICE 'cleanup R2: integracao=% batidas=% aditivos=% solicitacoes=%', v_int, v_bat, v_adi, v_sol;
END $$;