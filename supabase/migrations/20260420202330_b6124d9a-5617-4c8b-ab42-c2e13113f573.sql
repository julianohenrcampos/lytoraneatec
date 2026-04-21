create extension if not exists vector;

create or replace function public.is_superadm_or_rh(_user_id uuid)
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
     where ur.user_id = _user_id
       and r.ativo
       and r.nome in ('SuperAdm','AdmRH')
  )
$$;

create table if not exists public.bd_funcionarios_biometria_facial (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references public.bd_funcionarios(id) on delete cascade,
  descriptor vector(128) not null,
  foto_url text,
  origem text not null check (origem in ('admin_upload','auto_enrolamento_totem')),
  cadastrado_por_user_id uuid,
  dispositivo_origem_id uuid references public.bd_ponto_dispositivos(id) on delete set null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_biometria_descriptor_hnsw
  on public.bd_funcionarios_biometria_facial
  using hnsw (descriptor vector_cosine_ops);

create index if not exists idx_biometria_funcionario_ativo
  on public.bd_funcionarios_biometria_facial (funcionario_id) where ativo;

create trigger trg_biometria_updated_at
  before update on public.bd_funcionarios_biometria_facial
  for each row execute function public.update_updated_at_column();

alter table public.bd_funcionarios_biometria_facial enable row level security;

create policy "biometria_admin_all"
  on public.bd_funcionarios_biometria_facial
  for all to authenticated
  using (public.is_superadm_or_rh(auth.uid()))
  with check (public.is_superadm_or_rh(auth.uid()));

insert into storage.buckets (id, name, public)
values ('biometria-facial', 'biometria-facial', false)
on conflict (id) do nothing;

create policy "biometria_bucket_admin_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'biometria-facial' and public.is_superadm_or_rh(auth.uid()));

create policy "biometria_bucket_admin_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'biometria-facial' and public.is_superadm_or_rh(auth.uid()));

create policy "biometria_bucket_admin_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'biometria-facial' and public.is_superadm_or_rh(auth.uid()));

create policy "biometria_bucket_admin_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'biometria-facial' and public.is_superadm_or_rh(auth.uid()));

create or replace function public.identificar_funcionario_por_descriptor(
  p_dispositivo_id uuid,
  p_descriptor vector,
  p_threshold float default 0.60
)
returns table (
  funcionario_id uuid,
  nome text,
  matricula text,
  cpf text,
  funcao text,
  centro_custo text,
  foto_url text,
  confianca float
)
language sql
stable
security definer
set search_path = public
as $$
  with ccs as (
    select centro_custo_id
      from public.bd_ponto_dispositivo_centros_custo
     where dispositivo_id = p_dispositivo_id and ativo
    union
    select centro_custo_id
      from public.bd_ponto_dispositivos
     where id = p_dispositivo_id and centro_custo_id is not null
  ),
  candidatos as (
    select b.funcionario_id, b.foto_url,
           1 - (b.descriptor <=> p_descriptor) as confianca
      from public.bd_funcionarios_biometria_facial b
     where b.ativo
     order by b.descriptor <=> p_descriptor
     limit 5
  )
  select
    f.id,
    f.nome_completo,
    f.matricula,
    f.cpf,
    fn.nome_funcao,
    cc.nome_centro_custo,
    coalesce(c.foto_url, f.imagem),
    c.confianca
  from candidatos c
  join public.bd_funcionarios f on f.id = c.funcionario_id
  left join public.bd_funcoes fn on fn.id = f.funcao_id
  left join public.bd_centros_custo cc on cc.id = f.centro_custo_id
  where f.status in ('Ativo','Ativo sem Registro')
    and c.confianca >= p_threshold
    and (
      f.centro_custo_id in (select centro_custo_id from ccs)
      or exists (
        select 1 from public.bd_ponto_vinculos_operacionais v
         where v.funcionario_id = f.id and v.ativo
           and v.centro_custo_id in (select centro_custo_id from ccs)
      )
    )
  order by c.confianca desc
  limit 1;
$$;

grant execute on function public.identificar_funcionario_por_descriptor(uuid, vector, float)
  to anon, authenticated, service_role;