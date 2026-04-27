CREATE OR REPLACE FUNCTION public.get_funcionarios_ativos_global()
RETURNS TABLE (
  id                       uuid,
  nome_completo            text,
  cpf                      text,
  funcao_id                uuid,
  centro_custo_id          uuid,
  matricula                text,
  status                   text,
  email                    text,
  nome_funcao              text,
  valor_diaria             numeric,
  valor_diaria_exclusiva   numeric,
  valor_refeicao           numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_pode boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  -- Fast-path 1: SuperAdm ou profiles.acesso_global = true
  IF public.fn_diaria_has_global_access(v_uid) THEN
    v_pode := true;
  -- Fast-path 2: Roles operacionais com visão ampla no fluxo de Diárias
  ELSIF public.fn_has_role('AdmOBRA',         v_uid)
     OR public.fn_has_role('AdmRH',           v_uid)
     OR public.fn_has_role('AdmSSO',          v_uid)
     OR public.fn_has_role('TecEnferSSO',     v_uid)
     OR public.fn_has_role('AdmtreinoSSO',    v_uid)
     OR public.fn_has_role('ConsultaExames',  v_uid)
     OR public.fn_has_role('AdmSede',         v_uid)
     OR public.fn_has_role('GerenteRegional', v_uid)
     OR public.fn_has_role('Gerente',         v_uid) THEN
    v_pode := true;
  END IF;

  IF NOT v_pode THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    f.id,
    f.nome_completo,
    f.cpf,
    f.funcao_id,
    f.centro_custo_id,
    f.matricula,
    f.status,
    f.email,
    bf.nome_funcao,
    COALESCE(bf.valor_diaria, 0)   AS valor_diaria,
    bf.valor_diaria_exclusiva,
    COALESCE(bf.valor_refeicao, 0) AS valor_refeicao
  FROM public.bd_funcionarios f
  LEFT JOIN public.bd_funcoes bf ON bf.id = f.funcao_id
  WHERE f.status IN ('Ativo', 'Ativo sem Registro')
  ORDER BY f.nome_completo ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_funcionarios_ativos_global() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_funcionarios_ativos_global() TO authenticated;