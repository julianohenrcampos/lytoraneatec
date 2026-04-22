create table if not exists public.bd_bi_relatorios_auditoria (
  id uuid primary key default gen_random_uuid(),
  modulo text not null,
  acao text not null,
  formato text not null,
  nivel_dado text not null,
  visao_origem text,
  filtros jsonb not null default '{}'::jsonb,
  quantidade_registros integer,
  gerado_por uuid not null,
  created_at timestamptz not null default now()
);

alter table public.bd_bi_relatorios_auditoria enable row level security;

create index if not exists idx_bi_relatorios_auditoria_modulo_data
  on public.bd_bi_relatorios_auditoria (modulo, created_at desc);

create index if not exists idx_bi_relatorios_auditoria_usuario_data
  on public.bd_bi_relatorios_auditoria (gerado_por, created_at desc);

create or replace function public.fn_bi_can_view_dashboard(
  _modulo text,
  _user_id uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if _user_id is null then
    return false;
  end if;

  if public.check_is_super_admin(_user_id) then
    return true;
  end if;

  case lower(coalesce(_modulo, ''))
    when 'rh_operacional' then
      return coalesce(public.has_permission('dashboard_rh_view', _user_id), false);
    when 'rh_estrategico' then
      return coalesce(public.has_permission('dashboard_rh_view', _user_id), false)
        and coalesce(public.has_permission('gestao_rh_funcionarios_view', _user_id), false);
    when 'maquinas_operacional' then
      return coalesce(public.has_permission('dashboard_maquinas_view', _user_id), false);
    when 'maquinas_estrategico' then
      return public.fn_ativos_has_financial_access();
    when 'logistica_operacional' then
      return coalesce(public.has_permission('requisicoes_chamados_os_view', _user_id), false)
        or coalesce(public.has_permission('requisicoes_gestao_os_view', _user_id), false);
    when 'logistica_estrategico' then
      return coalesce(public.has_permission('requisicoes_gestao_os_view', _user_id), false)
        or public.fn_os_has_financial_access();
    when 'diarias_operacional' then
      return coalesce(public.has_permission('diarias_dashboard_view', _user_id), false)
        or public.fn_can_access_diarias_operacional(_user_id);
    when 'diarias_gerencial' then
      return public.fn_can_access_diarias_gerencial(_user_id);
    when 'diarias_financeiro' then
      return public.fn_can_access_diarias_financeiro(_user_id);
    when 'sso_operacional' then
      return coalesce(public.has_permission('acesso_sso_agendamento_exames', _user_id), false)
        or coalesce(public.has_sso_full_access(_user_id), false);
    when 'sso_estrategico' then
      return coalesce(public.has_sso_full_access(_user_id), false);
    when 'licitacoes_operacional' then
      return coalesce(public.has_permission('dashboard_licitacoes_view', _user_id), false)
        or coalesce(public.has_pncp_access(_user_id), false);
    when 'licitacoes_estrategico' then
      return coalesce(public.has_pncp_access(_user_id), false);
    else
      return false;
  end case;
end;
$$;

create or replace function public.fn_bi_can_export(
  _modulo text,
  _formato text,
  _nivel_dado text,
  _user_id uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_modulo text := lower(coalesce(_modulo, ''));
  v_nivel text := lower(coalesce(_nivel_dado, 'operacional'));
  v_formato text := lower(coalesce(_formato, 'screen'));
begin
  if _user_id is null then
    return false;
  end if;

  if v_formato not in ('screen', 'pdf', 'excel', 'csv', 'zip') then
    return false;
  end if;

  case v_modulo
    when 'rh' then
      return case when v_nivel in ('financeiro', 'sensivel', 'estrategico')
        then public.fn_bi_can_view_dashboard('rh_estrategico', _user_id)
        else public.fn_bi_can_view_dashboard('rh_operacional', _user_id)
      end;
    when 'maquinas' then
      return case when v_nivel in ('financeiro', 'sensivel', 'estrategico')
        then public.fn_bi_can_view_dashboard('maquinas_estrategico', _user_id)
        else public.fn_bi_can_view_dashboard('maquinas_operacional', _user_id)
      end;
    when 'logistica', 'os' then
      return case when v_nivel in ('financeiro', 'sensivel', 'estrategico')
        then public.fn_bi_can_view_dashboard('logistica_estrategico', _user_id)
        else public.fn_bi_can_view_dashboard('logistica_operacional', _user_id)
      end;
    when 'diarias' then
      return case
        when v_nivel = 'financeiro' then public.fn_bi_can_view_dashboard('diarias_financeiro', _user_id)
        when v_nivel = 'gerencial' then public.fn_bi_can_view_dashboard('diarias_gerencial', _user_id)
        else public.fn_bi_can_view_dashboard('diarias_operacional', _user_id)
      end;
    when 'sso' then
      return case when v_nivel in ('estrategico', 'sensivel')
        then public.fn_bi_can_view_dashboard('sso_estrategico', _user_id)
        else public.fn_bi_can_view_dashboard('sso_operacional', _user_id)
      end;
    when 'licitacoes' then
      return case when v_nivel in ('estrategico', 'sensivel')
        then public.fn_bi_can_view_dashboard('licitacoes_estrategico', _user_id)
        else public.fn_bi_can_view_dashboard('licitacoes_operacional', _user_id)
      end;
    else
      return false;
  end case;
end;
$$;

create or replace function public.fn_auditar_bi_relatorio(
  _modulo text,
  _acao text,
  _formato text,
  _nivel_dado text,
  _visao_origem text default null,
  _filtros jsonb default '{}'::jsonb,
  _quantidade_registros integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if not public.fn_bi_can_export(_modulo, _formato, _nivel_dado, v_user_id) then
    raise exception 'Acesso negado para geração do relatório/exportação';
  end if;

  insert into public.bd_bi_relatorios_auditoria (
    modulo,
    acao,
    formato,
    nivel_dado,
    visao_origem,
    filtros,
    quantidade_registros,
    gerado_por
  ) values (
    lower(coalesce(_modulo, 'desconhecido')),
    lower(coalesce(_acao, 'consulta')),
    lower(coalesce(_formato, 'screen')),
    lower(coalesce(_nivel_dado, 'operacional')),
    _visao_origem,
    coalesce(_filtros, '{}'::jsonb),
    _quantidade_registros,
    v_user_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

drop policy if exists "BI auditoria leitura administrativa" on public.bd_bi_relatorios_auditoria;
create policy "BI auditoria leitura administrativa"
on public.bd_bi_relatorios_auditoria
for select
to authenticated
using (
  public.check_is_super_admin(auth.uid())
  or public.has_permission('admin_permissoes_view', auth.uid())
  or public.has_permission('dashboard_rh_view', auth.uid())
  or public.has_permission('dashboard_maquinas_view', auth.uid())
  or public.has_permission('dashboard_licitacoes_view', auth.uid())
);

drop policy if exists "BI auditoria escrita do proprio usuario" on public.bd_bi_relatorios_auditoria;
create policy "BI auditoria escrita do proprio usuario"
on public.bd_bi_relatorios_auditoria
for insert
to authenticated
with check (
  gerado_por = auth.uid()
  and public.fn_bi_can_export(modulo, formato, nivel_dado, auth.uid())
);

create or replace view public.vw_bi_rh_operacional_indicadores
with (security_invoker = true)
as
select
  f.centro_custo_id,
  f.departamento_id,
  f.status,
  count(*) as total_funcionarios,
  count(*) filter (where f.status in ('Ativo', 'Ativo sem Registro')) as total_ativos
from public.bd_funcionarios f
where public.fn_bi_can_view_dashboard('rh_operacional')
  and public.fn_can_access_funcionario_operacional(f.id, f.departamento_id, f.centro_custo_id)
group by f.centro_custo_id, f.departamento_id, f.status;

create or replace view public.vw_bi_rh_estrategico_indicadores
with (security_invoker = true)
as
select
  f.centro_custo_id,
  f.departamento_id,
  count(*) as total_funcionarios,
  count(*) filter (where f.status in ('Ativo', 'Ativo sem Registro')) as total_ativos,
  coalesce(sum(f.salario_base), 0) as salario_base_total,
  coalesce(avg(f.salario_base), 0) as salario_base_medio,
  coalesce(sum(f.diarias), 0) as diarias_total,
  coalesce(sum(f.refeicao), 0) as refeicao_total
from public.bd_funcionarios f
where public.fn_bi_can_view_dashboard('rh_estrategico')
  and public.fn_can_access_funcionario_operacional(f.id, f.departamento_id, f.centro_custo_id)
group by f.centro_custo_id, f.departamento_id;

create or replace view public.vw_bi_diarias_operacional_indicadores
with (security_invoker = true)
as
select
  centro_custo_id,
  codigo_centro_custo,
  nome_centro_custo,
  date_trunc('month', data::timestamp)::date as competencia,
  status_solicitacao,
  count(*) as total_presencas,
  count(distinct funcionario_id) as total_funcionarios,
  count(distinct solicitacao_id) as total_solicitacoes
from public.vw_diarias_operacional_campo
where public.fn_bi_can_view_dashboard('diarias_operacional')
group by centro_custo_id, codigo_centro_custo, nome_centro_custo, date_trunc('month', data::timestamp)::date, status_solicitacao;

create or replace view public.vw_bi_diarias_gerencial_indicadores
with (security_invoker = true)
as
select
  centro_custo_id,
  codigo_centro_custo,
  nome_centro_custo,
  date_trunc('month', data::timestamp)::date as competencia,
  count(*) as total_presencas,
  count(distinct funcionario_id) as total_funcionarios,
  coalesce(sum(valor_diaria_aplicada), 0) as total_diarias,
  coalesce(sum(valor_refeicao_aplicado), 0) as total_refeicoes
from public.vw_diarias_aprovacao_gerencial
where public.fn_bi_can_view_dashboard('diarias_gerencial')
group by centro_custo_id, codigo_centro_custo, nome_centro_custo, date_trunc('month', data::timestamp)::date;

create or replace view public.vw_bi_diarias_financeiro_indicadores
with (security_invoker = true)
as
select
  centro_custo_id,
  codigo_centro_custo,
  nome_centro_custo,
  date_trunc('month', data::timestamp)::date as competencia,
  count(*) as total_presencas,
  count(distinct funcionario_id) as total_funcionarios_pagamento,
  coalesce(sum(valor_diaria_aplicada), 0) as total_diarias,
  coalesce(sum(valor_refeicao_aplicado), 0) as total_refeicoes
from public.vw_diarias_financeiro_dp
where public.fn_bi_can_view_dashboard('diarias_financeiro')
group by centro_custo_id, codigo_centro_custo, nome_centro_custo, date_trunc('month', data::timestamp)::date;

create or replace view public.vw_bi_os_operacional_indicadores
with (security_invoker = true)
as
select
  c.centro_custo_id,
  date_trunc('month', os.data_abertura::timestamp)::date as competencia,
  os.status,
  os.tipo_manutencao,
  count(*) as total_os,
  count(*) filter (where os.data_encerramento_atendimento is null) as total_abertas
from public.vw_ordens_servico_operacional_seguro os
left join public.bd_chamados_os c on c.id = os.chamado_id
where public.fn_bi_can_view_dashboard('logistica_operacional')
  and public.fn_os_can_access_ordem(os.id)
group by c.centro_custo_id, date_trunc('month', os.data_abertura::timestamp)::date, os.status, os.tipo_manutencao;

create or replace view public.vw_bi_os_estrategico_indicadores
with (security_invoker = true)
as
select
  c.centro_custo_id,
  date_trunc('month', os.data_abertura::timestamp)::date as competencia,
  os.status,
  count(*) as total_os,
  coalesce(sum(os.valor_servico), 0) as valor_servico_total,
  coalesce(sum(custos.total_itens_mao_obra), 0) as total_linhas_mao_obra,
  coalesce(sum(custos.total_itens_materiais), 0) as total_linhas_materiais
from public.vw_ordens_servico_admin_seguro os
left join public.bd_chamados_os c on c.id = os.chamado_id
left join public.vw_os_custos_resumido_seguro custos on custos.os_id = os.id
where public.fn_bi_can_view_dashboard('logistica_estrategico')
  and public.fn_os_can_access_ordem(os.id)
group by c.centro_custo_id, date_trunc('month', os.data_abertura::timestamp)::date, os.status;

create or replace view public.vw_bi_maquinas_operacional_indicadores
with (security_invoker = true)
as
select
  e.departamento_id,
  e.tipo_ativo,
  e.status_disponibilidade,
  count(*) as total_ativos
from public.bd_caminhoes_equipamentos e
where public.fn_bi_can_view_dashboard('maquinas_operacional')
  and public.fn_ativos_can_access_equipamento(e.id)
group by e.departamento_id, e.tipo_ativo, e.status_disponibilidade;

create or replace view public.vw_bi_maquinas_estrategico_indicadores
with (security_invoker = true)
as
select
  e.departamento_id,
  e.tipo_ativo,
  e.proprietario_tipo,
  e.status_disponibilidade,
  e.status_cadastro,
  count(*) as total_ativos
from public.bd_caminhoes_equipamentos e
where public.fn_bi_can_view_dashboard('maquinas_estrategico')
  and public.fn_ativos_can_access_equipamento(e.id)
group by e.departamento_id, e.tipo_ativo, e.proprietario_tipo, e.status_disponibilidade, e.status_cadastro;

create or replace view public.vw_bi_sso_indicadores
with (security_invoker = true)
as
select
  s.obra_id,
  date_trunc('month', s.data_inspecao::timestamp)::date as competencia,
  s.resultado_avaliacao,
  count(*) as total_checklists,
  coalesce(avg(s.nota_real), 0) as nota_media,
  coalesce(sum(s.total_conformes), 0) as total_conformes,
  coalesce(sum(s.total_aplicaveis), 0) as total_aplicaveis
from public.bd_sso_checklists s
where public.fn_bi_can_view_dashboard('sso_operacional')
  and (
    public.has_sso_full_access(auth.uid())
    or public.fn_logistica_can_access_centro_custo(s.obra_id)
  )
group by s.obra_id, date_trunc('month', s.data_inspecao::timestamp)::date, s.resultado_avaliacao;

create or replace view public.vw_bi_licitacoes_indicadores
with (security_invoker = true)
as
select
  date_trunc('month', l.data_publicacao::timestamp)::date as competencia,
  l.uf,
  l.modalidade_contratacao,
  l.status_analise,
  count(*) as total_licitacoes,
  coalesce(sum(l.valor_total_estimado), 0) as valor_estimado_total
from public.bd_pncp_todas_licitacoes l
where public.fn_bi_can_view_dashboard('licitacoes_operacional')
group by date_trunc('month', l.data_publicacao::timestamp)::date, l.uf, l.modalidade_contratacao, l.status_analise;