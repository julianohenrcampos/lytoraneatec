-- Corrige escopo de leitura de bd_funcionarios para usuários ADM SEDE.
-- 1) fn_can_access_funcionario_operacional: passa a usar fn_has_role (normaliza 'ADM SEDE' ↔ 'AdmSede' e lê bd_user_roles).
-- 2) fn_funcionarios_can_select_row: corrige o "SELECT setof INTO uuid[]" no ramo AdmSede usando array(SELECT ...).

CREATE OR REPLACE FUNCTION public.fn_can_access_funcionario_operacional(
  p_funcionario_id uuid,
  p_departamento_id uuid,
  p_centro_custo_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT (
    COALESCE(public.fn_is_super_admin(), false)
    OR COALESCE(public.check_is_super_admin(), false)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.acesso_global = true
    )
    OR public.fn_has_role('AdmRH', auth.uid())
    OR public.fn_has_role('AdmSSO', auth.uid())
    OR public.fn_has_role('AdmOBRA', auth.uid())
    OR public.fn_has_role('TecEnferSSO', auth.uid())
    OR public.fn_has_role('ConsultaExames', auth.uid())
    OR public.fn_has_role('AdmtreinoSSO', auth.uid())
    OR p_funcionario_id = (
      SELECT pr.funcionario_id FROM public.profiles pr
      WHERE pr.id = auth.uid() LIMIT 1
    )
    OR (
      public.fn_has_role('AdmSede', auth.uid())
      AND p_centro_custo_id IN (
        SELECT public.get_admsede_centros_custo(auth.uid())
      )
    )
    OR (
      (
        public.fn_has_role('TecSSO', auth.uid())
        OR public.fn_has_role('AdmLogistica', auth.uid())
        OR public.fn_has_role('AdmEquipamentos', auth.uid())
        OR public.fn_has_role('Encarregado', auth.uid())
        OR public.fn_has_role('Apontador', auth.uid())
        OR public.fn_has_role('GerenteRegional', auth.uid())
        OR public.fn_has_role('AdmTec', auth.uid())
        OR public.fn_has_role('JovemAdm', auth.uid())
        OR public.fn_has_role('EnferAdm', auth.uid())
      )
      AND p_departamento_id = public.get_user_departamento_id()
      AND public.get_user_departamento_id() IS NOT NULL
    )
  )
$function$;

CREATE OR REPLACE FUNCTION public.fn_funcionarios_can_select_row(
  p_user_id uuid,
  p_funcionario_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_funcionario_centro_custo uuid;
  v_funcionario_equipe uuid;
  v_funcionario_status text;
  v_user_funcionario_id uuid;
  v_user_equipes uuid[];
  v_user_ccs uuid[];
BEGIN
  IF p_user_id IS NULL OR p_funcionario_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.fn_is_super_admin(p_user_id) THEN
    RETURN true;
  END IF;

  IF public.fn_has_role('AdmRH', p_user_id)
     OR public.fn_has_role('AdmSSO', p_user_id)
     OR public.fn_has_role('TecEnferSSO', p_user_id)
     OR public.fn_has_role('ConsultaExames', p_user_id)
     OR public.fn_has_role('AdmtreinoSSO', p_user_id) THEN
    RETURN true;
  END IF;

  SELECT centro_custo_id, equipe_id, status
    INTO v_funcionario_centro_custo, v_funcionario_equipe, v_funcionario_status
  FROM public.bd_funcionarios
  WHERE id = p_funcionario_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT funcionario_id INTO v_user_funcionario_id
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_user_funcionario_id IS NOT NULL
     AND v_user_funcionario_id = p_funcionario_id THEN
    RETURN true;
  END IF;

  IF public.fn_has_role('Encarregado', p_user_id)
     OR public.fn_has_role('Apontador', p_user_id) THEN
    SELECT array_agg(e.id) INTO v_user_equipes
    FROM public.bd_equipes e
    WHERE e.encarregado_id = v_user_funcionario_id
       OR e.apontador_id  = v_user_funcionario_id;

    IF v_funcionario_equipe IS NOT NULL
       AND v_user_equipes IS NOT NULL
       AND v_funcionario_equipe = ANY (v_user_equipes) THEN
      RETURN true;
    END IF;
  END IF;

  IF public.fn_has_role('AdmOBRA', p_user_id) THEN
    IF v_funcionario_status IN ('Ativo', 'Ativo sem Registro') THEN
      RETURN true;
    END IF;
  END IF;

  -- AdmSede → CCs onde o usuário é adm_sede_funcionario_id.
  -- Correção: get_admsede_centros_custo retorna SETOF uuid; precisa de array(...) para uuid[].
  IF public.fn_has_role('AdmSede', p_user_id) THEN
    v_user_ccs := ARRAY(SELECT public.get_admsede_centros_custo(p_user_id));
    IF v_user_ccs IS NOT NULL
       AND v_funcionario_centro_custo IS NOT NULL
       AND v_funcionario_centro_custo = ANY (v_user_ccs) THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$function$;