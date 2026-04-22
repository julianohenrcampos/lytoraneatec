create or replace function public.fn_logistica_current_funcionario_id()
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

create or replace function public.fn_logistica_is_privileged_user()
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
          or coalesce(p.funcao_sistema, '') in ('Administrador', 'AdmRH', 'AdmLogistica')
        )
    ),
    false
  )
$$;

create or replace function public.fn_logistica_can_view_sensitive_exports()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.fn_logistica_is_privileged_user()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.funcao_sistema, '') in ('Gerente', 'Diretor', 'Financeiro')
    ),
    false
  )
$$;

create or replace function public.fn_logistica_can_access_centro_custo(_centro_custo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.fn_logistica_is_privileged_user()
    or exists (
      select 1
      from public.bd_requisicoes r
      where r.centro_custo_id = _centro_custo_id
        and r.engenheiro_id = public.fn_logistica_current_funcionario_id()
    )
    or exists (
      select 1
      from public.bd_programacao_entrega pe
      where pe.centro_custo_id = _centro_custo_id
        and exists (
          select 1
          from public.bd_lista_programacao_entrega le
          where le.programacao_entrega_id = pe.id
            and (
              coalesce(public.usuario_acessa_equipe(auth.uid(), le.equipe_id), false)
              or le.apontador_id = public.fn_logistica_current_funcionario_id()
            )
        )
    )
    or exists (
      select 1
      from public.bd_registro_apontamento_cam_equipa ace
      where ace.centro_custo_id = _centro_custo_id
        and (
          ace.created_by = auth.uid()
          or ace.operador_id = public.fn_logistica_current_funcionario_id()
        )
    ),
    false
  )
$$;

create or replace function public.fn_logistica_can_access_requisicao(_requisicao_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.fn_logistica_is_privileged_user()
    or exists (
      select 1
      from public.bd_requisicoes r
      where r.id = _requisicao_id
        and (
          r.engenheiro_id = public.fn_logistica_current_funcionario_id()
          or public.fn_logistica_can_access_centro_custo(r.centro_custo_id)
          or exists (
            select 1
            from public.bd_lista_programacao_entrega le
            where le.requisicao_id = r.id
              and (
                coalesce(public.usuario_acessa_equipe(auth.uid(), le.equipe_id), false)
                or le.apontador_id = public.fn_logistica_current_funcionario_id()
              )
          )
        )
    ),
    false
  )
$$;

create or replace function public.fn_logistica_can_access_programacao(_programacao_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.fn_logistica_is_privileged_user()
    or exists (
      select 1
      from public.bd_programacao_entrega pe
      where pe.id = _programacao_id
        and (
          public.fn_logistica_can_access_centro_custo(pe.centro_custo_id)
          or public.fn_logistica_can_access_requisicao(pe.requisicao_id)
        )
    ),
    false
  )
$$;

create or replace function public.fn_logistica_can_access_entrega(_lista_entrega_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.fn_logistica_is_privileged_user()
    or exists (
      select 1
      from public.bd_lista_programacao_entrega le
      where le.id = _lista_entrega_id
        and (
          le.apontador_id = public.fn_logistica_current_funcionario_id()
          or coalesce(public.usuario_acessa_equipe(auth.uid(), le.equipe_id), false)
          or public.fn_logistica_can_access_requisicao(le.requisicao_id)
          or public.fn_logistica_can_access_programacao(le.programacao_entrega_id)
        )
    ),
    false
  )
$$;

create or replace function public.fn_logistica_can_manage_entrega(_lista_entrega_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.fn_logistica_is_privileged_user()
    or exists (
      select 1
      from public.bd_lista_programacao_entrega le
      where le.id = _lista_entrega_id
        and (
          le.apontador_id = public.fn_logistica_current_funcionario_id()
          or coalesce(public.usuario_acessa_equipe(auth.uid(), le.equipe_id), false)
        )
    ),
    false
  )
$$;

create or replace function public.fn_logistica_can_access_apontamento_cam(_registro_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.fn_logistica_is_privileged_user()
    or exists (
      select 1
      from public.bd_registro_apontamento_cam_equipa ace
      where ace.id = _registro_id
        and (
          ace.created_by = auth.uid()
          or ace.operador_id = public.fn_logistica_current_funcionario_id()
          or public.fn_logistica_can_access_centro_custo(ace.centro_custo_id)
        )
    ),
    false
  )
$$;

create table if not exists public.bd_logistica_auditoria (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  recurso_tipo text not null,
  recurso_id uuid,
  contexto text not null,
  acao text not null,
  detalhes jsonb not null default '{}'::jsonb,
  filtros jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.bd_logistica_auditoria enable row level security;
drop policy if exists "Auditoria logistica visivel apenas perfis autorizados" on public.bd_logistica_auditoria;
create policy "Auditoria logistica visivel apenas perfis autorizados"
on public.bd_logistica_auditoria
for select
to authenticated
using (public.fn_logistica_can_view_sensitive_exports());

create or replace function public.fn_auditar_logistica_mutacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.bd_logistica_auditoria (
    actor_user_id,
    recurso_tipo,
    recurso_id,
    contexto,
    acao,
    detalhes,
    filtros
  )
  values (
    auth.uid(),
    tg_table_name,
    coalesce(new.id, old.id),
    'modulo_logistica',
    tg_op,
    jsonb_build_object(
      'old', to_jsonb(old),
      'new', to_jsonb(new)
    ),
    jsonb_build_object('trigger', tg_name)
  );

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_logistica_audit_requisicoes on public.bd_requisicoes;
create trigger trg_logistica_audit_requisicoes
after insert or update or delete on public.bd_requisicoes
for each row execute function public.fn_auditar_logistica_mutacao();

drop trigger if exists trg_logistica_audit_programacao on public.bd_programacao_entrega;
create trigger trg_logistica_audit_programacao
after insert or update or delete on public.bd_programacao_entrega
for each row execute function public.fn_auditar_logistica_mutacao();

drop trigger if exists trg_logistica_audit_lista_entrega on public.bd_lista_programacao_entrega;
create trigger trg_logistica_audit_lista_entrega
after insert or update or delete on public.bd_lista_programacao_entrega
for each row execute function public.fn_auditar_logistica_mutacao();

drop trigger if exists trg_logistica_audit_registro_cargas on public.bd_registro_cargas;
create trigger trg_logistica_audit_registro_cargas
after insert or update or delete on public.bd_registro_cargas
for each row execute function public.fn_auditar_logistica_mutacao();

drop trigger if exists trg_logistica_audit_aplicacao_detalhes on public.bd_registro_aplicacao_detalhes;
create trigger trg_logistica_audit_aplicacao_detalhes
after insert or update or delete on public.bd_registro_aplicacao_detalhes
for each row execute function public.fn_auditar_logistica_mutacao();

drop trigger if exists trg_logistica_audit_apontamento_aplicacao on public.bd_registro_apontamento_aplicacao;
create trigger trg_logistica_audit_apontamento_aplicacao
after insert or update or delete on public.bd_registro_apontamento_aplicacao
for each row execute function public.fn_auditar_logistica_mutacao();

drop trigger if exists trg_logistica_audit_apontamento_equipe on public.bd_apontamento_equipe;
create trigger trg_logistica_audit_apontamento_equipe
after insert or update or delete on public.bd_apontamento_equipe
for each row execute function public.fn_auditar_logistica_mutacao();

drop trigger if exists trg_logistica_audit_apontamento_cam_equipa on public.bd_registro_apontamento_cam_equipa;
create trigger trg_logistica_audit_apontamento_cam_equipa
after insert or update or delete on public.bd_registro_apontamento_cam_equipa
for each row execute function public.fn_auditar_logistica_mutacao();

drop policy if exists "Usuários autenticados podem acessar requisições" on public.bd_requisicoes;
drop policy if exists "Usuários autenticados podem acessar ruas" on public.bd_ruas_requisicao;
drop policy if exists "Usuários autenticados podem acessar programação" on public.bd_programacao_entrega;
drop policy if exists "Usuários autenticados podem acessar programação de entrega" on public.bd_lista_programacao_entrega;
drop policy if exists "Usuários autenticados podem visualizar registros de carga" on public.bd_registro_cargas;
drop policy if exists "Usuários autenticados podem criar registros de carga" on public.bd_registro_cargas;
drop policy if exists "Usuários autenticados podem atualizar registros de carga" on public.bd_registro_cargas;
drop policy if exists "Usuários autenticados podem deletar registros de carga" on public.bd_registro_cargas;
drop policy if exists "Usuários autenticados podem acessar detalhes aplicação" on public.bd_registro_aplicacao_detalhes;
drop policy if exists "Usuários autenticados podem acessar apontamentos" on public.bd_registro_apontamento_aplicacao;
drop policy if exists "Apontamentos cam/equip: visualização baseada em permissões" on public.bd_registro_apontamento_cam_equipa;
drop policy if exists "Apontamentos cam/equip: inserção autenticada" on public.bd_registro_apontamento_cam_equipa;
drop policy if exists "Apontamentos cam/equip: atualização baseada em permissões" on public.bd_registro_apontamento_cam_equipa;
drop policy if exists "Apontamentos cam/equip: exclusão baseada em permissões" on public.bd_registro_apontamento_cam_equipa;
drop policy if exists "Apontamento equipe: seleção por regras" on public.bd_apontamento_equipe;
drop policy if exists "Apontamento equipe: inserção por regras" on public.bd_apontamento_equipe;
drop policy if exists "Apontamento equipe: atualização por regras" on public.bd_apontamento_equipe;
drop policy if exists "Apontamento equipe: exclusão por regras" on public.bd_apontamento_equipe;
drop policy if exists "Requisicoes por escopo logistico" on public.bd_requisicoes;
drop policy if exists "Requisicoes criacao por escopo logistico" on public.bd_requisicoes;
drop policy if exists "Requisicoes atualizacao por escopo logistico" on public.bd_requisicoes;
drop policy if exists "Requisicoes exclusao por escopo logistico" on public.bd_requisicoes;
drop policy if exists "Ruas requisicao por escopo logistico" on public.bd_ruas_requisicao;
drop policy if exists "Ruas requisicao criacao por escopo logistico" on public.bd_ruas_requisicao;
drop policy if exists "Ruas requisicao atualizacao por escopo logistico" on public.bd_ruas_requisicao;
drop policy if exists "Ruas requisicao exclusao por escopo logistico" on public.bd_ruas_requisicao;
drop policy if exists "Programacao entrega por escopo logistico" on public.bd_programacao_entrega;
drop policy if exists "Programacao entrega criacao por escopo logistico" on public.bd_programacao_entrega;
drop policy if exists "Programacao entrega atualizacao por escopo logistico" on public.bd_programacao_entrega;
drop policy if exists "Programacao entrega exclusao por escopo logistico" on public.bd_programacao_entrega;
drop policy if exists "Lista entrega por escopo logistico" on public.bd_lista_programacao_entrega;
drop policy if exists "Lista entrega criacao por escopo logistico" on public.bd_lista_programacao_entrega;
drop policy if exists "Lista entrega atualizacao por escopo logistico" on public.bd_lista_programacao_entrega;
drop policy if exists "Lista entrega exclusao por escopo logistico" on public.bd_lista_programacao_entrega;
drop policy if exists "Registro cargas por escopo logistico" on public.bd_registro_cargas;
drop policy if exists "Registro cargas criacao por escopo logistico" on public.bd_registro_cargas;
drop policy if exists "Registro cargas atualizacao por escopo logistico" on public.bd_registro_cargas;
drop policy if exists "Registro cargas exclusao por escopo logistico" on public.bd_registro_cargas;
drop policy if exists "Aplicacao detalhes por escopo logistico" on public.bd_registro_aplicacao_detalhes;
drop policy if exists "Aplicacao detalhes criacao por escopo logistico" on public.bd_registro_aplicacao_detalhes;
drop policy if exists "Aplicacao detalhes atualizacao por escopo logistico" on public.bd_registro_aplicacao_detalhes;
drop policy if exists "Aplicacao detalhes exclusao por escopo logistico" on public.bd_registro_aplicacao_detalhes;
drop policy if exists "Apontamento aplicacao por escopo logistico" on public.bd_registro_apontamento_aplicacao;
drop policy if exists "Apontamento aplicacao criacao por escopo logistico" on public.bd_registro_apontamento_aplicacao;
drop policy if exists "Apontamento aplicacao atualizacao por escopo logistico" on public.bd_registro_apontamento_aplicacao;
drop policy if exists "Apontamento aplicacao exclusao por escopo logistico" on public.bd_registro_apontamento_aplicacao;
drop policy if exists "Apontamento equipe por escopo logistico" on public.bd_apontamento_equipe;
drop policy if exists "Apontamento equipe criacao por escopo logistico" on public.bd_apontamento_equipe;
drop policy if exists "Apontamento equipe atualizacao por escopo logistico" on public.bd_apontamento_equipe;
drop policy if exists "Apontamento equipe exclusao por escopo logistico" on public.bd_apontamento_equipe;
drop policy if exists "Apontamento cam equip por escopo logistico" on public.bd_registro_apontamento_cam_equipa;
drop policy if exists "Apontamento cam equip criacao por escopo logistico" on public.bd_registro_apontamento_cam_equipa;
drop policy if exists "Apontamento cam equip atualizacao por escopo logistico" on public.bd_registro_apontamento_cam_equipa;
drop policy if exists "Apontamento cam equip exclusao por escopo logistico" on public.bd_registro_apontamento_cam_equipa;

alter table public.bd_requisicoes force row level security;
alter table public.bd_ruas_requisicao force row level security;
alter table public.bd_programacao_entrega force row level security;
alter table public.bd_lista_programacao_entrega force row level security;
alter table public.bd_registro_cargas force row level security;
alter table public.bd_registro_aplicacao_detalhes force row level security;
alter table public.bd_registro_apontamento_aplicacao force row level security;
alter table public.bd_apontamento_equipe force row level security;
alter table public.bd_registro_apontamento_cam_equipa force row level security;

create policy "Requisicoes por escopo logistico"
on public.bd_requisicoes
for select
to authenticated
using (
  public.fn_logistica_can_access_requisicao(id)
  or (centro_custo_id is not null and public.fn_logistica_can_access_centro_custo(centro_custo_id))
  or engenheiro_id = public.fn_logistica_current_funcionario_id()
);

create policy "Requisicoes criacao por escopo logistico"
on public.bd_requisicoes
for insert
to authenticated
with check (
  public.fn_logistica_is_privileged_user()
  or engenheiro_id = public.fn_logistica_current_funcionario_id()
  or (centro_custo_id is not null and public.fn_logistica_can_access_centro_custo(centro_custo_id))
);

create policy "Requisicoes atualizacao por escopo logistico"
on public.bd_requisicoes
for update
to authenticated
using (
  public.fn_logistica_is_privileged_user()
  or engenheiro_id = public.fn_logistica_current_funcionario_id()
  or (centro_custo_id is not null and public.fn_logistica_can_access_centro_custo(centro_custo_id))
)
with check (
  public.fn_logistica_is_privileged_user()
  or engenheiro_id = public.fn_logistica_current_funcionario_id()
  or (centro_custo_id is not null and public.fn_logistica_can_access_centro_custo(centro_custo_id))
);

create policy "Requisicoes exclusao por escopo logistico"
on public.bd_requisicoes
for delete
to authenticated
using (
  public.fn_logistica_is_privileged_user()
  or engenheiro_id = public.fn_logistica_current_funcionario_id()
  or (centro_custo_id is not null and public.fn_logistica_can_access_centro_custo(centro_custo_id))
);

create policy "Ruas requisicao por escopo logistico"
on public.bd_ruas_requisicao
for select
to authenticated
using (public.fn_logistica_can_access_requisicao(requisicao_id));

create policy "Ruas requisicao criacao por escopo logistico"
on public.bd_ruas_requisicao
for insert
to authenticated
with check (public.fn_logistica_can_access_requisicao(requisicao_id));

create policy "Ruas requisicao atualizacao por escopo logistico"
on public.bd_ruas_requisicao
for update
to authenticated
using (public.fn_logistica_can_access_requisicao(requisicao_id))
with check (public.fn_logistica_can_access_requisicao(requisicao_id));

create policy "Ruas requisicao exclusao por escopo logistico"
on public.bd_ruas_requisicao
for delete
to authenticated
using (public.fn_logistica_can_access_requisicao(requisicao_id));

create policy "Programacao entrega por escopo logistico"
on public.bd_programacao_entrega
for select
to authenticated
using (
  public.fn_logistica_can_access_programacao(id)
  or (centro_custo_id is not null and public.fn_logistica_can_access_centro_custo(centro_custo_id))
  or (requisicao_id is not null and public.fn_logistica_can_access_requisicao(requisicao_id))
);

create policy "Programacao entrega criacao por escopo logistico"
on public.bd_programacao_entrega
for insert
to authenticated
with check (
  public.fn_logistica_is_privileged_user()
  or (centro_custo_id is not null and public.fn_logistica_can_access_centro_custo(centro_custo_id))
  or (requisicao_id is not null and public.fn_logistica_can_access_requisicao(requisicao_id))
);

create policy "Programacao entrega atualizacao por escopo logistico"
on public.bd_programacao_entrega
for update
to authenticated
using (
  public.fn_logistica_is_privileged_user()
  or (centro_custo_id is not null and public.fn_logistica_can_access_centro_custo(centro_custo_id))
  or (requisicao_id is not null and public.fn_logistica_can_access_requisicao(requisicao_id))
)
with check (
  public.fn_logistica_is_privileged_user()
  or (centro_custo_id is not null and public.fn_logistica_can_access_centro_custo(centro_custo_id))
  or (requisicao_id is not null and public.fn_logistica_can_access_requisicao(requisicao_id))
);

create policy "Programacao entrega exclusao por escopo logistico"
on public.bd_programacao_entrega
for delete
to authenticated
using (
  public.fn_logistica_is_privileged_user()
  or (centro_custo_id is not null and public.fn_logistica_can_access_centro_custo(centro_custo_id))
  or (requisicao_id is not null and public.fn_logistica_can_access_requisicao(requisicao_id))
);

create policy "Lista entrega por escopo logistico"
on public.bd_lista_programacao_entrega
for select
to authenticated
using (public.fn_logistica_can_access_entrega(id));

create policy "Lista entrega criacao por escopo logistico"
on public.bd_lista_programacao_entrega
for insert
to authenticated
with check (
  public.fn_logistica_is_privileged_user()
  or apontador_id = public.fn_logistica_current_funcionario_id()
  or coalesce(public.usuario_acessa_equipe(auth.uid(), equipe_id), false)
  or (requisicao_id is not null and public.fn_logistica_can_access_requisicao(requisicao_id))
  or (programacao_entrega_id is not null and public.fn_logistica_can_access_programacao(programacao_entrega_id))
);

create policy "Lista entrega atualizacao por escopo logistico"
on public.bd_lista_programacao_entrega
for update
to authenticated
using (
  public.fn_logistica_can_manage_entrega(id)
  or (requisicao_id is not null and public.fn_logistica_can_access_requisicao(requisicao_id))
)
with check (
  public.fn_logistica_can_manage_entrega(id)
  or (requisicao_id is not null and public.fn_logistica_can_access_requisicao(requisicao_id))
);

create policy "Lista entrega exclusao por escopo logistico"
on public.bd_lista_programacao_entrega
for delete
to authenticated
using (
  public.fn_logistica_can_manage_entrega(id)
  or (requisicao_id is not null and public.fn_logistica_can_access_requisicao(requisicao_id))
);

create policy "Registro cargas por escopo logistico"
on public.bd_registro_cargas
for select
to authenticated
using (public.fn_logistica_can_access_entrega(lista_entrega_id));

create policy "Registro cargas criacao por escopo logistico"
on public.bd_registro_cargas
for insert
to authenticated
with check (public.fn_logistica_can_manage_entrega(lista_entrega_id));

create policy "Registro cargas atualizacao por escopo logistico"
on public.bd_registro_cargas
for update
to authenticated
using (public.fn_logistica_can_manage_entrega(lista_entrega_id))
with check (public.fn_logistica_can_manage_entrega(lista_entrega_id));

create policy "Registro cargas exclusao por escopo logistico"
on public.bd_registro_cargas
for delete
to authenticated
using (public.fn_logistica_can_manage_entrega(lista_entrega_id));

create policy "Aplicacao detalhes por escopo logistico"
on public.bd_registro_aplicacao_detalhes
for select
to authenticated
using (
  public.fn_logistica_can_access_entrega(lista_entrega_id)
  or created_by = auth.uid()
);

create policy "Aplicacao detalhes criacao por escopo logistico"
on public.bd_registro_aplicacao_detalhes
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.fn_logistica_can_manage_entrega(lista_entrega_id)
);

create policy "Aplicacao detalhes atualizacao por escopo logistico"
on public.bd_registro_aplicacao_detalhes
for update
to authenticated
using (
  public.fn_logistica_is_privileged_user()
  or created_by = auth.uid()
  or public.fn_logistica_can_manage_entrega(lista_entrega_id)
)
with check (
  public.fn_logistica_is_privileged_user()
  or created_by = auth.uid()
  or public.fn_logistica_can_manage_entrega(lista_entrega_id)
);

create policy "Aplicacao detalhes exclusao por escopo logistico"
on public.bd_registro_aplicacao_detalhes
for delete
to authenticated
using (
  public.fn_logistica_is_privileged_user()
  or created_by = auth.uid()
  or public.fn_logistica_can_manage_entrega(lista_entrega_id)
);

create policy "Apontamento aplicacao por escopo logistico"
on public.bd_registro_apontamento_aplicacao
for select
to authenticated
using (public.fn_logistica_can_access_entrega(lista_entrega_id));

create policy "Apontamento aplicacao criacao por escopo logistico"
on public.bd_registro_apontamento_aplicacao
for insert
to authenticated
with check (public.fn_logistica_can_manage_entrega(lista_entrega_id));

create policy "Apontamento aplicacao atualizacao por escopo logistico"
on public.bd_registro_apontamento_aplicacao
for update
to authenticated
using (public.fn_logistica_can_manage_entrega(lista_entrega_id))
with check (public.fn_logistica_can_manage_entrega(lista_entrega_id));

create policy "Apontamento aplicacao exclusao por escopo logistico"
on public.bd_registro_apontamento_aplicacao
for delete
to authenticated
using (public.fn_logistica_can_manage_entrega(lista_entrega_id));

create policy "Apontamento equipe por escopo logistico"
on public.bd_apontamento_equipe
for select
to authenticated
using (
  public.fn_logistica_is_privileged_user()
  or coalesce(public.usuario_acessa_equipe(auth.uid(), equipe_id), false)
  or colaborador_id = public.fn_logistica_current_funcionario_id()
  or registrado_por = public.fn_logistica_current_funcionario_id()
  or (lista_entrega_id is not null and public.fn_logistica_can_access_entrega(lista_entrega_id))
);

create policy "Apontamento equipe criacao por escopo logistico"
on public.bd_apontamento_equipe
for insert
to authenticated
with check (
  public.fn_logistica_is_privileged_user()
  or coalesce(public.usuario_acessa_equipe(auth.uid(), equipe_id), false)
  or colaborador_id = public.fn_logistica_current_funcionario_id()
  or registrado_por = public.fn_logistica_current_funcionario_id()
  or (lista_entrega_id is not null and public.fn_logistica_can_manage_entrega(lista_entrega_id))
);

create policy "Apontamento equipe atualizacao por escopo logistico"
on public.bd_apontamento_equipe
for update
to authenticated
using (
  public.fn_logistica_is_privileged_user()
  or coalesce(public.usuario_acessa_equipe(auth.uid(), equipe_id), false)
  or registrado_por = public.fn_logistica_current_funcionario_id()
  or (lista_entrega_id is not null and public.fn_logistica_can_manage_entrega(lista_entrega_id))
)
with check (
  public.fn_logistica_is_privileged_user()
  or coalesce(public.usuario_acessa_equipe(auth.uid(), equipe_id), false)
  or registrado_por = public.fn_logistica_current_funcionario_id()
  or (lista_entrega_id is not null and public.fn_logistica_can_manage_entrega(lista_entrega_id))
);

create policy "Apontamento equipe exclusao por escopo logistico"
on public.bd_apontamento_equipe
for delete
to authenticated
using (
  public.fn_logistica_is_privileged_user()
  or coalesce(public.usuario_acessa_equipe(auth.uid(), equipe_id), false)
  or registrado_por = public.fn_logistica_current_funcionario_id()
  or (lista_entrega_id is not null and public.fn_logistica_can_manage_entrega(lista_entrega_id))
);

create policy "Apontamento cam equip por escopo logistico"
on public.bd_registro_apontamento_cam_equipa
for select
to authenticated
using (
  public.fn_logistica_can_access_apontamento_cam(id)
  or created_by = auth.uid()
  or operador_id = public.fn_logistica_current_funcionario_id()
);

create policy "Apontamento cam equip criacao por escopo logistico"
on public.bd_registro_apontamento_cam_equipa
for insert
to authenticated
with check (
  created_by = auth.uid()
  and (
    public.fn_logistica_is_privileged_user()
    or operador_id = public.fn_logistica_current_funcionario_id()
    or (centro_custo_id is not null and public.fn_logistica_can_access_centro_custo(centro_custo_id))
  )
);

create policy "Apontamento cam equip atualizacao por escopo logistico"
on public.bd_registro_apontamento_cam_equipa
for update
to authenticated
using (
  public.fn_logistica_is_privileged_user()
  or created_by = auth.uid()
  or operador_id = public.fn_logistica_current_funcionario_id()
  or (centro_custo_id is not null and public.fn_logistica_can_access_centro_custo(centro_custo_id))
)
with check (
  public.fn_logistica_is_privileged_user()
  or created_by = auth.uid()
  or operador_id = public.fn_logistica_current_funcionario_id()
  or (centro_custo_id is not null and public.fn_logistica_can_access_centro_custo(centro_custo_id))
);

create policy "Apontamento cam equip exclusao por escopo logistico"
on public.bd_registro_apontamento_cam_equipa
for delete
to authenticated
using (
  public.fn_logistica_is_privileged_user()
  or created_by = auth.uid()
  or operador_id = public.fn_logistica_current_funcionario_id()
  or (centro_custo_id is not null and public.fn_logistica_can_access_centro_custo(centro_custo_id))
);

create or replace view public.vw_requisicoes_operacional_segura
with (security_invoker = true)
as
select
  r.id,
  r.numero,
  r.centro_custo_id,
  cc.codigo_centro_custo,
  cc.nome_centro_custo,
  r.engenheiro_id,
  f.nome_completo as engenheiro_nome,
  r.data_requisicao,
  r.diretoria,
  r.gerencia,
  r.created_at,
  r.updated_at
from public.bd_requisicoes r
left join public.bd_centros_custo cc on cc.id = r.centro_custo_id
left join public.bd_funcionarios f on f.id = r.engenheiro_id;

create or replace view public.vw_programacao_entrega_segura
with (security_invoker = true)
as
select
  pe.id,
  pe.data_programacao,
  pe.data_entrega,
  pe.status,
  pe.centro_custo_id,
  cc.codigo_centro_custo,
  cc.nome_centro_custo,
  pe.requisicao_id,
  r.numero as requisicao_numero,
  pe.observacoes,
  pe.created_at,
  pe.updated_at
from public.bd_programacao_entrega pe
left join public.bd_centros_custo cc on cc.id = pe.centro_custo_id
left join public.bd_requisicoes r on r.id = pe.requisicao_id;

create or replace view public.vw_lista_programacao_entrega_segura
with (security_invoker = true)
as
select
  le.id,
  le.programacao_entrega_id,
  le.requisicao_id,
  r.numero as requisicao_numero,
  le.caminhao_id,
  le.equipe_id,
  e.nome_equipe,
  le.apontador_id,
  ap.nome_completo as apontador_nome,
  le.usina_id,
  le.data_entrega,
  le.quantidade_massa,
  le.logradouro,
  le.tipo_lancamento,
  le.status,
  le.created_at,
  le.updated_at
from public.bd_lista_programacao_entrega le
left join public.bd_requisicoes r on r.id = le.requisicao_id
left join public.bd_equipes e on e.id = le.equipe_id
left join public.bd_funcionarios ap on ap.id = le.apontador_id;

create or replace view public.vw_registro_cargas_seguro
with (security_invoker = true)
as
select
  rc.id,
  rc.lista_entrega_id,
  le.requisicao_id,
  r.numero as requisicao_numero,
  le.equipe_id,
  le.apontador_id,
  rc.programacao_id,
  rc.data_saida,
  rc.hora_saida,
  rc.temperatura_saida,
  rc.tonelada_saida,
  rc.tonelada_retorno,
  rc.tonelada_real,
  rc.status_registro,
  rc.imagem_ticket_saida,
  rc.imagem_ticket_retorno,
  rc.created_at,
  rc.updated_at
from public.bd_registro_cargas rc
left join public.bd_lista_programacao_entrega le on le.id = rc.lista_entrega_id
left join public.bd_requisicoes r on r.id = le.requisicao_id;

create or replace view public.vw_registro_aplicacao_seguro
with (security_invoker = true)
as
select
  ra.id,
  ra.lista_entrega_id,
  le.requisicao_id,
  r.numero as requisicao_numero,
  ra.registro_carga_id,
  ra.data_aplicacao,
  ra.hora_chegada_local,
  ra.temperatura_chegada,
  ra.hora_aplicacao,
  ra.temperatura_aplicacao,
  ra.tonelada_aplicada,
  ra.percentual_aplicado,
  ra.status_aplicacao,
  ra.logradouro_aplicado,
  ra.created_at,
  ra.updated_at
from public.bd_registro_apontamento_aplicacao ra
left join public.bd_lista_programacao_entrega le on le.id = ra.lista_entrega_id
left join public.bd_requisicoes r on r.id = le.requisicao_id;

create or replace view public.vw_apontamento_equipe_seguro
with (security_invoker = true)
as
select
  ae.id,
  ae.lista_entrega_id,
  ae.data_registro,
  ae.equipe_id,
  e.nome_equipe,
  ae.colaborador_id,
  ae.nome_colaborador,
  ae.presente,
  ae.hora_inicio,
  ae.hora_fim,
  ae.registrado_por,
  reg.nome_completo as registrado_por_nome,
  ae.created_at,
  ae.updated_at
from public.bd_apontamento_equipe ae
left join public.bd_equipes e on e.id = ae.equipe_id
left join public.bd_funcionarios reg on reg.id = ae.registrado_por;

create or replace view public.vw_apontamento_cam_equipa_seguro
with (security_invoker = true)
as
select
  ace.id,
  ace.caminhao_equipamento_id,
  ace.operador_id,
  op.nome_completo as operador_nome,
  ace.centro_custo_id,
  cc.codigo_centro_custo,
  cc.nome_centro_custo,
  ace.data,
  ace.hora_inicial,
  ace.hora_final,
  ace.horimetro_inicial,
  ace.horimetro_final,
  ace.situacao,
  ace.abastecimento,
  ace.created_by,
  ace.created_at,
  ace.updated_at
from public.bd_registro_apontamento_cam_equipa ace
left join public.bd_funcionarios op on op.id = ace.operador_id
left join public.bd_centros_custo cc on cc.id = ace.centro_custo_id;

create or replace view public.vw_logistica_relatorio_gerencial_seguro
with (security_invoker = true)
as
select
  pe.centro_custo_id,
  cc.codigo_centro_custo,
  cc.nome_centro_custo,
  le.data_entrega,
  count(distinct le.id) as total_entregas,
  count(distinct rc.id) as total_cargas,
  count(distinct ra.id) as total_aplicacoes,
  coalesce(sum(rc.tonelada_saida), 0) as total_tonelada_saida,
  coalesce(sum(rc.tonelada_real), 0) as total_tonelada_real,
  coalesce(sum(ra.tonelada_aplicada), 0) as total_tonelada_aplicada
from public.bd_programacao_entrega pe
join public.bd_lista_programacao_entrega le on le.programacao_entrega_id = pe.id
left join public.bd_registro_cargas rc on rc.lista_entrega_id = le.id
left join public.bd_registro_apontamento_aplicacao ra on ra.lista_entrega_id = le.id
left join public.bd_centros_custo cc on cc.id = pe.centro_custo_id
where public.fn_logistica_can_view_sensitive_exports()
group by pe.centro_custo_id, cc.codigo_centro_custo, cc.nome_centro_custo, le.data_entrega;