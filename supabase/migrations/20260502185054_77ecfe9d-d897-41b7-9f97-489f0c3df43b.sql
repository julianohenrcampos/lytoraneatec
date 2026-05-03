CREATE OR REPLACE FUNCTION public.fn_validate_permission_catalog_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_actor uuid := auth.uid();
  v_new_protected boolean := false;
  v_old_protected boolean := false;
begin
  if not public.fn_can_manage_permission_catalog(v_actor) then
    raise exception 'Você não possui permissão para alterar o catálogo de permissões.' using errcode = '42501';
  end if;

  if tg_op <> 'DELETE' then
    v_new_protected := (
      new.codigo LIKE 'admin!_%' ESCAPE '!'
      or new.codigo in ('admin_permissoes_view', 'admin_gestao_fluxos_view')
      or coalesce(new.rota, '') like '/admin%'
    );
  end if;

  if tg_op <> 'INSERT' then
    v_old_protected := (
      old.codigo LIKE 'admin!_%' ESCAPE '!'
      or old.codigo in ('admin_permissoes_view', 'admin_gestao_fluxos_view')
      or coalesce(old.rota, '') like '/admin%'
    );
  end if;

  if not public.fn_is_super_admin(v_actor) and (v_new_protected or v_old_protected) then
    raise exception 'Somente SuperAdm pode alterar permissões protegidas.' using errcode = '42501';
  end if;

  return coalesce(new, old);
end;
$function$;