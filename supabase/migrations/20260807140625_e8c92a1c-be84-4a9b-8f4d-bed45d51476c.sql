CREATE OR REPLACE FUNCTION public.fn_ct_registrar_assinatura(p_user uuid, p_solicitacao_id uuid, p_tipo text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  a record; v_nome text; v_cpf text; v_id uuid;
BEGIN
  SELECT * INTO a FROM public.bd_assinaturas_usuarios
   WHERE usuario_id = p_user AND ativo = true
   ORDER BY updated_at DESC LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CT3E_ASSINATURA_NAO_CADASTRADA' USING ERRCODE='P0001',
      HINT='Cadastre sua assinatura digital antes de concluir esta etapa.';
  END IF;
  v_nome := a.nome_completo;
  v_cpf := a.cpf;

  INSERT INTO public.bd_assinaturas (solicitacao_id, usuario_id, nome_usuario, cargo,
      assinatura_png, ip, hash_assinatura, data_assinatura, tipo_assinatura, cpf)
  VALUES (p_solicitacao_id, p_user, v_nome, a.cargo, a.assinatura_url,
      coalesce(inet_client_addr()::text,'desconhecido'),
      encode(extensions.digest(coalesce(v_nome,'')||'|'||coalesce(v_cpf,'')||'|'||p_tipo||'|'||now()::text, 'sha256'), 'hex'),
      now(), p_tipo, v_cpf)
  RETURNING id INTO v_id;
  RETURN v_id;
END $function$;