
ALTER TABLE public.bd_permissions DISABLE TRIGGER USER;
INSERT INTO public.bd_permissions (codigo, nome, descricao, rota, tipo, modulo, ativo)
SELECT 'central_aprovacoes_view',
       'Acesso à Central de Aprovações',
       'Permite visualizar a Central Corporativa de Aprovações',
       '/gestao-rh/central-aprovacoes',
       'page',
       'gestao_rh',
       true
WHERE NOT EXISTS (SELECT 1 FROM public.bd_permissions WHERE codigo = 'central_aprovacoes_view');
ALTER TABLE public.bd_permissions ENABLE TRIGGER USER;
