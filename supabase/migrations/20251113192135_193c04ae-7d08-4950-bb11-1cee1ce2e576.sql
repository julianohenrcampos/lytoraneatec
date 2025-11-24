-- ========================================
-- MIGRAÇÃO: Permissões SSO Simplificadas
-- ========================================

-- 1. Criar a permissão de acesso ao Dashboard SSO
INSERT INTO bd_permissoes (nome_permissao, descricao, rota) 
VALUES ('acesso_sso_dashboard', 'Acesso ao Dashboard de Análise SSO NR-18', '/sso/checklists/dashboard')
ON CONFLICT (nome_permissao) DO NOTHING;

-- 2. Atribuir permissões SSO para SuperAdm
UPDATE bd_funcoes_permissao
SET permissoes = array_cat(
  permissoes, 
  (SELECT array_agg(id) FROM bd_permissoes WHERE nome_permissao IN ('acesso_sso_checklists', 'acesso_sso_dashboard'))
)
WHERE nome_funcao = 'SuperAdm'
AND NOT EXISTS (
  SELECT 1 FROM unnest(permissoes) p 
  WHERE p IN (SELECT id FROM bd_permissoes WHERE nome_permissao IN ('acesso_sso_checklists', 'acesso_sso_dashboard'))
);

-- 3. Atribuir permissões SSO para AdmAdmin
UPDATE bd_funcoes_permissao
SET permissoes = array_cat(
  permissoes, 
  (SELECT array_agg(id) FROM bd_permissoes WHERE nome_permissao IN ('acesso_sso_checklists', 'acesso_sso_dashboard'))
)
WHERE nome_funcao = 'AdmAdmin'
AND NOT EXISTS (
  SELECT 1 FROM unnest(permissoes) p 
  WHERE p IN (SELECT id FROM bd_permissoes WHERE nome_permissao IN ('acesso_sso_checklists', 'acesso_sso_dashboard'))
);

-- 4. Atribuir permissões SSO para Engenheiro Civil
UPDATE bd_funcoes_permissao
SET permissoes = array_cat(
  permissoes, 
  (SELECT array_agg(id) FROM bd_permissoes WHERE nome_permissao IN ('acesso_sso_checklists', 'acesso_sso_dashboard'))
)
WHERE nome_funcao = 'Engenheiro Civil'
AND NOT EXISTS (
  SELECT 1 FROM unnest(permissoes) p 
  WHERE p IN (SELECT id FROM bd_permissoes WHERE nome_permissao IN ('acesso_sso_checklists', 'acesso_sso_dashboard'))
);

-- 5. Atribuir permissões SSO para Encarregado
UPDATE bd_funcoes_permissao
SET permissoes = array_cat(
  permissoes, 
  (SELECT array_agg(id) FROM bd_permissoes WHERE nome_permissao IN ('acesso_sso_checklists', 'acesso_sso_dashboard'))
)
WHERE nome_funcao = 'Encarregado'
AND NOT EXISTS (
  SELECT 1 FROM unnest(permissoes) p 
  WHERE p IN (SELECT id FROM bd_permissoes WHERE nome_permissao IN ('acesso_sso_checklists', 'acesso_sso_dashboard'))
);

-- Comentário final
COMMENT ON TABLE bd_permissoes IS 'Permissões SSO configuradas: acesso_sso_checklists e acesso_sso_dashboard atribuídas a SuperAdm, AdmAdmin, Engenheiro Civil e Encarregado';