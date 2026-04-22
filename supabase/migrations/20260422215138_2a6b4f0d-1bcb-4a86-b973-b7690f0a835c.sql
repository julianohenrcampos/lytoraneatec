begin;

create or replace function public.fn_has_permission(p_nome_permissao text, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with aliases as (
    select unnest(public.fn_permission_aliases(p_nome_permissao)) as nome_permissao
  ), explicit_deny as (
    select 1
    from public.bd_user_permission_overrides uo
    left join public.bd_permissoes p_legacy on p_legacy.id = uo.permission_id
    left join public.bd_permissions p_rbac on p_rbac.id = uo.permission_id
    join aliases a on a.nome_permissao in (
      coalesce(p_legacy.nome_permissao, ''),
      coalesce(p_rbac.codigo, '')
    )
    where uo.user_id = p_user_id
      and uo.permitido = false
    limit 1
  ), explicit_allow as (
    select 1
    from public.bd_user_permission_overrides uo
    left join public.bd_permissoes p_legacy on p_legacy.id = uo.permission_id
    left join public.bd_permissions p_rbac on p_rbac.id = uo.permission_id
    join aliases a on a.nome_permissao in (
      coalesce(p_legacy.nome_permissao, ''),
      coalesce(p_rbac.codigo, '')
    )
    where uo.user_id = p_user_id
      and uo.permitido = true
    limit 1
  ), role_allow as (
    select 1
    from public.bd_user_roles ur
    join public.bd_roles r on r.id = ur.role_id
    left join public.bd_role_permissions rp on rp.role_id = r.id
    left join public.bd_role_permission_actions rpa on rpa.role_id = r.id
    left join public.bd_permissions p_rp on p_rp.id = rp.permission_id
    left join public.bd_permissions p_rpa on p_rpa.id = rpa.permission_id
    join aliases a on a.nome_permissao in (
      coalesce(p_rp.codigo, ''),
      coalesce(p_rpa.codigo, '')
    )
    where ur.user_id = p_user_id
      and coalesce(r.ativo, true) = true
    limit 1
  ), legacy_allow as (
    select 1
    from public.profiles pr
    join public.bd_funcoes_permissao fp on fp.id = pr.funcao_permissao
    join public.bd_permissoes p on p.id = any(coalesce(fp.permissoes, '{}'::uuid[]))
    join aliases a on a.nome_permissao = p.nome_permissao
    where pr.id = p_user_id
    limit 1
  )
  select case
    when public.fn_is_super_admin(p_user_id) then true
    when exists (select 1 from explicit_deny) then false
    when exists (select 1 from explicit_allow) then true
    when exists (select 1 from role_allow) then true
    when exists (select 1 from legacy_allow) then true
    else false
  end;
$$;

create or replace function public.fn_diaria_can_create(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p_user_id is not null, false)
    and (
      public.fn_is_super_admin(p_user_id)
      or public.check_is_admsso(p_user_id)
      or public.fn_has_permission('diarias_criar', p_user_id)
      or public.fn_has_permission('diarias_solicitar', p_user_id)
      or public.fn_has_permission('diarias_solicitar_create', p_user_id)
      or public.fn_has_role('AdmSede', p_user_id)
      or public.fn_has_role('AdmOBRA', p_user_id)
      or public.fn_has_role('Apontador', p_user_id)
      or public.fn_has_role('Encarregado', p_user_id)
    );
$$;

create or replace function public.fn_set_diaria_criado_por()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Usuário autenticado é obrigatório para criar solicitações de diária.' using errcode = '42501';
  end if;

  new.criado_por := auth.uid();
  return new;
end;
$$;

drop policy if exists diaria_solicitacoes_insert on public.bd_diaria_solicitacoes;
create policy diaria_solicitacoes_insert
on public.bd_diaria_solicitacoes
for insert
to authenticated
with check (
  auth.uid() is not null
  and public.fn_has_permission('diarias_criar', auth.uid())
  and coalesce(criado_por, auth.uid()) = auth.uid()
);

drop trigger if exists trg_set_bd_diaria_solicitacoes_criado_por on public.bd_diaria_solicitacoes;
create trigger trg_set_bd_diaria_solicitacoes_criado_por
before insert on public.bd_diaria_solicitacoes
for each row
execute function public.fn_set_diaria_criado_por();

commit;