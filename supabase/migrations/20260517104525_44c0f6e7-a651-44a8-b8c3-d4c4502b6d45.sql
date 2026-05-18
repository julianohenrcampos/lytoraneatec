
DO $$
DECLARE n int;
BEGIN
  DELETE FROM public.bd_ponto_diaria_integracao
    WHERE presenca_diaria_id IS NULL
      AND data_operacional BETWEEN '2026-06-01' AND '2026-06-07';
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'shadow integracao removidos: %', n;

  DELETE FROM public.bd_ponto_batidas
    WHERE justificativa ILIKE '%[SHADOW-TEST]%'
      AND data_operacional BETWEEN '2026-06-01' AND '2026-06-07';
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'batidas removidas: %', n;

  DELETE FROM public.bd_diaria_solicitacoes
    WHERE justificativa ILIKE '%[SHADOW-TEST]%'
      AND data_inicio BETWEEN '2026-06-01' AND '2026-06-07';
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'solicitacoes removidas: %', n;
END $$;
