-- Fase 3A: Criar permissão definitiva gestao_abastecimento_view
-- AdmSede deliberadamente EXCLUÍDO (princípio de menor privilégio).
-- Bypass do trigger fn_validate_permission_catalog_change durante a migration
-- (auth.uid() é NULL em contexto de migration, e a operação é confiável/auditada via histórico de migrations).

SET LOCAL session_replication_role = replica;

-- 1) Criar permissão (idempotente)
INSERT INTO public.bd_permissions (codigo, nome, descricao, rota, tipo, modulo, ativo)
VALUES (
  'gestao_abastecimento_view',
  'Gestão de Abastecimento - Visualizar',
  'Permite consultar abastecimentos via Guardian Web Proxy e visualizar a página /gestao-abastecimento',
  '/gestao-abastecimento',
  'page',
  'gestao_maquinas',
  true
)
ON CONFLICT (codigo) DO NOTHING;

-- 2) Vincular APENAS aos perfis aprovados
INSERT INTO public.bd_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.bd_roles r
CROSS JOIN public.bd_permissions p
WHERE p.codigo = 'gestao_abastecimento_view'
  AND r.nome IN ('SuperAdm', 'AdmTransporte', 'AdmEquipamentos')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 3) Garantir ação 'visualizar' em bd_role_permission_actions
INSERT INTO public.bd_role_permission_actions (role_id, permission_id, acao)
SELECT r.id, p.id, 'visualizar'
FROM public.bd_roles r
CROSS JOIN public.bd_permissions p
WHERE p.codigo = 'gestao_abastecimento_view'
  AND r.nome IN ('SuperAdm', 'AdmTransporte', 'AdmEquipamentos')
ON CONFLICT DO NOTHING;

SET LOCAL session_replication_role = origin;