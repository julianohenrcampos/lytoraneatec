CREATE OR REPLACE FUNCTION public.fn_storage_can_access(_bucket text, _name text, _user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;