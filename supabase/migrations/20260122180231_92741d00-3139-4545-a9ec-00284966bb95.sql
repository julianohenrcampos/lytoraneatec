
-- Adicionar permissão acesso_sso_desvios ao AdmSSO
UPDATE bd_funcoes_permissao 
SET permissoes = array_append(permissoes, 'b2bd99ec-be04-4afe-94d1-2342e0df9c04'),
    updated_at = now()
WHERE nome_funcao = 'AdmSSO' 
  AND NOT ('b2bd99ec-be04-4afe-94d1-2342e0df9c04' = ANY(permissoes));

-- Adicionar permissão acesso_sso_desvios ao TecSSO
UPDATE bd_funcoes_permissao 
SET permissoes = array_append(permissoes, 'b2bd99ec-be04-4afe-94d1-2342e0df9c04'),
    updated_at = now()
WHERE nome_funcao = 'TecSSO' 
  AND NOT ('b2bd99ec-be04-4afe-94d1-2342e0df9c04' = ANY(permissoes));
