
BEGIN;
SET LOCAL session_replication_role = replica;

INSERT INTO public.bd_permissions (codigo, nome, descricao, rota, modulo, tipo, ativo)
VALUES
  ('centros_custo_operacional_todos',
   'CC Operacional — Todos',
   'Permite visualizar todos os centros de custo ativos em campos operacionais (dropdowns/selects), sem conceder acesso administrativo ao cadastro de Centros de Custo.',
   NULL, 'operacional', 'scope', true),
  ('centros_custo_operacional_vinculados',
   'CC Operacional — Vinculados',
   'Permite visualizar apenas os centros de custo vinculados ao usuário/equipe em campos operacionais, sem conceder acesso administrativo ao cadastro de Centros de Custo.',
   NULL, 'operacional', 'scope', true)
ON CONFLICT (codigo) DO UPDATE
  SET nome = EXCLUDED.nome,
      descricao = EXCLUDED.descricao,
      modulo = EXCLUDED.modulo,
      tipo = EXCLUDED.tipo,
      ativo = true,
      rota = NULL,
      updated_at = now();

INSERT INTO public.bd_permissoes (nome_permissao, descricao, rota)
VALUES
  ('centros_custo_operacional_todos',
   'LEGADO/COMPAT — CC Operacional — Todos. Fonte oficial: bd_permissions.',
   NULL),
  ('centros_custo_operacional_vinculados',
   'LEGADO/COMPAT — CC Operacional — Vinculados. Fonte oficial: bd_permissions.',
   NULL)
ON CONFLICT (nome_permissao) DO UPDATE
  SET descricao = EXCLUDED.descricao,
      rota = NULL,
      updated_at = now();

INSERT INTO public.bd_role_permission_actions (role_id, permission_id, acao)
SELECT r.id, p.id, a.acao
FROM public.bd_roles r
CROSS JOIN public.bd_permissions p
CROSS JOIN (VALUES ('visualizar'),('criar'),('editar'),('excluir')) AS a(acao)
WHERE r.nome = 'Apontador'
  AND p.codigo = 'centros_custo_operacional_todos'
ON CONFLICT DO NOTHING;

COMMIT;
