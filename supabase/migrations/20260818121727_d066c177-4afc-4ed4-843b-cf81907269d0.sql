create or replace function public.fn_chamado_interno_eventos_listar(p_chamado_id uuid)
returns table (
  id uuid,
  chamado_id uuid,
  tipo public.chamado_interno_evento_tipo,
  autor_profile_id uuid,
  mensagem text,
  status_anterior public.chamado_interno_status,
  status_novo public.chamado_interno_status,
  visivel_solicitante boolean,
  payload jsonb,
  created_at timestamptz,
  autor_nome text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.fn_chamado_interno_can_read(p_chamado_id) then
    raise exception 'Sem permissão de leitura para este chamado' using errcode = '42501';
  end if;

  return query
  select e.id,
         e.chamado_id,
         e.tipo,
         e.autor_profile_id,
         e.mensagem,
         e.status_anterior,
         e.status_novo,
         e.visivel_solicitante,
         e.payload,
         e.created_at,
         coalesce(nullif(trim(p.nome_completo), ''), nullif(trim(f.nome_completo), '')) as autor_nome
    from public.bd_chamado_interno_eventos e
    left join public.profiles p on p.id = e.autor_profile_id
    left join public.bd_funcionarios f on f.id = p.funcionario_id
   where e.chamado_id = p_chamado_id
     and (
       e.visivel_solicitante is true
       or public.fn_is_super_admin(auth.uid())
       or public.user_has_permission_action(auth.uid(), 'chamados_internos_admin', 'visualizar')
       or public.fn_chamado_interno_can_operate(p_chamado_id)
     )
   order by e.created_at asc;
end;
$$;

revoke all on function public.fn_chamado_interno_eventos_listar(uuid) from public;
grant execute on function public.fn_chamado_interno_eventos_listar(uuid) to authenticated;
grant execute on function public.fn_chamado_interno_eventos_listar(uuid) to service_role;