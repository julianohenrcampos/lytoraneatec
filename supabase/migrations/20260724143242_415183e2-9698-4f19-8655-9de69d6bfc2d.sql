CREATE OR REPLACE FUNCTION public.fn_chamado_interno_assumir(p_chamado_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_ant public.bd_chamados_internos%ROWTYPE;
  v_nov public.bd_chamados_internos%ROWTYPE;
  v_campos_alterados text[];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE='28000'; END IF;
  IF p_chamado_id IS NULL THEN RAISE EXCEPTION 'parametros_obrigatorios' USING ERRCODE='22004'; END IF;
  SELECT c.* INTO v_ant FROM public.bd_chamados_internos c WHERE c.id=p_chamado_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'chamado_inexistente' USING ERRCODE='P0002'; END IF;
  IF public.fn_chamado_interno_can_operate(p_chamado_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  IF v_ant.status NOT IN ('aberto','em_triagem','em_analise','reaberto') THEN
    RAISE EXCEPTION 'estado_invalido_para_transicao' USING ERRCODE='P0001';
  END IF;
  IF v_ant.status='em_analise' AND v_ant.responsavel_atual_profile_id=v_uid THEN RETURN; END IF;
  IF v_ant.responsavel_atual_profile_id IS NOT NULL AND v_ant.responsavel_atual_profile_id<>v_uid THEN
    RAISE EXCEPTION 'chamado_ja_atribuido' USING ERRCODE='55000';
  END IF;

  UPDATE public.bd_chamados_internos AS c
  SET responsavel_atual_profile_id=v_uid, status='em_analise'
  WHERE c.id=p_chamado_id RETURNING c.* INTO v_nov;

  v_campos_alterados := ARRAY['responsavel_atual_profile_id'];
  IF v_ant.status IS DISTINCT FROM 'em_analise'::public.chamado_interno_status THEN
    v_campos_alterados := array_append(v_campos_alterados, 'status'::text);
  END IF;

  INSERT INTO public.bd_chamado_interno_eventos (chamado_id,tipo,autor_profile_id,mensagem,status_anterior,status_novo,visivel_solicitante,payload)
  VALUES (p_chamado_id,'atribuicao',v_uid,NULL,v_ant.status,'em_analise',true,'{}'::jsonb);
  INSERT INTO public.bd_auditoria_log (tabela,registro_id,operacao,dados_anteriores,dados_novos,campos_alterados,usuario_id)
  VALUES ('bd_chamados_internos',p_chamado_id::text,'UPDATE',to_jsonb(v_ant),
          to_jsonb(v_nov)||jsonb_build_object('acao_chamado','assumir'),v_campos_alterados,v_uid);
END;
$function$;

ALTER FUNCTION public.fn_chamado_interno_assumir(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fn_chamado_interno_assumir(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_chamado_interno_assumir(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_chamado_interno_assumir(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_chamado_interno_assumir(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';