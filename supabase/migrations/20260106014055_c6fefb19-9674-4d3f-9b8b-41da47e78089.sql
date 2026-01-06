-- Migration: Adicionar permissões completas para módulo de Licitações
-- Data: 2026-01-06

-- 1. Criar permissão para Dashboard de Licitações (se não existir)
INSERT INTO bd_permissoes (nome_permissao, descricao, rota)
SELECT 'dashboard_licitacoes_view', 'Visualizar Dashboard de Licitações', '/licitacoes/dashboard'
WHERE NOT EXISTS (SELECT 1 FROM bd_permissoes WHERE nome_permissao = 'dashboard_licitacoes_view');

-- 2. Criar permissão para Configurações PNCP (se não existir)
INSERT INTO bd_permissoes (nome_permissao, descricao, rota)
SELECT 'configuracoes_pncp_view', 'Visualizar e gerenciar Configurações do PNCP', '/licitacoes/configuracoes-pncp'
WHERE NOT EXISTS (SELECT 1 FROM bd_permissoes WHERE nome_permissao = 'configuracoes_pncp_view');

-- 3. Atualizar função AdmLicitacoes com todas as permissões de licitações (cast para uuid[])
UPDATE bd_funcoes_permissao 
SET permissoes = (
  SELECT ARRAY_AGG(id::uuid) 
  FROM bd_permissoes 
  WHERE nome_permissao IN (
    'acesso_monitoramento_pncp',
    'dashboard_licitacoes_view',
    'configuracoes_pncp_view'
  )
)::uuid[],
updated_at = NOW()
WHERE nome_funcao = 'AdmLicitacoes';