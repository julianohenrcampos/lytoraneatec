DO $migration$
DECLARE
  v_oid oid;
  v_definition text;
  v_corrected text;
BEGIN
  SELECT p.oid, pg_get_functiondef(p.oid)
    INTO v_oid, v_definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'fn_ct_recebimento_finalizar'
    AND pg_get_function_identity_arguments(p.oid) = 'p_viagem_id uuid, p_payload jsonb, p_request_id uuid';

  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'Função public.fn_ct_recebimento_finalizar(uuid,jsonb,uuid) não encontrada';
  END IF;

  IF position('p record;' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Definição inesperada de fn_ct_recebimento_finalizar: declaração alvo não encontrada';
  END IF;

  v_corrected := replace(
    v_definition,
    'p record;',
    'p public.bd_ct_viagem_paradas%ROWTYPE;'
  );

  IF v_corrected = v_definition THEN
    RAISE EXCEPTION 'A correção de fn_ct_recebimento_finalizar não alterou a definição';
  END IF;

  EXECUTE v_corrected;
END
$migration$;