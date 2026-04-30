CREATE OR REPLACE FUNCTION public.trg_audit_cpf_alterado_fn()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_old_hash text;
  v_new_hash text;
begin
  if coalesce(OLD.cpf,'') = coalesce(NEW.cpf,'') then
    return NEW;
  end if;
  v_old_hash := case when OLD.cpf is null or length(trim(OLD.cpf))=0 then null
                     else encode(extensions.digest(regexp_replace(OLD.cpf,'\D','','g'),'sha256'),'hex') end;
  v_new_hash := case when NEW.cpf is null or length(trim(NEW.cpf))=0 then null
                     else encode(extensions.digest(regexp_replace(NEW.cpf,'\D','','g'),'sha256'),'hex') end;

  perform public.registrar_evento_auditoria_biometria(
    NEW.id,
    'cpf_alterado'::public.tipo_evento_auditoria_biometria,
    v_old_hash,
    v_new_hash,
    'trigger_db'::public.origem_auditoria_biometria,
    null,
    null,
    jsonb_build_object('tabela','bd_funcionarios')
  );
  return NEW;
end$function$;

CREATE OR REPLACE FUNCTION public.registrar_evento_auditoria_biometria(
  p_funcionario_id uuid,
  p_tipo_evento tipo_evento_auditoria_biometria,
  p_hash_anterior text,
  p_hash_novo text,
  p_origem origem_auditoria_biometria DEFAULT 'admin_web'::origem_auditoria_biometria,
  p_ip text DEFAULT NULL::text,
  p_user_agent text DEFAULT NULL::text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user uuid := auth.uid();
  v_now  timestamptz := now();
  v_event_hash text;
  v_integ_hash text;
  v_id uuid;
begin
  if p_funcionario_id is null then
    raise exception 'p_funcionario_id obrigatório';
  end if;

  v_event_hash := encode(extensions.digest(
    coalesce(p_funcionario_id::text,'') || '|' ||
    p_tipo_evento::text || '|' ||
    coalesce(p_hash_novo,'') || '|' ||
    to_char(date_trunc('minute', v_now), 'YYYY-MM-DD"T"HH24:MI'),
    'sha256'), 'hex');

  v_integ_hash := encode(extensions.digest(
    coalesce(p_funcionario_id::text,'') || '|' ||
    coalesce(p_hash_anterior,'') || '|' ||
    coalesce(p_hash_novo,'') || '|' ||
    coalesce(v_user::text,'') || '|' ||
    v_now::text,
    'sha256'), 'hex');

  insert into public.bd_auditoria_biometria(
    funcionario_id, tipo_evento, hash_anterior, hash_novo,
    user_id, ip, user_agent, origem, metadata,
    event_hash, integridade_hash, created_at
  ) values (
    p_funcionario_id, p_tipo_evento, p_hash_anterior, p_hash_novo,
    v_user, p_ip, p_user_agent, p_origem, coalesce(p_metadata,'{}'::jsonb),
    v_event_hash, v_integ_hash, v_now
  )
  on conflict (event_hash) do nothing
  returning id into v_id;

  return v_id;
end$function$;