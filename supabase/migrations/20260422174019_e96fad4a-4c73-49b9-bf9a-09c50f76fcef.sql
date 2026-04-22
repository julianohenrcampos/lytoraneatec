create table if not exists public.bd_funcionarios_sensivel (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references public.bd_funcionarios(id) on delete cascade,
  cpf text,
  cpf_hash text,
  data_nascimento date,
  email text,
  email_hash text,
  endereco_completo text,
  endereco_rua text,
  endereco_numero text,
  endereco_bairro text,
  endereco_cidade text,
  endereco_estado text,
  endereco_cep text,
  endereco_normalizado text,
  mapbox_place_name text,
  latitude numeric,
  longitude numeric,
  geocoding_status text,
  geocoding_source text,
  geocoding_relevance numeric,
  geocoding_updated_at timestamp with time zone,
  salario_base numeric,
  diarias numeric,
  refeicao numeric,
  custo_passagem numeric,
  adicional_noturno numeric,
  gratificacao numeric,
  periculosidade numeric,
  insalubridade numeric,
  banco text,
  agencia text,
  conta_corrente text,
  chave_pix text,
  pix_hash text,
  imagem text,
  observacoes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  modificado_por uuid,
  constraint bd_funcionarios_sensivel_funcionario_unique unique (funcionario_id)
);

create index if not exists idx_funcionarios_sensivel_funcionario_id on public.bd_funcionarios_sensivel(funcionario_id);
create index if not exists idx_funcionarios_sensivel_cpf_hash on public.bd_funcionarios_sensivel(cpf_hash);
create index if not exists idx_funcionarios_sensivel_email_hash on public.bd_funcionarios_sensivel(email_hash);
create index if not exists idx_funcionarios_sensivel_pix_hash on public.bd_funcionarios_sensivel(pix_hash);

create table if not exists public.bd_auditoria_leitura_funcionario_sensivel (
  id uuid primary key default gen_random_uuid(),
  viewer_user_id uuid not null,
  funcionario_id uuid not null references public.bd_funcionarios(id) on delete cascade,
  origem text not null,
  campos text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_auditoria_func_sensivel_viewer on public.bd_auditoria_leitura_funcionario_sensivel(viewer_user_id, created_at desc);
create index if not exists idx_auditoria_func_sensivel_funcionario on public.bd_auditoria_leitura_funcionario_sensivel(funcionario_id, created_at desc);

create or replace function public.fn_hash_sensitive_value(p_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_value is null or btrim(p_value) = '' then null
    else md5(lower(btrim(p_value)))
  end
$$;

create or replace function public.fn_can_access_funcionario_operacional(
  p_funcionario_id uuid,
  p_departamento_id uuid,
  p_centro_custo_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    coalesce(public.fn_is_super_admin(), false)
    or coalesce(public.check_is_super_admin(), false)
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.acesso_global = true
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and 'AdmRH' = any(coalesce(p.funcoes, '{}'::text[]))
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and (
          'AdmSSO' = any(coalesce(p.funcoes, '{}'::text[]))
          or 'AdmOBRA' = any(coalesce(p.funcoes, '{}'::text[]))
        )
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and (
          'TecEnferSSO' = any(coalesce(p.funcoes, '{}'::text[]))
          or 'ConsultaExames' = any(coalesce(p.funcoes, '{}'::text[]))
          or 'AdmtreinoSSO' = any(coalesce(p.funcoes, '{}'::text[]))
        )
    )
    or p_funcionario_id = (
      select pr.funcionario_id
      from public.profiles pr
      where pr.id = auth.uid()
      limit 1
    )
    or (
      exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and 'AdmSede' = any(coalesce(p.funcoes, '{}'::text[]))
      )
      and p_centro_custo_id in (
        select public.get_admsede_centros_custo(auth.uid())
      )
    )
    or (
      exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and (
            'TecSSO' = any(coalesce(p.funcoes, '{}'::text[]))
            or 'AdmLogistica' = any(coalesce(p.funcoes, '{}'::text[]))
            or 'AdmEquipamentos' = any(coalesce(p.funcoes, '{}'::text[]))
            or 'Encarregado' = any(coalesce(p.funcoes, '{}'::text[]))
            or 'Apontador' = any(coalesce(p.funcoes, '{}'::text[]))
            or 'GerenteRegional' = any(coalesce(p.funcoes, '{}'::text[]))
            or 'AdmTec' = any(coalesce(p.funcoes, '{}'::text[]))
            or 'JovemAdm' = any(coalesce(p.funcoes, '{}'::text[]))
            or 'EnferAdm' = any(coalesce(p.funcoes, '{}'::text[]))
          )
      )
      and p_departamento_id = public.get_user_departamento_id()
      and public.get_user_departamento_id() is not null
    )
  )
$$;

create or replace function public.fn_can_access_funcionario_sensitive(
  p_funcionario_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    coalesce(public.fn_is_super_admin(), false)
    or coalesce(public.check_is_super_admin(), false)
    or public.fn_has_role('AdmRH')
    or public.fn_has_role('Financeiro')
    or public.fn_has_role('DP')
    or public.fn_has_role('FinanceiroDP')
    or public.fn_has_role('DepartamentoPessoal')
    or public.fn_has_permission('gestao_rh_funcionarios_sensitive_view')
    or public.fn_has_permission('gestao_rh_funcionarios_view_sensitive')
    or public.fn_has_permission('gestao_rh_funcionarios_edit')
    or public.fn_has_permission('financeiro_folha_view')
  )
$$;

create or replace function public.fn_audit_sensitive_read(
  p_funcionario_id uuid,
  p_origem text,
  p_campos text[] default '{}',
  p_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return false;
  end if;

  insert into public.bd_auditoria_leitura_funcionario_sensivel (
    viewer_user_id,
    funcionario_id,
    origem,
    campos,
    metadata
  ) values (
    auth.uid(),
    p_funcionario_id,
    coalesce(nullif(btrim(p_origem), ''), 'unknown'),
    coalesce(p_campos, '{}'::text[]),
    coalesce(p_metadata, '{}'::jsonb)
  );

  return true;
end;
$$;

create or replace function public.fn_sync_funcionario_sensitive()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.bd_funcionarios_sensivel (
    funcionario_id,
    cpf,
    cpf_hash,
    data_nascimento,
    email,
    email_hash,
    endereco_completo,
    endereco_rua,
    endereco_numero,
    endereco_bairro,
    endereco_cidade,
    endereco_estado,
    endereco_cep,
    endereco_normalizado,
    mapbox_place_name,
    latitude,
    longitude,
    geocoding_status,
    geocoding_source,
    geocoding_relevance,
    geocoding_updated_at,
    salario_base,
    diarias,
    refeicao,
    custo_passagem,
    adicional_noturno,
    gratificacao,
    periculosidade,
    insalubridade,
    banco,
    agencia,
    conta_corrente,
    chave_pix,
    pix_hash,
    imagem,
    observacoes,
    updated_at,
    modificado_por
  ) values (
    new.id,
    new.cpf,
    public.fn_hash_sensitive_value(new.cpf),
    new.data_nascimento,
    new.email,
    public.fn_hash_sensitive_value(new.email),
    new.endereco_completo,
    new.endereco_rua,
    new.endereco_numero,
    new.endereco_bairro,
    new.endereco_cidade,
    new.endereco_estado,
    new.endereco_cep,
    new.endereco_normalizado,
    new.mapbox_place_name,
    new.latitude,
    new.longitude,
    new.geocoding_status,
    new.geocoding_source,
    new.geocoding_relevance,
    new.geocoding_updated_at,
    new.salario_base,
    new.diarias,
    new.refeicao,
    new.custo_passagem,
    new.adicional_noturno,
    new.gratificacao,
    new.periculosidade,
    new.insalubridade,
    new.banco,
    new.agencia,
    new.conta_corrente,
    new.chave_pix,
    public.fn_hash_sensitive_value(new.chave_pix),
    new.imagem,
    new.observacoes,
    now(),
    new.modificado_por
  )
  on conflict (funcionario_id) do update
  set cpf = excluded.cpf,
      cpf_hash = excluded.cpf_hash,
      data_nascimento = excluded.data_nascimento,
      email = excluded.email,
      email_hash = excluded.email_hash,
      endereco_completo = excluded.endereco_completo,
      endereco_rua = excluded.endereco_rua,
      endereco_numero = excluded.endereco_numero,
      endereco_bairro = excluded.endereco_bairro,
      endereco_cidade = excluded.endereco_cidade,
      endereco_estado = excluded.endereco_estado,
      endereco_cep = excluded.endereco_cep,
      endereco_normalizado = excluded.endereco_normalizado,
      mapbox_place_name = excluded.mapbox_place_name,
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      geocoding_status = excluded.geocoding_status,
      geocoding_source = excluded.geocoding_source,
      geocoding_relevance = excluded.geocoding_relevance,
      geocoding_updated_at = excluded.geocoding_updated_at,
      salario_base = excluded.salario_base,
      diarias = excluded.diarias,
      refeicao = excluded.refeicao,
      custo_passagem = excluded.custo_passagem,
      adicional_noturno = excluded.adicional_noturno,
      gratificacao = excluded.gratificacao,
      periculosidade = excluded.periculosidade,
      insalubridade = excluded.insalubridade,
      banco = excluded.banco,
      agencia = excluded.agencia,
      conta_corrente = excluded.conta_corrente,
      chave_pix = excluded.chave_pix,
      pix_hash = excluded.pix_hash,
      imagem = excluded.imagem,
      observacoes = excluded.observacoes,
      updated_at = now(),
      modificado_por = excluded.modificado_por;

  return new;
end;
$$;

drop trigger if exists trg_sync_funcionario_sensitive on public.bd_funcionarios;
create trigger trg_sync_funcionario_sensitive
after insert or update on public.bd_funcionarios
for each row
execute function public.fn_sync_funcionario_sensitive();

create or replace function public.fn_check_funcionario_email_status(p_email text)
returns table (
  exists_in_funcionarios boolean,
  funcionario_id uuid,
  nome_completo text,
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    true as exists_in_funcionarios,
    f.id as funcionario_id,
    f.nome_completo,
    f.status
  from public.bd_funcionarios f
  left join public.bd_funcionarios_sensivel s on s.funcionario_id = f.id
  where lower(trim(coalesce(s.email, f.email, ''))) = lower(trim(coalesce(p_email, '')))
  order by f.created_at desc nulls last
  limit 1
$$;

drop view if exists public.vw_funcionarios_rh;
drop view if exists public.vw_funcionarios_operacional;

create view public.vw_funcionarios_operacional
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
left join public.bd_centros_custo cc on cc.id = f.centro_custo_id
where public.fn_can_access_funcionario_operacional(f.id, f.departamento_id, f.centro_custo_id);

create view public.vw_funcionarios_rh
with (security_invoker = on)
as
select
  f.id,
  f.nome_completo,
  f.matricula,
  coalesce(s.cpf, f.cpf) as cpf,
  coalesce(s.data_nascimento, f.data_nascimento) as data_nascimento,
  coalesce(s.email, f.email) as email,
  coalesce(s.endereco_completo, f.endereco_completo) as endereco_completo,
  coalesce(s.endereco_rua, f.endereco_rua) as endereco_rua,
  coalesce(s.endereco_numero, f.endereco_numero) as endereco_numero,
  coalesce(s.endereco_bairro, f.endereco_bairro) as endereco_bairro,
  coalesce(s.endereco_cidade, f.endereco_cidade) as endereco_cidade,
  coalesce(s.endereco_estado, f.endereco_estado) as endereco_estado,
  coalesce(s.endereco_cep, f.endereco_cep) as endereco_cep,
  f.escolaridade,
  f.genero,
  f.empresa_id,
  f.departamento_id,
  f.funcao_id,
  f.centro_custo_id,
  f.equipe_id,
  f.data_admissao,
  f.data_ferias,
  f.data_demissao,
  f.data_desligamento,
  f.status,
  f.tipo_escala,
  coalesce(s.salario_base, f.salario_base) as salario_base,
  coalesce(s.insalubridade, f.insalubridade) as insalubridade,
  coalesce(s.periculosidade, f.periculosidade) as periculosidade,
  coalesce(s.gratificacao, f.gratificacao) as gratificacao,
  coalesce(s.adicional_noturno, f.adicional_noturno) as adicional_noturno,
  coalesce(s.custo_passagem, f.custo_passagem) as custo_passagem,
  coalesce(s.refeicao, f.refeicao) as refeicao,
  coalesce(s.diarias, f.diarias) as diarias,
  coalesce(s.banco, f.banco) as banco,
  coalesce(s.agencia, f.agencia) as agencia,
  coalesce(s.conta_corrente, f.conta_corrente) as conta_corrente,
  coalesce(s.chave_pix, f.chave_pix) as chave_pix,
  coalesce(s.imagem, f.imagem) as imagem,
  coalesce(s.observacoes, f.observacoes) as observacoes,
  f.created_at,
  f.updated_at,
  bf.nome_funcao,
  bd.nome_departamento,
  bc.codigo_centro_custo,
  bc.nome_centro_custo,
  be.nome_empresa,
  bq.nome_equipe
from public.bd_funcionarios f
left join public.bd_funcionarios_sensivel s on s.funcionario_id = f.id
left join public.bd_funcoes bf on bf.id = f.funcao_id
left join public.bd_departamentos bd on bd.id = f.departamento_id
left join public.bd_centros_custo bc on bc.id = f.centro_custo_id
left join public.bd_empresas be on be.id = f.empresa_id
left join public.bd_equipes bq on bq.id = f.equipe_id
where public.fn_can_access_funcionario_sensitive(f.id);

create or replace function public.fn_get_funcionario_sensitive(
  p_funcionario_id uuid,
  p_origem text default 'rpc.funcionario_sensivel'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.fn_can_access_funcionario_sensitive(p_funcionario_id) then
    raise exception 'Acesso negado a dados sensíveis do funcionário';
  end if;

  perform public.fn_audit_sensitive_read(
    p_funcionario_id,
    p_origem,
    array[
      'cpf','data_nascimento','email','endereco','salario','adicionais','dados_bancarios','imagem','observacoes'
    ]
  );

  select to_jsonb(v)
    into v_result
  from public.vw_funcionarios_rh v
  where v.id = p_funcionario_id;

  return v_result;
end;
$$;

alter table public.bd_funcionarios enable row level security;
alter table public.bd_funcionarios_sensivel enable row level security;
alter table public.bd_auditoria_leitura_funcionario_sensivel enable row level security;

drop policy if exists "Funcionários: acesso por papel e departamento" on public.bd_funcionarios;
drop policy if exists "Funcionários: atualização autenticada" on public.bd_funcionarios;
drop policy if exists "Funcionários: exclusão autenticada" on public.bd_funcionarios;
drop policy if exists "Funcionários: inserção autenticada" on public.bd_funcionarios;
drop policy if exists "Verificação de email para registro anon" on public.bd_funcionarios;

create policy "funcionarios_operacional_select"
on public.bd_funcionarios
for select
to authenticated
using (
  public.fn_can_access_funcionario_operacional(id, departamento_id, centro_custo_id)
  or public.fn_can_access_funcionario_sensitive(id)
);

create policy "funcionarios_insert_restrito"
on public.bd_funcionarios
for insert
to authenticated
with check (
  public.fn_is_super_admin()
  or public.fn_has_role('AdmRH')
  or public.fn_has_role('AdmSSO')
  or public.fn_has_role('AdmOBRA')
  or public.fn_has_permission('gestao_rh_funcionarios_create')
  or public.fn_has_permission('gestao_rh_funcionarios_edit')
);

create policy "funcionarios_update_restrito"
on public.bd_funcionarios
for update
to authenticated
using (
  public.fn_is_super_admin()
  or public.fn_has_role('AdmRH')
  or public.fn_has_role('AdmSSO')
  or public.fn_has_role('AdmOBRA')
  or public.fn_has_permission('gestao_rh_funcionarios_edit')
)
with check (
  public.fn_is_super_admin()
  or public.fn_has_role('AdmRH')
  or public.fn_has_role('AdmSSO')
  or public.fn_has_role('AdmOBRA')
  or public.fn_has_permission('gestao_rh_funcionarios_edit')
);

create policy "funcionarios_delete_restrito"
on public.bd_funcionarios
for delete
to authenticated
using (
  public.fn_is_super_admin()
  or public.fn_has_role('AdmRH')
  or public.fn_has_permission('gestao_rh_funcionarios_delete')
);

create policy "funcionarios_sensivel_select"
on public.bd_funcionarios_sensivel
for select
to authenticated
using (public.fn_can_access_funcionario_sensitive(funcionario_id));

create policy "funcionarios_sensivel_insert"
on public.bd_funcionarios_sensivel
for insert
to authenticated
with check (public.fn_can_access_funcionario_sensitive(funcionario_id));

create policy "funcionarios_sensivel_update"
on public.bd_funcionarios_sensivel
for update
to authenticated
using (public.fn_can_access_funcionario_sensitive(funcionario_id))
with check (public.fn_can_access_funcionario_sensitive(funcionario_id));

create policy "funcionarios_sensivel_delete"
on public.bd_funcionarios_sensivel
for delete
to authenticated
using (
  public.fn_is_super_admin()
  or public.fn_has_role('AdmRH')
);

create policy "auditoria_leitura_sensivel_select"
on public.bd_auditoria_leitura_funcionario_sensivel
for select
to authenticated
using (
  public.fn_is_super_admin()
  or public.fn_has_role('AdmRH')
  or public.fn_has_role('Financeiro')
  or public.fn_has_role('DP')
  or public.fn_has_role('FinanceiroDP')
  or public.fn_has_permission('gestao_rh_funcionarios_sensitive_view')
);

create policy "auditoria_leitura_sensivel_delete"
on public.bd_auditoria_leitura_funcionario_sensivel
for delete
to authenticated
using (public.fn_is_super_admin());

comment on table public.bd_funcionarios_sensivel is 'Camada segregada de dados pessoais, salariais, bancários e demais informações sensíveis de funcionários.';
comment on table public.bd_auditoria_leitura_funcionario_sensivel is 'Auditoria de acessos a dados sensíveis de funcionários.';
comment on view public.vw_funcionarios_operacional is 'View segura para consumo operacional sem PII e sem dados financeiros/bancários.';
comment on view public.vw_funcionarios_rh is 'View segura para RH/Financeiro/DP/SuperAdm com dados completos e compatibilidade legada durante rollout.';