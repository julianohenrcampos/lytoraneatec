create or replace function public.fn_auth_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid()
$$;

create or replace function public.fn_is_super_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bd_user_roles ur
    join public.bd_roles r on r.id = ur.role_id
    where ur.user_id = p_user_id
      and coalesce(r.ativo, true) = true
      and r.nome = 'SuperAdm'
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and coalesce(p.acesso_global, false) = true
      and 'SuperAdm' = any(coalesce(p.funcoes, '{}'::text[]))
  )
$$;

create or replace function public.fn_has_role(p_role text, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_is_super_admin(p_user_id)
  or exists (
    select 1
    from public.bd_user_roles ur
    join public.bd_roles r on r.id = ur.role_id
    where ur.user_id = p_user_id
      and coalesce(r.ativo, true) = true
      and r.nome = p_role
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p_role = any(coalesce(p.funcoes, '{}'::text[]))
  )
$$;

create or replace function public.fn_has_permission(p_nome_permissao text, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_is_super_admin(p_user_id)
  or exists (
    select 1
    from public.bd_user_roles ur
    join public.bd_roles r on r.id = ur.role_id
    join public.bd_role_permissions rp on rp.role_id = r.id
    join public.bd_permissoes p on p.id = rp.permission_id
    where ur.user_id = p_user_id
      and coalesce(r.ativo, true) = true
      and p.nome_permissao = p_nome_permissao
  )
  or exists (
    select 1
    from public.bd_user_roles ur
    join public.bd_roles r on r.id = ur.role_id
    join public.bd_role_permission_actions rpa on rpa.role_id = r.id
    join public.bd_permissoes p on p.id = rpa.permission_id
    where ur.user_id = p_user_id
      and coalesce(r.ativo, true) = true
      and p.nome_permissao = p_nome_permissao
  )
  or exists (
    select 1
    from public.bd_user_permission_overrides uo
    join public.bd_permissoes p on p.id = uo.permission_id
    where uo.user_id = p_user_id
      and uo.permitido = true
      and p.nome_permissao = p_nome_permissao
  )
  or exists (
    select 1
    from public.profiles pr
    join public.bd_funcoes_permissao fp on fp.id = pr.funcao_permissao
    join public.bd_permissoes p on p.id = any(coalesce(fp.permissoes, '{}'::uuid[]))
    where pr.id = p_user_id
      and p.nome_permissao = p_nome_permissao
  )
$$;

create table if not exists public.bd_security_audit_log (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  table_name text null,
  view_name text null,
  rpc_name text null,
  user_id uuid null,
  target_id uuid null,
  contexto jsonb not null default '{}'::jsonb,
  ip text null,
  user_agent text null,
  created_at timestamp with time zone not null default now()
);

alter table public.bd_security_audit_log enable row level security;

drop policy if exists "security_audit_admin_read" on public.bd_security_audit_log;
create policy "security_audit_admin_read"
on public.bd_security_audit_log
for select
to authenticated
using (
  public.fn_is_super_admin()
  or public.fn_has_role('AdmRH')
  or public.fn_has_permission('admin_permissoes_view')
);

drop policy if exists "security_audit_no_direct_insert" on public.bd_security_audit_log;
create policy "security_audit_no_direct_insert"
on public.bd_security_audit_log
for insert
to authenticated
with check (false);

create or replace function public.fn_log_sensitive_read(
  p_event_type text,
  p_table_name text default null,
  p_view_name text default null,
  p_rpc_name text default null,
  p_target_id uuid default null,
  p_contexto jsonb default '{}'::jsonb,
  p_ip text default null,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.bd_security_audit_log (
    event_type,
    table_name,
    view_name,
    rpc_name,
    user_id,
    target_id,
    contexto,
    ip,
    user_agent
  ) values (
    p_event_type,
    p_table_name,
    p_view_name,
    p_rpc_name,
    auth.uid(),
    p_target_id,
    coalesce(p_contexto, '{}'::jsonb),
    p_ip,
    p_user_agent
  );
end;
$$;

create or replace view public.vw_profile_self_safe
with (security_invoker = on)
as
select
  p.id,
  p.email,
  p.nome_completo,
  p.imagem_url,
  p.funcionario_id,
  p.funcao_sistema,
  p.acesso_global
from public.profiles p;

create or replace view public.vw_profiles_admin_safe
with (security_invoker = on)
as
select
  p.id,
  p.email,
  p.nome_completo,
  p.imagem_url,
  p.funcionario_id,
  p.funcao_sistema,
  p.acesso_global,
  p.created_at,
  p.updated_at
from public.profiles p;

create or replace view public.vw_funcionarios_operacional
with (security_invoker = on)
as
select
  f.id,
  f.nome_completo,
  f.cpf,
  f.email,
  f.status,
  f.empresa_id,
  f.departamento_id,
  f.funcao_id,
  f.centro_custo_id,
  f.equipe_id,
  f.data_admissao,
  f.imagem,
  f.matricula,
  e.nome_empresa,
  d.nome_departamento,
  fu.nome_funcao,
  cc.nome_centro_custo
from public.bd_funcionarios f
left join public.bd_empresas e on e.id = f.empresa_id
left join public.bd_departamentos d on d.id = f.departamento_id
left join public.bd_funcoes fu on fu.id = f.funcao_id
left join public.bd_centros_custo cc on cc.id = f.centro_custo_id;

create or replace view public.vw_rbac_roles_safe
with (security_invoker = on)
as
select
  r.id,
  r.nome,
  r.descricao,
  r.ativo,
  r.created_at,
  r.updated_at
from public.bd_roles r;

create or replace view public.vw_rbac_permissions_safe
with (security_invoker = on)
as
select
  p.id,
  p.nome_permissao,
  p.descricao,
  p.rota,
  p.created_at,
  p.updated_at
from public.bd_permissoes p;

alter table public.bd_funcoes_permissao enable row level security;
alter table public.bd_permissoes enable row level security;
alter table public.bd_user_roles enable row level security;
alter table public.bd_roles enable row level security;
alter table public.bd_role_permissions enable row level security;
alter table public.bd_role_permission_actions enable row level security;
alter table public.bd_user_permission_overrides enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "rbac_funcoes_permissao_select" on public.bd_funcoes_permissao;
create policy "rbac_funcoes_permissao_select"
on public.bd_funcoes_permissao
for select
to authenticated
using (
  public.fn_is_super_admin()
  or public.fn_has_permission('admin_permissoes_view')
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.funcao_permissao = bd_funcoes_permissao.id
  )
);

drop policy if exists "rbac_funcoes_permissao_write" on public.bd_funcoes_permissao;
create policy "rbac_funcoes_permissao_write"
on public.bd_funcoes_permissao
for all
to authenticated
using (
  public.fn_is_super_admin()
  or public.fn_has_permission('admin_permissoes_view')
)
with check (
  public.fn_is_super_admin()
  or public.fn_has_permission('admin_permissoes_view')
);

drop policy if exists "rbac_permissions_select" on public.bd_permissoes;
create policy "rbac_permissions_select"
on public.bd_permissoes
for select
to authenticated
using (
  public.fn_is_super_admin()
  or public.fn_has_permission('admin_permissoes_view')
  or exists (
    select 1
    from public.profiles pr
    join public.bd_funcoes_permissao fp on fp.id = pr.funcao_permissao
    where pr.id = auth.uid()
      and bd_permissoes.id = any(coalesce(fp.permissoes, '{}'::uuid[]))
  )
);

drop policy if exists "rbac_permissions_write" on public.bd_permissoes;
create policy "rbac_permissions_write"
on public.bd_permissoes
for all
to authenticated
using (
  public.fn_is_super_admin()
  or public.fn_has_permission('admin_permissoes_view')
)
with check (
  public.fn_is_super_admin()
  or public.fn_has_permission('admin_permissoes_view')
);

drop policy if exists "rbac_roles_select" on public.bd_roles;
create policy "rbac_roles_select"
on public.bd_roles
for select
to authenticated
using (
  public.fn_is_super_admin()
  or public.fn_has_permission('admin_permissoes_view')
  or exists (
    select 1
    from public.bd_user_roles ur
    where ur.user_id = auth.uid()
      and ur.role_id = bd_roles.id
  )
);

drop policy if exists "rbac_roles_write" on public.bd_roles;
create policy "rbac_roles_write"
on public.bd_roles
for all
to authenticated
using (
  public.fn_is_super_admin()
  or public.fn_has_permission('admin_permissoes_view')
)
with check (
  public.fn_is_super_admin()
  or public.fn_has_permission('admin_permissoes_view')
);

drop policy if exists "rbac_user_roles_select" on public.bd_user_roles;
create policy "rbac_user_roles_select"
on public.bd_user_roles
for select
to authenticated
using (
  public.fn_is_super_admin()
  or public.fn_has_permission('admin_permissoes_view')
  or bd_user_roles.user_id = auth.uid()
);

drop policy if exists "rbac_user_roles_write" on public.bd_user_roles;
create policy "rbac_user_roles_write"
on public.bd_user_roles
for all
to authenticated
using (
  public.fn_is_super_admin()
  or public.fn_has_permission('admin_permissoes_view')
)
with check (
  public.fn_is_super_admin()
  or public.fn_has_permission('admin_permissoes_view')
);

drop policy if exists "rbac_role_permissions_select" on public.bd_role_permissions;
create policy "rbac_role_permissions_select"
on public.bd_role_permissions
for select
to authenticated
using (
  public.fn_is_super_admin()
  or public.fn_has_permission('admin_permissoes_view')
  or exists (
    select 1
    from public.bd_user_roles ur
    where ur.user_id = auth.uid()
      and ur.role_id = bd_role_permissions.role_id
  )
);

drop policy if exists "rbac_role_permissions_write" on public.bd_role_permissions;
create policy "rbac_role_permissions_write"
on public.bd_role_permissions
for all
to authenticated
using (
  public.fn_is_super_admin()
  or public.fn_has_permission('admin_permissoes_view')
)
with check (
  public.fn_is_super_admin()
  or public.fn_has_permission('admin_permissoes_view')
);

drop policy if exists "rbac_role_permission_actions_select" on public.bd_role_permission_actions;
create policy "rbac_role_permission_actions_select"
on public.bd_role_permission_actions
for select
to authenticated
using (
  public.fn_is_super_admin()
  or public.fn_has_permission('admin_permissoes_view')
  or exists (
    select 1
    from public.bd_user_roles ur
    where ur.user_id = auth.uid()
      and ur.role_id = bd_role_permission_actions.role_id
  )
);

drop policy if exists "rbac_role_permission_actions_write" on public.bd_role_permission_actions;
create policy "rbac_role_permission_actions_write"
on public.bd_role_permission_actions
for all
to authenticated
using (
  public.fn_is_super_admin()
  or public.fn_has_permission('admin_permissoes_view')
)
with check (
  public.fn_is_super_admin()
  or public.fn_has_permission('admin_permissoes_view')
);

drop policy if exists "rbac_user_permission_overrides_select" on public.bd_user_permission_overrides;
create policy "rbac_user_permission_overrides_select"
on public.bd_user_permission_overrides
for select
to authenticated
using (
  public.fn_is_super_admin()
  or public.fn_has_permission('admin_permissoes_view')
  or bd_user_permission_overrides.user_id = auth.uid()
);

drop policy if exists "rbac_user_permission_overrides_write" on public.bd_user_permission_overrides;
create policy "rbac_user_permission_overrides_write"
on public.bd_user_permission_overrides
for all
to authenticated
using (
  public.fn_is_super_admin()
  or public.fn_has_permission('admin_permissoes_view')
)
with check (
  public.fn_is_super_admin()
  or public.fn_has_permission('admin_permissoes_view')
);

drop policy if exists "profiles_self_select_safe" on public.profiles;
create policy "profiles_self_select_safe"
on public.profiles
for select
to authenticated
using (id = public.fn_auth_user_id());

drop policy if exists "profiles_admin_select_safe" on public.profiles;
create policy "profiles_admin_select_safe"
on public.profiles
for select
to authenticated
using (
  public.fn_is_super_admin()
  or public.fn_has_permission('admin_permissoes_view')
  or public.fn_has_role('AdmRH')
  or public.fn_has_role('AdmLogistica')
  or public.fn_has_role('AdmEquipamentos')
  or public.fn_has_role('Financeiro')
  or public.fn_has_role('DP')
);

drop policy if exists "profiles_self_update_safe" on public.profiles;
create policy "profiles_self_update_safe"
on public.profiles
for update
to authenticated
using (id = public.fn_auth_user_id())
with check (id = public.fn_auth_user_id());