DO $$
DECLARE d text; d2 text;
BEGIN
  SELECT pg_get_functiondef('public.fn_ct_mov_direta_programar(uuid,uuid)'::regprocedure) INTO d;
  d2 := replace(d,
    E'IF EXISTS (SELECT 1 FROM public.bd_movimentacoes m\n              WHERE m.viagem_id = p_viagem_id AND m.parada_id IS NULL\n                AND coalesce(m.status,\'\') <> \'CANCELADA\') THEN',
    E'IF EXISTS (SELECT 1 FROM public.bd_movimentacoes mx\n              WHERE mx.viagem_id = p_viagem_id AND mx.parada_id IS NULL\n                AND coalesce(mx.status,\'\') <> \'CANCELADA\') THEN');
  d2 := replace(d2,
    E'AND NOT EXISTS (SELECT 1 FROM public.bd_movimentacoes m\n                                 WHERE m.parada_id = p.id AND coalesce(m.status,\'\') <> \'CANCELADA\')',
    E'AND NOT EXISTS (SELECT 1 FROM public.bd_movimentacoes mx\n                                 WHERE mx.parada_id = p.id AND coalesce(mx.status,\'\') <> \'CANCELADA\')');
  IF d2 = d THEN RAISE EXCEPTION 'PADRAO_NAO_ENCONTRADO'; END IF;
  EXECUTE d2;
END $$;