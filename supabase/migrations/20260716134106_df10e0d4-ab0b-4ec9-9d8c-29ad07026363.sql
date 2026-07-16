SET LOCAL session_replication_role = replica;

INSERT INTO public.bd_permissions (codigo, nome, descricao)
VALUES ('gestao_rh_funcionarios_edit', 'Editar Funcionários', 'Permite editar dados de funcionários no cadastro de RH')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.bd_role_permission_actions (role_id, permission_id, acao)
SELECT r.id, p.id, 'editar'
FROM public.bd_roles r
CROSS JOIN public.bd_permissions p
WHERE r.nome = 'AdmSede'
  AND p.codigo = 'gestao_rh_funcionarios_edit'
ON CONFLICT DO NOTHING;

SET LOCAL session_replication_role = origin;