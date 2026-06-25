
-- Atualiza RPC fn_atualizar_progresso_manual_atividade para sincronizar status
-- da atividade com o percentual manual informado, preservando 'cancelada' e
-- 'atrasada' (esta só sai automaticamente quando atinge 100%).

CREATE OR REPLACE FUNCTION public.fn_atualizar_progresso_manual_atividade(
  p_atividade_id uuid,
  p_percentual numeric,
  p_observacao text
)
RETURNS public.bd_planejamento_atividades
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_super boolean;
  v_cc uuid;
  v_old RECORD;
  v_new public.bd_planejamento_atividades;
  v_nova_fonte text;
  v_status_novo text;
  v_campos text[] := ARRAY[]::text[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  v_super := public.fn_is_super_admin(v_uid);

  IF NOT (v_super
          OR public.user_has_permission_action(v_uid, 'engenharia_planejamento_progresso_manual', 'editar')) THEN
    RAISE EXCEPTION 'Sem permissão para atualizar progresso manual' USING ERRCODE = '42501';
  END IF;

  IF p_percentual IS NOT NULL AND (p_percentual < 0 OR p_percentual > 100) THEN
    RAISE EXCEPTION 'Percentual deve estar entre 0 e 100' USING ERRCODE = 'P0001';
  END IF;

  SELECT a.*, po.centro_custo_id AS cc_id
    INTO v_old
    FROM public.bd_planejamento_atividades a
    JOIN public.bd_planejamentos_obra po ON po.id = a.planejamento_id
   WHERE a.id = p_atividade_id
   FOR UPDATE OF a;

  IF v_old.id IS NULL THEN
    RAISE EXCEPTION 'Atividade não encontrada' USING ERRCODE = 'P0002';
  END IF;

  v_cc := v_old.cc_id;

  IF NOT v_super AND NOT EXISTS (
    SELECT 1 FROM public.fn_planejamento_scope_centros_custo(v_uid) s WHERE s = v_cc
  ) THEN
    RAISE EXCEPTION 'Centro de Custo da atividade fora do seu escopo' USING ERRCODE = '42501';
  END IF;

  v_nova_fonte := CASE
    WHEN p_percentual IS NOT NULL THEN 'manual'
    WHEN v_old.percentual_concluido_importado IS NOT NULL THEN 'importado'
    ELSE NULL
  END;

  -- Derivar novo status conforme regra aprovada
  IF v_old.status = 'cancelada' THEN
    v_status_novo := 'cancelada';
  ELSIF p_percentual IS NULL THEN
    v_status_novo := v_old.status;
  ELSIF v_old.status = 'atrasada' THEN
    IF p_percentual = 100 THEN
      v_status_novo := 'concluida';
    ELSE
      v_status_novo := 'atrasada';
    END IF;
  ELSE
    IF p_percentual = 0 THEN
      v_status_novo := 'planejada';
    ELSIF p_percentual = 100 THEN
      v_status_novo := 'concluida';
    ELSE
      v_status_novo := 'em_andamento';
    END IF;
  END IF;

  PERFORM set_config('app.progresso_manual_rpc', '1', true);

  UPDATE public.bd_planejamento_atividades
     SET percentual_manual = p_percentual,
         percentual_manual_observacao = NULLIF(btrim(coalesce(p_observacao,'')), ''),
         percentual_manual_atualizado_por = v_uid,
         percentual_manual_atualizado_em = now(),
         fonte_progresso = v_nova_fonte,
         status = v_status_novo
   WHERE id = p_atividade_id
   RETURNING * INTO v_new;

  PERFORM set_config('app.progresso_manual_rpc', '0', true);

  IF v_old.percentual_manual IS DISTINCT FROM v_new.percentual_manual THEN
    v_campos := array_append(v_campos, 'percentual_manual');
  END IF;
  IF v_old.percentual_manual_observacao IS DISTINCT FROM v_new.percentual_manual_observacao THEN
    v_campos := array_append(v_campos, 'percentual_manual_observacao');
  END IF;
  IF v_old.fonte_progresso IS DISTINCT FROM v_new.fonte_progresso THEN
    v_campos := array_append(v_campos, 'fonte_progresso');
  END IF;
  IF v_old.status IS DISTINCT FROM v_new.status THEN
    v_campos := array_append(v_campos, 'status');
  END IF;

  INSERT INTO public.bd_auditoria_log(
    tabela, registro_id, operacao, dados_anteriores, dados_novos, campos_alterados, usuario_id
  ) VALUES (
    'bd_planejamento_atividades',
    p_atividade_id::text,
    'UPDATE',
    jsonb_build_object(
      'atividade_id', v_old.id,
      'planejamento_id', v_old.planejamento_id,
      'percentual_manual', v_old.percentual_manual,
      'percentual_manual_observacao', v_old.percentual_manual_observacao,
      'percentual_manual_atualizado_por', v_old.percentual_manual_atualizado_por,
      'percentual_manual_atualizado_em', v_old.percentual_manual_atualizado_em,
      'fonte_progresso', v_old.fonte_progresso,
      'status', v_old.status
    ),
    jsonb_build_object(
      'atividade_id', v_new.id,
      'planejamento_id', v_new.planejamento_id,
      'percentual_manual', v_new.percentual_manual,
      'percentual_manual_observacao', v_new.percentual_manual_observacao,
      'percentual_manual_atualizado_por', v_new.percentual_manual_atualizado_por,
      'percentual_manual_atualizado_em', v_new.percentual_manual_atualizado_em,
      'fonte_progresso', v_new.fonte_progresso,
      'status', v_new.status
    ),
    v_campos,
    v_uid
  );

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_atualizar_progresso_manual_atividade(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_atualizar_progresso_manual_atividade(uuid, numeric, text) TO authenticated;
