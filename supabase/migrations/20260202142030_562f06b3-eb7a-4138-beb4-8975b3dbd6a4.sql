-- Inserir a função "Gerente Regional" na tabela bd_funcoes
-- Sem ON CONFLICT pois não há constraint única
INSERT INTO public.bd_funcoes (nome_funcao, descricao, situacao)
SELECT 'Gerente Regional', 'Responsável por aprovar diárias dos centros de custo sob sua gestão', 'Ativo'
WHERE NOT EXISTS (
  SELECT 1 FROM public.bd_funcoes WHERE nome_funcao = 'Gerente Regional'
);