DROP FUNCTION IF EXISTS public.get_funcionarios_para_diarias();

CREATE FUNCTION public.get_funcionarios_para_diarias()
RETURNS TABLE (
  id uuid,
  nome_completo text,
  cpf text,
  funcao_id uuid,
  funcao_nome text,
  valor_diaria numeric,
  valor_diaria_exclusiva numeric,
  valor_refeicao numeric,
  centro_custo_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    f.id,
    f.nome_completo,
    f.cpf,
    f.funcao_id,
    fn.nome_funcao,
    fn.valor_diaria,
    fn.valor_diaria_exclusiva,
    fn.valor_refeicao,
    f.centro_custo_id
  FROM bd_funcionarios f
  LEFT JOIN bd_funcoes fn ON fn.id = f.funcao_id
  WHERE f.status = 'Ativo'
  ORDER BY f.nome_completo;
$$;