
-- 1) Índices para acelerar matching por email (normalizado)
create index if not exists idx_profiles_email_norm
  on public.profiles ((lower(trim(email))));

create index if not exists idx_bd_funcionarios_email_norm
  on public.bd_funcionarios ((lower(trim(email))));

-- 2) Função de atualização direta do funcionario_id com SECURITY DEFINER (bypass RLS)
create or replace function public.update_profile_funcionario_id(_profile_id uuid, _funcionario_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
     set funcionario_id = _funcionario_id,
         updated_at = now()
   where id = _profile_id
$$;

-- 3a) Vincular perfil -> funcionário por email (partindo do profile)
create or replace function public.link_profile_to_funcionario_by_email(_profile_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email_norm text;
  v_func_id uuid;
begin
  select lower(trim(email)) into v_email_norm
  from public.profiles
  where id = _profile_id;

  if v_email_norm is null or v_email_norm = '' then
    return false;
  end if;

  select f.id
    into v_func_id
  from public.bd_funcionarios f
  where lower(trim(f.email)) = v_email_norm
  order by f.updated_at desc nulls last, f.created_at desc nulls last
  limit 1;

  if v_func_id is null then
    return false;
  end if;

  perform public.update_profile_funcionario_id(_profile_id, v_func_id);
  return true;
end;
$$;

-- 3b) Vincular funcionário -> perfil por email (partindo do funcionario)
create or replace function public.link_profile_from_funcionario_email(_funcionario_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email_norm text;
  v_profile_id uuid;
begin
  select lower(trim(email)) into v_email_norm
  from public.bd_funcionarios
  where id = _funcionario_id;

  if v_email_norm is null or v_email_norm = '' then
    return false;
  end if;

  select p.id
    into v_profile_id
  from public.profiles p
  where lower(trim(p.email)) = v_email_norm
  order by p.updated_at desc nulls last, p.created_at desc nulls last
  limit 1;

  if v_profile_id is null then
    return false;
  end if;

  perform public.update_profile_funcionario_id(v_profile_id, _funcionario_id);
  return true;
end;
$$;

-- 4a) Trigger function em profiles (dispara ao inserir/alterar email)
create or replace function public.trg_profiles_link_funcionario_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT'
     or (tg_op = 'UPDATE'
         and coalesce(lower(trim(new.email)),'') is distinct
             from coalesce(lower(trim(old.email)),''))
  then
    perform public.link_profile_to_funcionario_by_email(new.id);
  end if;
  return new;
end;
$$;

-- 4b) Trigger em profiles
drop trigger if exists trg_profiles_link_funcionario on public.profiles;
create trigger trg_profiles_link_funcionario
  after insert or update of email on public.profiles
  for each row
  execute function public.trg_profiles_link_funcionario_fn();

-- 4c) Trigger function em bd_funcionarios (dispara ao inserir/alterar email)
create or replace function public.trg_funcionarios_link_profile_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT'
     or (tg_op = 'UPDATE'
         and coalesce(lower(trim(new.email)),'') is distinct
             from coalesce(lower(trim(old.email)),''))
  then
    perform public.link_profile_from_funcionario_email(new.id);
  end if;
  return new;
end;
$$;

-- 4d) Trigger em bd_funcionarios
drop trigger if exists trg_funcionarios_link_profile on public.bd_funcionarios;
create trigger trg_funcionarios_link_profile
  after insert or update of email on public.bd_funcionarios
  for each row
  execute function public.trg_funcionarios_link_profile_fn();

-- 5) Backfill imediato: preencher profiles.funcionario_id onde nulo e emails coincidam
with matches as (
  select p.id as profile_id, f.id as funcionario_id
  from public.profiles p
  join public.bd_funcionarios f
    on lower(trim(p.email)) = lower(trim(f.email))
  where p.funcionario_id is null
)
update public.profiles p
   set funcionario_id = m.funcionario_id,
       updated_at = now()
  from matches m
 where p.id = m.profile_id;

-- 6) Verificação: quantos perfis ainda ficaram sem vínculo?
select count(*) as perfis_sem_vinculo
  from public.profiles
 where funcionario_id is null;
