begin;

create or replace function public.set_bd_diaria_solicitacoes_criado_por()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED: usuário autenticado é obrigatório para criar solicitação de diária'
      using errcode = '42501';
  end if;

  new.criado_por := auth.uid();
  return new;
end;
$$;

drop trigger if exists trg_set_bd_diaria_solicitacoes_criado_por on public.bd_diaria_solicitacoes;

create trigger trg_set_bd_diaria_solicitacoes_criado_por
before insert on public.bd_diaria_solicitacoes
for each row
execute function public.set_bd_diaria_solicitacoes_criado_por();

drop policy if exists diaria_solicitacoes_insert on public.bd_diaria_solicitacoes;

create policy diaria_solicitacoes_insert
on public.bd_diaria_solicitacoes
for insert
to authenticated
with check (
  auth.uid() is not null
  and public.fn_has_permission('diarias_criar', auth.uid())
  and criado_por = auth.uid()
);

commit;