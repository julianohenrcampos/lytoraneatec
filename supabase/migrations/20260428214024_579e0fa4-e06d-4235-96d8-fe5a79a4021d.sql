CREATE OR REPLACE FUNCTION public.get_funcionarios_ativos_global()
 RETURNS TABLE(id uuid, nome_completo text, cpf text, funcao_id uuid, centro_custo_id uuid, matricula text, status text, email text, nome_funcao text, valor_diaria numeric, valor_diaria_exclusiva numeric, valor_refeicao numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Apenas exige usuário autenticado. Controle de acesso é feito nas camadas
  -- superiores (RBAC via usePermission/ActionGuard + RLS nas tabelas de Diárias).
  -- Esta RPC é apenas uma listagem operacional unificada de funcionários ativos.
  IF auth.uid() IS NULL THEN
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
$function$;

COMMENT ON FUNCTION public.get_funcionarios_ativos_global() IS
'Lista unificada de funcionários ativos para uso operacional (Diárias, Solicitações). Sem gate de role: controle de acesso é exclusivo das camadas superiores (RBAC via usePermission/ActionGuard + RLS nas tabelas de fluxo). Exige apenas usuário autenticado.';