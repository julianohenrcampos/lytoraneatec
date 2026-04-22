create table if not exists public.bd_permission_change_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid null,
  target_user_id uuid null,
  entity_type text not null,
  entity_id uuid null,
  action text not null,
  old_data jsonb null,
  new_data jsonb null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint bd_permission_change_audit_logs_entity_type_chk check (
    entity_type in (
      'permission',
      'role',
      'role_permission',
      'role_permission_action',
      'user_role',
      'user_permission_override'
    )
  ),
  constraint bd_permission_change_audit_logs_action_chk check (
    action in ('insert', 'update', 'delete')
  )
);

create index if not exists idx_permission_change_audit_actor on public.bd_permission_change_audit_logs(actor_user_id, created_at desc);
create index if not exists idx_permission_change_audit_target on public.bd_permission_change_audit_logs(target_user_id, created_at desc);
create index if not exists idx_permission_change_audit_entity on public.bd_permission_change_audit_logs(entity_type, entity_id, created_at desc);

alter table public.bd_permission_change_audit_logs enable row level security;

create or replace function public.fn_can_view_permission_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with role_based as (
    select 1
    from public.bd_user_roles ur
    join public.bd_roles r on r.id = ur.role_id
    where ur.user_id = p_user_id
      and coalesce(r.ativo, true) = true
      and (
        r.nome in ('SuperAdm', 'Administrador')
        or exists (
          select 1
          from public.bd_role_permissions rp
          join public.bd_permissions p on p.id = rp.permission_id
          where rp.role_id = r.id
            and p.codigo = 'admin_permissoes_view'
        )
        or exists (
          select 1
          from public.bd_role_permission_actions rpa
          join public.bd_permissions p on p.id = rpa.permission_id
          where rpa.role_id = r.id
            and p.codigo = 'admin_permissoes_view'
        )
      )
    limit 1
  ),
  legacy_based as (
    select 1
    from public.profiles pr
    left join public.bd_funcoes_permissao fp on fp.id = pr.funcao_permissao
    where pr.id = p_user_id
      and (
        'SuperAdm' = any(coalesce(pr.funcoes, '{}'::text[]))
        or 'Administrador' = any(coalesce(pr.funcoes, '{}'::text[]))
        or coalesce(pr.funcao_sistema, '') in ('SuperAdm', 'Administrador')
        or coalesce(fp.nome_funcao, '') in ('SuperAdm', 'Administrador')
        or exists (
          select 1
          from public.bd_permissoes bp
          where bp.id = any(coalesce(fp.permissoes, '{}'::uuid[]))
            and bp.nome_permissao = 'admin_permissoes_view'
        )
      )
    limit 1
  )
  select coalesce(p_user_id is not null, false)
    and (
      public.fn_is_super_admin(p_user_id)
      or exists (select 1 from role_based)
      or exists (select 1 from legacy_based)
    );
$$;

create or replace function public.fn_can_manage_permission_catalog(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_is_super_admin(p_user_id);
$$;

create or replace function public.fn_permission_is_protected(p_permission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bd_permissions p
    where p.id = p_permission_id
      and (
        p.codigo like 'admin\_%' escape '\\'
        or p.codigo in ('admin_permissoes_view', 'admin_gestao_fluxos_view')
        or coalesce(p.rota, '') like '/admin%'
      )
  );
$$;

create or replace function public.fn_role_is_protected(p_role_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bd_roles r
    where r.id = p_role_id
      and r.nome in ('SuperAdm', 'Administrador')
  )
  or exists (
    select 1
    from public.bd_role_permissions rp
    where rp.role_id = p_role_id
      and public.fn_permission_is_protected(rp.permission_id)
  )
  or exists (
    select 1
    from public.bd_role_permission_actions rpa
    where rpa.role_id = p_role_id
      and public.fn_permission_is_protected(rpa.permission_id)
  );
$$;

create or replace function public.fn_can_read_permission_row(p_permission_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p_user_id is not null, false)
    and (
      public.fn_can_view_permission_admin(p_user_id)
      or exists (
        select 1
        from public.bd_user_roles ur
        left join public.bd_role_permissions rp on rp.role_id = ur.role_id
        left join public.bd_role_permission_actions rpa on rpa.role_id = ur.role_id
        where ur.user_id = p_user_id
          and (rp.permission_id = p_permission_id or rpa.permission_id = p_permission_id)
      )
      or exists (
        select 1
        from public.bd_user_permission_overrides uo
        where uo.user_id = p_user_id
          and uo.permission_id = p_permission_id
      )
    );
$$;

create or replace function public.fn_can_manage_user_access(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_is_super_admin(p_user_id)
      or public.fn_can_view_permission_admin(p_user_id);
$$;

create or replace function public.fn_target_user_has_protected_access(p_target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_is_super_admin(p_target_user_id)
  or exists (
    select 1
    from public.bd_user_roles ur
    where ur.user_id = p_target_user_id
      and public.fn_role_is_protected(ur.role_id)
  );
$$;

create or replace function public.fn_actor_can_manage_user_target(p_actor_user_id uuid, p_target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p_actor_user_id is not null, false)
    and coalesce(p_target_user_id is not null, false)
    and public.fn_can_manage_user_access(p_actor_user_id)
    and (
      public.fn_is_super_admin(p_actor_user_id)
      or (
        p_actor_user_id <> p_target_user_id
        and not public.fn_target_user_has_protected_access(p_target_user_id)
      )
    );
$$;

create or replace function public.fn_actor_can_assign_role(p_actor_user_id uuid, p_target_user_id uuid, p_role_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_actor_can_manage_user_target(p_actor_user_id, p_target_user_id)
    and exists (
      select 1
      from public.bd_roles r
      where r.id = p_role_id
        and coalesce(r.ativo, true) = true
    )
    and (
      public.fn_is_super_admin(p_actor_user_id)
      or not public.fn_role_is_protected(p_role_id)
    );
$$;

create or replace function public.fn_actor_can_override_permission(p_actor_user_id uuid, p_target_user_id uuid, p_permission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_actor_can_manage_user_target(p_actor_user_id, p_target_user_id)
    and (
      public.fn_is_super_admin(p_actor_user_id)
      or not public.fn_permission_is_protected(p_permission_id)
    );
$$;

create or replace function public.fn_audit_permission_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity_type text;
  v_actor uuid;
  v_target uuid;
  v_entity_id uuid;
  v_old jsonb;
  v_new jsonb;
  v_metadata jsonb := '{}'::jsonb;
begin
  v_actor := auth.uid();
  v_old := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  v_new := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  v_entity_id := coalesce(new.id, old.id);

  case tg_table_name
    when 'bd_permissions' then
      v_entity_type := 'permission';
    when 'bd_roles' then
      v_entity_type := 'role';
    when 'bd_role_permissions' then
      v_entity_type := 'role_permission';
      v_metadata := jsonb_build_object(
        'role_id', coalesce(new.role_id, old.role_id),
        'permission_id', coalesce(new.permission_id, old.permission_id)
      );
    when 'bd_role_permission_actions' then
      v_entity_type := 'role_permission_action';
      v_metadata := jsonb_build_object(
        'role_id', coalesce(new.role_id, old.role_id),
        'permission_id', coalesce(new.permission_id, old.permission_id),
        'acao', coalesce(new.acao, old.acao)
      );
    when 'bd_user_roles' then
      v_entity_type := 'user_role';
      v_target := coalesce(new.user_id, old.user_id);
      v_metadata := jsonb_build_object(
        'role_id', coalesce(new.role_id, old.role_id)
      );
    when 'bd_user_permission_overrides' then
      v_entity_type := 'user_permission_override';
      v_target := coalesce(new.user_id, old.user_id);
      v_metadata := jsonb_build_object(
        'permission_id', coalesce(new.permission_id, old.permission_id),
        'acao', coalesce(new.acao, old.acao),
        'permitido', coalesce(new.permitido, old.permitido)
      );
    else
      return coalesce(new, old);
  end case;

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
    v_actor,
    v_target,
    v_entity_type,
    v_entity_id,
    lower(tg_op),
    v_old,
    v_new,
    v_metadata
  );

  return coalesce(new, old);
end;
$$;

create or replace function public.fn_validate_user_role_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.fn_actor_can_assign_role(auth.uid(), new.user_id, new.role_id) then
    raise exception 'Você não pode atribuir esta função para este usuário.' using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.fn_validate_user_permission_override()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.fn_actor_can_override_permission(auth.uid(), new.user_id, new.permission_id) then
    raise exception 'Você não pode alterar este override de permissão.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_audit_bd_permissions on public.bd_permissions;
create trigger trg_audit_bd_permissions
after insert or update or delete on public.bd_permissions
for each row execute function public.fn_audit_permission_change();

drop trigger if exists trg_audit_bd_roles on public.bd_roles;
create trigger trg_audit_bd_roles
after insert or update or delete on public.bd_roles
for each row execute function public.fn_audit_permission_change();

drop trigger if exists trg_audit_bd_role_permissions on public.bd_role_permissions;
create trigger trg_audit_bd_role_permissions
after insert or update or delete on public.bd_role_permissions
for each row execute function public.fn_audit_permission_change();

drop trigger if exists trg_audit_bd_role_permission_actions on public.bd_role_permission_actions;
create trigger trg_audit_bd_role_permission_actions
after insert or update or delete on public.bd_role_permission_actions
for each row execute function public.fn_audit_permission_change();

drop trigger if exists trg_audit_bd_user_roles on public.bd_user_roles;
create trigger trg_audit_bd_user_roles
after insert or update or delete on public.bd_user_roles
for each row execute function public.fn_audit_permission_change();

drop trigger if exists trg_audit_bd_user_permission_overrides on public.bd_user_permission_overrides;
create trigger trg_audit_bd_user_permission_overrides
after insert or update or delete on public.bd_user_permission_overrides
for each row execute function public.fn_audit_permission_change();

drop trigger if exists trg_validate_user_role_assignment on public.bd_user_roles;
create trigger trg_validate_user_role_assignment
before insert or update on public.bd_user_roles
for each row execute function public.fn_validate_user_role_assignment();

drop trigger if exists trg_validate_user_permission_override on public.bd_user_permission_overrides;
create trigger trg_validate_user_permission_override
before insert or update on public.bd_user_permission_overrides
for each row execute function public.fn_validate_user_permission_override();

drop policy if exists insert_logs on public.bd_permission_audit_logs;
drop policy if exists read_logs on public.bd_permission_audit_logs;
create policy permission_audit_logs_select_secure
on public.bd_permission_audit_logs
for select
to authenticated
using (public.fn_can_view_permission_admin(auth.uid()));

create policy permission_audit_logs_insert_authenticated
on public.bd_permission_audit_logs
for insert
to authenticated
with check (auth.role() = 'authenticated');

drop policy if exists manage_permissions on public.bd_permissions;
drop policy if exists read_permissions on public.bd_permissions;
create policy rbac_permissions_select_secure
on public.bd_permissions
for select
to authenticated
using (public.fn_can_read_permission_row(id, auth.uid()));

create policy rbac_permissions_write_secure
on public.bd_permissions
for all
to authenticated
using (public.fn_can_manage_permission_catalog(auth.uid()))
with check (public.fn_can_manage_permission_catalog(auth.uid()));

drop policy if exists authenticated_select_role_perm_actions on public.bd_role_permission_actions;
drop policy if exists rbac_role_permission_actions_select on public.bd_role_permission_actions;
drop policy if exists rbac_role_permission_actions_write on public.bd_role_permission_actions;
drop policy if exists superadm_delete_role_perm_actions on public.bd_role_permission_actions;
drop policy if exists superadm_insert_role_perm_actions on public.bd_role_permission_actions;
drop policy if exists superadm_update_role_perm_actions on public.bd_role_permission_actions;
create policy rbac_role_permission_actions_select_secure
on public.bd_role_permission_actions
for select
to authenticated
using (
  public.fn_can_view_permission_admin(auth.uid())
  or exists (
    select 1
    from public.bd_user_roles ur
    where ur.user_id = auth.uid()
      and ur.role_id = bd_role_permission_actions.role_id
  )
);

create policy rbac_role_permission_actions_write_secure
on public.bd_role_permission_actions
for all
to authenticated
using (public.fn_can_manage_permission_catalog(auth.uid()))
with check (public.fn_can_manage_permission_catalog(auth.uid()));

drop policy if exists manage_role_permissions on public.bd_role_permissions;
drop policy if exists rbac_role_permissions_select on public.bd_role_permissions;
drop policy if exists rbac_role_permissions_write on public.bd_role_permissions;
drop policy if exists read_role_permissions on public.bd_role_permissions;
create policy rbac_role_permissions_select_secure
on public.bd_role_permissions
for select
to authenticated
using (
  public.fn_can_view_permission_admin(auth.uid())
  or exists (
    select 1
    from public.bd_user_roles ur
    where ur.user_id = auth.uid()
      and ur.role_id = bd_role_permissions.role_id
  )
);

create policy rbac_role_permissions_write_secure
on public.bd_role_permissions
for all
to authenticated
using (public.fn_can_manage_permission_catalog(auth.uid()))
with check (public.fn_can_manage_permission_catalog(auth.uid()));

drop policy if exists manage_roles on public.bd_roles;
drop policy if exists rbac_roles_select on public.bd_roles;
drop policy if exists rbac_roles_write on public.bd_roles;
drop policy if exists read_roles on public.bd_roles;
create policy rbac_roles_select_secure
on public.bd_roles
for select
to authenticated
using (
  public.fn_can_view_permission_admin(auth.uid())
  or exists (
    select 1
    from public.bd_user_roles ur
    where ur.user_id = auth.uid()
      and ur.role_id = bd_roles.id
  )
);

create policy rbac_roles_write_secure
on public.bd_roles
for all
to authenticated
using (public.fn_can_manage_permission_catalog(auth.uid()))
with check (public.fn_can_manage_permission_catalog(auth.uid()));

drop policy if exists manage_user_roles on public.bd_user_roles;
drop policy if exists rbac_user_roles_select on public.bd_user_roles;
drop policy if exists rbac_user_roles_write on public.bd_user_roles;
drop policy if exists read_user_roles on public.bd_user_roles;
create policy rbac_user_roles_select_secure
on public.bd_user_roles
for select
to authenticated
using (
  user_id = auth.uid()
  or public.fn_can_view_permission_admin(auth.uid())
);

create policy rbac_user_roles_insert_secure
on public.bd_user_roles
for insert
to authenticated
with check (
  public.fn_actor_can_assign_role(auth.uid(), user_id, role_id)
);

create policy rbac_user_roles_update_secure
on public.bd_user_roles
for update
to authenticated
using (
  public.fn_actor_can_assign_role(auth.uid(), user_id, role_id)
)
with check (
  public.fn_actor_can_assign_role(auth.uid(), user_id, role_id)
);

create policy rbac_user_roles_delete_secure
on public.bd_user_roles
for delete
to authenticated
using (
  public.fn_actor_can_assign_role(auth.uid(), user_id, role_id)
);

drop policy if exists authenticated_select_user_overrides on public.bd_user_permission_overrides;
drop policy if exists rbac_user_permission_overrides_select on public.bd_user_permission_overrides;
drop policy if exists rbac_user_permission_overrides_write on public.bd_user_permission_overrides;
drop policy if exists superadm_delete_user_overrides on public.bd_user_permission_overrides;
drop policy if exists superadm_insert_user_overrides on public.bd_user_permission_overrides;
drop policy if exists superadm_update_user_overrides on public.bd_user_permission_overrides;
create policy rbac_user_permission_overrides_select_secure
on public.bd_user_permission_overrides
for select
to authenticated
using (
  user_id = auth.uid()
  or public.fn_can_view_permission_admin(auth.uid())
);

create policy rbac_user_permission_overrides_insert_secure
on public.bd_user_permission_overrides
for insert
to authenticated
with check (
  public.fn_actor_can_override_permission(auth.uid(), user_id, permission_id)
);

create policy rbac_user_permission_overrides_update_secure
on public.bd_user_permission_overrides
for update
to authenticated
using (
  public.fn_actor_can_override_permission(auth.uid(), user_id, permission_id)
)
with check (
  public.fn_actor_can_override_permission(auth.uid(), user_id, permission_id)
);

create policy rbac_user_permission_overrides_delete_secure
on public.bd_user_permission_overrides
for delete
to authenticated
using (
  public.fn_actor_can_override_permission(auth.uid(), user_id, permission_id)
);

create policy permission_change_audit_logs_select_secure
on public.bd_permission_change_audit_logs
for select
to authenticated
using (public.fn_can_view_permission_admin(auth.uid()));

create policy permission_change_audit_logs_insert_blocked
on public.bd_permission_change_audit_logs
for insert
to authenticated
with check (false);

create policy permission_change_audit_logs_update_blocked
on public.bd_permission_change_audit_logs
for update
to authenticated
using (false)
with check (false);

create policy permission_change_audit_logs_delete_blocked
on public.bd_permission_change_audit_logs
for delete
to authenticated
using (false);