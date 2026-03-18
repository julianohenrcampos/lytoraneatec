-- ====================================================
-- ETAPA 1: ESTRUTURA RBAC - Migração puramente estrutural
-- ====================================================

-- 1) Extensão pgcrypto
create extension if not exists pgcrypto;

-- 2) Tabela de Roles
create table if not exists public.bd_roles (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  descricao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_bd_roles_nome on public.bd_roles(nome);

-- 3) Tabela de Permissions
create table if not exists public.bd_permissions (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  descricao text,
  rota text,
  modulo text,
  tipo text not null default 'page',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_bd_permissions_codigo on public.bd_permissions(codigo);
create index if not exists idx_bd_permissions_rota on public.bd_permissions(rota);
create index if not exists idx_bd_permissions_modulo on public.bd_permissions(modulo);

-- 4) Relação Role x Permission
create table if not exists public.bd_role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.bd_roles(id) on delete cascade,
  permission_id uuid not null references public.bd_permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(role_id, permission_id)
);
create index if not exists idx_role_permissions_role on public.bd_role_permissions(role_id);
create index if not exists idx_role_permissions_permission on public.bd_role_permissions(permission_id);

-- 5) Relação User x Role
create table if not exists public.bd_user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.bd_roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, role_id)
);
create index if not exists idx_user_roles_user on public.bd_user_roles(user_id);
create index if not exists idx_user_roles_role on public.bd_user_roles(role_id);

-- 6) Seed SuperAdm
insert into public.bd_roles (nome, descricao)
select 'SuperAdm', 'Acesso total ao sistema'
where not exists (
  select 1 from public.bd_roles where nome = 'SuperAdm'
);

-- 7) Log de auditoria de permissões
create table if not exists public.bd_permission_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  rota text,
  permitido boolean,
  origem text,
  created_at timestamptz default now()
);
create index if not exists idx_permission_logs_user on public.bd_permission_audit_logs(user_id);
create index if not exists idx_permission_logs_rota on public.bd_permission_audit_logs(rota);

-- 8) RLS + Políticas
alter table public.bd_roles enable row level security;
alter table public.bd_permissions enable row level security;
alter table public.bd_role_permissions enable row level security;
alter table public.bd_user_roles enable row level security;
alter table public.bd_permission_audit_logs enable row level security;

-- Leitura para autenticados
create policy "read_roles" on public.bd_roles
  for select using (auth.role() = 'authenticated');

create policy "read_permissions" on public.bd_permissions
  for select using (auth.role() = 'authenticated');

create policy "read_role_permissions" on public.bd_role_permissions
  for select using (auth.role() = 'authenticated');

create policy "read_user_roles" on public.bd_user_roles
  for select using (auth.role() = 'authenticated');

create policy "read_logs" on public.bd_permission_audit_logs
  for select using (auth.role() = 'authenticated');

-- Escrita restrita a SuperAdmins
create policy "manage_roles" on public.bd_roles
  for all using (public.check_is_super_admin(auth.uid()))
  with check (public.check_is_super_admin(auth.uid()));

create policy "manage_permissions" on public.bd_permissions
  for all using (public.check_is_super_admin(auth.uid()))
  with check (public.check_is_super_admin(auth.uid()));

create policy "manage_role_permissions" on public.bd_role_permissions
  for all using (public.check_is_super_admin(auth.uid()))
  with check (public.check_is_super_admin(auth.uid()));

create policy "manage_user_roles" on public.bd_user_roles
  for all using (public.check_is_super_admin(auth.uid()))
  with check (public.check_is_super_admin(auth.uid()));

create policy "insert_logs" on public.bd_permission_audit_logs
  for insert with check (auth.role() = 'authenticated');