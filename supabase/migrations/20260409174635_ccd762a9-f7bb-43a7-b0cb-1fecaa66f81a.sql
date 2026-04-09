
-- 1a. Criar roles faltantes
INSERT INTO bd_roles (nome, descricao)
SELECT v.nome, v.descricao
FROM (VALUES
  ('AdmEquipamentos', 'Administrador de Equipamentos'),
  ('Operador', 'Operador de campo'),
  ('Usuário', 'Usuário padrão do sistema'),
  ('Gestor_Paulo_1767803550988', 'Gestor Paulo (migrado)')
) AS v(nome, descricao)
WHERE NOT EXISTS (SELECT 1 FROM bd_roles r WHERE r.nome = v.nome);

-- 1b. Popular bd_user_roles para usuários faltantes
INSERT INTO bd_user_roles (user_id, role_id)
SELECT p.id, r.id
FROM profiles p
JOIN bd_roles r ON (r.nome = p.funcoes[1] OR TRIM(r.nome) = TRIM(p.funcoes[1]))
WHERE p.funcoes IS NOT NULL 
  AND array_length(p.funcoes, 1) > 0
  AND NOT EXISTS (SELECT 1 FROM bd_user_roles ur WHERE ur.user_id = p.id)
ON CONFLICT DO NOTHING;

-- 1c. Create bd_permissoes_acoes
CREATE TABLE IF NOT EXISTS public.bd_permissoes_acoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_id uuid NOT NULL REFERENCES public.bd_permissions(id) ON DELETE CASCADE,
  acao text NOT NULL CHECK (acao IN ('visualizar', 'criar', 'editar', 'excluir', 'aprovar')),
  descricao text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (permission_id, acao)
);

-- 1d. Create bd_role_permission_actions
CREATE TABLE IF NOT EXISTS public.bd_role_permission_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.bd_roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.bd_permissions(id) ON DELETE CASCADE,
  acao text NOT NULL CHECK (acao IN ('visualizar', 'criar', 'editar', 'excluir', 'aprovar')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (role_id, permission_id, acao)
);

-- 1e. Create bd_user_permission_overrides
CREATE TABLE IF NOT EXISTS public.bd_user_permission_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.bd_permissions(id) ON DELETE CASCADE,
  acao text NOT NULL CHECK (acao IN ('visualizar', 'criar', 'editar', 'excluir', 'aprovar')),
  permitido boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, permission_id, acao)
);

-- 1f. Performance indexes
CREATE INDEX IF NOT EXISTS idx_role_perm_actions ON bd_role_permission_actions (role_id, permission_id, acao);
CREATE INDEX IF NOT EXISTS idx_user_overrides ON bd_user_permission_overrides (user_id, permission_id, acao);
CREATE INDEX IF NOT EXISTS idx_perm_acoes ON bd_permissoes_acoes (permission_id, acao);

-- 1g. Enable RLS
ALTER TABLE public.bd_permissoes_acoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bd_role_permission_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bd_user_permission_overrides ENABLE ROW LEVEL SECURITY;

-- RLS Policies (using existing is_super_admin function)
CREATE POLICY "authenticated_select_permissoes_acoes"
  ON public.bd_permissoes_acoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "superadm_insert_permissoes_acoes"
  ON public.bd_permissoes_acoes FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "superadm_update_permissoes_acoes"
  ON public.bd_permissoes_acoes FOR UPDATE TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "superadm_delete_permissoes_acoes"
  ON public.bd_permissoes_acoes FOR DELETE TO authenticated USING (public.is_super_admin(auth.uid()));

CREATE POLICY "authenticated_select_role_perm_actions"
  ON public.bd_role_permission_actions FOR SELECT TO authenticated USING (true);
CREATE POLICY "superadm_insert_role_perm_actions"
  ON public.bd_role_permission_actions FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "superadm_update_role_perm_actions"
  ON public.bd_role_permission_actions FOR UPDATE TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "superadm_delete_role_perm_actions"
  ON public.bd_role_permission_actions FOR DELETE TO authenticated USING (public.is_super_admin(auth.uid()));

CREATE POLICY "authenticated_select_user_overrides"
  ON public.bd_user_permission_overrides FOR SELECT TO authenticated USING (true);
CREATE POLICY "superadm_insert_user_overrides"
  ON public.bd_user_permission_overrides FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "superadm_update_user_overrides"
  ON public.bd_user_permission_overrides FOR UPDATE TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "superadm_delete_user_overrides"
  ON public.bd_user_permission_overrides FOR DELETE TO authenticated USING (public.is_super_admin(auth.uid()));

-- 1h. Seed: all permissions get 'visualizar' action
INSERT INTO bd_permissoes_acoes (permission_id, acao, descricao)
SELECT p.id, 'visualizar', 'Visualizar ' || p.codigo
FROM bd_permissions p
ON CONFLICT (permission_id, acao) DO NOTHING;

-- 1i. Seed: all role_permissions get 'visualizar' action
INSERT INTO bd_role_permission_actions (role_id, permission_id, acao)
SELECT rp.role_id, rp.permission_id, 'visualizar'
FROM bd_role_permissions rp
ON CONFLICT (role_id, permission_id, acao) DO NOTHING;
