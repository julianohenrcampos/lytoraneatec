create or replace function public.fn_user_has_any_named_role(_user_id uuid, _roles text[])
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
      and r.nome = any(_roles)
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = _user_id
      and p.funcoes && _roles
  );
$$;

create or replace function public.fn_can_access_diarias_operacional(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.check_is_super_admin(_user_id)
    or public.check_is_admsso(_user_id)
    or public.has_permission('diarias_view')
    or public.has_permission('diarias_apontamento_view')
    or public.has_permission('diarias_solicitacoes_view')
    or public.has_permission('diarias_relatorio_view')
    or public.fn_user_has_any_named_role(_user_id, array['AdmOBRA','AdmSede','Engenheiro','GerenteRegional','Gerente']);
$$;

create or replace function public.fn_can_access_diarias_gerencial(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.check_is_super_admin(_user_id)
    or public.has_permission('diarias_autorizar')
    or public.has_permission('diarias_aprovar')
    or public.has_permission('diarias_relatorio_view')
    or public.fn_user_has_any_named_role(_user_id, array['AdmSede','GerenteRegional','Gerente','DiretorOperacional','DiretorAdministrativo']);
$$;

create or replace function public.fn_can_access_diarias_financeiro(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.check_is_super_admin(_user_id)
    or public.has_permission('diarias_exportar_excel')
    or public.has_permission('diarias_relatorio_financeiro_view')
    or public.has_permission('diarias_relatorio_dp_view')
    or public.has_permission('diarias_folha_pagamento_export')
    or public.has_permission('diarias_remessa_export')
    or public.has_permission('diarias_protocolo_documentos_export')
    or public.fn_user_has_any_named_role(_user_id, array['Financeiro','DP','DepartamentoPessoal']);
$$;

create or replace function public.fn_user_can_access_diaria_solicitacao(_user_id uuid, _solicitacao_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bd_diaria_solicitacoes s
    left join public.bd_centros_custo cc on cc.id = s.centro_custo_id
    where s.id = _solicitacao_id
      and (
        public.check_is_super_admin(_user_id)
        or public.check_is_admsso(_user_id)
        or s.criado_por = _user_id
        or s.responsavel_campo_id = public.get_user_funcionario_id(_user_id)
        or cc.aprovador_diarias_id = public.get_user_funcionario_id(_user_id)
        or cc.adm_sede_funcionario_id = public.get_user_funcionario_id(_user_id)
      )
  );
$$;

create or replace function public.fn_user_can_access_diaria_financial(_user_id uuid, _solicitacao_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bd_diaria_solicitacoes s
    left join public.bd_centros_custo cc on cc.id = s.centro_custo_id
    where s.id = _solicitacao_id
      and (
        public.fn_can_access_diarias_financeiro(_user_id)
        or public.check_is_super_admin(_user_id)
        or cc.aprovador_diarias_id = public.get_user_funcionario_id(_user_id)
        or cc.adm_sede_funcionario_id = public.get_user_funcionario_id(_user_id)
      )
  );
$$;

create table if not exists public.bd_diaria_relatorio_auditoria (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  contexto text not null,
  acao text not null,
  formato text,
  arquivo_nome text,
  solicitacao_id uuid,
  centro_custo_id uuid,
  periodo_inicio date,
  periodo_fim date,
  filtros jsonb not null default '{}'::jsonb,
  quantidade_registros integer,
  created_at timestamp with time zone not null default now()
);

alter table public.bd_diaria_relatorio_auditoria enable row level security;

drop policy if exists "SuperAdmin lê auditoria de relatórios de diárias" on public.bd_diaria_relatorio_auditoria;
create policy "SuperAdmin lê auditoria de relatórios de diárias"
on public.bd_diaria_relatorio_auditoria
for select
to authenticated
using (public.check_is_super_admin(auth.uid()));

drop policy if exists "Financeiro e gerência leem auditoria de relatórios de diárias" on public.bd_diaria_relatorio_auditoria;
create policy "Financeiro e gerência leem auditoria de relatórios de diárias"
on public.bd_diaria_relatorio_auditoria
for select
to authenticated
using (
  public.fn_can_access_diarias_financeiro(auth.uid())
  or public.fn_can_access_diarias_gerencial(auth.uid())
);

drop policy if exists "Usuário autenticado registra auditoria de relatórios de diárias" on public.bd_diaria_relatorio_auditoria;
create policy "Usuário autenticado registra auditoria de relatórios de diárias"
on public.bd_diaria_relatorio_auditoria
for insert
to authenticated
with check (user_id = auth.uid());

create or replace function public.fn_auditar_relatorio_diarias(
  p_contexto text,
  p_acao text,
  p_formato text default null,
  p_arquivo_nome text default null,
  p_solicitacao_id uuid default null,
  p_centro_custo_id uuid default null,
  p_periodo_inicio date default null,
  p_periodo_fim date default null,
  p_filtros jsonb default '{}'::jsonb,
  p_quantidade_registros integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if p_contexto = 'financeiro_dp' and not public.fn_can_access_diarias_financeiro(v_user_id) then
    raise exception 'Acesso negado para auditoria financeira';
  end if;

  if p_contexto = 'aprovacao_gerencial' and not public.fn_can_access_diarias_gerencial(v_user_id) then
    raise exception 'Acesso negado para auditoria gerencial';
  end if;

  if p_contexto = 'operacional_campo' and not public.fn_can_access_diarias_operacional(v_user_id) then
    raise exception 'Acesso negado para auditoria operacional';
  end if;

  insert into public.bd_diaria_relatorio_auditoria (
    user_id,
    contexto,
    acao,
    formato,
    arquivo_nome,
    solicitacao_id,
    centro_custo_id,
    periodo_inicio,
    periodo_fim,
    filtros,
    quantidade_registros
  ) values (
    v_user_id,
    p_contexto,
    p_acao,
    p_formato,
    p_arquivo_nome,
    p_solicitacao_id,
    p_centro_custo_id,
    p_periodo_inicio,
    p_periodo_fim,
    coalesce(p_filtros, '{}'::jsonb),
    p_quantidade_registros
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace view public.vw_diarias_operacional_campo
with (security_invoker = true)
as
select
  p.id as presenca_id,
  p.solicitacao_id,
  dsol.numero_solicitacao,
  dsol.data_inicio as solicitacao_data_inicio,
  dsol.data_fim as solicitacao_data_fim,
  p.data,
  cc.id as centro_custo_id,
  cc.codigo_centro_custo,
  cc.nome_centro_custo,
  p.funcionario_id,
  f.nome_completo as nome_funcionario,
  f.matricula as matricula_funcionario,
  f.empresa_id,
  emp.nome_empresa as empresa_funcionario,
  f.status as status_funcionario,
  p.funcao_id,
  func.nome_funcao,
  p.hora_entrada,
  p.hora_saida,
  p.intervalo_inicio,
  p.intervalo_fim,
  (p.presente)::text as presenca_status,
  p.confirmado_por,
  p.confirmado_em,
  p.tipo_diaria,
  p.usar_diaria_exclusiva,
  dsol.status as status_solicitacao,
  dsol.criado_por as solicitante_id,
  sol_profile.nome_completo as solicitante_nome,
  dsol.engenheiro_solicitante_id,
  eng_func.nome_completo as engenheiro_solicitante_nome,
  apto.responsavel_campo_id as apontador_id,
  apt_func.nome_completo as apontador_nome,
  p.observacoes,
  p.created_at
from public.bd_diaria_presencas p
join public.bd_diaria_solicitacoes dsol on p.solicitacao_id = dsol.id
join public.bd_centros_custo cc on dsol.centro_custo_id = cc.id
left join public.bd_funcionarios f on p.funcionario_id = f.id
left join public.bd_empresas emp on f.empresa_id = emp.id
left join public.bd_funcoes func on p.funcao_id = func.id
left join public.profiles sol_profile on dsol.criado_por = sol_profile.id
left join public.bd_funcionarios eng_func on dsol.engenheiro_solicitante_id = eng_func.id
left join public.bd_diaria_apontamentos apto on dsol.id = apto.solicitacao_id
left join public.bd_funcionarios apt_func on apto.responsavel_campo_id = apt_func.id
where p.presente = true;

create or replace view public.vw_diarias_aprovacao_gerencial
with (security_invoker = true)
as
select
  p.id as presenca_id,
  p.solicitacao_id,
  dsol.numero_solicitacao,
  dsol.data_inicio as solicitacao_data_inicio,
  dsol.data_fim as solicitacao_data_fim,
  p.data,
  cc.id as centro_custo_id,
  cc.codigo_centro_custo,
  cc.nome_centro_custo,
  p.funcionario_id,
  f.nome_completo as nome_funcionario,
  case
    when f.cpf is null then null
    else concat(left(regexp_replace(f.cpf, '\\D', '', 'g'), 3), '.***.***-', right(regexp_replace(f.cpf, '\\D', '', 'g'), 2))
  end as cpf_mascarado,
  f.matricula as matricula_funcionario,
  f.empresa_id,
  emp.nome_empresa as empresa_funcionario,
  f.status as status_funcionario,
  p.funcao_id,
  func.nome_funcao,
  p.valor_diaria_aplicada,
  p.hora_entrada,
  p.hora_saida,
  p.intervalo_inicio,
  p.intervalo_fim,
  (p.presente)::text as presenca_status,
  p.confirmado_por,
  p.confirmado_em,
  p.tipo_diaria,
  p.usar_diaria_exclusiva,
  dsol.status as status_solicitacao,
  dsol.criado_por as solicitante_id,
  sol_profile.nome_completo as solicitante_nome,
  dsol.engenheiro_solicitante_id,
  eng_func.nome_completo as engenheiro_solicitante_nome,
  apto.responsavel_campo_id as apontador_id,
  apt_func.nome_completo as apontador_nome,
  p.recebe_refeicao,
  p.valor_refeicao_aplicado,
  coalesce(p.observacoes, ult_aud.comentario) as observacoes,
  p.created_at
from public.bd_diaria_presencas p
join public.bd_diaria_solicitacoes dsol on p.solicitacao_id = dsol.id
join public.bd_centros_custo cc on dsol.centro_custo_id = cc.id
left join public.bd_funcionarios f on p.funcionario_id = f.id
left join public.bd_empresas emp on f.empresa_id = emp.id
left join public.bd_funcoes func on p.funcao_id = func.id
left join public.profiles sol_profile on dsol.criado_por = sol_profile.id
left join public.bd_funcionarios eng_func on dsol.engenheiro_solicitante_id = eng_func.id
left join public.bd_diaria_apontamentos apto on dsol.id = apto.solicitacao_id
left join public.bd_funcionarios apt_func on apto.responsavel_campo_id = apt_func.id
left join lateral (
  select a.comentario
  from public.bd_diaria_aprovacoes a
  where a.entidade = 'relatorio'
    and a.acao = 'editar_hora_saida'
    and a.entidade_id = p.id
  order by a.feito_em desc nulls last
  limit 1
) ult_aud on true
where p.presente = true;

create or replace view public.vw_diarias_financeiro_dp
with (security_invoker = true)
as
select
  p.id as presenca_id,
  p.solicitacao_id,
  dsol.numero_solicitacao,
  dsol.data_inicio as solicitacao_data_inicio,
  dsol.data_fim as solicitacao_data_fim,
  p.data,
  cc.id as centro_custo_id,
  cc.codigo_centro_custo,
  cc.nome_centro_custo,
  p.funcionario_id,
  f.nome_completo as nome_funcionario,
  f.cpf as cpf_funcionario,
  f.banco as banco_funcionario,
  f.agencia as agencia_funcionario,
  f.conta_corrente as conta_funcionario,
  f.chave_pix as pix_funcionario,
  f.matricula as matricula_funcionario,
  f.empresa_id,
  emp.nome_empresa as empresa_funcionario,
  f.status as status_funcionario,
  p.funcao_id,
  func.nome_funcao,
  p.valor_diaria_aplicada,
  p.hora_entrada,
  p.hora_saida,
  p.intervalo_inicio,
  p.intervalo_fim,
  (p.presente)::text as presenca_status,
  p.confirmado_por,
  p.confirmado_em,
  p.tipo_diaria,
  p.usar_diaria_exclusiva,
  dsol.status as status_solicitacao,
  dsol.criado_por as solicitante_id,
  sol_profile.nome_completo as solicitante_nome,
  dsol.engenheiro_solicitante_id,
  eng_func.nome_completo as engenheiro_solicitante_nome,
  apto.responsavel_campo_id as apontador_id,
  apt_func.nome_completo as apontador_nome,
  p.recebe_refeicao,
  p.valor_refeicao_aplicado,
  coalesce(p.observacoes, ult_aud.comentario) as observacoes,
  p.created_at
from public.bd_diaria_presencas p
join public.bd_diaria_solicitacoes dsol on p.solicitacao_id = dsol.id
join public.bd_centros_custo cc on dsol.centro_custo_id = cc.id
left join public.bd_funcionarios f on p.funcionario_id = f.id
left join public.bd_empresas emp on f.empresa_id = emp.id
left join public.bd_funcoes func on p.funcao_id = func.id
left join public.profiles sol_profile on dsol.criado_por = sol_profile.id
left join public.bd_funcionarios eng_func on dsol.engenheiro_solicitante_id = eng_func.id
left join public.bd_diaria_apontamentos apto on dsol.id = apto.solicitacao_id
left join public.bd_funcionarios apt_func on apto.responsavel_campo_id = apt_func.id
left join lateral (
  select a.comentario
  from public.bd_diaria_aprovacoes a
  where a.entidade = 'relatorio'
    and a.acao = 'editar_hora_saida'
    and a.entidade_id = p.id
  order by a.feito_em desc nulls last
  limit 1
) ult_aud on true
where p.presente = true;

create or replace view public.vw_documentos_fluxo_diarias_seguro
with (security_invoker = true)
as
select
  d.id,
  d.solicitacao_id,
  d.tipo_documento,
  d.url_arquivo,
  d.versao,
  d.etapa_origem,
  d.criado_em,
  d.criado_por,
  s.numero_solicitacao,
  s.centro_custo_id,
  cc.codigo_centro_custo,
  cc.nome_centro_custo,
  s.criado_por as solicitante_id,
  s.responsavel_campo_id,
  cc.aprovador_diarias_id,
  cc.adm_sede_funcionario_id
from public.bd_documentos_fluxo d
join public.bd_diaria_solicitacoes s on s.id = d.solicitacao_id
left join public.bd_centros_custo cc on cc.id = s.centro_custo_id;

create or replace view public.vw_assinaturas_diarias_seguro
with (security_invoker = true)
as
select
  a.id,
  a.solicitacao_id,
  a.documento_id,
  a.usuario_id,
  a.nome_usuario,
  a.cargo,
  a.hash_assinatura,
  a.data_assinatura,
  a.tipo_assinatura,
  a.etapa_exec_id,
  s.numero_solicitacao,
  s.centro_custo_id,
  cc.codigo_centro_custo,
  cc.nome_centro_custo,
  s.criado_por as solicitante_id,
  s.responsavel_campo_id,
  cc.aprovador_diarias_id,
  cc.adm_sede_funcionario_id
from public.bd_assinaturas a
join public.bd_diaria_solicitacoes s on s.id = a.solicitacao_id
left join public.bd_centros_custo cc on cc.id = s.centro_custo_id;

revoke all on public.vw_diarias_operacional_campo from public, anon;
revoke all on public.vw_diarias_aprovacao_gerencial from public, anon;
revoke all on public.vw_diarias_financeiro_dp from public, anon;
revoke all on public.vw_documentos_fluxo_diarias_seguro from public, anon;
revoke all on public.vw_assinaturas_diarias_seguro from public, anon;

grant select on public.vw_diarias_operacional_campo to authenticated;
grant select on public.vw_diarias_aprovacao_gerencial to authenticated;
grant select on public.vw_diarias_financeiro_dp to authenticated;
grant select on public.vw_documentos_fluxo_diarias_seguro to authenticated;
grant select on public.vw_assinaturas_diarias_seguro to authenticated;

drop policy if exists "diaria_solicitacoes_select" on public.bd_diaria_solicitacoes;
create policy "diaria_solicitacoes_select"
on public.bd_diaria_solicitacoes
for select
to authenticated
using (public.fn_user_can_access_diaria_solicitacao(auth.uid(), id));

drop policy if exists "diaria_aprovacoes_select" on public.bd_diaria_aprovacoes;
create policy "diaria_aprovacoes_select"
on public.bd_diaria_aprovacoes
for select
to authenticated
using (
  public.check_is_super_admin(auth.uid())
  or public.check_is_admsso(auth.uid())
  or exists (
    select 1
    from public.bd_diaria_solicitacoes s
    where s.id = bd_diaria_aprovacoes.entidade_id
      and bd_diaria_aprovacoes.entidade = 'solicitacao'
      and public.fn_user_can_access_diaria_solicitacao(auth.uid(), s.id)
  )
  or exists (
    select 1
    from public.bd_diaria_presencas p
    where p.id = bd_diaria_aprovacoes.entidade_id
      and bd_diaria_aprovacoes.entidade = 'relatorio'
      and public.fn_user_can_access_diaria_solicitacao(auth.uid(), p.solicitacao_id)
  )
);

drop policy if exists "diaria_aprovacoes_insert" on public.bd_diaria_aprovacoes;
create policy "diaria_aprovacoes_insert"
on public.bd_diaria_aprovacoes
for insert
to authenticated
with check (
  public.check_is_super_admin(auth.uid())
  or public.check_is_admsso(auth.uid())
  or (
    bd_diaria_aprovacoes.entidade = 'solicitacao'
    and exists (
      select 1
      from public.bd_diaria_solicitacoes s
      left join public.bd_centros_custo cc on cc.id = s.centro_custo_id
      where s.id = bd_diaria_aprovacoes.entidade_id
        and (
          s.criado_por = auth.uid()
          or cc.aprovador_diarias_id = public.get_user_funcionario_id(auth.uid())
          or cc.adm_sede_funcionario_id = public.get_user_funcionario_id(auth.uid())
          or public.fn_can_access_diarias_gerencial(auth.uid())
        )
    )
  )
  or (
    bd_diaria_aprovacoes.entidade = 'relatorio'
    and exists (
      select 1
      from public.bd_diaria_presencas p
      where p.id = bd_diaria_aprovacoes.entidade_id
        and public.fn_user_can_access_diaria_solicitacao(auth.uid(), p.solicitacao_id)
    )
  )
);

drop policy if exists "Usuário lê documentos das suas solicitações" on public.bd_documentos_fluxo;
drop policy if exists "SuperAdmin lê todos documentos" on public.bd_documentos_fluxo;
create policy "documentos_fluxo_select_controlado"
on public.bd_documentos_fluxo
for select
to authenticated
using (
  public.check_is_super_admin(auth.uid())
  or public.check_is_admsso(auth.uid())
  or public.fn_user_can_access_diaria_solicitacao(auth.uid(), solicitacao_id)
  or public.fn_user_can_access_diaria_financial(auth.uid(), solicitacao_id)
);

drop policy if exists "Usuário insere documentos das suas solicitações" on public.bd_documentos_fluxo;
drop policy if exists "SuperAdmin insere documentos" on public.bd_documentos_fluxo;
create policy "documentos_fluxo_insert_controlado"
on public.bd_documentos_fluxo
for insert
to authenticated
with check (
  public.check_is_super_admin(auth.uid())
  or public.check_is_admsso(auth.uid())
  or public.fn_user_can_access_diaria_solicitacao(auth.uid(), solicitacao_id)
);

drop policy if exists "Usuários leem assinaturas de suas solicitações" on public.bd_assinaturas;
drop policy if exists "SuperAdmin lê todas assinaturas" on public.bd_assinaturas;
create policy "assinaturas_select_controlado"
on public.bd_assinaturas
for select
to authenticated
using (
  public.check_is_super_admin(auth.uid())
  or public.check_is_admsso(auth.uid())
  or public.fn_user_can_access_diaria_solicitacao(auth.uid(), solicitacao_id)
  or public.fn_user_can_access_diaria_financial(auth.uid(), solicitacao_id)
);

drop policy if exists "Authenticated pode inserir assinaturas" on public.bd_assinaturas;
create policy "assinaturas_insert_controlado"
on public.bd_assinaturas
for insert
to authenticated
with check (
  usuario_id = auth.uid()
  and (
    public.check_is_super_admin(auth.uid())
    or public.check_is_admsso(auth.uid())
    or public.fn_user_can_access_diaria_solicitacao(auth.uid(), solicitacao_id)
  )
);