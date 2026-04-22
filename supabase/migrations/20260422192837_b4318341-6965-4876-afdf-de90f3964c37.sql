create or replace function public.fn_ponto_is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.is_ponto_superadmin(), false)
$$;

create or replace function public.fn_ponto_get_funcionario_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select public.get_funcionario_id_for_auth()
$$;

create or replace function public.fn_ponto_has_permission(_codigo text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.has_ponto_permission(_codigo), false)
$$;

create or replace function public.fn_ponto_can_manage_devices()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_ponto_is_superadmin()
      or public.fn_ponto_has_permission('ponto_gerenciar_dispositivos')
$$;

create or replace function public.fn_ponto_can_manage_config()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_ponto_is_superadmin()
      or public.fn_ponto_has_permission('ponto_gerenciar_config')
$$;

create or replace function public.fn_ponto_can_manage_vinculos()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_ponto_is_superadmin()
      or public.fn_ponto_has_permission('ponto_gerenciar_vinculos')
$$;

create or replace function public.fn_ponto_can_view_rh()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_ponto_is_superadmin()
      or public.fn_ponto_has_permission('ponto_visualizar_todos')
      or exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and (
            p.funcoes && array['AdmRH','RH','DP','Financeiro']::text[]
          )
      )
$$;

create or replace function public.fn_ponto_can_view_gestao()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_ponto_can_view_rh()
      or public.fn_ponto_has_permission('ponto_visualizar_equipe')
      or exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and (
            p.funcoes && array['AdmOBRA','AdmSede','Encarregado','Gerente','Supervisor']::text[]
          )
      )
$$;

create or replace function public.fn_ponto_can_view_antifraude_logs()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_ponto_is_superadmin()
      or public.fn_ponto_has_permission('ponto_visualizar_todos')
      or public.fn_ponto_has_permission('ponto_aprovar_ajuste')
$$;

create or replace function public.fn_ponto_user_can_access_cc(_centro_custo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.fn_ponto_can_view_rh()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.funcionario_id is not null
        and (
          p.funcionario_id = (
            select cc.adm_sede_funcionario_id
            from public.bd_centros_custo cc
            where cc.id = _centro_custo_id
          )
          or p.funcionario_id = (
            select cc.aprovador_diarias_id
            from public.bd_centros_custo cc
            where cc.id = _centro_custo_id
          )
        )
    )
    or exists (
      select 1
      from public.bd_ponto_vinculos_operacionais v
      where v.funcionario_id = public.fn_ponto_get_funcionario_id()
        and v.centro_custo_id = _centro_custo_id
        and coalesce(v.ativo, true)
        and (v.data_inicio is null or v.data_inicio <= current_date)
        and (v.data_fim is null or v.data_fim >= current_date)
    )
$$;

create or replace function public.fn_ponto_user_can_access_funcionario(_funcionario_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    _funcionario_id = public.fn_ponto_get_funcionario_id()
    or public.fn_ponto_can_view_rh()
    or exists (
      select 1
      from public.bd_funcionarios f
      where f.id = _funcionario_id
        and public.fn_ponto_user_can_access_cc(f.centro_custo_id)
    )
    or exists (
      select 1
      from public.bd_ponto_vinculos_operacionais v_usuario
      join public.bd_ponto_vinculos_operacionais v_alvo
        on v_alvo.centro_custo_id = v_usuario.centro_custo_id
      where v_usuario.funcionario_id = public.fn_ponto_get_funcionario_id()
        and v_alvo.funcionario_id = _funcionario_id
        and coalesce(v_usuario.ativo, true)
        and coalesce(v_alvo.ativo, true)
        and (v_usuario.data_inicio is null or v_usuario.data_inicio <= current_date)
        and (v_usuario.data_fim is null or v_usuario.data_fim >= current_date)
        and (v_alvo.data_inicio is null or v_alvo.data_inicio <= current_date)
        and (v_alvo.data_fim is null or v_alvo.data_fim >= current_date)
    )
$$;

create or replace function public.fn_ponto_can_access_batida(_batida_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bd_ponto_batidas b
    where b.id = _batida_id
      and public.fn_ponto_user_can_access_funcionario(b.funcionario_id)
  )
$$;

create table if not exists public.bd_ponto_relatorio_auditoria (
  id uuid primary key default gen_random_uuid(),
  contexto text not null,
  tipo_acesso text not null,
  recurso text not null,
  filtros jsonb not null default '{}'::jsonb,
  quantidade_registros integer,
  origem text,
  detalhes jsonb not null default '{}'::jsonb,
  usuario_id uuid,
  funcionario_id uuid,
  created_at timestamp with time zone not null default now()
);

alter table public.bd_ponto_relatorio_auditoria enable row level security;

create policy "Ponto auditoria leitura restrita"
on public.bd_ponto_relatorio_auditoria
for select
to authenticated
using (public.fn_ponto_can_view_antifraude_logs());

create policy "Ponto auditoria escrita sistema"
on public.bd_ponto_relatorio_auditoria
for insert
to authenticated
with check (
  usuario_id = auth.uid()
  and (
    public.fn_ponto_user_can_access_funcionario(funcionario_id)
    or public.fn_ponto_can_view_antifraude_logs()
    or funcionario_id is null
  )
);

create index if not exists idx_ponto_relatorio_auditoria_usuario_data
  on public.bd_ponto_relatorio_auditoria (usuario_id, created_at desc);
create index if not exists idx_ponto_relatorio_auditoria_contexto
  on public.bd_ponto_relatorio_auditoria (contexto, tipo_acesso, created_at desc);

create or replace function public.fn_auditar_relatorio_ponto(
  _contexto text,
  _tipo_acesso text,
  _recurso text,
  _filtros jsonb default '{}'::jsonb,
  _quantidade_registros integer default null,
  _origem text default null,
  _detalhes jsonb default '{}'::jsonb,
  _funcionario_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _id uuid;
begin
  insert into public.bd_ponto_relatorio_auditoria (
    contexto,
    tipo_acesso,
    recurso,
    filtros,
    quantidade_registros,
    origem,
    detalhes,
    usuario_id,
    funcionario_id
  ) values (
    _contexto,
    _tipo_acesso,
    _recurso,
    coalesce(_filtros, '{}'::jsonb),
    _quantidade_registros,
    _origem,
    coalesce(_detalhes, '{}'::jsonb),
    auth.uid(),
    _funcionario_id
  )
  returning id into _id;

  return _id;
end;
$$;

alter table public.bd_ponto_batidas enable row level security;
alter table public.bd_ponto_dispositivos enable row level security;
alter table public.bd_ponto_dispositivo_centros_custo enable row level security;
alter table public.bd_ponto_vinculos_operacionais enable row level security;
alter table public.bd_ponto_config enable row level security;
alter table public.bd_ponto_ajustes enable row level security;
alter table public.bd_ponto_audit_log enable row level security;
alter table public.bd_ponto_apontamento_integracao enable row level security;
alter table public.bd_ponto_diaria_integracao enable row level security;

revoke all on public.bd_ponto_dispositivos from anon, public;
revoke all on public.bd_ponto_dispositivo_centros_custo from anon, public;
revoke all on public.bd_ponto_batidas from anon, public;
revoke all on public.bd_ponto_audit_log from anon, public;
revoke all on public.bd_ponto_relatorio_auditoria from anon, public;
revoke all on public.vw_ponto_dispositivos_admin from anon, public;

revoke all on public.vw_ponto_dispositivos_admin from authenticated;
grant select on public.vw_ponto_dispositivos_admin to authenticated;
grant select on public.bd_ponto_relatorio_auditoria to authenticated;
grant insert on public.bd_ponto_relatorio_auditoria to authenticated;

drop policy if exists ponto_batidas_select on public.bd_ponto_batidas;
create policy ponto_batidas_select
on public.bd_ponto_batidas
for select
to authenticated
using (public.fn_ponto_user_can_access_funcionario(funcionario_id));

drop policy if exists ponto_batidas_insert on public.bd_ponto_batidas;
create policy ponto_batidas_insert
on public.bd_ponto_batidas
for insert
to authenticated
with check (
  (
    modo_registro = 'pwa_pessoal'
    and funcionario_id = public.fn_ponto_get_funcionario_id()
  )
  or public.fn_ponto_can_manage_devices()
  or public.fn_ponto_can_view_rh()
);

drop policy if exists ponto_batidas_update on public.bd_ponto_batidas;
create policy ponto_batidas_update
on public.bd_ponto_batidas
for update
to authenticated
using (
  public.fn_ponto_can_view_rh()
  or public.fn_ponto_has_permission('ponto_aprovar_ajuste')
)
with check (
  public.fn_ponto_can_view_rh()
  or public.fn_ponto_has_permission('ponto_aprovar_ajuste')
);

drop policy if exists ponto_ajustes_select on public.bd_ponto_ajustes;
create policy ponto_ajustes_select
on public.bd_ponto_ajustes
for select
to authenticated
using (
  solicitado_por = auth.uid()
  or public.fn_ponto_can_view_antifraude_logs()
  or public.fn_ponto_user_can_access_funcionario(funcionario_id)
);

drop policy if exists ponto_ajustes_insert on public.bd_ponto_ajustes;
create policy ponto_ajustes_insert
on public.bd_ponto_ajustes
for insert
to authenticated
with check (
  solicitado_por = auth.uid()
  and public.fn_ponto_user_can_access_funcionario(funcionario_id)
);

drop policy if exists ponto_ajustes_update on public.bd_ponto_ajustes;
create policy ponto_ajustes_update
on public.bd_ponto_ajustes
for update
to authenticated
using (public.fn_ponto_can_view_antifraude_logs())
with check (public.fn_ponto_can_view_antifraude_logs());

drop policy if exists ponto_audit_select on public.bd_ponto_audit_log;
create policy ponto_audit_select
on public.bd_ponto_audit_log
for select
to authenticated
using (public.fn_ponto_can_view_antifraude_logs());

drop policy if exists ponto_apontamento_integracao_select on public.bd_ponto_apontamento_integracao;
create policy ponto_apontamento_integracao_select
on public.bd_ponto_apontamento_integracao
for select
to authenticated
using (
  public.fn_ponto_can_view_rh()
  or exists (
    select 1
    from public.bd_ponto_batidas b
    where b.id = batida_id
      and public.fn_ponto_user_can_access_funcionario(b.funcionario_id)
  )
);

drop policy if exists ponto_diaria_integracao_select on public.bd_ponto_diaria_integracao;
create policy ponto_diaria_integracao_select
on public.bd_ponto_diaria_integracao
for select
to authenticated
using (
  public.fn_ponto_can_view_rh()
  or exists (
    select 1
    from public.bd_ponto_batidas b
    where b.id = batida_id
      and public.fn_ponto_user_can_access_funcionario(b.funcionario_id)
  )
);

drop policy if exists "SuperAdm manage dispositivos" on public.bd_ponto_dispositivos;
drop policy if exists ponto_disp_select on public.bd_ponto_dispositivos;
drop policy if exists ponto_disp_insert on public.bd_ponto_dispositivos;
drop policy if exists ponto_disp_update on public.bd_ponto_dispositivos;
drop policy if exists ponto_disp_delete on public.bd_ponto_dispositivos;

create policy ponto_disp_select
on public.bd_ponto_dispositivos
for select
to authenticated
using (public.fn_ponto_can_manage_devices());

create policy ponto_disp_insert
on public.bd_ponto_dispositivos
for insert
to authenticated
with check (public.fn_ponto_can_manage_devices());

create policy ponto_disp_update
on public.bd_ponto_dispositivos
for update
to authenticated
using (public.fn_ponto_can_manage_devices())
with check (public.fn_ponto_can_manage_devices());

create policy ponto_disp_delete
on public.bd_ponto_dispositivos
for delete
to authenticated
using (public.fn_ponto_can_manage_devices());

drop policy if exists "SuperAdm full access dispositivo_ccs" on public.bd_ponto_dispositivo_centros_custo;
create policy ponto_disp_cc_select
on public.bd_ponto_dispositivo_centros_custo
for select
to authenticated
using (public.fn_ponto_can_manage_devices());

create policy ponto_disp_cc_insert
on public.bd_ponto_dispositivo_centros_custo
for insert
to authenticated
with check (public.fn_ponto_can_manage_devices());

create policy ponto_disp_cc_update
on public.bd_ponto_dispositivo_centros_custo
for update
to authenticated
using (public.fn_ponto_can_manage_devices())
with check (public.fn_ponto_can_manage_devices());

create policy ponto_disp_cc_delete
on public.bd_ponto_dispositivo_centros_custo
for delete
to authenticated
using (public.fn_ponto_can_manage_devices());

drop policy if exists ponto_vinc_select on public.bd_ponto_vinculos_operacionais;
drop policy if exists ponto_vinc_insert on public.bd_ponto_vinculos_operacionais;
drop policy if exists ponto_vinc_update on public.bd_ponto_vinculos_operacionais;
drop policy if exists ponto_vinc_delete on public.bd_ponto_vinculos_operacionais;

create policy ponto_vinc_select
on public.bd_ponto_vinculos_operacionais
for select
to authenticated
using (
  funcionario_id = public.fn_ponto_get_funcionario_id()
  or public.fn_ponto_can_manage_vinculos()
  or public.fn_ponto_user_can_access_cc(centro_custo_id)
);

create policy ponto_vinc_insert
on public.bd_ponto_vinculos_operacionais
for insert
to authenticated
with check (public.fn_ponto_can_manage_vinculos());

create policy ponto_vinc_update
on public.bd_ponto_vinculos_operacionais
for update
to authenticated
using (public.fn_ponto_can_manage_vinculos())
with check (public.fn_ponto_can_manage_vinculos());

create policy ponto_vinc_delete
on public.bd_ponto_vinculos_operacionais
for delete
to authenticated
using (public.fn_ponto_can_manage_vinculos());

drop policy if exists ponto_cfg_select on public.bd_ponto_config;
drop policy if exists ponto_cfg_insert on public.bd_ponto_config;
drop policy if exists ponto_cfg_update on public.bd_ponto_config;

create policy ponto_cfg_select
on public.bd_ponto_config
for select
to authenticated
using (
  public.fn_ponto_can_manage_config()
  or public.fn_ponto_user_can_access_cc(centro_custo_id)
  or public.fn_ponto_has_permission('ponto_registrar')
);

create policy ponto_cfg_insert
on public.bd_ponto_config
for insert
to authenticated
with check (public.fn_ponto_can_manage_config());

create policy ponto_cfg_update
on public.bd_ponto_config
for update
to authenticated
using (public.fn_ponto_can_manage_config())
with check (public.fn_ponto_can_manage_config());

create or replace view public.vw_ponto_batidas_pessoal
with (security_invoker = true)
as
select
  b.id,
  b.funcionario_id,
  b.centro_custo_id,
  b.dispositivo_id,
  b.tipo_batida,
  b.modo_registro,
  b.data_hora_dispositivo,
  b.data_hora_servidor,
  b.data_hora_considerada,
  b.status_validacao,
  b.status_sync,
  b.justificativa,
  b.data_operacional,
  b.tipo_registro,
  b.score_risco,
  case
    when b.latitude is null or b.longitude is null then null
    else round(b.latitude::numeric, 3)
  end as latitude_aproximada,
  case
    when b.latitude is null or b.longitude is null then null
    else round(b.longitude::numeric, 3)
  end as longitude_aproximada,
  b.dentro_raio,
  b.created_at,
  b.updated_at
from public.bd_ponto_batidas b
where b.funcionario_id = public.fn_ponto_get_funcionario_id();

create or replace view public.vw_ponto_batidas_gestao
with (security_invoker = true)
as
select
  b.id,
  b.funcionario_id,
  f.nome_completo as funcionario_nome,
  f.matricula as funcionario_matricula,
  f.centro_custo_id,
  cc.nome_centro_custo,
  cc.codigo_centro_custo,
  b.tipo_batida,
  b.modo_registro,
  b.data_hora_considerada,
  b.status_validacao,
  b.status_sync,
  b.justificativa,
  b.data_operacional,
  b.tipo_registro,
  b.score_risco,
  b.dentro_raio,
  b.distancia_centro_metros,
  case
    when public.fn_ponto_can_view_antifraude_logs() then round(b.latitude::numeric, 5)
    else round(b.latitude::numeric, 3)
  end as latitude_controlada,
  case
    when public.fn_ponto_can_view_antifraude_logs() then round(b.longitude::numeric, 5)
    else round(b.longitude::numeric, 3)
  end as longitude_controlada,
  b.created_at
from public.bd_ponto_batidas b
join public.bd_funcionarios f on f.id = b.funcionario_id
left join public.bd_centros_custo cc on cc.id = b.centro_custo_id
where public.fn_ponto_user_can_access_funcionario(b.funcionario_id)
  and public.fn_ponto_can_view_gestao();

create or replace view public.vw_ponto_batidas_rh
with (security_invoker = true)
as
select
  b.*,
  f.nome_completo as funcionario_nome,
  f.matricula as funcionario_matricula,
  f.cpf as funcionario_cpf,
  cc.nome_centro_custo,
  cc.codigo_centro_custo,
  d.nome as dispositivo_nome,
  d.codigo_dispositivo
from public.bd_ponto_batidas b
join public.bd_funcionarios f on f.id = b.funcionario_id
left join public.bd_centros_custo cc on cc.id = b.centro_custo_id
left join public.bd_ponto_dispositivos d on d.id = b.dispositivo_id
where public.fn_ponto_can_view_rh();

create or replace view public.vw_ponto_dispositivos_seguro
with (security_invoker = true)
as
select
  d.id,
  d.nome,
  d.codigo_dispositivo,
  d.tipo,
  d.modo_operacao,
  d.centro_custo_id,
  d.ativo,
  d.ultimo_heartbeat,
  d.ultimo_login_at,
  d.ultimo_login_ip,
  d.created_at,
  d.updated_at,
  (d.senha_hash is not null) as tem_senha,
  case when public.fn_ponto_can_view_antifraude_logs() then d.device_fingerprint else null end as device_fingerprint,
  case when public.fn_ponto_can_view_antifraude_logs() then d.device_secret_hash else null end as device_secret_hash_masked
from public.bd_ponto_dispositivos d
where public.fn_ponto_can_manage_devices();

create or replace view public.vw_ponto_logs_antifraude_seguro
with (security_invoker = true)
as
select
  b.id,
  b.funcionario_id,
  f.nome_completo as funcionario_nome,
  f.matricula as funcionario_matricula,
  b.centro_custo_id,
  cc.nome_centro_custo,
  cc.codigo_centro_custo,
  b.dispositivo_id,
  d.nome as dispositivo_nome,
  d.codigo_dispositivo,
  b.tipo_batida,
  b.modo_registro,
  b.data_hora_considerada,
  b.latitude,
  b.longitude,
  b.precisao_gps_metros,
  b.dentro_raio,
  b.distancia_centro_metros,
  b.origem_dados,
  b.offline_uuid,
  b.status_validacao,
  b.status_sync,
  b.justificativa,
  b.ip_address,
  b.user_agent,
  b.device_fingerprint,
  b.score_risco,
  b.validado_por,
  b.validado_em,
  b.foto_hash,
  b.created_at,
  b.updated_at
from public.bd_ponto_batidas b
join public.bd_funcionarios f on f.id = b.funcionario_id
left join public.bd_centros_custo cc on cc.id = b.centro_custo_id
left join public.bd_ponto_dispositivos d on d.id = b.dispositivo_id
where public.fn_ponto_can_view_antifraude_logs();

grant select on public.vw_ponto_batidas_pessoal to authenticated;
grant select on public.vw_ponto_batidas_gestao to authenticated;
grant select on public.vw_ponto_batidas_rh to authenticated;
grant select on public.vw_ponto_dispositivos_seguro to authenticated;
grant select on public.vw_ponto_logs_antifraude_seguro to authenticated;

create or replace function public.fn_ponto_registrar_auditoria_config()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.bd_ponto_audit_log (tabela, registro_id, acao, dados_anteriores, dados_novos, usuario_id, created_at)
  values (
    tg_table_name,
    coalesce(new.id, old.id),
    tg_op,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end,
    auth.uid(),
    now()
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_ponto_audit_config on public.bd_ponto_config;
create trigger trg_ponto_audit_config
after insert or update or delete on public.bd_ponto_config
for each row execute function public.fn_ponto_registrar_auditoria_config();

drop trigger if exists trg_ponto_audit_vinculos on public.bd_ponto_vinculos_operacionais;
create trigger trg_ponto_audit_vinculos
after insert or update or delete on public.bd_ponto_vinculos_operacionais
for each row execute function public.fn_ponto_registrar_auditoria_config();

drop trigger if exists trg_ponto_audit_ajustes on public.bd_ponto_ajustes;
create trigger trg_ponto_audit_ajustes
after insert or update or delete on public.bd_ponto_ajustes
for each row execute function public.fn_ponto_registrar_auditoria_config();

comment on view public.vw_ponto_batidas_pessoal is 'Visão segura de registros próprios de ponto';
comment on view public.vw_ponto_batidas_gestao is 'Visão segura gerencial de registros de ponto';
comment on view public.vw_ponto_batidas_rh is 'Visão segura RH/completa de registros de ponto';
comment on view public.vw_ponto_dispositivos_seguro is 'Visão segura administrativa de dispositivos de ponto';
comment on view public.vw_ponto_logs_antifraude_seguro is 'Visão segura de logs antifraude do ponto';