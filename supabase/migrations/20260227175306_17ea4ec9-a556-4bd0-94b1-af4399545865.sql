INSERT INTO bd_funcoes_permissao (nome_funcao, descricao, permissoes)
SELECT 'AdmOBRA', 'Administrador de Obra - mesmas permissões do AdmSSO', permissoes
FROM bd_funcoes_permissao
WHERE nome_funcao = 'AdmSSO';