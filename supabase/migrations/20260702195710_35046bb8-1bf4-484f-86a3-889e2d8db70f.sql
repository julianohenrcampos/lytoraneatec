-- ============================================================
-- FIX: AdmSede (via permissão gestao_rh_funcionarios_view) não conseguia
-- ler documentos-rh no Storage nem ver/editar registros de bd_vale_transporte
-- criados por outros usuários.
-- ============================================================

-- 1) fn_storage_can_access: alinhar branch 'documentos-rh' com fn_storage_can_upload
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
      -- FIX 2026-07-02: alinhado com fn_storage_can_upload. Antes exigia UUID na
      -- 1ª pasta (paths 'vale-transporte/<agendamento_id>/...' retornavam NULL)
      -- e negava leitura a quem tem permissão de RH (ex.: AdmSede).
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

-- 2) bd_vale_transporte: incluir gate por permissão de RH (mesmo critério do
--    Storage e do agendamento), mantendo as roles existentes.
DROP POLICY IF EXISTS vt_select_scoped ON public.bd_vale_transporte;
CREATE POLICY vt_select_scoped ON public.bd_vale_transporte
FOR SELECT USING (
  (created_by = auth.uid())
  OR coalesce(public.has_permission('gestao_rh_funcionarios_view', auth.uid()), false)
  OR has_role('SuperAdm'::text, auth.uid())
  OR has_role('AdmRH'::text, auth.uid())
  OR has_role('TecSSO'::text, auth.uid())
  OR has_role('AdmSSO'::text, auth.uid())
  OR has_role('Financeiro'::text, auth.uid())
  OR has_role('DP'::text, auth.uid())
);

DROP POLICY IF EXISTS vt_update_scoped ON public.bd_vale_transporte;
CREATE POLICY vt_update_scoped ON public.bd_vale_transporte
FOR UPDATE USING (
  (created_by = auth.uid())
  OR coalesce(public.has_permission('gestao_rh_funcionarios_view', auth.uid()), false)
  OR has_role('SuperAdm'::text, auth.uid())
  OR has_role('AdmRH'::text, auth.uid())
  OR has_role('TecSSO'::text, auth.uid())
  OR has_role('AdmSSO'::text, auth.uid())
  OR has_role('Financeiro'::text, auth.uid())
  OR has_role('DP'::text, auth.uid())
) WITH CHECK (
  (created_by = auth.uid())
  OR coalesce(public.has_permission('gestao_rh_funcionarios_view', auth.uid()), false)
  OR has_role('SuperAdm'::text, auth.uid())
  OR has_role('AdmRH'::text, auth.uid())
  OR has_role('TecSSO'::text, auth.uid())
  OR has_role('AdmSSO'::text, auth.uid())
  OR has_role('Financeiro'::text, auth.uid())
  OR has_role('DP'::text, auth.uid())
);