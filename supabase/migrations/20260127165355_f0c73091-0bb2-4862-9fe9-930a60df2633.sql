-- Adicionar permissão de Agendamento de Exames à função AdmSSO
UPDATE public.bd_funcoes_permissao
SET permissoes = array_append(permissoes, 'ab3c9470-03b8-4760-8b84-49fe6b2484ed'::uuid)
WHERE nome_funcao = 'AdmSSO'
  AND NOT ('ab3c9470-03b8-4760-8b84-49fe6b2484ed'::uuid = ANY(permissoes));