
DO $mig$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='fn_importador_ativos_atualizar';
  v_def := replace(v_def,
    'SELECT ce.*, upper(btrim(f.codigo)) AS frota_codigo_db INTO v_ce
    FROM public.bd_caminhoes_equipamentos ce
    LEFT JOIN public.bd_frotas f ON f.id=ce.frota_id
   WHERE ce.id=v_eq_id FOR UPDATE;',
    'SELECT ce.*, upper(btrim((SELECT codigo FROM public.bd_frotas WHERE id=ce.frota_id))) AS frota_codigo_db INTO v_ce
    FROM public.bd_caminhoes_equipamentos ce
   WHERE ce.id=v_eq_id FOR UPDATE;');
  EXECUTE v_def;
END $mig$;
