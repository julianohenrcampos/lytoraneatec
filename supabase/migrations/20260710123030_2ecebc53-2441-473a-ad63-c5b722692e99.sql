CREATE OR REPLACE FUNCTION public.fn_planejamento_scope_centros_custo(
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS SETOF uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_uid uuid := auth.uid();
BEGIN
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS DISTINCT FROM v_auth_uid THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT DISTINCT cc.id
  FROM public.bd_centros_custo AS cc
  LEFT JOIN public.profiles AS p ON p.id = v_auth_uid
  WHERE COALESCE(p.acesso_global, false) = true
     OR cc.planejador_responsavel_id = v_auth_uid
     OR (
       p.funcionario_id IS NOT NULL
       AND (
            cc.aprovador_diarias_id  = p.funcionario_id
         OR cc.adm_sede_funcionario_id = p.funcionario_id
         OR cc.adm_obra_funcionario_id = p.funcionario_id
       )
     );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_planejamento_scope_centros_custo(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_planejamento_scope_centros_custo(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_planejamento_scope_centros_custo(uuid) TO authenticated;