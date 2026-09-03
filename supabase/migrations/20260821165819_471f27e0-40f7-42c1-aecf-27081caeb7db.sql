CREATE OR REPLACE FUNCTION public.fn_ct_registrar_assinatura(p_user uuid, p_solicitacao_id uuid, p_tipo text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  a record;
  v_nome text;
  v_cpf text;
  v_cargo text;
  v_png text;
  v_tipo text;
  v_id uuid;
BEGIN
  SELECT * INTO a FROM public.bd_assinaturas_usuarios
   WHERE usuario_id = p_user AND ativo = true
   ORDER BY updated_at DESC LIMIT 1;

  IF FOUND THEN
    v_nome  := a.nome_completo;
    v_cpf   := a.cpf;
    v_cargo := a.cargo;
    v_png   := a.assinatura_url;
    v_tipo  := p_tipo;
  ELSE
    -- Assinatura eletronica simples (aceite): nao bloqueia a operacao.
    SELECT nullif(trim(pr.nome_completo), ''), nullif(trim(pr.cargo), '')
      INTO v_nome, v_cargo
      FROM public.profiles pr
     WHERE pr.id = p_user;

    IF v_nome IS NULL THEN
      SELECT nullif(trim(f.nome_completo), ''), nullif(trim(f.funcao), '')
        INTO v_nome, v_cargo
        FROM public.profiles pr
        JOIN public.bd_funcionarios f ON f.id = pr.funcionario_id
       WHERE pr.id = p_user;
    END IF;

    IF v_nome IS NULL THEN
      RAISE EXCEPTION 'CT3E_USUARIO_SEM_NOME' USING ERRCODE='P0001',
        HINT='Complete seu nome no perfil para registrar o aceite eletronico.';
    END IF;

    v_cpf  := NULL;
    v_png  := NULL;
    v_tipo := p_tipo || '_ACEITE';
  END IF;

  INSERT INTO public.bd_assinaturas (solicitacao_id, usuario_id, nome_usuario, cargo,
      assinatura_png, ip, hash_assinatura, data_assinatura, tipo_assinatura, cpf)
  VALUES (p_solicitacao_id, p_user, v_nome, v_cargo, v_png,
      coalesce(inet_client_addr()::text,'desconhecido'),
      encode(extensions.digest(coalesce(v_nome,'')||'|'||coalesce(v_cpf,'')||'|'||v_tipo||'|'||now()::text, 'sha256'), 'hex'),
      now(), v_tipo, v_cpf)
  RETURNING id INTO v_id;

  RETURN v_id;
END
$function$;