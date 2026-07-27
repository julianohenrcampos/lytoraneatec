ALTER TABLE public.bd_atestados_medicos
  ADD COLUMN IF NOT EXISTS lido boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lido_em timestamptz NULL,
  ADD COLUMN IF NOT EXISTS lido_por uuid NULL,
  ADD COLUMN IF NOT EXISTS lido_por_nome text NULL;

CREATE OR REPLACE FUNCTION public.fn_atestado_marcar_lido(
  p_atestado_id uuid,
  p_lido boolean
)
RETURNS TABLE (
  id uuid,
  lido boolean,
  lido_em timestamptz,
  lido_por uuid,
  lido_por_nome text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_nome text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'nao_autenticado';
  END IF;

  IF NOT (
    has_role('SuperAdm', v_uid)
    OR has_permission('saude_atestados_analisar', v_uid)
    OR has_permission('saude_atestados_status_update', v_uid)
  ) THEN
    RAISE EXCEPTION 'sem_permissao';
  END IF;

  SELECT p.nome_completo INTO v_nome FROM public.profiles p WHERE p.id = v_uid;

  RETURN QUERY
  UPDATE public.bd_atestados_medicos a
     SET lido = COALESCE(p_lido, false),
         lido_em = CASE WHEN COALESCE(p_lido, false) THEN now() ELSE NULL END,
         lido_por = CASE WHEN COALESCE(p_lido, false) THEN v_uid ELSE NULL END,
         lido_por_nome = CASE WHEN COALESCE(p_lido, false) THEN v_nome ELSE NULL END
   WHERE a.id = p_atestado_id
  RETURNING a.id, a.lido, a.lido_em, a.lido_por, a.lido_por_nome;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'atestado_nao_encontrado';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_atestado_marcar_lido(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_atestado_marcar_lido(uuid, boolean) TO authenticated;