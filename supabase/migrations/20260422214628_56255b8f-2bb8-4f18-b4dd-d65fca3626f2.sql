begin;

create or replace function public.fn_normalize_role_name(p_nome text)
returns text
language sql
immutable
set search_path = public
as $$
  select upper(trim(coalesce(p_nome, '')));
$$;

create or replace function public.fn_permission_aliases(p_nome_permissao text)
returns text[]
language sql
immutable
set search_path = public
as $$
  select case trim(coalesce(p_nome_permissao, ''))
    when 'diarias_visualizar' then array['diarias_visualizar','diarias_view','diarias_solicitacoes_view','diarias_dashboard_view']::text[]
    when 'diarias_criar' then array['diarias_criar','diarias_solicitar','diarias_solicitar_create']::text[]
    when 'diarias_editar' then array['diarias_editar','diarias_solicitar_edit_own','diarias_solicitar_resend_own']::text[]
    when 'diarias_aprovar' then array['diarias_aprovar','diarias_autorizar']::text[]
    when 'diarias_apontar' then array['diarias_apontar','diarias_apontar_own','diarias_apontamento_view','diarias_confirmar_presenca']::text[]
    when 'funcionarios_visualizar' then array['funcionarios_visualizar','gestao_rh_funcionarios_view']::text[]
    when 'funcionarios_criar' then array['funcionarios_criar']::text[]
    when 'funcionarios_editar' then array['funcionarios_editar']::text[]
    when 'funcionarios_excluir' then array['funcionarios_excluir']::text[]
    when 'relatorios_operacionais' then array['relatorios_operacionais','relatorio_aplicacao_view','diarias_relatorio_view','gestao_maquinas_relatorio_medicao_view']::text[]
    when 'relatorios_financeiros' then array['relatorios_financeiros']::text[]
    else array[trim(coalesce(p_nome_permissao, ''))]::text[]
  end;
$$;

create or replace function public.fn_has_role(p_role text, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_is_super_admin(p_user_id)
    or exists (
      select 1
      from public.bd_user_roles ur
      join public.bd_roles r on r.id = ur.role_id
      where ur.user_id = p_user_id
        and coalesce(r.ativo, true) = true
        and public.fn_normalize_role_name(r.nome) = public.fn_normalize_role_name(p_role)
    )
    or exists (
      select 1
      from public.profiles p
      left join public.bd_funcoes_permissao fp on fp.id = p.funcao_permissao
      where p.id = p_user_id
        and (
          exists (
            select 1
            from unnest(coalesce(p.funcoes, '{}'::text[])) as f(nome)
            where public.fn_normalize_role_name(f.nome) = public.fn_normalize_role_name(p_role)
          )
          or public.fn_normalize_role_name(coalesce(p.funcao_sistema, '')) = public.fn_normalize_role_name(p_role)
          or public.fn_normalize_role_name(coalesce(fp.nome_funcao, '')) = public.fn_normalize_role_name(p_role)
        )
    );
$$;

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
    join public.bd_permissoes p on p.id = uo.permission_id
    join aliases a on a.nome_permissao = p.nome_permissao
    where uo.user_id = p_user_id
      and uo.permitido = false
    limit 1
  ), explicit_allow as (
    select 1
    from public.bd_user_permission_overrides uo
    join public.bd_permissoes p on p.id = uo.permission_id
    join aliases a on a.nome_permissao = p.nome_permissao
    where uo.user_id = p_user_id
      and uo.permitido = true
    limit 1
  ), role_allow as (
    select 1
    from public.bd_user_roles ur
    join public.bd_roles r on r.id = ur.role_id
    left join public.bd_role_permissions rp on rp.role_id = r.id
    left join public.bd_role_permission_actions rpa on rpa.role_id = r.id
    left join public.bd_permissoes p_rp on p_rp.id = rp.permission_id
    left join public.bd_permissoes p_rpa on p_rpa.id = rpa.permission_id
    join aliases a on a.nome_permissao in (p_rp.nome_permissao, p_rpa.nome_permissao)
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

with standard_permissions(nome_permissao, descricao, rota) as (
  values
    ('diarias_visualizar', 'Permissão padronizada para visualizar solicitações, dashboards e listagens de diárias', null),
    ('diarias_criar', 'Permissão padronizada para criar solicitações de diária', null),
    ('diarias_editar', 'Permissão padronizada para editar ou reenviar solicitações de diária', null),
    ('diarias_aprovar', 'Permissão padronizada para aprovar solicitações de diária', null),
    ('diarias_apontar', 'Permissão padronizada para apontamento e confirmação operacional de diárias', null),
    ('funcionarios_visualizar', 'Permissão padronizada para visualizar cadastro de funcionários', '/gestao-rh/funcionarios'),
    ('funcionarios_criar', 'Permissão padronizada para cadastrar funcionários', null),
    ('funcionarios_editar', 'Permissão padronizada para editar funcionários', null),
    ('funcionarios_excluir', 'Permissão padronizada para excluir funcionários', null),
    ('relatorios_operacionais', 'Permissão padronizada para relatórios operacionais', null),
    ('relatorios_financeiros', 'Permissão padronizada para relatórios financeiros', null)
)
insert into public.bd_permissoes (nome_permissao, descricao, rota)
select sp.nome_permissao, sp.descricao, sp.rota
from standard_permissions sp
left join public.bd_permissoes p
  on lower(trim(p.nome_permissao)) = lower(trim(sp.nome_permissao))
where p.id is null;

create unique index if not exists ux_bd_permissoes_nome_permissao_normalized
  on public.bd_permissoes (lower(trim(nome_permissao)));

with expected(legacy_nome_funcao, permission_nome) as (
  values
    ('SuperAdm','diarias_visualizar'),('SuperAdm','diarias_criar'),('SuperAdm','diarias_editar'),('SuperAdm','diarias_aprovar'),('SuperAdm','diarias_apontar'),('SuperAdm','funcionarios_visualizar'),('SuperAdm','funcionarios_criar'),('SuperAdm','funcionarios_editar'),('SuperAdm','funcionarios_excluir'),('SuperAdm','relatorios_operacionais'),('SuperAdm','relatorios_financeiros'),
    ('AdmRH','funcionarios_visualizar'),('AdmRH','funcionarios_criar'),('AdmRH','funcionarios_editar'),('AdmRH','funcionarios_excluir'),('AdmRH','relatorios_operacionais'),('AdmRH','relatorios_financeiros'),
    ('AdmEquipamentos','relatorios_operacionais'),
    ('AdmOBRA','diarias_visualizar'),('AdmOBRA','diarias_criar'),('AdmOBRA','diarias_editar'),('AdmOBRA','diarias_aprovar'),('AdmOBRA','diarias_apontar'),('AdmOBRA','funcionarios_visualizar'),('AdmOBRA','relatorios_operacionais'),
    ('AdmSede','diarias_visualizar'),('AdmSede','diarias_aprovar'),('AdmSede','funcionarios_visualizar'),('AdmSede','relatorios_operacionais'),('AdmSede','relatorios_financeiros'),
    ('Apontador','diarias_visualizar'),('Apontador','diarias_criar'),('Apontador','diarias_editar'),('Apontador','diarias_apontar'),
    ('GerenteRegional','diarias_visualizar'),('GerenteRegional','diarias_aprovar'),('GerenteRegional','relatorios_operacionais'),('GerenteRegional','relatorios_financeiros'),
    ('Operador','diarias_visualizar'),('Operador','diarias_apontar')
), agg as (
  select fp.id,
         array_agg(distinct p.id) filter (where p.id is not null) as permission_ids
  from public.bd_funcoes_permissao fp
  join expected e
    on public.fn_normalize_role_name(fp.nome_funcao) = public.fn_normalize_role_name(e.legacy_nome_funcao)
  join public.bd_permissoes p
    on lower(trim(p.nome_permissao)) = lower(trim(e.permission_nome))
  group by fp.id
)
update public.bd_funcoes_permissao fp
set permissoes = (
  select array(
    select distinct x
    from unnest(coalesce(fp.permissoes, '{}'::uuid[]) || coalesce(agg.permission_ids, '{}'::uuid[])) as t(x)
  )
),
updated_at = now()
from agg
where fp.id = agg.id;

create or replace view public.vw_rbac_standard_funcao_permissoes as
select
  fp.nome_funcao,
  p.nome_permissao,
  case
    when p.nome_permissao = any(public.fn_permission_aliases('diarias_visualizar')) then 'diarias_visualizar'
    when p.nome_permissao = any(public.fn_permission_aliases('diarias_criar')) then 'diarias_criar'
    when p.nome_permissao = any(public.fn_permission_aliases('diarias_editar')) then 'diarias_editar'
    when p.nome_permissao = any(public.fn_permission_aliases('diarias_aprovar')) then 'diarias_aprovar'
    when p.nome_permissao = any(public.fn_permission_aliases('diarias_apontar')) then 'diarias_apontar'
    when p.nome_permissao = any(public.fn_permission_aliases('funcionarios_visualizar')) then 'funcionarios_visualizar'
    when p.nome_permissao = any(public.fn_permission_aliases('funcionarios_criar')) then 'funcionarios_criar'
    when p.nome_permissao = any(public.fn_permission_aliases('funcionarios_editar')) then 'funcionarios_editar'
    when p.nome_permissao = any(public.fn_permission_aliases('funcionarios_excluir')) then 'funcionarios_excluir'
    when p.nome_permissao = any(public.fn_permission_aliases('relatorios_operacionais')) then 'relatorios_operacionais'
    when p.nome_permissao = any(public.fn_permission_aliases('relatorios_financeiros')) then 'relatorios_financeiros'
    else null
  end as permissao_padrao,
  p.descricao,
  p.rota
from public.bd_funcoes_permissao fp
join public.bd_permissoes p
  on p.id = any(coalesce(fp.permissoes, '{}'::uuid[]));

create or replace view public.vw_rbac_standard_permission_gaps as
with expected(legacy_nome_funcao, permission_nome) as (
  values
    ('SuperAdm','diarias_visualizar'),('SuperAdm','diarias_criar'),('SuperAdm','diarias_editar'),('SuperAdm','diarias_aprovar'),('SuperAdm','diarias_apontar'),('SuperAdm','funcionarios_visualizar'),('SuperAdm','funcionarios_criar'),('SuperAdm','funcionarios_editar'),('SuperAdm','funcionarios_excluir'),('SuperAdm','relatorios_operacionais'),('SuperAdm','relatorios_financeiros'),
    ('AdmRH','funcionarios_visualizar'),('AdmRH','funcionarios_criar'),('AdmRH','funcionarios_editar'),('AdmRH','funcionarios_excluir'),('AdmRH','relatorios_operacionais'),('AdmRH','relatorios_financeiros'),
    ('AdmEquipamentos','relatorios_operacionais'),
    ('AdmOBRA','diarias_visualizar'),('AdmOBRA','diarias_criar'),('AdmOBRA','diarias_editar'),('AdmOBRA','diarias_aprovar'),('AdmOBRA','diarias_apontar'),('AdmOBRA','funcionarios_visualizar'),('AdmOBRA','relatorios_operacionais'),
    ('AdmSede','diarias_visualizar'),('AdmSede','diarias_aprovar'),('AdmSede','funcionarios_visualizar'),('AdmSede','relatorios_operacionais'),('AdmSede','relatorios_financeiros'),
    ('Apontador','diarias_visualizar'),('Apontador','diarias_criar'),('Apontador','diarias_editar'),('Apontador','diarias_apontar'),
    ('GerenteRegional','diarias_visualizar'),('GerenteRegional','diarias_aprovar'),('GerenteRegional','relatorios_operacionais'),('GerenteRegional','relatorios_financeiros'),
    ('Operador','diarias_visualizar'),('Operador','diarias_apontar')
), current_map as (
  select public.fn_normalize_role_name(nome_funcao) as role_nome, permissao_padrao
  from public.vw_rbac_standard_funcao_permissoes
  where permissao_padrao is not null
)
select e.legacy_nome_funcao as nome_funcao, e.permission_nome as permissao_faltante
from expected e
left join current_map c
  on c.role_nome = public.fn_normalize_role_name(e.legacy_nome_funcao)
 and c.permissao_padrao = e.permission_nome
where c.role_nome is null;

commit;