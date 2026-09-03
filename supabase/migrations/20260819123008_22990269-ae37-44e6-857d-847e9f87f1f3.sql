CREATE UNIQUE INDEX IF NOT EXISTS ux_bd_notificacoes_dedup_key
  ON public.bd_notificacoes ((metadata->>'dedup_key'))
  WHERE COALESCE(metadata->>'dedup_key', '') <> '';

CREATE OR REPLACE FUNCTION public.fn_notificacao_emitir_core(
  p_tipo text, p_titulo text, p_mensagem text,
  p_link text DEFAULT NULL, p_metadata jsonb DEFAULT '{}'::jsonb,
  p_destinatarios uuid[] DEFAULT '{}'::uuid[],
  p_dedup_key text DEFAULT NULL, p_created_by uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dedup text := NULLIF(COALESCE(p_dedup_key, p_metadata->>'dedup_key'), '');
  v_meta jsonb := COALESCE(p_metadata,'{}'::jsonb);
  v_ator uuid := COALESCE(p_created_by, auth.uid());
  v_dest uuid[]; v_id uuid; v_dedup_hit boolean := false; v_ins int;
BEGIN
  IF COALESCE(BTRIM(p_tipo),'') = '' OR COALESCE(BTRIM(p_titulo),'') = '' THEN
    RAISE EXCEPTION 'fn_notificacao_emitir_core: tipo e titulo obrigatorios';
  END IF;

  SELECT array_agg(DISTINCT d) INTO v_dest
    FROM unnest(COALESCE(p_destinatarios,'{}'::uuid[])) d
   WHERE d IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = d);

  IF v_dest IS NULL OR array_length(v_dest,1) = 0 THEN
    RETURN jsonb_build_object('ok',true,'skipped',true,'motivo','sem_destinatarios');
  END IF;

  IF v_dedup IS NOT NULL THEN
    v_meta := v_meta || jsonb_build_object('dedup_key', v_dedup);
    SELECT id INTO v_id FROM public.bd_notificacoes
     WHERE metadata->>'dedup_key' = v_dedup LIMIT 1;
    v_dedup_hit := v_id IS NOT NULL;
  END IF;

  IF v_id IS NULL THEN
    BEGIN
      INSERT INTO public.bd_notificacoes (tipo,titulo,mensagem,link,metadata,created_by)
      VALUES (p_tipo,p_titulo,p_mensagem,p_link,v_meta,v_ator)
      RETURNING id INTO v_id;
    EXCEPTION WHEN unique_violation THEN
      SELECT id INTO v_id FROM public.bd_notificacoes
       WHERE metadata->>'dedup_key' = v_dedup LIMIT 1;
      v_dedup_hit := true;
    END;
  END IF;

  INSERT INTO public.bd_notificacoes_usuarios (notificacao_id, usuario_id, lida)
  SELECT v_id, d, false FROM unnest(v_dest) d
  ON CONFLICT (notificacao_id, usuario_id) DO NOTHING;
  GET DIAGNOSTICS v_ins = ROW_COUNT;

  RETURN jsonb_build_object('ok',true,'notificacao_id',v_id,
    'destinatarios',array_length(v_dest,1),'vinculos_novos',v_ins,'deduplicada',v_dedup_hit);
END $$;

REVOKE ALL ON FUNCTION public.fn_notificacao_emitir_core(text,text,text,text,jsonb,uuid[],text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_notificacao_emitir_core(text,text,text,text,jsonb,uuid[],text,uuid) FROM anon;
REVOKE ALL ON FUNCTION public.fn_notificacao_emitir_core(text,text,text,text,jsonb,uuid[],text,uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_notificacao_emitir_core(text,text,text,text,jsonb,uuid[],text,uuid) TO service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE public.bd_notificacoes_usuarios;