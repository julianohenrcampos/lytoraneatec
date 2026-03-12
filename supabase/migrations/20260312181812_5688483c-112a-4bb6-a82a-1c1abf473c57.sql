
DROP FUNCTION IF EXISTS get_funcionarios_para_diarias();

CREATE FUNCTION get_funcionarios_para_diarias()
RETURNS TABLE(
  id uuid,
  nome_completo text,
  cpf text,
  funcao_id uuid,
  centro_custo_id uuid,
  funcao_nome text,
  valor_diaria numeric,
  valor_diaria_exclusiva numeric,
  valor_refeicao numeric,
  matricula text,
  status_funcionario text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    f.id,
    f.nome_completo,
    f.cpf,
    f.funcao_id,
    f.centro_custo_id,
    fn.nome_funcao AS funcao_nome,
    fn.valor_diaria,
    fn.valor_diaria_exclusiva,
    fn.valor_refeicao,
    f.matricula,
    f.status AS status_funcionario
  FROM bd_funcionarios f
  LEFT JOIN bd_funcoes fn ON fn.id = f.funcao_id
  WHERE f.status = 'Ativo'
  ORDER BY f.nome_completo;
$$;
