CREATE OR REPLACE FUNCTION public.fn_chamado_interno_confirmar_encerramento(p_chamado_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_ant public.bd_chamados_internos%ROWTYPE;
  v_nov public.bd_chamados_internos%ROWTYPE;
  v_is_admin boolean;
  v_is_requester_actor boolean;
  v_fid uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE='28000'; END IF;
  IF p_chamado_id IS NULL THEN RAISE EXCEPTION 'parametros_obrigatorios' USING ERRCODE='22004'; END IF;
  SELECT c.* INTO v_ant FROM public.bd_chamados_internos c WHERE c.id=p_chamado_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'chamado_inexistente' USING ERRCODE='P0002'; END IF;

  v_fid := public.get_user_funcionario_id(v_uid);
  v_is_admin := public.user_has_permission_action(v_uid,'chamados_internos_admin','editar') IS TRUE;
  v_is_requester_actor :=
    (public.user_has_permission_action(v_uid,'chamados_internos_abrir','editar') IS TRUE)
    AND (
      v_ant.aberto_por = v_uid
      OR (v_fid IS NOT NULL AND v_ant.solicitante_funcionario_id = v_fid)
    );
  IF public.user_has_permission_action(v_uid,'chamados_internos_view','visualizar') IS NOT TRUE
     OR (v_is_admin OR v_is_requester_actor) IS NOT TRUE THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;

  IF v_ant.status NOT IN ('resolvido','respondido','aguardando_solicitante','reaberto') THEN
    RAISE EXCEPTION 'estado_invalido_para_transicao' USING ERRCODE='P0001';
  END IF;

  -- Confirmação do solicitante em estado ainda não resolvido implica resolução:
  -- registra o marco de resolução antes do encerramento para alimentar MTTR/SLA.
  IF v_ant.status <> 'resolvido' THEN
    INSERT INTO public.bd_chamado_interno_eventos (chamado_id,tipo,autor_profile_id,mensagem,status_anterior,status_novo,visivel_solicitante,payload)
    VALUES (p_chamado_id,'resolucao',v_uid,'Resolução confirmada pelo solicitante.',v_ant.status,'resolvido',true,
            jsonb_build_object('origem','confirmacao_solicitante'));
    UPDATE public.bd_chamados_internos AS c SET status='resolvido' WHERE c.id=p_chamado_id;
  END IF;

  UPDATE public.bd_chamados_internos AS c SET status='encerrado' WHERE c.id=p_chamado_id RETURNING c.* INTO v_nov;
  INSERT INTO public.bd_chamado_interno_eventos (chamado_id,tipo,autor_profile_id,mensagem,status_anterior,status_novo,visivel_solicitante,payload)
  VALUES (p_chamado_id,'confirmacao_encerramento',v_uid,'Encerramento confirmado.','resolvido','encerrado',true,'{}'::jsonb);
  INSERT INTO public.bd_auditoria_log (tabela,registro_id,operacao,dados_anteriores,dados_novos,campos_alterados,usuario_id)
  VALUES ('bd_chamados_internos',p_chamado_id::text,'UPDATE',to_jsonb(v_ant),
          to_jsonb(v_nov)||jsonb_build_object('acao_chamado','confirmar_encerramento'),ARRAY['status'],v_uid);
END;
$function$;