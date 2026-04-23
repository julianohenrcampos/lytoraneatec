begin;

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
      or public.fn_has_role('GerenteRegional', p_user_id)
      or public.fn_has_role('Gerente', p_user_id)
      or public.fn_has_role('Engenheiro Civil', p_user_id)
    );
$$;

drop policy if exists diaria_solicitacoes_insert on public.bd_diaria_solicitacoes;
create policy diaria_solicitacoes_insert
on public.bd_diaria_solicitacoes
for insert
to authenticated
with check (
  auth.uid() is not null
  and public.fn_diaria_can_create(auth.uid())
  and coalesce(criado_por, auth.uid()) = auth.uid()
);

commit;