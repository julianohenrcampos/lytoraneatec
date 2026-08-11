ALTER TABLE public.bd_funcionario_classificacao_solicitacoes
  ADD COLUMN IF NOT EXISTS salario_atual numeric,
  ADD COLUMN IF NOT EXISTS salario_novo numeric;

COMMENT ON COLUMN public.bd_funcionario_classificacao_solicitacoes.salario_atual IS 'Snapshot do salario base do funcionario no momento da emissao da solicitacao.';
COMMENT ON COLUMN public.bd_funcionario_classificacao_solicitacoes.salario_novo IS 'Snapshot do salario base do novo cargo no momento da emissao da solicitacao.';