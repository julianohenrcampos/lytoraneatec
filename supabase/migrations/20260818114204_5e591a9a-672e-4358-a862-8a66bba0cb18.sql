-- 1) Nomes completos: enriquecimento de lista passa a devolver quem abriu
DROP FUNCTION IF EXISTS public.fn_chamado_interno_enriquecer_lista(uuid[]);

CREATE FUNCTION public.fn_chamado_interno_enriquecer_lista(p_ids uuid[])
RETURNS TABLE (
  chamado_id uuid,
  centro_custo_codigo text,
  centro_custo_nome text,
  solicitante_funcionario_id uuid,
  solicitante_nome text,
  aberto_por_nome text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '28000';
  END IF;

  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    cc.codigo_centro_custo::text,
    cc.nome_centro_custo::text,
    c.solicitante_funcionario_id,
    f.nome_completo::text,
    COALESCE(fa.nome_completo, pa.nome_completo)::text
  FROM public.bd_chamados_internos c
  LEFT JOIN public.bd_centros_custo cc ON cc.id = c.centro_custo_id
  LEFT JOIN public.bd_funcionarios  f  ON f.id  = c.solicitante_funcionario_id
  LEFT JOIN public.profiles         pa ON pa.id = c.aberto_por
  LEFT JOIN public.bd_funcionarios  fa ON fa.id = pa.funcionario_id
  WHERE c.id = ANY (p_ids)
    AND public.fn_chamado_interno_can_read(c.id) IS TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_chamado_interno_enriquecer_lista(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_chamado_interno_enriquecer_lista(uuid[]) TO authenticated;

-- 2) Nomes das pessoas de um chamado (solicitante, quem abriu, responsável)
CREATE OR REPLACE FUNCTION public.fn_chamado_interno_detalhe_pessoas(p_chamado_id uuid)
RETURNS TABLE (
  solicitante_nome text,
  aberto_por_nome text,
  responsavel_nome text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '28000';
  END IF;
  IF public.fn_chamado_interno_can_read(p_chamado_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    f.nome_completo::text,
    COALESCE(fa.nome_completo, pa.nome_completo)::text,
    COALESCE(fr.nome_completo, pr.nome_completo)::text
  FROM public.bd_chamados_internos c
  LEFT JOIN public.bd_funcionarios f  ON f.id  = c.solicitante_funcionario_id
  LEFT JOIN public.profiles        pa ON pa.id = c.aberto_por
  LEFT JOIN public.bd_funcionarios fa ON fa.id = pa.funcionario_id
  LEFT JOIN public.profiles        pr ON pr.id = c.responsavel_atual_profile_id
  LEFT JOIN public.bd_funcionarios fr ON fr.id = pr.funcionario_id
  WHERE c.id = p_chamado_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_chamado_interno_detalhe_pessoas(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_chamado_interno_detalhe_pessoas(uuid) TO authenticated;

-- 3) Anexos de chamados internos
CREATE TABLE IF NOT EXISTS public.bd_chamado_interno_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chamado_id uuid NOT NULL REFERENCES public.bd_chamados_internos(id) ON DELETE CASCADE,
  evento_id uuid REFERENCES public.bd_chamado_interno_eventos(id) ON DELETE SET NULL,
  storage_path text NOT NULL UNIQUE,
  nome_arquivo text NOT NULL,
  mime_type text NOT NULL,
  tamanho_bytes bigint NOT NULL,
  enviado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chamado_interno_anexos_chamado
  ON public.bd_chamado_interno_anexos (chamado_id, created_at);

GRANT SELECT ON public.bd_chamado_interno_anexos TO authenticated;
GRANT ALL ON public.bd_chamado_interno_anexos TO service_role;

ALTER TABLE public.bd_chamado_interno_anexos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anexos_select_can_read" ON public.bd_chamado_interno_anexos;
CREATE POLICY "anexos_select_can_read"
ON public.bd_chamado_interno_anexos
FOR SELECT
TO authenticated
USING (public.fn_chamado_interno_can_read(chamado_id) IS TRUE);

-- 4) RPC de registro dos anexos (única via de escrita)
CREATE OR REPLACE FUNCTION public.fn_chamado_interno_anexos_registrar(
  p_chamado_id uuid,
  p_evento_id uuid,
  p_anexos jsonb
)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_item jsonb;
  v_total integer := 0;
  v_ja integer := 0;
  v_mimes text[] := ARRAY['image/jpeg','image/png','image/webp','application/pdf'];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE='28000'; END IF;
  IF public.fn_chamado_interno_can_read(p_chamado_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  IF p_anexos IS NULL OR jsonb_typeof(p_anexos) <> 'array' THEN
    RAISE EXCEPTION 'anexos_invalidos' USING ERRCODE='22004';
  END IF;
  IF jsonb_array_length(p_anexos) = 0 THEN RETURN 0; END IF;
  IF jsonb_array_length(p_anexos) > 5 THEN
    RAISE EXCEPTION 'limite_anexos_excedido' USING ERRCODE='P0001';
  END IF;

  IF p_evento_id IS NOT NULL THEN
    SELECT count(*) INTO v_ja
    FROM public.bd_chamado_interno_anexos a
    WHERE a.evento_id = p_evento_id;
    IF v_ja + jsonb_array_length(p_anexos) > 5 THEN
      RAISE EXCEPTION 'limite_anexos_excedido' USING ERRCODE='P0001';
    END IF;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_anexos)
  LOOP
    IF coalesce(btrim(v_item->>'storage_path'),'') = ''
       OR coalesce(btrim(v_item->>'nome_arquivo'),'') = '' THEN
      RAISE EXCEPTION 'anexo_incompleto' USING ERRCODE='22004';
    END IF;
    IF NOT ((v_item->>'mime_type') = ANY (v_mimes)) THEN
      RAISE EXCEPTION 'anexo_tipo_nao_permitido' USING ERRCODE='P0001';
    END IF;
    IF coalesce((v_item->>'tamanho_bytes')::bigint, 0) <= 0
       OR (v_item->>'tamanho_bytes')::bigint > 10485760 THEN
      RAISE EXCEPTION 'anexo_tamanho_invalido' USING ERRCODE='P0001';
    END IF;
    IF (v_item->>'storage_path') NOT LIKE (p_chamado_id::text || '/%') THEN
      RAISE EXCEPTION 'anexo_path_invalido' USING ERRCODE='P0001';
    END IF;

    INSERT INTO public.bd_chamado_interno_anexos (
      chamado_id, evento_id, storage_path, nome_arquivo, mime_type, tamanho_bytes, enviado_por
    ) VALUES (
      p_chamado_id, p_evento_id, v_item->>'storage_path', v_item->>'nome_arquivo',
      v_item->>'mime_type', (v_item->>'tamanho_bytes')::bigint, v_uid
    )
    ON CONFLICT (storage_path) DO NOTHING;

    v_total := v_total + 1;
  END LOOP;

  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_chamado_interno_anexos_registrar(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_chamado_interno_anexos_registrar(uuid, uuid, jsonb) TO authenticated;

-- 5) Último evento do chamado autorado pelo usuário (para vincular anexos da timeline)
CREATE OR REPLACE FUNCTION public.fn_chamado_interno_ultimo_evento_proprio(p_chamado_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE='28000'; END IF;
  IF public.fn_chamado_interno_can_read(p_chamado_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;

  SELECT e.id INTO v_id
  FROM public.bd_chamado_interno_eventos e
  WHERE e.chamado_id = p_chamado_id
    AND e.autor_profile_id = v_uid
  ORDER BY e.created_at DESC
  LIMIT 1;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_chamado_interno_ultimo_evento_proprio(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_chamado_interno_ultimo_evento_proprio(uuid) TO authenticated;