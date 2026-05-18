
DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.fn_ponto_diaria_simular_lote(
    '2026-06-01T00:00:00-03:00'::timestamptz,
    '2026-06-07T23:59:59-03:00'::timestamptz,
    500) INTO r;
  RAISE NOTICE 'SIM RESULT: %', r;
END $$;
