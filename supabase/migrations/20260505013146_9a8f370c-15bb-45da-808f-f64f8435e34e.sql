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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_authorized boolean := false;
  v_global_access boolean := false;
  v_user_func_id uuid;
  v_user_cc uuid;
  v_admsede_ccs uuid[];
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  -- SuperAdm / AdmRH: autorizam a consulta, mas o retorno continua filtrado
  -- por p_centro_custo_id quando informado.
  IF public.fn_is_super_admin(p_user_id)
     OR public.fn_has_role('AdmRH', p_user_id) THEN
    v_authorized := true;
    v_global_access := true;
  END IF;

  -- AdmSede: get_admsede_centros_custo retorna SETOF uuid.
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

  -- Perfis vinculados a funcionário.
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

    IF public.fn_has_role('AdmOBRA', p_user_id)
       AND v_user_func_id IS NOT NULL
       AND p_centro_custo_id IS NOT NULL
       AND (
         -- vínculo direto do funcionário ao CC
         v_user_cc = p_centro_custo_id

         -- D2.3-Rota3: AdmOBRA multiobra oficial pelo cadastro do CC
         OR EXISTS (
           SELECT 1
             FROM public.bd_centros_custo cc
            WHERE cc.id = p_centro_custo_id
              AND cc.adm_obra_funcionario_id = v_user_func_id
              AND COALESCE(cc.situacao, 'Ativo') = 'Ativo'
         )

         -- D2.3-Rota3: responsável de campo em solicitação ativa do CC
         OR EXISTS (
           SELECT 1
             FROM public.bd_diaria_solicitacoes s
            WHERE s.centro_custo_id = p_centro_custo_id
              AND s.responsavel_campo_id = v_user_func_id
              AND s.status NOT IN ('cancelado', 'cancelada', 'reprovada')
         )
       ) THEN
      v_authorized := true;

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
       -- Quando CC é informado, SEMPRE restringe ao CC, inclusive SuperAdm/AdmRH.
       (p_centro_custo_id IS NOT NULL AND f.centro_custo_id = p_centro_custo_id)

       -- Compatibilidade: se CC vier nulo, apenas acesso global retorna todos.
       OR (p_centro_custo_id IS NULL AND v_global_access)
     )
   ORDER BY f.nome_completo;
END;
$$;

REVOKE ALL ON FUNCTION public.get_apontadores_por_cc(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_apontadores_por_cc(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.get_apontadores_por_cc(uuid, uuid) IS
  'D2.3-Rota3: retorna funcionários ativos do CC selecionado para Apontador/Resp. Campo. AdmOBRA autorizado por CC primário, adm_obra_funcionario_id ou responsável de campo ativo. SuperAdm/AdmRH também respeitam p_centro_custo_id quando informado. Sem filtro rígido por role Apontador nesta fase.';