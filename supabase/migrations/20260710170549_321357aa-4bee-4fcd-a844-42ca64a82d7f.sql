
-- A trigger de validação do catálogo é bypassada no contexto de migração,
-- pois não há auth.uid() e a mudança faz parte do deploy.
SET LOCAL session_replication_role = replica;

INSERT INTO public.bd_permissions (codigo, nome, rota, descricao)
VALUES (
  'engenharia_planejamento_macro_ativar',
  'Ativar versão do planejamento macro',
  '/engenharia/planejamento-macro',
  'Permite tornar vigente uma versão de planejamento nos Centros de Custo pertencentes ao escopo oficial do usuário.'
)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.bd_role_permission_actions (role_id, permission_id, acao)
SELECT r.id, p.id, 'aprovar'
FROM public.bd_roles r, public.bd_permissions p
WHERE r.nome = 'Planejador'
  AND p.codigo = 'engenharia_planejamento_macro_ativar'
  AND NOT EXISTS (
    SELECT 1 FROM public.bd_role_permission_actions x
    WHERE x.role_id = r.id AND x.permission_id = p.id AND x.acao = 'aprovar'
  );

SET LOCAL session_replication_role = DEFAULT;

CREATE OR REPLACE FUNCTION public.fn_planejamento_tornar_vigente(p_planejamento_id uuid)
RETURNS public.bd_planejamentos_obra
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_cc     uuid;
  v_status text;
  v_row    public.bd_planejamentos_obra;
  v_count  int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT centro_custo_id, status
    INTO v_cc, v_status
  FROM public.bd_planejamentos_obra
  WHERE id = p_planejamento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'planejamento não encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF v_status <> 'rascunho' THEN
    RAISE EXCEPTION 'somente rascunho pode ser tornado vigente' USING ERRCODE = '22023';
  END IF;

  IF NOT public.fn_is_super_admin(v_uid) THEN
    IF NOT public.user_has_permission_action(
             v_uid,
             'engenharia_planejamento_macro_ativar',
             'aprovar') THEN
      RAISE EXCEPTION 'sem permissão' USING ERRCODE = '42501';
    END IF;

    IF v_cc NOT IN (
      SELECT public.fn_planejamento_scope_centros_custo(v_uid)
    ) THEN
      RAISE EXCEPTION 'CC fora do escopo' USING ERRCODE = '42501';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('planejamento_vigente:' || v_cc::text, 0)
  );

  UPDATE public.bd_planejamentos_obra
     SET status = 'arquivado', updated_at = now()
   WHERE centro_custo_id = v_cc
     AND status = 'vigente'
     AND id <> p_planejamento_id;

  UPDATE public.bd_planejamentos_obra
     SET status = 'vigente',
         aprovado_por = v_uid,
         aprovado_em  = now(),
         updated_at   = now()
   WHERE id = p_planejamento_id
  RETURNING * INTO v_row;

  SELECT count(*) INTO v_count
  FROM public.bd_planejamentos_obra
  WHERE centro_custo_id = v_cc AND status = 'vigente';

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'invariante violado: mais de uma vigente' USING ERRCODE = '23505';
  END IF;

  RETURN v_row;
END
$$;

REVOKE ALL ON FUNCTION public.fn_planejamento_tornar_vigente(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_planejamento_tornar_vigente(uuid) TO authenticated;
