-- =====================================================
-- G2: Gerente como apontador via permissão configurável
-- Sem hardcode de role. Validação por action RBAC + escopo de CC.
-- =====================================================

-- 1) Helper RBAC genérico (action-aware), sem hardcode de role.
CREATE OR REPLACE FUNCTION public.fn_has_action(
  p_user_id uuid,
  p_codigo  text,
  p_acoes   text[]
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.fn_is_super_admin(p_user_id)
    OR EXISTS (
      SELECT 1
        FROM public.bd_user_permission_overrides uo
        JOIN public.bd_permissions p ON p.id = uo.permission_id
       WHERE uo.user_id = p_user_id
         AND uo.permitido = true
         AND uo.acao = ANY(p_acoes)
         AND p.codigo = p_codigo
    )
    OR EXISTS (
      SELECT 1
        FROM public.bd_user_roles ur
        JOIN public.bd_role_permission_actions rpa ON rpa.role_id = ur.role_id
        JOIN public.bd_permissions p ON p.id = rpa.permission_id
        JOIN public.bd_roles r ON r.id = ur.role_id
       WHERE ur.user_id = p_user_id
         AND COALESCE(r.ativo, true) = true
         AND rpa.acao = ANY(p_acoes)
         AND p.codigo = p_codigo
         AND NOT EXISTS (
           SELECT 1 FROM public.bd_user_permission_overrides uod
            WHERE uod.user_id = p_user_id
              AND uod.permission_id = p.id
              AND uod.acao = rpa.acao
              AND uod.permitido = false
         )
    );
$$;

REVOKE ALL ON FUNCTION public.fn_has_action(uuid, text, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_has_action(uuid, text, text[]) TO authenticated;

COMMENT ON FUNCTION public.fn_has_action(uuid, text, text[]) IS
  'G2: verifica se usuário possui permissão (codigo) com ao menos uma das ações dadas, respeitando overrides individuais. Sem hardcode de role.';

-- 2) RPC principal: novo ramo RBAC + escopo de CC. Resto idêntico ao atual.
CREATE OR REPLACE FUNCTION public.get_apontadores_por_cc(
  p_user_id uuid,
  p_centro_custo_id uuid
) RETURNS TABLE (
  id uuid,
  nome_completo text,
  matricula text,
  status text,
  centro_custo_id uuid,
  funcao_id uuid,
  nome_funcao text,
  valor_diaria numeric,
  valor_diaria_exclusiva numeric,
  valor_refeicao numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_authorized    boolean := false;
  v_global_access boolean := false;
  v_user_func_id  uuid;
  v_user_cc       uuid;
  v_admsede_ccs   uuid[];
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  -- SuperAdm / AdmRH (mantido — roles de governança global)
  IF public.fn_is_super_admin(p_user_id)
     OR public.fn_has_role('AdmRH', p_user_id) THEN
    v_authorized := true;
    v_global_access := true;
  END IF;

  -- AdmSede (mantido)
  IF NOT v_authorized AND public.fn_has_role('AdmSede', p_user_id) THEN
    SELECT ARRAY(
      SELECT public.get_admsede_centros_custo(p_user_id)
    ) INTO v_admsede_ccs;

    IF v_admsede_ccs IS NOT NULL
       AND p_centro_custo_id IS NOT NULL
       AND p_centro_custo_id = ANY(v_admsede_ccs) THEN
      v_authorized := true;
    END IF;
  END IF;

  -- Perfis com funcionário vinculado
  IF NOT v_authorized THEN
    SELECT p.funcionario_id
      INTO v_user_func_id
      FROM public.profiles p
     WHERE p.id = p_user_id;

    IF v_user_func_id IS NOT NULL THEN
      SELECT f.centro_custo_id
        INTO v_user_cc
        FROM public.bd_funcionarios f
       WHERE f.id = v_user_func_id;
    END IF;

    -- Ramo AdmOBRA (mantido — D2.3-Rota3 já validada)
    IF public.fn_has_role('AdmOBRA', p_user_id)
       AND v_user_func_id IS NOT NULL
       AND p_centro_custo_id IS NOT NULL
       AND (
         v_user_cc = p_centro_custo_id
         OR EXISTS (
           SELECT 1
             FROM public.bd_centros_custo cc
            WHERE cc.id = p_centro_custo_id
              AND cc.adm_obra_funcionario_id = v_user_func_id
              AND COALESCE(cc.situacao, 'Ativo') = 'Ativo'
         )
         OR EXISTS (
           SELECT 1
             FROM public.bd_diaria_solicitacoes s
            WHERE s.centro_custo_id = p_centro_custo_id
              AND s.responsavel_campo_id = v_user_func_id
              AND s.status NOT IN ('cancelado', 'cancelada', 'reprovada')
         )
       ) THEN
      v_authorized := true;

    -- Ramo Encarregado/Apontador (mantido)
    ELSIF (public.fn_has_role('Encarregado', p_user_id)
           OR public.fn_has_role('Apontador', p_user_id))
          AND v_user_func_id IS NOT NULL
          AND p_centro_custo_id IS NOT NULL
          AND EXISTS (
            SELECT 1
              FROM public.bd_equipes e
              JOIN public.bd_funcionarios f ON f.equipe_id = e.id
             WHERE (e.encarregado_id = v_user_func_id OR e.apontador_id = v_user_func_id)
               AND f.centro_custo_id = p_centro_custo_id
          ) THEN
      v_authorized := true;

    -- Ramo NOVO G2: RBAC genérico — sem hardcode de role.
    -- Autoriza qualquer usuário com action de apontamento E CC dentro do seu escopo de Diárias.
    ELSIF v_user_func_id IS NOT NULL
          AND p_centro_custo_id IS NOT NULL
          AND p_centro_custo_id IN (
            SELECT public.fn_diaria_scope_centros_custo(p_user_id)
          )
          AND public.fn_has_action(
            p_user_id,
            'diarias_apontamento_view',
            ARRAY['criar','editar']::text[]
          ) THEN
      v_authorized := true;
    END IF;
  END IF;

  IF NOT v_authorized THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT f.id,
         f.nome_completo,
         f.matricula,
         f.status,
         f.centro_custo_id,
         f.funcao_id,
         fc.nome_funcao,
         fc.valor_diaria,
         fc.valor_diaria_exclusiva,
         fc.valor_refeicao
    FROM public.bd_funcionarios f
    LEFT JOIN public.bd_funcoes fc ON fc.id = f.funcao_id
   WHERE f.status IN ('Ativo', 'Ativo sem Registro')
     AND (
       (p_centro_custo_id IS NOT NULL AND f.centro_custo_id = p_centro_custo_id)
       OR (p_centro_custo_id IS NULL AND v_global_access)
     )
   ORDER BY f.nome_completo;
END;
$$;

REVOKE ALL ON FUNCTION public.get_apontadores_por_cc(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_apontadores_por_cc(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.get_apontadores_por_cc(uuid, uuid) IS
  'G2: ramo RBAC adicional autoriza qualquer usuário com action diarias_apontamento_view (criar|editar) cujo CC esteja em fn_diaria_scope_centros_custo. Sem hardcode de role para Gerente. Mantém comportamento prévio para SuperAdm/AdmRH/AdmSede/AdmOBRA/Apontador/Encarregado.';