CREATE OR REPLACE FUNCTION public.fn_funcionarios_can_select_row(p_user_id uuid, p_funcionario_id uuid)
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
  -- Guardas básicas
  IF p_user_id IS NULL OR p_funcionario_id IS NULL THEN
    RETURN false;
  END IF;

  -- 1) Bypass total: SuperAdm
  IF public.fn_is_super_admin(p_user_id) THEN
    RETURN true;
  END IF;

  -- 2) Roles globais de RH/SSO → acesso total operacional
  IF public.fn_has_role('AdmRH', p_user_id)
     OR public.fn_has_role('AdmSSO', p_user_id)
     OR public.fn_has_role('TecEnferSSO', p_user_id)
     OR public.fn_has_role('ConsultaExames', p_user_id)
     OR public.fn_has_role('AdmtreinoSSO', p_user_id) THEN
    RETURN true;
  END IF;

  -- Carrega dados do funcionário-alvo
  SELECT centro_custo_id, equipe_id, status
    INTO v_funcionario_centro_custo, v_funcionario_equipe, v_funcionario_status
  FROM public.bd_funcionarios
  WHERE id = p_funcionario_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- 3) Próprio registro (Motorista, Operador, Usuário e quaisquer outros)
  SELECT funcionario_id INTO v_user_funcionario_id
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_user_funcionario_id IS NOT NULL
     AND v_user_funcionario_id = p_funcionario_id THEN
    RETURN true;
  END IF;

  -- 4) Encarregado / Apontador → apenas funcionários da SUA equipe
  IF public.fn_has_role('Encarregado', p_user_id)
     OR public.fn_has_role('Apontador', p_user_id) THEN

    SELECT array_agg(e.id)
      INTO v_user_equipes
    FROM public.bd_equipes e
    WHERE e.encarregado_id = v_user_funcionario_id
       OR e.apontador_id  = v_user_funcionario_id;

    IF v_funcionario_equipe IS NOT NULL
       AND v_user_equipes IS NOT NULL
       AND v_funcionario_equipe = ANY (v_user_equipes) THEN
      RETURN true;
    END IF;
  END IF;

  -- 5) AdmOBRA → leitura operacional ampla
  --    Pode visualizar QUALQUER funcionário com status operacional ativo,
  --    para suportar convocação de mão de obra entre centros de custo
  --    (ex.: Diárias com empréstimo de pessoal de outra obra).
  --    Restrições de escrita continuam regidas pelas políticas
  --    funcionarios_insert_restrito / funcionarios_update_restrito /
  --    funcionarios_delete_restrito.
  --    Dados sensíveis (CPF, e-mail, banco, endereço) seguem protegidos
  --    por fn_can_access_funcionario_sensitive — AdmOBRA NÃO ganha PII.
  IF public.fn_has_role('AdmOBRA', p_user_id) THEN
    IF v_funcionario_status IN ('Ativo', 'Ativo sem Registro') THEN
      RETURN true;
    END IF;
  END IF;

  -- 6) AdmSede → CCs gerenciados (apenas dados operacionais; financeiro será tratado em coluna/relatório)
  IF public.fn_has_role('AdmSede', p_user_id) THEN
    SELECT public.get_admsede_centros_custo(p_user_id) INTO v_user_ccs;
    IF v_user_ccs IS NOT NULL
       AND v_funcionario_centro_custo = ANY (v_user_ccs) THEN
      RETURN true;
    END IF;
  END IF;

  -- 7) Default: nega
  RETURN false;
END;
$function$;