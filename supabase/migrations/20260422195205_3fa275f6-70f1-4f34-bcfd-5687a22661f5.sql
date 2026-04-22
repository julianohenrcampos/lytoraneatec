create or replace function public.fn_ativos_has_operational_access(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_is_super_admin(p_user_id)
    or public.fn_has_permission('gestao_maquinas_caminhoes_view', p_user_id)
    or public.fn_has_permission('dashboard_maquinas_view', p_user_id)
    or public.fn_has_permission('gestao_maquinas_relatorio_medicao_view', p_user_id);
$$;

create or replace function public.fn_ativos_has_logistics_access(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_is_super_admin(p_user_id)
    or public.fn_has_role('Encarregado', p_user_id)
    or public.fn_has_role('Logistica', p_user_id)
    or public.fn_has_role('Manutencao', p_user_id)
    or public.fn_has_role('Operacional', p_user_id)
    or public.fn_has_permission('gestao_maquinas_caminhoes_view', p_user_id);
$$;

create or replace function public.fn_ativos_has_financial_access(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_is_super_admin(p_user_id)
    or public.fn_has_role('Administrador', p_user_id)
    or public.fn_has_role('Diretoria', p_user_id)
    or public.fn_has_role('Financeiro', p_user_id)
    or public.fn_has_role('Compras', p_user_id)
    or public.fn_has_role('Suprimentos', p_user_id)
    or public.fn_has_role('Aprovador', p_user_id);
$$;

create or replace function public.fn_ativos_has_precise_location_access(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_ativos_has_financial_access(p_user_id)
    or public.fn_has_role('Logistica', p_user_id)
    or public.fn_has_role('Manutencao', p_user_id)
    or public.fn_is_super_admin(p_user_id);
$$;

create or replace function public.fn_ativos_profile_funcionario_id(p_user_id uuid default auth.uid())
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.funcionario_id
  from public.profiles p
  where p.id = p_user_id
  limit 1;
$$;

create or replace function public.fn_ativos_user_centros_custo(p_user_id uuid default auth.uid())
returns table(centro_custo_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  with actor as (
    select public.fn_ativos_profile_funcionario_id(p_user_id) as funcionario_id
  )
  select distinct f.centro_custo_id
  from actor a
  join public.bd_funcionarios f on f.id = a.funcionario_id
  where f.centro_custo_id is not null

  union

  select distinct cc.id
  from public.bd_centros_custo cc
  where public.fn_is_super_admin(p_user_id)
     or public.fn_ativos_has_financial_access(p_user_id);
$$;

create or replace function public.fn_ativos_can_access_centro_custo(p_centro_custo_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_centro_custo_id is null
    or public.fn_is_super_admin(p_user_id)
    or public.fn_ativos_has_financial_access(p_user_id)
    or exists (
      select 1
      from public.fn_ativos_user_centros_custo(p_user_id) ucc
      where ucc.centro_custo_id = p_centro_custo_id
    );
$$;

create or replace function public.fn_ativos_can_access_solicitacao(p_solicitacao_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bd_solicitacoes_equipamento s
    where s.id = p_solicitacao_id
      and (
        public.fn_is_super_admin(p_user_id)
        or public.fn_ativos_has_financial_access(p_user_id)
        or s.solicitante_id = p_user_id
        or public.fn_ativos_can_access_centro_custo(s.centro_custo_id, p_user_id)
      )
  );
$$;

create or replace function public.fn_ativos_can_access_equipamento(p_equipamento_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with ultima_disp as (
    select d.centro_custo_id
    from public.bd_disponibilidade_equipamentos d
    where d.equipamento_id = p_equipamento_id
    order by coalesce(d.updated_at, d.created_at) desc nulls last
    limit 1
  ), ultima_loc as (
    select l.centro_custo_id
    from public.bd_localizacao_equipamentos l
    where l.equipamento_id = p_equipamento_id
    order by l.data_registro desc nulls last
    limit 1
  )
  select public.fn_ativos_has_operational_access(p_user_id)
    and (
      public.fn_is_super_admin(p_user_id)
      or public.fn_ativos_has_financial_access(p_user_id)
      or not exists (select 1 from ultima_disp)
      or exists (
        select 1
        from ultima_disp d
        where public.fn_ativos_can_access_centro_custo(d.centro_custo_id, p_user_id)
      )
      or exists (
        select 1
        from ultima_loc l
        where public.fn_ativos_can_access_centro_custo(l.centro_custo_id, p_user_id)
      )
    );
$$;

create table if not exists public.bd_ativos_auditoria (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  acao text not null,
  recurso_tipo text not null,
  recurso_id uuid,
  contexto text not null,
  filtros jsonb not null default '{}'::jsonb,
  detalhes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.bd_ativos_auditoria enable row level security;

drop policy if exists "ativos_auditoria_read_admin" on public.bd_ativos_auditoria;
create policy "ativos_auditoria_read_admin"
  on public.bd_ativos_auditoria
  for select
  to authenticated
  using (
    public.fn_is_super_admin(auth.uid())
    or public.fn_ativos_has_financial_access(auth.uid())
  );

drop policy if exists "ativos_auditoria_insert_system" on public.bd_ativos_auditoria;
create policy "ativos_auditoria_insert_system"
  on public.bd_ativos_auditoria
  for insert
  to authenticated
  with check (actor_user_id = auth.uid());

create index if not exists idx_ativos_auditoria_actor_created_at
  on public.bd_ativos_auditoria(actor_user_id, created_at desc);
create index if not exists idx_ativos_auditoria_recurso
  on public.bd_ativos_auditoria(recurso_tipo, recurso_id, created_at desc);

create or replace function public.fn_auditar_ativos(
  p_acao text,
  p_recurso_tipo text,
  p_recurso_id uuid default null,
  p_contexto text default 'operacional',
  p_filtros jsonb default '{}'::jsonb,
  p_detalhes jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.bd_ativos_auditoria (
    actor_user_id,
    acao,
    recurso_tipo,
    recurso_id,
    contexto,
    filtros,
    detalhes
  ) values (
    auth.uid(),
    p_acao,
    p_recurso_tipo,
    p_recurso_id,
    p_contexto,
    coalesce(p_filtros, '{}'::jsonb),
    coalesce(p_detalhes, '{}'::jsonb)
  );
end;
$$;

create or replace function public.fn_ativos_auditar_mutacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recurso_id uuid;
  v_detalhes jsonb;
begin
  v_recurso_id := coalesce(new.id, old.id);
  v_detalhes := jsonb_build_object(
    'tabela', tg_table_name,
    'operacao', tg_op,
    'old', case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    'new', case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  perform public.fn_auditar_ativos(
    lower(tg_op),
    tg_table_name,
    v_recurso_id,
    case
      when tg_table_name in ('bd_custos_equipamentos','bd_cotacoes','bd_cotacoes_itens','bd_cotacoes_propostas','bd_aprovacoes_excecao') then 'financeiro_aprovacao'
      when tg_table_name = 'bd_localizacao_equipamentos' then 'localizacao'
      else 'operacional_logistica'
    end,
    '{}'::jsonb,
    v_detalhes
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

alter table public.bd_caminhoes_equipamentos enable row level security;
alter table public.bd_disponibilidade_equipamentos enable row level security;
alter table public.bd_localizacao_equipamentos enable row level security;
alter table public.bd_solicitacoes_equipamento enable row level security;
alter table public.bd_custos_equipamentos enable row level security;
alter table public.bd_cotacoes enable row level security;
alter table public.bd_cotacoes_itens enable row level security;
alter table public.bd_cotacoes_propostas enable row level security;
alter table public.bd_aprovacoes_excecao enable row level security;

drop policy if exists "Allow all access to caminhoes_equipamentos during development" on public.bd_caminhoes_equipamentos;
drop policy if exists "Authenticated users can read disponibilidade" on public.bd_disponibilidade_equipamentos;
drop policy if exists "Authenticated users can insert disponibilidade" on public.bd_disponibilidade_equipamentos;
drop policy if exists "Authenticated users can update disponibilidade" on public.bd_disponibilidade_equipamentos;
drop policy if exists "Authenticated users can read localizacao" on public.bd_localizacao_equipamentos;
drop policy if exists "Authenticated users can insert localizacao" on public.bd_localizacao_equipamentos;
drop policy if exists "Authenticated users can update localizacao" on public.bd_localizacao_equipamentos;
drop policy if exists "Authenticated users can read solicitacoes_equip" on public.bd_solicitacoes_equipamento;
drop policy if exists "Authenticated users can insert solicitacoes_equip" on public.bd_solicitacoes_equipamento;
drop policy if exists "Authenticated users can update solicitacoes_equip" on public.bd_solicitacoes_equipamento;
drop policy if exists "Auth read bd_custos_equipamentos" on public.bd_custos_equipamentos;
drop policy if exists "Auth insert bd_custos_equipamentos" on public.bd_custos_equipamentos;
drop policy if exists "Auth update bd_custos_equipamentos" on public.bd_custos_equipamentos;
drop policy if exists "Auth read bd_cotacoes" on public.bd_cotacoes;
drop policy if exists "Auth insert bd_cotacoes" on public.bd_cotacoes;
drop policy if exists "Auth update bd_cotacoes" on public.bd_cotacoes;
drop policy if exists "Auth read bd_cotacoes_itens" on public.bd_cotacoes_itens;
drop policy if exists "Auth insert bd_cotacoes_itens" on public.bd_cotacoes_itens;
drop policy if exists "Auth update bd_cotacoes_itens" on public.bd_cotacoes_itens;
drop policy if exists "Auth read bd_cotacoes_propostas" on public.bd_cotacoes_propostas;
drop policy if exists "Auth insert bd_cotacoes_propostas" on public.bd_cotacoes_propostas;
drop policy if exists "Auth update bd_cotacoes_propostas" on public.bd_cotacoes_propostas;
drop policy if exists "Auth read bd_aprovacoes_excecao" on public.bd_aprovacoes_excecao;
drop policy if exists "Auth insert bd_aprovacoes_excecao" on public.bd_aprovacoes_excecao;
drop policy if exists "Auth update bd_aprovacoes_excecao" on public.bd_aprovacoes_excecao;

drop policy if exists "ativos_equipamentos_read" on public.bd_caminhoes_equipamentos;
create policy "ativos_equipamentos_read"
  on public.bd_caminhoes_equipamentos
  for select
  to authenticated
  using (public.fn_ativos_can_access_equipamento(id, auth.uid()));

drop policy if exists "ativos_equipamentos_write" on public.bd_caminhoes_equipamentos;
create policy "ativos_equipamentos_write"
  on public.bd_caminhoes_equipamentos
  for all
  to authenticated
  using (public.fn_ativos_has_logistics_access(auth.uid()))
  with check (public.fn_ativos_has_logistics_access(auth.uid()));

drop policy if exists "ativos_disponibilidade_read" on public.bd_disponibilidade_equipamentos;
create policy "ativos_disponibilidade_read"
  on public.bd_disponibilidade_equipamentos
  for select
  to authenticated
  using (
    public.fn_ativos_has_operational_access(auth.uid())
    and (
      public.fn_ativos_has_financial_access(auth.uid())
      or public.fn_ativos_can_access_centro_custo(centro_custo_id, auth.uid())
      or public.fn_ativos_can_access_equipamento(equipamento_id, auth.uid())
    )
  );

drop policy if exists "ativos_disponibilidade_write" on public.bd_disponibilidade_equipamentos;
create policy "ativos_disponibilidade_write"
  on public.bd_disponibilidade_equipamentos
  for all
  to authenticated
  using (public.fn_ativos_has_logistics_access(auth.uid()))
  with check (
    public.fn_ativos_has_logistics_access(auth.uid())
    and public.fn_ativos_can_access_equipamento(equipamento_id, auth.uid())
  );

drop policy if exists "ativos_localizacao_read" on public.bd_localizacao_equipamentos;
create policy "ativos_localizacao_read"
  on public.bd_localizacao_equipamentos
  for select
  to authenticated
  using (
    public.fn_ativos_has_precise_location_access(auth.uid())
    and public.fn_ativos_can_access_equipamento(equipamento_id, auth.uid())
  );

drop policy if exists "ativos_localizacao_write" on public.bd_localizacao_equipamentos;
create policy "ativos_localizacao_write"
  on public.bd_localizacao_equipamentos
  for all
  to authenticated
  using (public.fn_ativos_has_logistics_access(auth.uid()))
  with check (
    public.fn_ativos_has_logistics_access(auth.uid())
    and public.fn_ativos_can_access_equipamento(equipamento_id, auth.uid())
  );

drop policy if exists "ativos_solicitacoes_read" on public.bd_solicitacoes_equipamento;
create policy "ativos_solicitacoes_read"
  on public.bd_solicitacoes_equipamento
  for select
  to authenticated
  using (
    public.fn_ativos_has_operational_access(auth.uid())
    and (
      solicitante_id = auth.uid()
      or public.fn_ativos_can_access_centro_custo(centro_custo_id, auth.uid())
      or public.fn_ativos_has_financial_access(auth.uid())
    )
  );

drop policy if exists "ativos_solicitacoes_insert" on public.bd_solicitacoes_equipamento;
create policy "ativos_solicitacoes_insert"
  on public.bd_solicitacoes_equipamento
  for insert
  to authenticated
  with check (
    public.fn_ativos_has_operational_access(auth.uid())
    and (solicitante_id is null or solicitante_id = auth.uid() or public.fn_ativos_has_logistics_access(auth.uid()))
    and public.fn_ativos_can_access_centro_custo(centro_custo_id, auth.uid())
  );

drop policy if exists "ativos_solicitacoes_update" on public.bd_solicitacoes_equipamento;
create policy "ativos_solicitacoes_update"
  on public.bd_solicitacoes_equipamento
  for update
  to authenticated
  using (
    public.fn_ativos_has_logistics_access(auth.uid())
    or public.fn_ativos_has_financial_access(auth.uid())
    or solicitante_id = auth.uid()
  )
  with check (
    public.fn_ativos_has_logistics_access(auth.uid())
    or public.fn_ativos_has_financial_access(auth.uid())
    or solicitante_id = auth.uid()
  );

drop policy if exists "ativos_custos_read" on public.bd_custos_equipamentos;
create policy "ativos_custos_read"
  on public.bd_custos_equipamentos
  for select
  to authenticated
  using (public.fn_ativos_has_financial_access(auth.uid()));

drop policy if exists "ativos_custos_write" on public.bd_custos_equipamentos;
create policy "ativos_custos_write"
  on public.bd_custos_equipamentos
  for all
  to authenticated
  using (public.fn_ativos_has_financial_access(auth.uid()))
  with check (public.fn_ativos_has_financial_access(auth.uid()));

drop policy if exists "ativos_cotacoes_read" on public.bd_cotacoes;
create policy "ativos_cotacoes_read"
  on public.bd_cotacoes
  for select
  to authenticated
  using (
    public.fn_ativos_has_financial_access(auth.uid())
    or public.fn_ativos_can_access_solicitacao(solicitacao_id, auth.uid())
  );

drop policy if exists "ativos_cotacoes_write" on public.bd_cotacoes;
create policy "ativos_cotacoes_write"
  on public.bd_cotacoes
  for all
  to authenticated
  using (public.fn_ativos_has_financial_access(auth.uid()))
  with check (public.fn_ativos_has_financial_access(auth.uid()));

drop policy if exists "ativos_cotacoes_itens_read" on public.bd_cotacoes_itens;
create policy "ativos_cotacoes_itens_read"
  on public.bd_cotacoes_itens
  for select
  to authenticated
  using (
    public.fn_ativos_has_financial_access(auth.uid())
    or exists (
      select 1
      from public.bd_cotacoes c
      where c.id = cotacao_id
        and public.fn_ativos_can_access_solicitacao(c.solicitacao_id, auth.uid())
    )
  );

drop policy if exists "ativos_cotacoes_itens_write" on public.bd_cotacoes_itens;
create policy "ativos_cotacoes_itens_write"
  on public.bd_cotacoes_itens
  for all
  to authenticated
  using (public.fn_ativos_has_financial_access(auth.uid()))
  with check (public.fn_ativos_has_financial_access(auth.uid()));

drop policy if exists "ativos_cotacoes_propostas_read" on public.bd_cotacoes_propostas;
create policy "ativos_cotacoes_propostas_read"
  on public.bd_cotacoes_propostas
  for select
  to authenticated
  using (
    public.fn_ativos_has_financial_access(auth.uid())
    or exists (
      select 1
      from public.bd_cotacoes_itens ci
      join public.bd_cotacoes c on c.id = ci.cotacao_id
      where ci.id = cotacao_item_id
        and public.fn_ativos_can_access_solicitacao(c.solicitacao_id, auth.uid())
    )
  );

drop policy if exists "ativos_cotacoes_propostas_write" on public.bd_cotacoes_propostas;
create policy "ativos_cotacoes_propostas_write"
  on public.bd_cotacoes_propostas
  for all
  to authenticated
  using (public.fn_ativos_has_financial_access(auth.uid()))
  with check (public.fn_ativos_has_financial_access(auth.uid()));

drop policy if exists "ativos_aprovacoes_excecao_read" on public.bd_aprovacoes_excecao;
create policy "ativos_aprovacoes_excecao_read"
  on public.bd_aprovacoes_excecao
  for select
  to authenticated
  using (
    public.fn_ativos_has_financial_access(auth.uid())
    or public.fn_ativos_can_access_solicitacao(solicitacao_id, auth.uid())
  );

drop policy if exists "ativos_aprovacoes_excecao_write" on public.bd_aprovacoes_excecao;
create policy "ativos_aprovacoes_excecao_write"
  on public.bd_aprovacoes_excecao
  for all
  to authenticated
  using (public.fn_ativos_has_financial_access(auth.uid()))
  with check (public.fn_ativos_has_financial_access(auth.uid()));

create or replace view public.vw_ativos_operacional
with (security_invoker = true)
as
with ultima_disponibilidade as (
  select distinct on (d.equipamento_id)
    d.equipamento_id,
    d.status_operacional,
    d.centro_custo_id,
    d.data_inicio,
    d.previsao_liberacao,
    d.confiabilidade_previsao,
    d.observacao,
    d.updated_at
  from public.bd_disponibilidade_equipamentos d
  order by d.equipamento_id, coalesce(d.updated_at, d.created_at) desc nulls last
), ultima_localizacao as (
  select distinct on (l.equipamento_id)
    l.equipamento_id,
    l.centro_custo_id,
    case when public.fn_ativos_has_precise_location_access(auth.uid()) then round(l.latitude::numeric, 5) else round(l.latitude::numeric, 2) end as latitude_controlada,
    case when public.fn_ativos_has_precise_location_access(auth.uid()) then round(l.longitude::numeric, 5) else round(l.longitude::numeric, 2) end as longitude_controlada,
    l.origem,
    l.data_registro
  from public.bd_localizacao_equipamentos l
  order by l.equipamento_id, l.data_registro desc nulls last
)
select
  e.id,
  e.frota,
  e.numero_frota,
  e.placa,
  e.fabricante,
  e.tipo_ativo,
  e.categoria_ativo_id,
  e.subcategoria_ativo_id,
  e.tipo_equipamento_id,
  e.situacao,
  e.status_disponibilidade,
  ud.status_operacional,
  ud.centro_custo_id,
  cc.nome_centro_custo,
  ul.latitude_controlada,
  ul.longitude_controlada,
  ul.origem as localizacao_origem,
  ul.data_registro as localizacao_data_registro
from public.bd_caminhoes_equipamentos e
left join ultima_disponibilidade ud on ud.equipamento_id = e.id
left join public.bd_centros_custo cc on cc.id = ud.centro_custo_id
left join ultima_localizacao ul on ul.equipamento_id = e.id;

create or replace view public.vw_ativos_logistica_manutencao
with (security_invoker = true)
as
select
  e.*,
  d.status_operacional,
  d.centro_custo_id,
  cc.nome_centro_custo,
  cc.codigo_centro_custo,
  l.latitude,
  l.longitude,
  l.origem as localizacao_origem,
  l.data_registro as localizacao_data_registro
from public.bd_caminhoes_equipamentos e
left join lateral (
  select d1.*
  from public.bd_disponibilidade_equipamentos d1
  where d1.equipamento_id = e.id
  order by coalesce(d1.updated_at, d1.created_at) desc nulls last
  limit 1
) d on true
left join public.bd_centros_custo cc on cc.id = d.centro_custo_id
left join lateral (
  select l1.*
  from public.bd_localizacao_equipamentos l1
  where l1.equipamento_id = e.id
  order by l1.data_registro desc nulls last
  limit 1
) l on true;

create or replace view public.vw_localizacao_equipamentos_controlada
with (security_invoker = true)
as
select
  l.id,
  l.equipamento_id,
  l.centro_custo_id,
  case when public.fn_ativos_has_precise_location_access(auth.uid()) then round(l.latitude::numeric, 5) else round(l.latitude::numeric, 2) end as latitude_controlada,
  case when public.fn_ativos_has_precise_location_access(auth.uid()) then round(l.longitude::numeric, 5) else round(l.longitude::numeric, 2) end as longitude_controlada,
  l.origem,
  l.data_registro
from public.bd_localizacao_equipamentos l;

create or replace view public.vw_solicitacoes_equipamento_operacional
with (security_invoker = true)
as
select
  s.id,
  s.centro_custo_id,
  cc.codigo_centro_custo,
  cc.nome_centro_custo,
  s.solicitante_id,
  s.tipo_equipamento_id,
  te.descricao_padronizada as tipo_equipamento_descricao,
  s.quantidade,
  s.data_inicio,
  s.tempo_previsto_dias,
  s.regime_trabalho,
  s.com_operador,
  s.prioridade,
  s.justificativa,
  s.status,
  s.created_at,
  s.updated_at
from public.bd_solicitacoes_equipamento s
left join public.bd_centros_custo cc on cc.id = s.centro_custo_id
left join public.bd_tipos_equipamento te on te.id = s.tipo_equipamento_id;

create or replace view public.vw_solicitacoes_equipamento_financeiro
with (security_invoker = true)
as
select
  s.*,
  cc.codigo_centro_custo,
  cc.nome_centro_custo,
  te.descricao_padronizada as tipo_equipamento_descricao,
  coalesce(c.valor_diaria, 0) as valor_diaria_referencia,
  coalesce(c.valor_hora, 0) as valor_hora_referencia,
  coalesce(c.valor_mensal, 0) as valor_mensal_referencia
from public.bd_solicitacoes_equipamento s
left join public.bd_centros_custo cc on cc.id = s.centro_custo_id
left join public.bd_tipos_equipamento te on te.id = s.tipo_equipamento_id
left join lateral (
  select c1.*
  from public.bd_custos_equipamentos c1
  where c1.ativo = true
    and (c1.tipo_equipamento_id = s.tipo_equipamento_id)
  order by c1.vigencia_inicio desc nulls last
  limit 1
) c on true;

create or replace view public.vw_custos_equipamentos_seguro
with (security_invoker = true)
as
select
  c.id,
  c.tipo_equipamento_id,
  te.descricao_padronizada as tipo_equipamento_descricao,
  c.equipamento_id,
  e.frota,
  e.numero_frota,
  c.valor_hora,
  c.valor_diaria,
  c.valor_mensal,
  c.vigencia_inicio,
  c.vigencia_fim,
  c.ativo,
  c.created_at,
  c.updated_at
from public.bd_custos_equipamentos c
left join public.bd_tipos_equipamento te on te.id = c.tipo_equipamento_id
left join public.bd_caminhoes_equipamentos e on e.id = c.equipamento_id;

create or replace view public.vw_cotacoes_segura
with (security_invoker = true)
as
select
  c.id,
  c.solicitacao_id,
  s.centro_custo_id,
  cc.nome_centro_custo,
  c.data_abertura,
  c.status,
  c.created_at,
  c.updated_at,
  jsonb_agg(
    distinct jsonb_build_object(
      'item_id', ci.id,
      'tipo_equipamento_id', ci.tipo_equipamento_id,
      'quantidade', ci.quantidade
    )
  ) filter (where ci.id is not null) as itens,
  jsonb_agg(
    distinct jsonb_build_object(
      'proposta_id', cp.id,
      'empresa_id', cp.empresa_id,
      'fabricante_id', cp.fabricante_id,
      'modelo_id', cp.modelo_id,
      'ano_fabricacao', cp.ano_fabricacao,
      'valor_unitario', cp.valor_unitario,
      'valor_total', cp.valor_total,
      'com_operador', cp.com_operador,
      'prazo_entrega', cp.prazo_entrega,
      'status', cp.status
    )
  ) filter (where cp.id is not null) as propostas
from public.bd_cotacoes c
left join public.bd_solicitacoes_equipamento s on s.id = c.solicitacao_id
left join public.bd_centros_custo cc on cc.id = s.centro_custo_id
left join public.bd_cotacoes_itens ci on ci.cotacao_id = c.id
left join public.bd_cotacoes_propostas cp on cp.cotacao_item_id = ci.id
group by c.id, s.centro_custo_id, cc.nome_centro_custo;

create or replace view public.vw_aprovacoes_excecao_segura
with (security_invoker = true)
as
select
  a.id,
  a.solicitacao_id,
  s.centro_custo_id,
  cc.nome_centro_custo,
  a.valor_referencia_interno,
  a.valor_proposto,
  a.percentual_acima,
  a.justificativa,
  a.aprovado_por,
  a.data_aprovacao,
  a.status,
  a.created_at,
  a.updated_at
from public.bd_aprovacoes_excecao a
left join public.bd_solicitacoes_equipamento s on s.id = a.solicitacao_id
left join public.bd_centros_custo cc on cc.id = s.centro_custo_id;

create or replace view public.vw_portfolio_tecnico_seguro
with (security_invoker = true)
as
select
  c.id,
  c.descricao_padrao,
  c.capacidade,
  c.ano_fabricacao_padrao,
  c.cor_padrao,
  c.motor_padrao,
  c.potencia,
  c.imagem_url,
  c.ativo,
  te.descricao_padronizada as tipo_equipamento_descricao,
  sb.nome_subcategoria,
  f.nome as fabricante_nome,
  m.nome_modelo
from public.bd_catalogo_equipamentos c
left join public.bd_tipos_equipamento te on te.id = c.tipo_equipamento_id
left join public.bd_subcategorias_ativos sb on sb.id = c.subcategoria_id
left join public.bd_fabricantes f on f.id = c.fabricante_id
left join public.bd_modelos m on m.id = c.modelo_id;

drop trigger if exists trg_ativos_audit_disponibilidade on public.bd_disponibilidade_equipamentos;
create trigger trg_ativos_audit_disponibilidade
after insert or update or delete on public.bd_disponibilidade_equipamentos
for each row execute function public.fn_ativos_auditar_mutacao();

drop trigger if exists trg_ativos_audit_localizacao on public.bd_localizacao_equipamentos;
create trigger trg_ativos_audit_localizacao
after insert or update or delete on public.bd_localizacao_equipamentos
for each row execute function public.fn_ativos_auditar_mutacao();

drop trigger if exists trg_ativos_audit_custos on public.bd_custos_equipamentos;
create trigger trg_ativos_audit_custos
after insert or update or delete on public.bd_custos_equipamentos
for each row execute function public.fn_ativos_auditar_mutacao();

drop trigger if exists trg_ativos_audit_cotacoes on public.bd_cotacoes;
create trigger trg_ativos_audit_cotacoes
after insert or update or delete on public.bd_cotacoes
for each row execute function public.fn_ativos_auditar_mutacao();

drop trigger if exists trg_ativos_audit_cotacoes_itens on public.bd_cotacoes_itens;
create trigger trg_ativos_audit_cotacoes_itens
after insert or update or delete on public.bd_cotacoes_itens
for each row execute function public.fn_ativos_auditar_mutacao();

drop trigger if exists trg_ativos_audit_cotacoes_propostas on public.bd_cotacoes_propostas;
create trigger trg_ativos_audit_cotacoes_propostas
after insert or update or delete on public.bd_cotacoes_propostas
for each row execute function public.fn_ativos_auditar_mutacao();

drop trigger if exists trg_ativos_audit_aprovacoes_excecao on public.bd_aprovacoes_excecao;
create trigger trg_ativos_audit_aprovacoes_excecao
after insert or update or delete on public.bd_aprovacoes_excecao
for each row execute function public.fn_ativos_auditar_mutacao();