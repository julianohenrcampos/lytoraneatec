create or replace function public.fn_os_current_funcionario_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.funcionario_id
  from public.profiles p
  where p.id = auth.uid()
  limit 1
$$;

create or replace function public.fn_os_is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.check_is_super_admin(auth.uid())
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and (
          coalesce(p.acesso_global, false) = true
          or coalesce(p.funcao_sistema, '') in ('Administrador', 'AdmLogistica', 'AdmEquipamentos', 'AdmRH')
        )
    ),
    false
  )
$$;

create or replace function public.fn_os_has_operational_access(_centro_custo_id uuid, _equipamento_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.fn_os_is_admin_user()
    or (_centro_custo_id is not null and public.fn_ativos_can_access_centro_custo(_centro_custo_id, auth.uid()))
    or (_equipamento_id is not null and public.fn_ativos_can_access_equipamento(_equipamento_id, auth.uid()))
    or exists (
      select 1
      from public.bd_chamados_os c
      where c.centro_custo_id = _centro_custo_id
        and c.solicitante_id = public.fn_os_current_funcionario_id()
    ),
    false
  )
$$;

create or replace function public.fn_os_has_maintenance_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.fn_os_is_admin_user()
    or public.fn_ativos_has_logistics_access(auth.uid())
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.funcao_sistema, '') in ('Mecanico', 'Encarregado', 'Supervisor')
    ),
    false
  )
$$;

create or replace function public.fn_os_has_financial_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.fn_os_is_admin_user()
    or public.fn_ativos_has_financial_access(auth.uid())
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.funcao_sistema, '') in ('Financeiro', 'Gerente', 'Diretor')
    ),
    false
  )
$$;

create or replace function public.fn_os_can_access_chamado(_chamado_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.fn_os_is_admin_user()
    or exists (
      select 1
      from public.bd_chamados_os c
      where c.id = _chamado_id
        and (
          c.solicitante_id = public.fn_os_current_funcionario_id()
          or public.fn_os_has_operational_access(c.centro_custo_id, c.caminhao_equipamento_id)
          or exists (
            select 1
            from public.bd_ordens_servico os
            where os.chamado_id = c.id
              and (
                os.executado_por_id = auth.uid()
                or os.encerrado_por_id = auth.uid()
                or public.fn_os_has_maintenance_access()
              )
          )
        )
    ),
    false
  )
$$;

create or replace function public.fn_os_can_access_ordem(_os_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.fn_os_is_admin_user()
    or exists (
      select 1
      from public.bd_ordens_servico os
      left join public.bd_chamados_os c on c.id = os.chamado_id
      where os.id = _os_id
        and (
          os.executado_por_id = auth.uid()
          or os.encerrado_por_id = auth.uid()
          or public.fn_os_has_maintenance_access()
          or public.fn_os_has_operational_access(c.centro_custo_id, os.caminhao_equipamento_id)
          or (c.id is not null and public.fn_os_can_access_chamado(c.id))
        )
    ),
    false
  )
$$;

create or replace function public.fn_os_can_manage_chamado(_chamado_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.fn_os_is_admin_user()
    or exists (
      select 1
      from public.bd_chamados_os c
      where c.id = _chamado_id
        and (
          c.solicitante_id = public.fn_os_current_funcionario_id()
          or public.fn_os_has_maintenance_access()
          or public.fn_os_has_operational_access(c.centro_custo_id, c.caminhao_equipamento_id)
        )
    ),
    false
  )
$$;

create or replace function public.fn_os_can_manage_ordem(_os_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.fn_os_is_admin_user()
    or exists (
      select 1
      from public.bd_ordens_servico os
      where os.id = _os_id
        and (
          os.executado_por_id = auth.uid()
          or os.encerrado_por_id = auth.uid()
          or public.fn_os_has_maintenance_access()
        )
    ),
    false
  )
$$;

create table if not exists public.bd_os_auditoria (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  recurso_tipo text not null,
  recurso_id uuid,
  contexto text not null,
  acao text not null,
  detalhes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.bd_os_auditoria enable row level security;
drop policy if exists "OS auditoria leitura restrita" on public.bd_os_auditoria;
create policy "OS auditoria leitura restrita"
on public.bd_os_auditoria
for select
to authenticated
using (public.fn_os_has_financial_access() or public.fn_os_has_maintenance_access());

drop policy if exists "OS auditoria insercao sistema" on public.bd_os_auditoria;
create policy "OS auditoria insercao sistema"
on public.bd_os_auditoria
for insert
to authenticated
with check (actor_user_id = auth.uid());

create table if not exists public.bd_os_leituras_sensiveis (
  id uuid primary key default gen_random_uuid(),
  viewer_user_id uuid not null,
  recurso_tipo text not null,
  recurso_id uuid not null,
  origem text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.bd_os_leituras_sensiveis enable row level security;
drop policy if exists "OS leitura sensivel restrita" on public.bd_os_leituras_sensiveis;
create policy "OS leitura sensivel restrita"
on public.bd_os_leituras_sensiveis
for select
to authenticated
using (public.fn_os_has_financial_access() or public.fn_os_has_maintenance_access());

drop policy if exists "OS leitura sensivel insercao sistema" on public.bd_os_leituras_sensiveis;
create policy "OS leitura sensivel insercao sistema"
on public.bd_os_leituras_sensiveis
for insert
to authenticated
with check (viewer_user_id = auth.uid());

create or replace function public.fn_auditar_os_mutacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.bd_os_auditoria (
    actor_user_id,
    recurso_tipo,
    recurso_id,
    contexto,
    acao,
    detalhes
  ) values (
    auth.uid(),
    tg_table_name,
    coalesce(new.id, old.id),
    'modulo_chamados_os',
    tg_op,
    jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new), 'trigger', tg_name)
  );

  return coalesce(new, old);
end;
$$;

create or replace function public.fn_registrar_leitura_os_sensivel(_recurso_tipo text, _recurso_id uuid, _origem text, _metadata jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.fn_os_has_financial_access() or public.fn_os_has_maintenance_access() then
    insert into public.bd_os_leituras_sensiveis (viewer_user_id, recurso_tipo, recurso_id, origem, metadata)
    values (auth.uid(), _recurso_tipo, _recurso_id, _origem, coalesce(_metadata, '{}'::jsonb));
  end if;
end;
$$;

drop trigger if exists trg_os_audit_chamados on public.bd_chamados_os;
create trigger trg_os_audit_chamados
after insert or update or delete on public.bd_chamados_os
for each row execute function public.fn_auditar_os_mutacao();

drop trigger if exists trg_os_audit_ordens on public.bd_ordens_servico;
create trigger trg_os_audit_ordens
after insert or update or delete on public.bd_ordens_servico
for each row execute function public.fn_auditar_os_mutacao();

drop trigger if exists trg_os_audit_mao_obra on public.bd_os_mao_obra;
create trigger trg_os_audit_mao_obra
after insert or update or delete on public.bd_os_mao_obra
for each row execute function public.fn_auditar_os_mutacao();

drop trigger if exists trg_os_audit_materiais on public.bd_os_materiais_utilizados;
create trigger trg_os_audit_materiais
after insert or update or delete on public.bd_os_materiais_utilizados
for each row execute function public.fn_auditar_os_mutacao();

drop trigger if exists trg_os_audit_movimentacoes on public.bd_movimentacoes;
create trigger trg_os_audit_movimentacoes
after insert or update or delete on public.bd_movimentacoes
for each row execute function public.fn_auditar_os_mutacao();

drop trigger if exists trg_os_audit_mov_saida on public.bd_movimentacao_saida;
create trigger trg_os_audit_mov_saida
after insert or update or delete on public.bd_movimentacao_saida
for each row execute function public.fn_auditar_os_mutacao();

drop trigger if exists trg_os_audit_mov_transporte on public.bd_movimentacao_transporte;
create trigger trg_os_audit_mov_transporte
after insert or update or delete on public.bd_movimentacao_transporte
for each row execute function public.fn_auditar_os_mutacao();

drop policy if exists "Usuários autenticados podem acessar chamados" on public.bd_chamados_os;
drop policy if exists "OS: select authenticated" on public.bd_ordens_servico;
drop policy if exists "OS: insert authenticated" on public.bd_ordens_servico;
drop policy if exists "OS: update authenticated" on public.bd_ordens_servico;
drop policy if exists "OS: delete authenticated" on public.bd_ordens_servico;
drop policy if exists "OS Mão de Obra: select authenticated" on public.bd_os_mao_obra;
drop policy if exists "OS Mão de Obra: insert authenticated" on public.bd_os_mao_obra;
drop policy if exists "OS Mão de Obra: update authenticated" on public.bd_os_mao_obra;
drop policy if exists "OS Mão de Obra: delete authenticated" on public.bd_os_mao_obra;
drop policy if exists "OS Materiais: select authenticated" on public.bd_os_materiais_utilizados;
drop policy if exists "OS Materiais: insert authenticated" on public.bd_os_materiais_utilizados;
drop policy if exists "OS Materiais: update authenticated" on public.bd_os_materiais_utilizados;
drop policy if exists "OS Materiais: delete authenticated" on public.bd_os_materiais_utilizados;
drop policy if exists "Auth users full access movimentacoes" on public.bd_movimentacoes;
drop policy if exists "Auth users full access mov_saida" on public.bd_movimentacao_saida;
drop policy if exists "Auth users full access mov_transporte" on public.bd_movimentacao_transporte;
drop policy if exists "Chamados leitura por escopo" on public.bd_chamados_os;
drop policy if exists "Chamados criacao por escopo" on public.bd_chamados_os;
drop policy if exists "Chamados atualizacao por escopo" on public.bd_chamados_os;
drop policy if exists "Chamados exclusao por escopo" on public.bd_chamados_os;
drop policy if exists "OS leitura por escopo" on public.bd_ordens_servico;
drop policy if exists "OS criacao por escopo" on public.bd_ordens_servico;
drop policy if exists "OS atualizacao por escopo" on public.bd_ordens_servico;
drop policy if exists "OS exclusao por escopo" on public.bd_ordens_servico;
drop policy if exists "OS mao de obra leitura por escopo" on public.bd_os_mao_obra;
drop policy if exists "OS mao de obra escrita por escopo" on public.bd_os_mao_obra;
drop policy if exists "OS materiais leitura por escopo" on public.bd_os_materiais_utilizados;
drop policy if exists "OS materiais escrita por escopo" on public.bd_os_materiais_utilizados;
drop policy if exists "Movimentacoes leitura por escopo" on public.bd_movimentacoes;
drop policy if exists "Movimentacoes escrita por escopo" on public.bd_movimentacoes;
drop policy if exists "Movimentacao saida leitura por escopo" on public.bd_movimentacao_saida;
drop policy if exists "Movimentacao saida escrita por escopo" on public.bd_movimentacao_saida;
drop policy if exists "Movimentacao transporte leitura por escopo" on public.bd_movimentacao_transporte;
drop policy if exists "Movimentacao transporte escrita por escopo" on public.bd_movimentacao_transporte;

alter table public.bd_chamados_os force row level security;
alter table public.bd_ordens_servico force row level security;
alter table public.bd_os_mao_obra force row level security;
alter table public.bd_os_materiais_utilizados force row level security;
alter table public.bd_movimentacoes force row level security;
alter table public.bd_movimentacao_saida force row level security;
alter table public.bd_movimentacao_transporte force row level security;

create policy "Chamados leitura por escopo"
on public.bd_chamados_os
for select
to authenticated
using (public.fn_os_can_access_chamado(id));

create policy "Chamados criacao por escopo"
on public.bd_chamados_os
for insert
to authenticated
with check (
  solicitante_id = public.fn_os_current_funcionario_id()
  or public.fn_os_has_operational_access(centro_custo_id, caminhao_equipamento_id)
  or public.fn_os_has_maintenance_access()
);

create policy "Chamados atualizacao por escopo"
on public.bd_chamados_os
for update
to authenticated
using (public.fn_os_can_manage_chamado(id))
with check (public.fn_os_can_manage_chamado(id));

create policy "Chamados exclusao por escopo"
on public.bd_chamados_os
for delete
to authenticated
using (public.fn_os_is_admin_user());

create policy "OS leitura por escopo"
on public.bd_ordens_servico
for select
to authenticated
using (public.fn_os_can_access_ordem(id));

create policy "OS criacao por escopo"
on public.bd_ordens_servico
for insert
to authenticated
with check (
  public.fn_os_has_maintenance_access()
  or (chamado_id is not null and public.fn_os_can_manage_chamado(chamado_id))
);

create policy "OS atualizacao por escopo"
on public.bd_ordens_servico
for update
to authenticated
using (public.fn_os_can_manage_ordem(id))
with check (public.fn_os_can_manage_ordem(id));

create policy "OS exclusao por escopo"
on public.bd_ordens_servico
for delete
to authenticated
using (public.fn_os_is_admin_user());

create policy "OS mao de obra leitura por escopo"
on public.bd_os_mao_obra
for select
to authenticated
using (public.fn_os_can_access_ordem(os_id));

create policy "OS mao de obra escrita por escopo"
on public.bd_os_mao_obra
for all
to authenticated
using (public.fn_os_can_manage_ordem(os_id))
with check (public.fn_os_can_manage_ordem(os_id));

create policy "OS materiais leitura por escopo"
on public.bd_os_materiais_utilizados
for select
to authenticated
using (public.fn_os_can_access_ordem(os_id));

create policy "OS materiais escrita por escopo"
on public.bd_os_materiais_utilizados
for all
to authenticated
using (public.fn_os_can_manage_ordem(os_id))
with check (public.fn_os_can_manage_ordem(os_id));

create policy "Movimentacoes leitura por escopo"
on public.bd_movimentacoes
for select
to authenticated
using (
  public.fn_os_is_admin_user()
  or public.fn_os_has_maintenance_access()
  or public.fn_ativos_has_operational_access(auth.uid())
);

create policy "Movimentacoes escrita por escopo"
on public.bd_movimentacoes
for all
to authenticated
using (public.fn_os_is_admin_user() or public.fn_os_has_maintenance_access())
with check (public.fn_os_is_admin_user() or public.fn_os_has_maintenance_access());

create policy "Movimentacao saida leitura por escopo"
on public.bd_movimentacao_saida
for select
to authenticated
using (
  public.fn_os_is_admin_user()
  or public.fn_os_has_maintenance_access()
  or public.fn_ativos_has_operational_access(auth.uid())
);

create policy "Movimentacao saida escrita por escopo"
on public.bd_movimentacao_saida
for all
to authenticated
using (public.fn_os_is_admin_user() or public.fn_os_has_maintenance_access())
with check (public.fn_os_is_admin_user() or public.fn_os_has_maintenance_access());

create policy "Movimentacao transporte leitura por escopo"
on public.bd_movimentacao_transporte
for select
to authenticated
using (
  public.fn_os_is_admin_user()
  or public.fn_os_has_maintenance_access()
  or public.fn_ativos_has_operational_access(auth.uid())
);

create policy "Movimentacao transporte escrita por escopo"
on public.bd_movimentacao_transporte
for all
to authenticated
using (public.fn_os_is_admin_user() or public.fn_os_has_maintenance_access())
with check (public.fn_os_is_admin_user() or public.fn_os_has_maintenance_access());

create or replace view public.vw_chamados_os_operacional_seguro
with (security_invoker = true)
as
select
  c.id,
  c.numero_chamado,
  c.caminhao_equipamento_id,
  eq.placa,
  c.centro_custo_id,
  cc.codigo_centro_custo,
  cc.nome_centro_custo,
  c.solicitante_id,
  sol.nome_completo as solicitante_nome,
  c.data_solicitacao,
  c.hora_solicitacao,
  c.tipo_falha,
  c.descricao_problema,
  c.prioridade,
  c.status,
  c.fotos_avarias,
  c.created_at,
  c.updated_at
from public.bd_chamados_os c
left join public.bd_caminhoes_equipamentos eq on eq.id = c.caminhao_equipamento_id
left join public.bd_centros_custo cc on cc.id = c.centro_custo_id
left join public.bd_funcionarios sol on sol.id = c.solicitante_id;

create or replace view public.vw_ordens_servico_operacional_seguro
with (security_invoker = true)
as
select
  os.id,
  os.numero_os,
  os.chamado_id,
  os.caminhao_equipamento_id,
  eq.placa,
  os.tipo_servico,
  os.descricao_servico,
  os.data_abertura,
  os.status,
  os.mecanico_id,
  mec.nome_completo as mecanico_nome,
  os.tipo_manutencao,
  os.data_inicio_atendimento,
  os.hora_inicio_atendimento,
  os.data_encerramento_atendimento,
  os.hora_encerramento_atendimento,
  os.executado_por_id,
  os.encerrado_por_id,
  os.created_at,
  os.updated_at
from public.bd_ordens_servico os
left join public.bd_caminhoes_equipamentos eq on eq.id = os.caminhao_equipamento_id
left join public.bd_funcionarios mec on mec.id = os.mecanico_id;

create or replace view public.vw_ordens_servico_admin_seguro
with (security_invoker = true)
as
select
  os.id,
  os.numero_os,
  os.chamado_id,
  os.caminhao_equipamento_id,
  eq.placa,
  os.tipo_servico,
  os.descricao_servico,
  os.data_abertura,
  os.status,
  os.mecanico_id,
  mec.nome_completo as mecanico_nome,
  os.valor_servico,
  os.telefone_solicitante,
  os.obra_patio,
  os.setor_executante,
  os.terceirizada,
  os.tipo_manutencao,
  os.horimetro_odometro_inicial,
  os.horimetro_odometro_final,
  os.duracao_total,
  os.executado_por_id,
  os.encerrado_por_id,
  os.tratativa_solucao,
  os.created_at,
  os.updated_at
from public.bd_ordens_servico os
left join public.bd_caminhoes_equipamentos eq on eq.id = os.caminhao_equipamento_id
left join public.bd_funcionarios mec on mec.id = os.mecanico_id
where public.fn_os_has_financial_access() or public.fn_os_has_maintenance_access();

create or replace view public.vw_os_custos_resumido_seguro
with (security_invoker = true)
as
select
  os.id as os_id,
  os.numero_os,
  coalesce(os.valor_servico, 0) as valor_servico,
  count(distinct mob.id) as total_itens_mao_obra,
  count(distinct mat.id) as total_itens_materiais
from public.bd_ordens_servico os
left join public.bd_os_mao_obra mob on mob.os_id = os.id
left join public.bd_os_materiais_utilizados mat on mat.os_id = os.id
where public.fn_os_has_financial_access() or public.fn_os_has_maintenance_access()
group by os.id, os.numero_os, os.valor_servico;

update storage.buckets
set public = false
where id = 'os_photos';

drop policy if exists "Allow public read access on os_photos" on storage.objects;
drop policy if exists "Allow authenticated users to upload os photos" on storage.objects;
drop policy if exists "Allow users to delete os photos" on storage.objects;
drop policy if exists "Allow users to update os photos" on storage.objects;
drop policy if exists "os_photos_read_restrito" on storage.objects;
drop policy if exists "os_photos_insert_restrito" on storage.objects;
drop policy if exists "os_photos_update_restrito" on storage.objects;
drop policy if exists "os_photos_delete_restrito" on storage.objects;

create or replace function public.fn_os_storage_object_allowed(_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, storage
as $$
declare
  parts text[];
  entity_type text;
  entity_id uuid;
begin
  parts := string_to_array(_name, '/');
  if array_length(parts, 1) < 2 then
    return false;
  end if;

  entity_type := parts[1];
  begin
    entity_id := parts[2]::uuid;
  exception when others then
    return false;
  end;

  if entity_type = 'chamado' then
    return public.fn_os_can_access_chamado(entity_id);
  elsif entity_type = 'os' then
    return public.fn_os_can_access_ordem(entity_id);
  else
    return false;
  end if;
end;
$$;

create policy "os_photos_read_restrito"
on storage.objects
for select
to authenticated
using (bucket_id = 'os_photos' and public.fn_os_storage_object_allowed(name));

create policy "os_photos_insert_restrito"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'os_photos' and owner = auth.uid() and public.fn_os_storage_object_allowed(name));

create policy "os_photos_update_restrito"
on storage.objects
for update
to authenticated
using (bucket_id = 'os_photos' and owner = auth.uid() and public.fn_os_storage_object_allowed(name))
with check (bucket_id = 'os_photos' and owner = auth.uid() and public.fn_os_storage_object_allowed(name));

create policy "os_photos_delete_restrito"
on storage.objects
for delete
to authenticated
using (bucket_id = 'os_photos' and owner = auth.uid() and public.fn_os_storage_object_allowed(name));