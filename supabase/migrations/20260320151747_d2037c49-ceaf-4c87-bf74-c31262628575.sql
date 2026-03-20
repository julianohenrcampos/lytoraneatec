
-- 1. Criar role GestorLicitacoes
INSERT INTO public.bd_roles (nome, descricao, ativo)
VALUES ('GestorLicitacoes', 'Gestor do módulo de Licitações PNCP', true);

-- 2. Vincular as 4 permissões de licitações
INSERT INTO public.bd_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.bd_roles r
CROSS JOIN public.bd_permissions p
WHERE r.nome = 'GestorLicitacoes'
  AND p.codigo IN ('dashboard_licitacoes_view', 'acesso_monitoramento_pncp', 'configuracoes_pncp_view', 'relatorio_licitacoes_view');
