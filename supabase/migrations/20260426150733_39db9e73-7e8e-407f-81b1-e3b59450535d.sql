create or replace function public.salvar_assinatura_funcionario(
  p_funcionario_id uuid,
  p_assinatura_url text,
  p_assinatura_hash text default null,
  p_ip text default null,
  p_user_agent text default null,
  p_origem public.origem_auditoria_biometria default 'admin_web'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_hash_anterior text;
  v_tinha_anterior boolean;
begin
  if v_uid is null then
    raise exception 'Não autenticado';
  end if;

  if not public.is_super_admin(v_uid) then
    raise exception 'Sem permissão para gerenciar assinaturas';
  end if;

  if p_assinatura_url is null or length(trim(p_assinatura_url)) = 0 then
    raise exception 'p_assinatura_url é obrigatório';
  end if;

  -- Captura hash anterior antes do update
  select assinatura_hash, (assinatura_url is not null)
    into v_hash_anterior, v_tinha_anterior
    from public.bd_funcionarios
   where id = p_funcionario_id;

  update public.bd_funcionarios
     set assinatura_url        = p_assinatura_url,
         assinatura_hash       = coalesce(p_assinatura_hash, assinatura_hash),
         assinatura_updated_at = now()
   where id = p_funcionario_id;

  if not found then
    raise exception 'Funcionário não encontrado: %', p_funcionario_id;
  end if;

  -- Auditoria — best effort (nunca quebra a operação principal)
  begin
    perform public.registrar_evento_auditoria_biometria(
      p_funcionario_id,
      case when coalesce(v_tinha_anterior, false)
           then 'assinatura_substituida'::public.tipo_evento_auditoria_biometria
           else 'assinatura_cadastrada'::public.tipo_evento_auditoria_biometria
      end,
      v_hash_anterior,
      p_assinatura_hash,
      coalesce(p_origem, 'admin_web'::public.origem_auditoria_biometria),
      p_ip,
      p_user_agent,
      jsonb_build_object('assinatura_url', p_assinatura_url)
    );
  exception when others then
    raise notice 'auditoria assinatura falhou: %', SQLERRM;
  end;

  return jsonb_build_object(
    'success', true,
    'funcionario_id', p_funcionario_id,
    'assinatura_url', p_assinatura_url,
    'updated_at', now()
  );
end;
$$;

revoke all on function public.salvar_assinatura_funcionario(uuid, text, text, text, text, public.origem_auditoria_biometria) from public;
grant execute on function public.salvar_assinatura_funcionario(uuid, text, text, text, text, public.origem_auditoria_biometria) to authenticated;