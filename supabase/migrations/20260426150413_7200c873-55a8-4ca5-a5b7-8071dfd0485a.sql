-- ===========================================================
-- Auditoria de Biometria / Assinatura / CPF
-- ===========================================================

-- 0. Extensões necessárias
create extension if not exists pgcrypto with schema public;

-- 1. Enums
do $$
begin
  if not exists (select 1 from pg_type where typname = 'tipo_evento_auditoria_biometria') then
    create type public.tipo_evento_auditoria_biometria as enum (
      'biometria_cadastrada',
      'biometria_substituida',
      'biometria_desativada',
      'assinatura_cadastrada',
      'assinatura_substituida',
      'cpf_alterado'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'origem_auditoria_biometria') then
    create type public.origem_auditoria_biometria as enum (
      'admin_web',
      'pwa_mobile',
      'totem_device',
      'api_interna',
      'trigger_db'
    );
  end if;
end$$;

-- 2. Tabela
create table if not exists public.bd_auditoria_biometria (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references public.bd_funcionarios(id) on delete cascade,
  tipo_evento public.tipo_evento_auditoria_biometria not null,
  hash_anterior text,
  hash_novo text,
  user_id uuid,
  ip text,
  user_agent text,
  origem public.origem_auditoria_biometria not null default 'admin_web',
  metadata jsonb not null default '{}'::jsonb,
  event_hash text not null,
  integridade_hash text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_bd_auditoria_biometria_event_hash
  on public.bd_auditoria_biometria (event_hash);
create index if not exists idx_bd_auditoria_biometria_func_data
  on public.bd_auditoria_biometria (funcionario_id, created_at desc);
create index if not exists idx_bd_auditoria_biometria_tipo
  on public.bd_auditoria_biometria (tipo_evento, created_at desc);
create index if not exists idx_bd_auditoria_biometria_origem
  on public.bd_auditoria_biometria (origem, created_at desc);

alter table public.bd_auditoria_biometria enable row level security;

-- 3. RLS — apenas SuperAdm/AdmRH leem
drop policy if exists "auditoria_biometria_select_admin" on public.bd_auditoria_biometria;
create policy "auditoria_biometria_select_admin"
  on public.bd_auditoria_biometria for select
  to authenticated
  using (public.is_superadm_or_rh(auth.uid()));

-- (Sem policy de insert/update/delete: só via SECURITY DEFINER abaixo)

-- 4. RPC central
create or replace function public.registrar_evento_auditoria_biometria(
  p_funcionario_id uuid,
  p_tipo_evento public.tipo_evento_auditoria_biometria,
  p_hash_anterior text,
  p_hash_novo text,
  p_origem public.origem_auditoria_biometria default 'admin_web',
  p_ip text default null,
  p_user_agent text default null,
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_now  timestamptz := now();
  v_event_hash text;
  v_integ_hash text;
  v_id uuid;
begin
  if p_funcionario_id is null then
    raise exception 'p_funcionario_id obrigatório';
  end if;

  -- (1) event_hash anti-duplicidade — granularidade de minuto
  v_event_hash := encode(digest(
    coalesce(p_funcionario_id::text,'') || '|' ||
    p_tipo_evento::text || '|' ||
    coalesce(p_hash_novo,'') || '|' ||
    to_char(date_trunc('minute', v_now), 'YYYY-MM-DD"T"HH24:MI'),
    'sha256'), 'hex');

  -- (2) integridade_hash — cadeia funcionario+antes+depois+executor+timestamp
  v_integ_hash := encode(digest(
    coalesce(p_funcionario_id::text,'') || '|' ||
    coalesce(p_hash_anterior,'') || '|' ||
    coalesce(p_hash_novo,'') || '|' ||
    coalesce(v_user::text,'') || '|' ||
    v_now::text,
    'sha256'), 'hex');

  insert into public.bd_auditoria_biometria(
    funcionario_id, tipo_evento, hash_anterior, hash_novo,
    user_id, ip, user_agent, origem, metadata,
    event_hash, integridade_hash, created_at
  ) values (
    p_funcionario_id, p_tipo_evento, p_hash_anterior, p_hash_novo,
    v_user, p_ip, p_user_agent, p_origem, coalesce(p_metadata,'{}'::jsonb),
    v_event_hash, v_integ_hash, v_now
  )
  on conflict (event_hash) do nothing
  returning id into v_id;

  return v_id;
end$$;

revoke all on function public.registrar_evento_auditoria_biometria(
  uuid, public.tipo_evento_auditoria_biometria, text, text,
  public.origem_auditoria_biometria, text, text, jsonb
) from public;
grant execute on function public.registrar_evento_auditoria_biometria(
  uuid, public.tipo_evento_auditoria_biometria, text, text,
  public.origem_auditoria_biometria, text, text, jsonb
) to authenticated, service_role;

-- 5. Trigger CPF alterado em bd_funcionarios
create or replace function public.trg_audit_cpf_alterado_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_hash text;
  v_new_hash text;
begin
  if coalesce(OLD.cpf,'') = coalesce(NEW.cpf,'') then
    return NEW;
  end if;
  v_old_hash := case when OLD.cpf is null or length(trim(OLD.cpf))=0 then null
                     else encode(digest(regexp_replace(OLD.cpf,'\D','','g'),'sha256'),'hex') end;
  v_new_hash := case when NEW.cpf is null or length(trim(NEW.cpf))=0 then null
                     else encode(digest(regexp_replace(NEW.cpf,'\D','','g'),'sha256'),'hex') end;

  perform public.registrar_evento_auditoria_biometria(
    NEW.id,
    'cpf_alterado'::public.tipo_evento_auditoria_biometria,
    v_old_hash,
    v_new_hash,
    'trigger_db'::public.origem_auditoria_biometria,
    null,
    null,
    jsonb_build_object('tabela','bd_funcionarios')
  );
  return NEW;
end$$;

drop trigger if exists trg_audit_cpf_alterado on public.bd_funcionarios;
create trigger trg_audit_cpf_alterado
  after update of cpf on public.bd_funcionarios
  for each row
  execute function public.trg_audit_cpf_alterado_fn();