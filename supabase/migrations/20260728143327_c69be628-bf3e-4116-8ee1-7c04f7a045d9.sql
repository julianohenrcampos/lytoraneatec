DO $m1a$
DECLARE
  v_tipo text;
  v_notnull boolean;
  v_default text;
  v_rows bigint;
BEGIN
  IF to_regclass('public.bd_solicitacao_item_atendimentos') IS NULL THEN
    RAISE EXCEPTION 'PREFLIGHT: tabela public.bd_solicitacao_item_atendimentos inexistente';
  END IF;

  SELECT format_type(a.atttypid, a.atttypmod), a.attnotnull, pg_get_expr(d.adbin, d.adrelid)
    INTO v_tipo, v_notnull, v_default
  FROM pg_attribute a
  LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
  WHERE a.attrelid = 'public.bd_solicitacao_item_atendimentos'::regclass
    AND a.attname = 'contexto_decisao'
    AND a.attnum > 0 AND NOT a.attisdropped;

  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'PREFLIGHT: coluna contexto_decisao inexistente';
  END IF;
  IF v_tipo <> 'jsonb' THEN
    RAISE EXCEPTION 'PREFLIGHT: tipo divergente (esperado jsonb, encontrado %)', v_tipo;
  END IF;
  IF NOT v_notnull THEN
    RAISE EXCEPTION 'PREFLIGHT: coluna contexto_decisao nao esta NOT NULL';
  END IF;

  EXECUTE 'SELECT count(*) FROM public.bd_solicitacao_item_atendimentos' INTO v_rows;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'PREFLIGHT: tabela possui % registros (esperado 0)', v_rows;
  END IF;

  IF v_default IS NULL THEN
    RAISE NOTICE 'ESTADO JA CONFORME: contexto_decisao sem default; ALTER nao executado';
  ELSIF v_default = '''{}''::jsonb' THEN
    EXECUTE 'ALTER TABLE public.bd_solicitacao_item_atendimentos ALTER COLUMN contexto_decisao DROP DEFAULT';
  ELSE
    RAISE EXCEPTION 'PREFLIGHT: default inesperado (%), abortando', v_default;
  END IF;

  -- POSTFLIGHT
  SELECT format_type(a.atttypid, a.atttypmod), a.attnotnull, pg_get_expr(d.adbin, d.adrelid)
    INTO v_tipo, v_notnull, v_default
  FROM pg_attribute a
  LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
  WHERE a.attrelid = 'public.bd_solicitacao_item_atendimentos'::regclass
    AND a.attname = 'contexto_decisao';

  IF v_tipo <> 'jsonb' OR NOT v_notnull OR v_default IS NOT NULL THEN
    RAISE EXCEPTION 'POSTFLIGHT FALHOU: tipo=%, notnull=%, default=%', v_tipo, v_notnull, v_default;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_attrdef d
    JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
    WHERE d.adrelid = 'public.bd_solicitacao_item_atendimentos'::regclass
      AND a.attname = 'contexto_decisao'
  ) THEN
    RAISE EXCEPTION 'POSTFLIGHT FALHOU: registro remanescente em pg_attrdef';
  END IF;
END
$m1a$;