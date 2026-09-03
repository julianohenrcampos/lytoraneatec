DO $mig$
DECLARE
  v_def  text;
  v_new  text;
  v_from text := 'FROM jsonb_to_recordset(p_itens) WITH ORDINALITY AS x(';
  v_to   text := 'FROM ROWS FROM (jsonb_to_recordset(p_itens) AS (';
  v_end_from text := E'      observacoes             text\n    )\n  ),\n  norm AS (';
  v_end_to   text := E'      observacoes             text\n    )) WITH ORDINALITY AS x\n  ),\n  norm AS (';
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'fn_solic_equip_criar';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'fn_solic_equip_criar nao encontrada';
  END IF;
  IF position(v_from in v_def) = 0 THEN
    RAISE EXCEPTION 'trecho FROM jsonb_to_recordset ... WITH ORDINALITY nao encontrado';
  END IF;
  IF position(v_end_from in v_def) = 0 THEN
    RAISE EXCEPTION 'fim da lista de colunas nao encontrado';
  END IF;

  v_new := replace(replace(v_def, v_from, v_to), v_end_from, v_end_to);
  IF v_new = v_def THEN
    RAISE EXCEPTION 'nenhuma substituicao aplicada';
  END IF;

  EXECUTE v_new;
END
$mig$;