-- Migration: Adicionar permissões de RH à função AdmLicitacoes
-- Data: 2026-01-06

-- Atualizar função AdmLicitacoes com permissões de Licitações + RH
UPDATE bd_funcoes_permissao 
SET permissoes = (
  SELECT ARRAY_AGG(id::uuid) 
  FROM bd_permissoes 
  WHERE nome_permissao IN (
    -- Licitações (já existentes)
    'acesso_monitoramento_pncp',
    'dashboard_licitacoes_view',
    'configuracoes_pncp_view',
    -- RH (novas)
    'gestao_rh_empresas_view',
    'gestao_rh_departamentos_view',
    'gestao_rh_centros_custo_view',
    'gestao_rh_funcoes_view',
    'gestao_rh_funcionarios_view'
  )
)::uuid[],
descricao = 'Administrador de Licitações - Acesso a licitações PNCP e gestão de RH do seu departamento',
updated_at = NOW()
WHERE nome_funcao = 'AdmLicitacoes';