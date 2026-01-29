-- Criar função JovemAdm
INSERT INTO bd_funcoes_permissao (nome_funcao, descricao, permissoes)
VALUES (
  'JovemAdm',
  'Jovem Aprendiz Administrativo - Acesso apenas ao Agendamento de Exames',
  ARRAY[
    'f534a5e2-7650-4a2a-aa84-918081497da6'::uuid,
    'ab3c9470-03b8-4760-8b84-49fe6b2484ed'::uuid
  ]
);

-- Criar função TecEnferSSO
INSERT INTO bd_funcoes_permissao (nome_funcao, descricao, permissoes)
VALUES (
  'TecEnferSSO',
  'Técnico de Enfermagem SSO - Acesso apenas ao Agendamento de Exames',
  ARRAY[
    'f534a5e2-7650-4a2a-aa84-918081497da6'::uuid,
    'ab3c9470-03b8-4760-8b84-49fe6b2484ed'::uuid
  ]
);