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
      and (
        coalesce(p.acesso_global, false) = true
        or 'SuperAdm' = any(coalesce(p.funcoes, '{}'::text[]))
        or coalesce(p.funcao_sistema, '') = 'SuperAdm'
      )
  )
  or exists (
    select 1
    from public.profiles p
    join public.bd_funcoes_permissao fp on fp.id = p.funcao_permissao
    where p.id = p_user_id
      and fp.nome_funcao = 'SuperAdm'
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
    left join public.bd_funcoes_permissao fp on fp.id = p.funcao_permissao
    where p.id = p_user_id
      and (
        p_role = any(coalesce(p.funcoes, '{}'::text[]))
        or coalesce(p.funcao_sistema, '') = p_role
        or coalesce(fp.nome_funcao, '') = p_role
      )
  )
$$;

create or replace function public.fn_has_permission(p_nome_permissao text, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with explicit_deny as (
    select 1
    from public.bd_user_permission_overrides uo
    join public.bd_permissoes p on p.id = uo.permission_id
    where uo.user_id = p_user_id
      and uo.permitido = false
      and p.nome_permissao = p_nome_permissao
    limit 1
  ), explicit_allow as (
    select 1
    from public.bd_user_permission_overrides uo
    join public.bd_permissoes p on p.id = uo.permission_id
    where uo.user_id = p_user_id
      and uo.permitido = true
      and p.nome_permissao = p_nome_permissao
    limit 1
  ), role_allow as (
    select 1
    from public.bd_user_roles ur
    join public.bd_roles r on r.id = ur.role_id
    left join public.bd_role_permissions rp on rp.role_id = r.id
    left join public.bd_role_permission_actions rpa on rpa.role_id = r.id
    left join public.bd_permissoes p_rp on p_rp.id = rp.permission_id
    left join public.bd_permissoes p_rpa on p_rpa.id = rpa.permission_id
    where ur.user_id = p_user_id
      and coalesce(r.ativo, true) = true
      and (
        p_rp.nome_permissao = p_nome_permissao
        or p_rpa.nome_permissao = p_nome_permissao
      )
    limit 1
  ), legacy_allow as (
    select 1
    from public.profiles pr
    join public.bd_funcoes_permissao fp on fp.id = pr.funcao_permissao
    join public.bd_permissoes p on p.id = any(coalesce(fp.permissoes, '{}'::uuid[]))
    where pr.id = p_user_id
      and p.nome_permissao = p_nome_permissao
    limit 1
  )
  select case
    when public.fn_is_super_admin(p_user_id) then true
    when exists (select 1 from explicit_deny) then false
    when exists (select 1 from explicit_allow) then true
    when exists (select 1 from role_allow) then true
    when exists (select 1 from legacy_allow) then true
    else false
  end
$$;

create or replace function public.check_is_super_admin(user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_is_super_admin(user_id)
$$;

create or replace function public.check_is_super_admin_new(user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_is_super_admin(user_id)
$$;

create or replace function public.check_is_super_admin_hybrid(user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_is_super_admin(user_id)
$$;

create or replace function public.user_has_permission(user_id uuid, permission_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_has_permission(permission_name, user_id)
$$;

create or replace function public.has_permission(p_permission_name text, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_has_permission(p_permission_name, p_user_id)
$$;

create or replace function public.has_role(p_role text, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_has_role(p_role, p_user_id)
$$;

create or replace function public.fn_get_my_permission_snapshot()
returns table (
  user_id uuid,
  is_super_admin boolean,
  role_names text[],
  permission_names text[],
  permission_codes text[],
  allowed_routes text[]
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select public.fn_auth_user_id() as uid
  ), role_rows as (
    select distinct r.nome
    from me
    join public.bd_user_roles ur on ur.user_id = me.uid
    join public.bd_roles r on r.id = ur.role_id
    where coalesce(r.ativo, true) = true
    union
    select distinct unnest(coalesce(p.funcoes, '{}'::text[]))
    from me
    join public.profiles p on p.id = me.uid
    union
    select distinct fp.nome_funcao
    from me
    join public.profiles p on p.id = me.uid
    join public.bd_funcoes_permissao fp on fp.id = p.funcao_permissao
    where fp.nome_funcao is not null
  ), permission_rows as (
    select distinct p.nome_permissao, p.rota
    from me
    join public.bd_user_roles ur on ur.user_id = me.uid
    join public.bd_roles r on r.id = ur.role_id
    left join public.bd_role_permissions rp on rp.role_id = r.id
    left join public.bd_role_permission_actions rpa on rpa.role_id = r.id
    left join public.bd_permissoes p on p.id = coalesce(rp.permission_id, rpa.permission_id)
    where coalesce(r.ativo, true) = true
      and p.id is not null
    union
    select distinct p.nome_permissao, p.rota
    from me
    join public.profiles pr on pr.id = me.uid
    join public.bd_funcoes_permissao fp on fp.id = pr.funcao_permissao
    join public.bd_permissoes p on p.id = any(coalesce(fp.permissoes, '{}'::uuid[]))
    union
    select distinct p.nome_permissao, p.rota
    from me
    join public.bd_user_permission_overrides uo on uo.user_id = me.uid and uo.permitido = true
    join public.bd_permissoes p on p.id = uo.permission_id
  )
  select
    me.uid as user_id,
    public.fn_is_super_admin(me.uid) as is_super_admin,
    coalesce((select array_agg(distinct rr.nome order by rr.nome) from role_rows rr where rr.nome is not null), '{}'::text[]) as role_names,
    coalesce((select array_agg(distinct pr.nome_permissao order by pr.nome_permissao) from permission_rows pr where pr.nome_permissao is not null), '{}'::text[]) as permission_names,
    coalesce((select array_agg(distinct pr.nome_permissao order by pr.nome_permissao) from permission_rows pr where pr.nome_permissao is not null), '{}'::text[]) as permission_codes,
    coalesce((select array_agg(distinct pr.rota order by pr.rota) from permission_rows pr where pr.rota is not null), '{}'::text[]) as allowed_routes
  from me
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
  p.acesso_global,
  p.updated_at
from public.profiles p;

grant select on public.vw_profile_self_safe to authenticated;

alter table public.profiles enable row level security;
alter table public.bd_funcoes enable row level security;
alter table public.bd_funcoes_permissao enable row level security;
alter table public.bd_permissoes enable row level security;
alter table public.bd_user_roles enable row level security;
alter table public.bd_roles enable row level security;
alter table public.bd_role_permissions enable row level security;
alter table public.bd_role_permission_actions enable row level security;
alter table public.bd_user_permission_overrides enable row level security;

drop policy if exists "Usuários podem ver todos os perfis" on public.profiles;
drop policy if exists "Apenas SuperAdm podem atualizar perfis" on public.profiles;
drop policy if exists "profiles_self_select_safe" on public.profiles;
drop policy if exists "profiles_admin_select_safe" on public.profiles;
drop policy if exists "profiles_self_update_safe" on public.profiles;
drop policy if exists "profiles_admin_update_safe" on public.profiles;
create policy "profiles_self_select_safe"
on public.profiles
for select
to authenticated
using (id = public.fn_auth_user_id());

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
  or public.fn_has_role('AdmSSO')
  or public.fn_has_role('AdmOBRA')
  or public.fn_has_role('Financeiro')
  or public.fn_has_role('DP')
);

create policy "profiles_self_update_safe"
on public.profiles
for update
to authenticated
using (id = public.fn_auth_user_id())
with check (id = public.fn_auth_user_id());

create policy "profiles_admin_update_safe"
on public.profiles
for update
to authenticated
using (
  public.fn_is_super_admin()
  or public.fn_has_permission('admin_permissoes_view')
  or public.fn_has_role('AdmRH')
)
with check (
  public.fn_is_super_admin()
  or public.fn_has_permission('admin_permissoes_view')
  or public.fn_has_role('AdmRH')
);

drop policy if exists "Usuários autenticados podem acessar funções" on public.bd_funcoes;
drop policy if exists "bd_funcoes_read_authenticated" on public.bd_funcoes;
drop policy if exists "bd_funcoes_write_admin" on public.bd_funcoes;
create policy "bd_funcoes_read_authenticated"
on public.bd_funcoes
for select
to authenticated
using (true);

create policy "bd_funcoes_write_admin"
on public.bd_funcoes
for all
to authenticated
using (
  public.fn_is_super_admin()
  or public.fn_has_permission('gestao_rh_funcoes_edit')
  or public.fn_has_permission('admin_permissoes_view')
  or public.fn_has_role('AdmRH')
)
with check (
  public.fn_is_super_admin()
  or public.fn_has_permission('gestao_rh_funcoes_edit')
  or public.fn_has_permission('admin_permissoes_view')
  or public.fn_has_role('AdmRH')
);

drop policy if exists "Usuários autenticados podem acessar funções permissão" on public.bd_funcoes_permissao;
drop policy if exists "rbac_funcoes_permissao_select" on public.bd_funcoes_permissao;
drop policy if exists "rbac_funcoes_permissao_write" on public.bd_funcoes_permissao;
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
    where p.id = public.fn_auth_user_id()
      and p.funcao_permissao = bd_funcoes_permissao.id
  )
);

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

drop policy if exists "Usuários autenticados podem acessar permissões" on public.bd_permissoes;
drop policy if exists "rbac_permissions_select" on public.bd_permissoes;
drop policy if exists "rbac_permissions_write" on public.bd_permissoes;
create policy "rbac_permissions_select"
on public.bd_permissoes
for select
to authenticated
using (
  public.fn_is_super_admin()
  or public.fn_has_permission('admin_permissoes_view')
  or public.fn_has_permission(bd_permissoes.nome_permissao)
);

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
drop policy if exists "rbac_roles_write" on public.bd_roles;
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
    where ur.user_id = public.fn_auth_user_id()
      and ur.role_id = bd_roles.id
  )
);

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
drop policy if exists "rbac_user_roles_write" on public.bd_user_roles;
create policy "rbac_user_roles_select"
on public.bd_user_roles
for select
to authenticated
using (
  public.fn_is_super_admin()
  or public.fn_has_permission('admin_permissoes_view')
  or bd_user_roles.user_id = public.fn_auth_user_id()
);

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
drop policy if exists "rbac_role_permissions_write" on public.bd_role_permissions;
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
    where ur.user_id = public.fn_auth_user_id()
      and ur.role_id = bd_role_permissions.role_id
  )
);

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
drop policy if exists "rbac_role_permission_actions_write" on public.bd_role_permission_actions;
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
    where ur.user_id = public.fn_auth_user_id()
      and ur.role_id = bd_role_permission_actions.role_id
  )
);

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
drop policy if exists "rbac_user_permission_overrides_write" on public.bd_user_permission_overrides;
create policy "rbac_user_permission_overrides_select"
on public.bd_user_permission_overrides
for select
to authenticated
using (
  public.fn_is_super_admin()
  or public.fn_has_permission('admin_permissoes_view')
  or bd_user_permission_overrides.user_id = public.fn_auth_user_id()
);

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