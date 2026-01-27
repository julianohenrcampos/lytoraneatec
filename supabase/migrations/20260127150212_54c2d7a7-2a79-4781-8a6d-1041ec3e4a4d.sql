-- Criar função AssAdm (Assistente Administrativo)
INSERT INTO public.bd_funcoes_permissao (nome_funcao, descricao, permissoes)
VALUES (
  'AssAdm',
  'Assistente Administrativo - Acesso ao Agendamento de Exames',
  ARRAY[
    'f534a5e2-7650-4a2a-aa84-918081497da6'::uuid,
    'ab3c9470-03b8-4760-8b84-49fe6b2484ed'::uuid
  ]
)
ON CONFLICT (nome_funcao) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  permissoes = EXCLUDED.permissoes;

-- Criar função EnferAdm (Enfermeiro Administrativo)  
INSERT INTO public.bd_funcoes_permissao (nome_funcao, descricao, permissoes)
VALUES (
  'EnferAdm',
  'Enfermeiro Administrativo - Acesso ao Agendamento de Exames',
  ARRAY[
    'f534a5e2-7650-4a2a-aa84-918081497da6'::uuid,
    'ab3c9470-03b8-4760-8b84-49fe6b2484ed'::uuid
  ]
)
ON CONFLICT (nome_funcao) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  permissoes = EXCLUDED.permissoes;