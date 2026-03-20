-- Create the missing permission in legacy table
INSERT INTO public.bd_permissoes (nome_permissao, descricao, rota)
VALUES ('relatorio_licitacoes_view', 'Relatório de Licitações', '/licitacoes/relatorios')
ON CONFLICT DO NOTHING;

-- Create GestorLicitacoes in legacy bd_funcoes_permissao with proper cast
INSERT INTO public.bd_funcoes_permissao (nome_funcao, descricao, permissoes)
SELECT 
  'GestorLicitacoes',
  'Gestor do módulo de Licitações PNCP',
  ARRAY(
    SELECT id FROM public.bd_permissoes 
    WHERE nome_permissao IN (
      'dashboard_licitacoes_view',
      'acesso_monitoramento_pncp',
      'configuracoes_pncp_view',
      'relatorio_licitacoes_view'
    )
  )::uuid[];
