create table if not exists public.bd_storage_auditoria (
  id uuid primary key default gen_random_uuid(),
  bucket_name text not null,
  object_path text not null,
  acao text not null,
  entidade_tipo text,
  entidade_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  actor_user_id uuid not null,
  created_at timestamptz not null default now()
);

alter table public.bd_storage_auditoria enable row level security;

create index if not exists idx_storage_auditoria_bucket_data
  on public.bd_storage_auditoria (bucket_name, created_at desc);

create index if not exists idx_storage_auditoria_actor_data
  on public.bd_storage_auditoria (actor_user_id, created_at desc);

create or replace function public.fn_storage_extract_uuid(_value text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if _value is null or btrim(_value) = '' then
    return null;
  end if;

  begin
    return _value::uuid;
  exception when others then
    return null;
  end;
end;
$$;

create or replace function public.fn_storage_entity_id(_name text, _index integer)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_storage_extract_uuid((storage.foldername(_name))[_index]);
$$;

create or replace function public.fn_storage_entity_type(_bucket text, _name text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  case _bucket
    when 'avatars' then return 'profile_avatar';
    when 'funcionarios' then return 'funcionario_arquivo';
    when 'os_photos' then return 'ordem_servico';
    when 'tickets' then return 'chamado_os';
    when 'apontamentos' then return 'apontamento_caminhao';
    when 'inspecao-fotos' then return 'inspecao_sso';
    when 'sso-checklists' then return 'checklist_sso';
    when 'sso-desvios' then return 'desvio_sso';
    when 'sso-ver-agir' then return 'ver_agir_sso';
    when 'exames_agendamentos' then return 'agendamento_exame';
    when 'documentos-rh' then return 'documento_rh';
    when 'assinaturas' then return 'assinatura';
    when 'ponto-fotos' then return 'ponto_foto';
    else return 'arquivo';
  end case;
end;
$$;

create or replace function public.fn_storage_can_access(
  _bucket text,
  _name text,
  _user_id uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_entity_id uuid;
  v_second_id uuid;
begin
  if _user_id is null then
    return false;
  end if;

  if public.check_is_super_admin(_user_id) then
    return true;
  end if;

  case _bucket
    when 'assinaturas' then
      return (storage.foldername(_name))[1] = _user_id::text;

    when 'avatars' then
      return (storage.foldername(_name))[1] = 'profile-images'
        or (storage.foldername(_name))[1] = _user_id::text;

    when 'funcionarios' then
      v_entity_id := public.fn_storage_entity_id(_name, 1);
      if v_entity_id is null then
        return false;
      end if;
      return public.fn_can_access_funcionario_operacional(v_entity_id, null, null)
        or public.fn_can_access_funcionario_sensitive(v_entity_id);

    when 'tickets' then
      v_entity_id := public.fn_storage_entity_id(_name, 1);
      return v_entity_id is not null and public.fn_os_can_access_chamado(v_entity_id);

    when 'os_photos' then
      if split_part(_name, '/', 1) = 'chamado' then
        v_entity_id := public.fn_storage_entity_id(_name, 2);
        return v_entity_id is not null and public.fn_os_can_access_chamado(v_entity_id);
      end if;
      v_entity_id := public.fn_storage_entity_id(_name, 1);
      return v_entity_id is not null and public.fn_os_can_access_ordem(v_entity_id);

    when 'apontamentos' then
      v_entity_id := public.fn_storage_entity_id(_name, 1);
      return v_entity_id is not null and public.fn_logistica_can_access_apontamento_cam(v_entity_id);

    when 'inspecao-fotos', 'sso-checklists' then
      v_entity_id := public.fn_storage_entity_id(_name, 1);
      return _user_id is not null and (
        public.has_sso_full_access(_user_id)
        or public.has_sso_permission(_user_id)
        or exists (
          select 1
          from public.bd_sso_checklists s
          where s.id = v_entity_id
            and public.fn_logistica_can_access_centro_custo(s.obra_id)
        )
      );

    when 'sso-desvios' then
      v_entity_id := public.fn_storage_entity_id(_name, 1);
      return _user_id is not null and (
        public.has_sso_full_access(_user_id)
        or public.has_sso_permission(_user_id)
        or exists (
          select 1
          from public.bd_registro_desvios_sso d
          where d.id = v_entity_id
            and public.fn_logistica_can_access_centro_custo(d.centro_custo_id)
        )
      );

    when 'sso-ver-agir' then
      v_entity_id := public.fn_storage_entity_id(_name, 1);
      return _user_id is not null and (
        public.has_sso_full_access(_user_id)
        or public.has_sso_permission(_user_id)
        or exists (
          select 1
          from public.bd_sso_ver_agir v
          where v.id = v_entity_id
            and public.fn_logistica_can_access_centro_custo(v.obra_id)
        )
      );

    when 'exames_agendamentos' then
      return public.has_sso_permission(_user_id) or public.has_sso_full_access(_user_id);

    when 'documentos-rh' then
      v_entity_id := public.fn_storage_entity_id(_name, 1);
      return v_entity_id is not null and public.fn_can_access_funcionario_sensitive(v_entity_id);

    when 'ponto-fotos' then
      return public.has_permission('ponto_visualizar_todos', _user_id)
        or public.has_permission('ponto_aprovar_ajuste', _user_id)
        or public.has_permission('ponto_registrar', _user_id);

    when 'empresas-logos', 'services', 'veiculos' then
      return true;

    else
      return false;
  end case;
end;
$$;

create or replace function public.fn_storage_can_upload(
  _bucket text,
  _name text,
  _user_id uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_entity_id uuid;
begin
  if _user_id is null then
    return false;
  end if;

  if public.check_is_super_admin(_user_id) then
    return true;
  end if;

  case _bucket
    when 'assinaturas' then
      return (storage.foldername(_name))[1] = _user_id::text;
    when 'avatars' then
      return (storage.foldername(_name))[1] in ('profile-images', _user_id::text);
    when 'funcionarios' then
      v_entity_id := public.fn_storage_entity_id(_name, 1);
      return v_entity_id is not null and public.fn_can_access_funcionario_sensitive(v_entity_id);
    when 'tickets' then
      v_entity_id := public.fn_storage_entity_id(_name, 1);
      return v_entity_id is not null and public.fn_os_can_manage_chamado(v_entity_id);
    when 'os_photos' then
      if split_part(_name, '/', 1) = 'chamado' then
        v_entity_id := public.fn_storage_entity_id(_name, 2);
        return v_entity_id is not null and public.fn_os_can_manage_chamado(v_entity_id);
      end if;
      v_entity_id := public.fn_storage_entity_id(_name, 1);
      return v_entity_id is not null and public.fn_os_can_manage_ordem(v_entity_id);
    when 'apontamentos' then
      return coalesce(public.has_permission('requisicoes_apontamento_caminhoes_view', _user_id), false)
        or coalesce(public.has_permission('requisicoes_apontamento_equipe_view', _user_id), false);
    when 'inspecao-fotos', 'sso-checklists', 'sso-desvios', 'sso-ver-agir', 'exames_agendamentos' then
      return public.has_sso_permission(_user_id) or public.has_sso_full_access(_user_id);
    when 'documentos-rh' then
      return coalesce(public.has_permission('gestao_rh_funcionarios_view', _user_id), false)
        or public.fn_can_access_funcionario_sensitive(public.fn_storage_entity_id(_name, 1));
    when 'ponto-fotos' then
      return public.has_permission('ponto_registrar', _user_id)
        or public.has_permission('ponto_aprovar_ajuste', _user_id);
    when 'empresas-logos', 'services', 'veiculos' then
      return true;
    else
      return false;
  end case;
end;
$$;

create or replace function public.fn_storage_audit_access(
  _bucket text,
  _name text,
  _acao text,
  _metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_audit_id uuid;
  v_entity_type text;
  v_entity_id uuid;
begin
  if v_actor is null then
    raise exception 'Usuário não autenticado';
  end if;

  if not public.fn_storage_can_access(_bucket, _name, v_actor) then
    raise exception 'Acesso negado ao arquivo';
  end if;

  v_entity_type := public.fn_storage_entity_type(_bucket, _name);
  v_entity_id := public.fn_storage_entity_id(_name, 1);
  if _bucket = 'os_photos' and split_part(_name, '/', 1) = 'chamado' then
    v_entity_id := public.fn_storage_entity_id(_name, 2);
  end if;

  insert into public.bd_storage_auditoria (
    bucket_name,
    object_path,
    acao,
    entidade_tipo,
    entidade_id,
    metadata,
    actor_user_id
  ) values (
    _bucket,
    _name,
    lower(coalesce(_acao, 'visualizacao')),
    v_entity_type,
    v_entity_id,
    coalesce(_metadata, '{}'::jsonb),
    v_actor
  )
  returning id into v_audit_id;

  return v_audit_id;
end;
$$;

drop policy if exists "storage auditoria leitura administrativa" on public.bd_storage_auditoria;
create policy "storage auditoria leitura administrativa"
on public.bd_storage_auditoria
for select
to authenticated
using (
  public.check_is_super_admin(auth.uid())
  or public.has_permission('admin_permissoes_view', auth.uid())
  or public.has_permission('dashboard_maquinas_view', auth.uid())
  or public.has_permission('dashboard_rh_view', auth.uid())
);

drop policy if exists "storage auditoria escrita autenticada" on public.bd_storage_auditoria;
create policy "storage auditoria escrita autenticada"
on public.bd_storage_auditoria
for insert
to authenticated
with check (
  actor_user_id = auth.uid()
);

update storage.buckets
set public = false
where id in (
  'avatars',
  'funcionarios',
  'apontamentos',
  'inspecao-fotos',
  'tickets',
  'os_photos',
  'assinaturas',
  'documentos-rh',
  'exames_agendamentos',
  'sso-checklists',
  'sso-desvios',
  'sso-ver-agir',
  'ponto-fotos'
);

drop policy if exists "Allow public read access on avatars" on storage.objects;
drop policy if exists "Allow authenticated users to upload their avatar" on storage.objects;
drop policy if exists "Allow users to update their own avatar" on storage.objects;
drop policy if exists "Allow users to delete their own avatar" on storage.objects;

drop policy if exists "Allow public read access on funcionarios" on storage.objects;
drop policy if exists "Allow authenticated users to upload funcionario files" on storage.objects;
drop policy if exists "Allow users to update funcionario files" on storage.objects;
drop policy if exists "Allow users to delete funcionario files" on storage.objects;

drop policy if exists "Allow public read access on apontamentos" on storage.objects;
drop policy if exists "Allow authenticated users to upload apontamento files" on storage.objects;
drop policy if exists "Allow users to update apontamento files" on storage.objects;
drop policy if exists "Allow users to delete apontamento files" on storage.objects;

drop policy if exists "Allow public read access on inspecao-fotos" on storage.objects;
drop policy if exists "Allow authenticated users to upload inspecao files" on storage.objects;
drop policy if exists "Allow users to update inspecao files" on storage.objects;
drop policy if exists "Allow users to delete inspecao files" on storage.objects;

drop policy if exists "Allow public read access on tickets" on storage.objects;
drop policy if exists "Allow authenticated users to upload ticket files" on storage.objects;
drop policy if exists "Allow users to update ticket files" on storage.objects;
drop policy if exists "Allow users to delete ticket files" on storage.objects;

drop policy if exists "Auth users can read signatures" on storage.objects;
drop policy if exists "Auth users can upload own signatures" on storage.objects;
drop policy if exists "Auth users can update own signatures" on storage.objects;

drop policy if exists "Auth read docs-rh" on storage.objects;
drop policy if exists "Auth upload docs-rh" on storage.objects;

drop policy if exists "Exames storage: select for authenticated" on storage.objects;
drop policy if exists "Exames storage: insert for SSO users" on storage.objects;
drop policy if exists "Exames storage: delete for SSO users" on storage.objects;

drop policy if exists "SSO Checklists: SELECT público" on storage.objects;
drop policy if exists "SSO Checklists: INSERT para usuários autenticados" on storage.objects;
drop policy if exists "SSO Checklists: UPDATE pelo owner" on storage.objects;
drop policy if exists "SSO Checklists: DELETE pelo owner" on storage.objects;

drop policy if exists "SSO Desvios: SELECT para usuários autenticados" on storage.objects;
drop policy if exists "SSO Desvios: INSERT para usuários autenticados" on storage.objects;
drop policy if exists "SSO Desvios: UPDATE para usuários autenticados" on storage.objects;
drop policy if exists "SSO Desvios: DELETE para usuários autenticados" on storage.objects;

drop policy if exists "SSO Ver Agir: SELECT para usuários autenticados" on storage.objects;
drop policy if exists "SSO Ver Agir: INSERT para usuários autenticados" on storage.objects;
drop policy if exists "SSO Ver Agir: UPDATE para usuários autenticados" on storage.objects;
drop policy if exists "SSO Ver Agir: DELETE para usuários autenticados" on storage.objects;

create policy "storage_private_select_scoped"
on storage.objects
for select
to authenticated
using (
  public.fn_storage_can_access(bucket_id, name, auth.uid())
);

create policy "storage_private_insert_scoped"
on storage.objects
for insert
to authenticated
with check (
  public.fn_storage_can_upload(bucket_id, name, auth.uid())
);

create policy "storage_private_update_scoped"
on storage.objects
for update
to authenticated
using (
  public.fn_storage_can_upload(bucket_id, name, auth.uid())
)
with check (
  public.fn_storage_can_upload(bucket_id, name, auth.uid())
);

create policy "storage_private_delete_scoped"
on storage.objects
for delete
to authenticated
using (
  public.fn_storage_can_upload(bucket_id, name, auth.uid())
);