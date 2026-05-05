BEGIN;

UPDATE profiles
SET funcao_permissao = NULL
WHERE id = '42f46549-6335-4065-85a0-5fa978211ec1'
  AND funcao_permissao = '4a325479-4c97-4999-a24a-87d3901a06a2';

DELETE FROM bd_funcoes_permissao
WHERE id = '4a325479-4c97-4999-a24a-87d3901a06a2'
  AND nome_funcao LIKE 'Gestor_Gestor_QA_RBAC_d1_%';

DELETE FROM profiles
WHERE id = '42f46549-6335-4065-85a0-5fa978211ec1'
  AND email = 'qa+rbac-d1-202605041500@qa.lytoranea.com.br';

COMMIT;