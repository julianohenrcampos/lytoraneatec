alter table public.bd_permission_change_audit_logs
  drop constraint if exists bd_permission_change_audit_logs_entity_type_chk;

alter table public.bd_permission_change_audit_logs
  add constraint bd_permission_change_audit_logs_entity_type_chk check (
    entity_type in (
      'permission',
      'role',
      'role_permission',
      'role_permission_action',
      'user_role',
      'user_permission_override',
      'profile_scope'
    )
  );

create or replace function public.fn_can_manage_permission_catalog(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_can_view_permission_admin(p_user_id);
$$;

create or replace function public.fn_validate_permission_catalog_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_new_protected boolean := false;
  v_old_protected boolean := false;
begin
  if not public.fn_can_manage_permission_catalog(v_actor) then
    raise exception 'Você não possui permissão para alterar o catálogo de permissões.' using errcode = '42501';
  end if;

  if tg_op <> 'DELETE' then
    v_new_protected := (
      new.codigo like 'admin\_%' escape '\\'
      or new.codigo in ('admin_permissoes_view', 'admin_gestao_fluxos_view')
      or coalesce(new.rota, '') like '/admin%'
    );
  end if;

  if tg_op <> 'INSERT' then
    v_old_protected := (
      old.codigo like 'admin\_%' escape '\\'
      or old.codigo in ('admin_permissoes_view', 'admin_gestao_fluxos_view')
      or coalesce(old.rota, '') like '/admin%'
    );
  end if;

  if not public.fn_is_super_admin(v_actor) and (v_new_protected or v_old_protected) then
    raise exception 'Somente SuperAdm pode alterar permissões protegidas.' using errcode = '42501';
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.fn_validate_role_catalog_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_new_protected boolean := false;
  v_old_protected boolean := false;
begin
  if not public.fn_can_manage_permission_catalog(v_actor) then
    raise exception 'Você não possui permissão para alterar funções.' using errcode = '42501';
  end if;

  if tg_op <> 'DELETE' then
    v_new_protected := new.nome in ('SuperAdm', 'Administrador');
  end if;

  if tg_op <> 'INSERT' then
    v_old_protected := old.nome in ('SuperAdm', 'Administrador');
  end if;

  if not public.fn_is_super_admin(v_actor) and (v_new_protected or v_old_protected) then
    raise exception 'Somente SuperAdm pode alterar funções protegidas.' using errcode = '42501';
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.fn_validate_role_permission_link_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role_id uuid := coalesce(new.role_id, old.role_id);
  v_permission_id uuid := coalesce(new.permission_id, old.permission_id);
begin
  if not public.fn_can_manage_permission_catalog(v_actor) then
    raise exception 'Você não possui permissão para alterar vínculos de função.' using errcode = '42501';
  end if;

  if not public.fn_is_super_admin(v_actor)
     and (public.fn_role_is_protected(v_role_id) or public.fn_permission_is_protected(v_permission_id)) then
    raise exception 'Somente SuperAdm pode alterar vínculos protegidos.' using errcode = '42501';
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.fn_validate_role_permission_action_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role_id uuid := coalesce(new.role_id, old.role_id);
  v_permission_id uuid := coalesce(new.permission_id, old.permission_id);
begin
  if not public.fn_can_manage_permission_catalog(v_actor) then
    raise exception 'Você não possui permissão para alterar ações da função.' using errcode = '42501';
  end if;

  if not public.fn_is_super_admin(v_actor)
     and (public.fn_role_is_protected(v_role_id) or public.fn_permission_is_protected(v_permission_id)) then
    raise exception 'Somente SuperAdm pode alterar ações protegidas.' using errcode = '42501';
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.fn_get_manageable_permission_profiles()
returns table (
  id uuid,
  nome_completo text,
  email text,
  imagem_url text,
  created_at timestamptz,
  updated_at timestamptz,
  funcionario_id uuid,
  acesso_global boolean,
  funcao_sistema text,
  funcoes text[],
  role_names text[],
  primary_role text,
  departamento_id uuid,
  departamento_nome text
)
language sql
stable
security definer
set search_path = public
as $$
  with actor_context as (
    select
      p.id as actor_id,
      p.funcionario_id,
      coalesce(p.acesso_global, false) as acesso_global,
      f.departamento_id,
      public.fn_is_super_admin(p.id) as is_super_admin,
      public.fn_has_role('AdmRH', p.id) as is_adm_rh,
      public.fn_has_role('Administrador', p.id) as is_admin
    from public.profiles p
    left join public.bd_funcionarios f on f.id = p.funcionario_id
    where p.id = auth.uid()
  ),
  user_roles as (
    select ur.user_id, array_agg(r.nome order by r.nome) as role_names
    from public.bd_user_roles ur
    join public.bd_roles r on r.id = ur.role_id
    where coalesce(r.ativo, true) = true
    group by ur.user_id
  )
  select
    p.id,
    p.nome_completo,
    p.email,
    p.imagem_url,
    p.created_at,
    p.updated_at,
    p.funcionario_id,
    coalesce(p.acesso_global, false) as acesso_global,
    p.funcao_sistema,
    coalesce(p.funcoes, '{}'::text[]) as funcoes,
    coalesce(ur.role_names, '{}'::text[]) as role_names,
    coalesce(
      ur.role_names[1],
      nullif(p.funcao_sistema, ''),
      nullif((coalesce(p.funcoes, '{}'::text[]))[1], '')
    ) as primary_role,
    f.departamento_id,
    d.nome_departamento as departamento_nome
  from public.profiles p
  left join public.bd_funcionarios f on f.id = p.funcionario_id
  left join public.bd_departamentos d on d.id = f.departamento_id
  left join user_roles ur on ur.user_id = p.id
  cross join actor_context ac
  where public.fn_can_view_permission_admin(auth.uid())
    and (
      ac.is_super_admin
      or ac.is_adm_rh
      or ac.is_admin
      or ac.acesso_global
      or (
        ac.departamento_id is not null
        and f.departamento_id = ac.departamento_id
      )
      or p.id = auth.uid()
    )
  order by p.nome_completo nulls last;
$$;

create or replace function public.fn_assign_user_role_secure(p_target_user_id uuid, p_role_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role_name text;
begin
  if not public.fn_actor_can_assign_role(auth.uid(), p_target_user_id, p_role_id) then
    raise exception 'Você não pode atribuir esta função para este usuário.' using errcode = '42501';
  end if;

  select nome into v_role_name
  from public.bd_roles
  where id = p_role_id
    and coalesce(ativo, true) = true;

  if v_role_name is null then
    raise exception 'Função não encontrada ou inativa.' using errcode = 'P0002';
  end if;

  delete from public.bd_user_roles where user_id = p_target_user_id;
  insert into public.bd_user_roles (user_id, role_id) values (p_target_user_id, p_role_id);

  update public.profiles
     set funcoes = array[v_role_name],
         funcao_sistema = v_role_name,
         updated_at = now()
   where id = p_target_user_id;
end;
$$;

create or replace function public.fn_remove_user_role_secure(p_target_user_id uuid, p_role_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.fn_actor_can_assign_role(auth.uid(), p_target_user_id, p_role_id) then
    raise exception 'Você não pode remover esta função deste usuário.' using errcode = '42501';
  end if;

  delete from public.bd_user_roles
  where user_id = p_target_user_id
    and role_id = p_role_id;

  update public.profiles
     set funcoes = array['user'],
         funcao_sistema = 'Usuário',
         updated_at = now()
   where id = p_target_user_id
     and not exists (
       select 1
       from public.bd_user_roles ur
       where ur.user_id = p_target_user_id
     );
end;
$$;

create or replace function public.fn_clear_user_admin_roles_secure(p_target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.fn_actor_can_manage_user_target(auth.uid(), p_target_user_id) then
    raise exception 'Você não pode limpar permissões deste usuário.' using errcode = '42501';
  end if;

  if not public.fn_is_super_admin(auth.uid()) and public.fn_target_user_has_protected_access(p_target_user_id) then
    raise exception 'Somente SuperAdm pode limpar permissões deste usuário.' using errcode = '42501';
  end if;

  delete from public.bd_user_permission_overrides where user_id = p_target_user_id;
  delete from public.bd_user_roles where user_id = p_target_user_id;

  update public.profiles
     set funcoes = array['user'],
         funcao_permissao = null,
         funcao_sistema = 'Usuário',
         updated_at = now()
   where id = p_target_user_id;
end;
$$;

create or replace function public.fn_update_managed_profile_access_scope(p_target_user_id uuid, p_acesso_global boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_new jsonb;
begin
  if not public.fn_actor_can_manage_user_target(auth.uid(), p_target_user_id) then
    raise exception 'Você não pode alterar o escopo deste usuário.' using errcode = '42501';
  end if;

  select jsonb_build_object('acesso_global', coalesce(acesso_global, false), 'funcionario_id', funcionario_id)
    into v_old
  from public.profiles
  where id = p_target_user_id;

  update public.profiles
     set acesso_global = p_acesso_global,
         updated_at = now()
   where id = p_target_user_id;

  select jsonb_build_object('acesso_global', coalesce(acesso_global, false), 'funcionario_id', funcionario_id)
    into v_new
  from public.profiles
  where id = p_target_user_id;

  insert into public.bd_permission_change_audit_logs (
    actor_user_id,
    target_user_id,
    entity_type,
    entity_id,
    action,
    old_data,
    new_data,
    metadata
  ) values (
    auth.uid(),
    p_target_user_id,
    'profile_scope',
    p_target_user_id,
    'update',
    v_old,
    v_new,
    jsonb_build_object('field', 'acesso_global')
  );
end;
$$;

drop trigger if exists trg_validate_permission_catalog_change on public.bd_permissions;
create trigger trg_validate_permission_catalog_change
before insert or update or delete on public.bd_permissions
for each row execute function public.fn_validate_permission_catalog_change();

drop trigger if exists trg_validate_role_catalog_change on public.bd_roles;
create trigger trg_validate_role_catalog_change
before insert or update or delete on public.bd_roles
for each row execute function public.fn_validate_role_catalog_change();

drop trigger if exists trg_validate_role_permission_link_change on public.bd_role_permissions;
create trigger trg_validate_role_permission_link_change
before insert or update or delete on public.bd_role_permissions
for each row execute function public.fn_validate_role_permission_link_change();

drop trigger if exists trg_validate_role_permission_action_change on public.bd_role_permission_actions;
create trigger trg_validate_role_permission_action_change
before insert or update or delete on public.bd_role_permission_actions
for each row execute function public.fn_validate_role_permission_action_change();

drop policy if exists rbac_permissions_write_secure on public.bd_permissions;
create policy rbac_permissions_write_secure
on public.bd_permissions
for all
to authenticated
using (public.fn_can_manage_permission_catalog(auth.uid()))
with check (public.fn_can_manage_permission_catalog(auth.uid()));

drop policy if exists rbac_roles_write_secure on public.bd_roles;
create policy rbac_roles_write_secure
on public.bd_roles
for all
to authenticated
using (public.fn_can_manage_permission_catalog(auth.uid()))
with check (public.fn_can_manage_permission_catalog(auth.uid()));

drop policy if exists rbac_role_permissions_write_secure on public.bd_role_permissions;
create policy rbac_role_permissions_write_secure
on public.bd_role_permissions
for all
to authenticated
using (public.fn_can_manage_permission_catalog(auth.uid()))
with check (public.fn_can_manage_permission_catalog(auth.uid()));

drop policy if exists rbac_role_permission_actions_write_secure on public.bd_role_permission_actions;
create policy rbac_role_permission_actions_write_secure
on public.bd_role_permission_actions
for all
to authenticated
using (public.fn_can_manage_permission_catalog(auth.uid()))
with check (public.fn_can_manage_permission_catalog(auth.uid()));

drop policy if exists permission_audit_logs_insert_authenticated on public.bd_permission_audit_logs;
create policy permission_audit_logs_insert_authenticated
on public.bd_permission_audit_logs
for insert
to authenticated
with check (user_id is null or user_id = auth.uid());