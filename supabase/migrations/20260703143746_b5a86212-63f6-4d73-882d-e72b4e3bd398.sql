
-- B.3.5-C: adicionar suporte a fotos de Registro Manual no bucket 'apontamentos'
-- Sub-ramo condicional ao prefixo 'registro-manual/'. Fluxos antigos intactos.

CREATE OR REPLACE FUNCTION public.fn_storage_can_upload(
  _bucket text, _name text, _user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_entity_id uuid;
  v_folders   text[];
  v_file      text;
  v_ext       text;
  v_reg_id    uuid;
  v_det_id    uuid;
  v_cc        uuid;
  v_creator   uuid;
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
      v_folders := storage.foldername(_name);

      -- NOVO sub-ramo B.3.5-C: fotos de Registro Manual
      if coalesce(v_folders[1], '') = 'registro-manual' then
        -- Path deve ter exatamente 3 pastas + arquivo
        if coalesce(array_length(v_folders, 1), 0) <> 3 then
          return false;
        end if;

        v_reg_id := public.fn_storage_extract_uuid(v_folders[2]);
        v_det_id := public.fn_storage_extract_uuid(v_folders[3]);
        if v_reg_id is null or v_det_id is null then
          return false;
        end if;

        v_file := storage.filename(_name);
        if v_file is null or length(v_file) = 0 then
          return false;
        end if;
        v_ext := lower(regexp_replace(v_file, '^.*\.', ''));
        if v_ext not in ('jpg', 'jpeg', 'png', 'webp') then
          return false;
        end if;

        select r.centro_custo_id, r.created_by
          into v_cc, v_creator
        from public.bd_registro_apontamento_aplicacao r
        join public.bd_registro_aplicacao_detalhes d on d.registro_aplicacao_id = r.id
        where r.id = v_reg_id
          and d.id = v_det_id
          and r.origem_registro = 'manual'
          and d.lista_entrega_id is null
          and d.registro_carga_id is null
          and d.rua_aplicacao_id is not null;

        if v_cc is null then
          return false;
        end if;

        return public.fn_logistica_is_privileged_user()
            or v_creator = _user_id
            or (
              public.user_has_permission_action(
                _user_id, 'requisicoes_registro_aplicacao_view', 'criar')
              and exists (
                select 1
                from public.fn_diaria_scope_centros_custo(_user_id) s(cc)
                where s.cc = v_cc
              )
            );
      end if;

      -- Ramo antigo INTOCADO (apontamentos de caminhões/equipe)
      return coalesce(public.has_permission('requisicoes_apontamento_caminhoes_view', _user_id), false)
          or coalesce(public.has_permission('requisicoes_apontamento_equipe_view',   _user_id), false);
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
$function$;


CREATE OR REPLACE FUNCTION public.fn_storage_can_access(
  _bucket text, _name text, _user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_entity_id uuid;
  v_second_id uuid;
  v_folders   text[];
  v_file      text;
  v_ext       text;
  v_reg_id    uuid;
  v_det_id    uuid;
  v_cc        uuid;
  v_creator   uuid;
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
      v_folders := storage.foldername(_name);

      -- NOVO sub-ramo B.3.5-C: fotos de Registro Manual
      if coalesce(v_folders[1], '') = 'registro-manual' then
        if coalesce(array_length(v_folders, 1), 0) <> 3 then
          return false;
        end if;

        v_reg_id := public.fn_storage_extract_uuid(v_folders[2]);
        v_det_id := public.fn_storage_extract_uuid(v_folders[3]);
        if v_reg_id is null or v_det_id is null then
          return false;
        end if;

        v_file := storage.filename(_name);
        if v_file is null or length(v_file) = 0 then
          return false;
        end if;
        v_ext := lower(regexp_replace(v_file, '^.*\.', ''));
        if v_ext not in ('jpg', 'jpeg', 'png', 'webp') then
          return false;
        end if;

        select r.centro_custo_id, r.created_by
          into v_cc, v_creator
        from public.bd_registro_apontamento_aplicacao r
        join public.bd_registro_aplicacao_detalhes d on d.registro_aplicacao_id = r.id
        where r.id = v_reg_id
          and d.id = v_det_id
          and r.origem_registro = 'manual'
          and d.lista_entrega_id is null
          and d.registro_carga_id is null
          and d.rua_aplicacao_id is not null;

        if v_cc is null then
          return false;
        end if;

        return public.fn_logistica_is_privileged_user()
            or v_creator = _user_id
            or (
              public.user_has_permission_action(
                _user_id, 'requisicoes_registro_aplicacao_view', 'visualizar')
              and exists (
                select 1
                from public.fn_diaria_scope_centros_custo(_user_id) s(cc)
                where s.cc = v_cc
              )
            );
      end if;

      -- Ramo antigo INTOCADO
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
            and public.fn_logistica_can_access_centro_custo(d.obra_id)
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
            and public.fn_logistica_can_access_centro_custo(v.centro_custo_id)
        )
      );

    when 'exames_agendamentos' then
      return public.has_sso_permission(_user_id) or public.has_sso_full_access(_user_id);

    when 'documentos-rh' then
      v_entity_id := public.fn_storage_entity_id(_name, 1);
      return coalesce(public.has_permission('gestao_rh_funcionarios_view', _user_id), false)
        or (v_entity_id is not null and public.fn_can_access_funcionario_sensitive(v_entity_id));

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
$function$;
