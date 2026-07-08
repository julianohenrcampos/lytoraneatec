
-- FASE A: bloqueio de Ordem Diária retroativa (Brasil/São Paulo).
-- Sem alterações em schema, RLS, triggers, constraints.

-- 1) fn_gerar_ordem_diaria_rascunho
CREATE OR REPLACE FUNCTION public.fn_gerar_ordem_diaria_rascunho(
  p_planejamento_id uuid,
  p_data_ordem date,
  p_responsavel_funcionario_id uuid,
  p_responsavel_profile_id uuid,
  p_atividade_ids uuid[],
  p_observacao_geral text,
  p_responsaveis_por_item jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ordem_id uuid;
  v_cc uuid;
  v_semana_inicio date;
  v_semana_fim date;
  v_resp_nome text;
  v_resp_funcao text;
  v_uid uuid := auth.uid();
  v_super boolean;
  v_at record;
  v_ordem_exec int := 0;
  v_resp_item jsonb;
  v_resp_item_func uuid;
  v_resp_item_prof uuid;
  v_resp_item_nome text;
  v_resp_item_funcao text;
  v_hoje_br date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE='42501';
  END IF;

  v_super := public.fn_is_super_admin(v_uid);

  IF NOT (v_super OR public.user_has_permission_action(v_uid,'engenharia_ordem_diaria_manage','criar')) THEN
    RAISE EXCEPTION 'Sem permissão para criar Ordem Diária' USING ERRCODE='42501';
  END IF;

  -- FASE A: bloqueio retroativo
  IF p_data_ordem IS NULL OR p_data_ordem < v_hoje_br THEN
    RAISE EXCEPTION 'Não é possível gerar Ordem Diária retroativa.' USING ERRCODE='P0001';
  END IF;

  IF p_atividade_ids IS NULL OR cardinality(p_atividade_ids) = 0 THEN
    RAISE EXCEPTION 'Selecione ao menos uma atividade' USING ERRCODE='P0001';
  END IF;

  SELECT centro_custo_id INTO v_cc
    FROM public.bd_planejamentos_obra
    WHERE id = p_planejamento_id;
  IF v_cc IS NULL THEN
    RAISE EXCEPTION 'Planejamento não encontrado' USING ERRCODE='P0002';
  END IF;

  IF NOT v_super AND NOT EXISTS (
    SELECT 1
      FROM public.fn_planejamento_scope_centros_custo(v_uid) AS s(cc)
     WHERE s.cc = v_cc
  ) THEN
    RAISE EXCEPTION 'Centro de Custo fora do seu escopo' USING ERRCODE='42501';
  END IF;

  v_semana_inicio := p_data_ordem - ((EXTRACT(ISODOW FROM p_data_ordem)::int - 1));
  v_semana_fim := v_semana_inicio + 6;

  IF p_responsavel_funcionario_id IS NOT NULL THEN
    SELECT f.nome_completo, fn.nome_funcao
      INTO v_resp_nome, v_resp_funcao
      FROM public.bd_funcionarios f
      LEFT JOIN public.bd_funcoes fn ON fn.id = f.funcao_id
      WHERE f.id = p_responsavel_funcionario_id;
  ELSIF p_responsavel_profile_id IS NOT NULL THEN
    SELECT COALESCE(p.full_name, p.email) INTO v_resp_nome
      FROM public.profiles p
      WHERE p.id = p_responsavel_profile_id;
  END IF;

  INSERT INTO public.bd_ordens_diarias_obra (
    centro_custo_id, planejamento_id, data_ordem, semana_inicio, semana_fim,
    responsavel_funcionario_id, responsavel_profile_id,
    responsavel_nome_snapshot, responsavel_funcao_snapshot,
    status, observacao_geral, criado_por
  ) VALUES (
    v_cc, p_planejamento_id, p_data_ordem, v_semana_inicio, v_semana_fim,
    p_responsavel_funcionario_id, p_responsavel_profile_id,
    v_resp_nome, v_resp_funcao,
    'rascunho', p_observacao_geral, v_uid
  )
  RETURNING id INTO v_ordem_id;

  FOR v_at IN
    SELECT a.*
      FROM public.bd_planejamento_atividades a
     WHERE a.planejamento_id = p_planejamento_id
       AND a.id = ANY(p_atividade_ids)
     ORDER BY a.ordem_execucao NULLS LAST, a.data_inicio NULLS LAST, a.nome
  LOOP
    v_ordem_exec := v_ordem_exec + 1;

    v_resp_item := p_responsaveis_por_item -> v_at.id::text;
    v_resp_item_func := NULL;
    v_resp_item_prof := NULL;
    v_resp_item_nome := NULL;
    v_resp_item_funcao := NULL;

    IF v_resp_item IS NOT NULL THEN
      v_resp_item_func := NULLIF(v_resp_item->>'funcionario_id','')::uuid;
      v_resp_item_prof := NULLIF(v_resp_item->>'profile_id','')::uuid;
    END IF;
    IF v_resp_item_func IS NULL AND v_resp_item_prof IS NULL THEN
      v_resp_item_func := p_responsavel_funcionario_id;
      v_resp_item_prof := p_responsavel_profile_id;
    END IF;

    IF v_resp_item_func IS NOT NULL THEN
      SELECT f.nome_completo, fn.nome_funcao
        INTO v_resp_item_nome, v_resp_item_funcao
        FROM public.bd_funcionarios f
        LEFT JOIN public.bd_funcoes fn ON fn.id = f.funcao_id
        WHERE f.id = v_resp_item_func;
    ELSIF v_resp_item_prof IS NOT NULL THEN
      SELECT COALESCE(p.full_name, p.email) INTO v_resp_item_nome
        FROM public.profiles p
        WHERE p.id = v_resp_item_prof;
    END IF;

    INSERT INTO public.bd_ordens_diarias_obra_itens (
      ordem_id, atividade_id, ordem_execucao,
      nome_atividade_snapshot, codigo_eap_snapshot, frente_servico_snapshot,
      status_atividade_snapshot, percentual_snapshot, fonte_progresso_snapshot,
      equipe_snapshot, equipamentos_snapshot, materiais_snapshot, pendencias_snapshot,
      observacao_item,
      responsavel_item_funcionario_id, responsavel_item_profile_id,
      responsavel_item_nome_snapshot, responsavel_item_funcao_snapshot,
      atividade_is_critica_snapshot,
      atividade_quantidade_planejada_snapshot,
      atividade_unidade_medida_snapshot
    ) VALUES (
      v_ordem_id, v_at.id, v_ordem_exec,
      v_at.nome,
      COALESCE(v_at.outline_number, v_at.codigo_wbs),
      v_at.frente_servico,
      v_at.status,
      COALESCE(v_at.percentual_manual, v_at.percentual_concluido_importado),
      v_at.fonte_progresso,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'funcionario_id', e.funcionario_id,
          'nome', f.nome_completo,
          'funcao_id', e.funcao_id,
          'funcao', fn.nome_funcao,
          'papel_na_tarefa', e.papel_na_tarefa,
          'dias_previstos', e.dias_previstos,
          'horas_previstas', e.horas_previstas
        ))
        FROM public.bd_planejamento_atividade_equipe e
        LEFT JOIN public.bd_funcionarios f ON f.id = e.funcionario_id
        LEFT JOIN public.bd_funcoes fn ON fn.id = e.funcao_id
        WHERE e.atividade_id = v_at.id AND e.status <> 'cancelado'
      ), '[]'::jsonb),
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'descricao', r.descricao, 'unidade', r.unidade,
          'quantidade', r.quantidade_prevista, 'grupo', r.grupo, 'familia', r.familia
        ))
        FROM public.bd_planejamento_recursos r
        WHERE r.atividade_id = v_at.id AND r.tipo_recurso IN ('equipamento','EQ')
      ), '[]'::jsonb),
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'descricao', r.descricao, 'unidade', r.unidade,
          'quantidade', r.quantidade_prevista, 'grupo', r.grupo, 'familia', r.familia
        ))
        FROM public.bd_planejamento_recursos r
        WHERE r.atividade_id = v_at.id AND r.tipo_recurso IN ('material','MAT')
      ), '[]'::jsonb),
      '[]'::jsonb,
      NULL,
      v_resp_item_func, v_resp_item_prof, v_resp_item_nome, v_resp_item_funcao,
      COALESCE(v_at.is_critica, false),
      v_at.quantidade_prevista,
      v_at.unidade
    );
  END LOOP;

  RETURN v_ordem_id;
END;
$function$;


-- 2) fn_atualizar_ordem_diaria_rascunho
CREATE OR REPLACE FUNCTION public.fn_atualizar_ordem_diaria_rascunho(
  p_ordem_id uuid,
  p_responsavel_funcionario_id uuid,
  p_responsavel_profile_id uuid,
  p_atividade_ids uuid[],
  p_observacao_geral text,
  p_observacao_por_item jsonb,
  p_responsaveis_por_item jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_super boolean; v_old public.bd_ordens_diarias_obra%ROWTYPE;
  v_nome text; v_funcao text; v_aid uuid; v_snap jsonb; v_obs text;
  v_resp_func_id uuid; v_resp_prof_id uuid;
  v_item_nome text; v_item_funcao text;
  v_validas uuid[];
  v_hoje_br date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado' USING ERRCODE='42501'; END IF;
  v_super := public.fn_is_super_admin(v_uid);
  IF NOT (v_super OR public.user_has_permission_action(v_uid,'engenharia_ordem_diaria_manage','editar')) THEN
    RAISE EXCEPTION 'Sem permissão para editar Ordem Diária' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_old FROM public.bd_ordens_diarias_obra WHERE id = p_ordem_id FOR UPDATE;
  IF v_old.id IS NULL THEN RAISE EXCEPTION 'Ordem não encontrada' USING ERRCODE='P0002'; END IF;
  IF v_old.status <> 'rascunho' THEN RAISE EXCEPTION 'Apenas rascunhos podem ser editados' USING ERRCODE='P0001'; END IF;

  -- FASE A: bloqueio retroativo
  IF v_old.data_ordem < v_hoje_br THEN
    RAISE EXCEPTION 'Não é possível atualizar Ordem Diária retroativa.' USING ERRCODE='P0001';
  END IF;

  IF NOT v_super AND NOT EXISTS (
    SELECT 1 FROM public.fn_planejamento_scope_centros_custo(v_uid) s WHERE s = v_old.centro_custo_id
  ) THEN
    RAISE EXCEPTION 'Centro de Custo fora do seu escopo' USING ERRCODE='42501';
  END IF;

  IF p_atividade_ids IS NULL OR cardinality(p_atividade_ids) = 0 THEN
    RAISE EXCEPTION 'Selecione ao menos uma atividade' USING ERRCODE='P0001';
  END IF;

  -- Validar que todas as atividades pertencem ao planejamento da ordem
  SELECT array_agg(a.id) INTO v_validas
    FROM public.bd_planejamento_atividades a
   WHERE a.planejamento_id = v_old.planejamento_id AND a.id = ANY(p_atividade_ids);
  IF v_validas IS NULL OR cardinality(v_validas) <> cardinality(p_atividade_ids) THEN
    RAISE EXCEPTION 'Atividade(s) selecionada(s) não pertencem ao planejamento' USING ERRCODE='P0001';
  END IF;

  SELECT nome, funcao INTO v_nome, v_funcao
    FROM public.fn_ordem_diaria_resolver_responsavel(p_responsavel_funcionario_id, p_responsavel_profile_id);

  PERFORM set_config('app.ordem_diaria_rpc','1',true);

  UPDATE public.bd_ordens_diarias_obra
     SET responsavel_funcionario_id = p_responsavel_funcionario_id,
         responsavel_profile_id = p_responsavel_profile_id,
         responsavel_nome_snapshot = v_nome,
         responsavel_funcao_snapshot = v_funcao,
         observacao_geral = NULLIF(btrim(coalesce(p_observacao_geral,'')),'')
   WHERE id = p_ordem_id;

  DELETE FROM public.bd_ordens_diarias_obra_itens
   WHERE ordem_id = p_ordem_id
     AND (atividade_id IS NULL OR atividade_id <> ALL(p_atividade_ids));

  FOREACH v_aid IN ARRAY p_atividade_ids LOOP
    v_snap := public.fn_ordem_diaria_build_item_snapshot(v_aid);
    IF v_snap IS NULL THEN CONTINUE; END IF;
    v_obs := p_observacao_por_item ->> v_aid::text;

    v_resp_func_id := NULL; v_resp_prof_id := NULL;
    IF p_responsaveis_por_item IS NOT NULL AND p_responsaveis_por_item ? v_aid::text THEN
      v_resp_func_id := NULLIF(p_responsaveis_por_item -> v_aid::text ->> 'funcionario_id','')::uuid;
      v_resp_prof_id := NULLIF(p_responsaveis_por_item -> v_aid::text ->> 'profile_id','')::uuid;
      IF v_resp_func_id IS NOT NULL THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.bd_funcionarios f
           WHERE f.id = v_resp_func_id AND f.centro_custo_id = v_old.centro_custo_id
        ) THEN
          RAISE EXCEPTION 'Responsável da tarefa (%) não pertence ao CC da ordem', v_resp_func_id USING ERRCODE='P0001';
        END IF;
      END IF;
    END IF;
    IF v_resp_func_id IS NULL AND v_resp_prof_id IS NULL THEN
      v_resp_func_id := p_responsavel_funcionario_id;
      v_resp_prof_id := p_responsavel_profile_id;
    END IF;

    v_item_nome := NULL; v_item_funcao := NULL;
    SELECT nome, funcao INTO v_item_nome, v_item_funcao
      FROM public.fn_ordem_diaria_resolver_responsavel(v_resp_func_id, v_resp_prof_id);

    IF EXISTS (SELECT 1 FROM public.bd_ordens_diarias_obra_itens WHERE ordem_id = p_ordem_id AND atividade_id = v_aid) THEN
      UPDATE public.bd_ordens_diarias_obra_itens
         SET nome_atividade_snapshot = v_snap->>'nome_atividade_snapshot',
             codigo_eap_snapshot = v_snap->>'codigo_eap_snapshot',
             frente_servico_snapshot = v_snap->>'frente_servico_snapshot',
             status_atividade_snapshot = v_snap->>'status_atividade_snapshot',
             percentual_snapshot = NULLIF(v_snap->>'percentual_snapshot','')::numeric,
             fonte_progresso_snapshot = v_snap->>'fonte_progresso_snapshot',
             equipe_snapshot = COALESCE(v_snap->'equipe_snapshot','[]'::jsonb),
             equipamentos_snapshot = COALESCE(v_snap->'equipamentos_snapshot','[]'::jsonb),
             materiais_snapshot = COALESCE(v_snap->'materiais_snapshot','[]'::jsonb),
             observacao_item = COALESCE(v_obs, observacao_item),
             responsavel_item_funcionario_id = v_resp_func_id,
             responsavel_item_profile_id = v_resp_prof_id,
             responsavel_item_nome_snapshot = v_item_nome,
             responsavel_item_funcao_snapshot = v_item_funcao
       WHERE ordem_id = p_ordem_id AND atividade_id = v_aid;
    ELSE
      INSERT INTO public.bd_ordens_diarias_obra_itens(
        ordem_id, atividade_id,
        nome_atividade_snapshot, codigo_eap_snapshot, frente_servico_snapshot,
        status_atividade_snapshot, percentual_snapshot, fonte_progresso_snapshot,
        equipe_snapshot, equipamentos_snapshot, materiais_snapshot, observacao_item,
        responsavel_item_funcionario_id, responsavel_item_profile_id,
        responsavel_item_nome_snapshot, responsavel_item_funcao_snapshot
      ) VALUES (
        p_ordem_id, v_aid,
        v_snap->>'nome_atividade_snapshot',
        v_snap->>'codigo_eap_snapshot',
        v_snap->>'frente_servico_snapshot',
        v_snap->>'status_atividade_snapshot',
        NULLIF(v_snap->>'percentual_snapshot','')::numeric,
        v_snap->>'fonte_progresso_snapshot',
        COALESCE(v_snap->'equipe_snapshot','[]'::jsonb),
        COALESCE(v_snap->'equipamentos_snapshot','[]'::jsonb),
        COALESCE(v_snap->'materiais_snapshot','[]'::jsonb),
        v_obs,
        v_resp_func_id, v_resp_prof_id, v_item_nome, v_item_funcao
      );
    END IF;
  END LOOP;

  PERFORM set_config('app.ordem_diaria_rpc','0',true);

  INSERT INTO public.bd_auditoria_log(tabela, registro_id, operacao, dados_anteriores, dados_novos, campos_alterados, usuario_id)
  VALUES ('bd_ordens_diarias_obra', p_ordem_id::text, 'UPDATE',
    jsonb_build_object('responsavel_nome', v_old.responsavel_nome_snapshot, 'observacao_geral', v_old.observacao_geral),
    jsonb_build_object('responsavel_nome', v_nome, 'observacao_geral', p_observacao_geral, 'atividades', to_jsonb(p_atividade_ids)),
    ARRAY['responsavel','observacao_geral','itens']::text[], v_uid);
END;
$function$;


-- 3) fn_emitir_ordem_diaria
CREATE OR REPLACE FUNCTION public.fn_emitir_ordem_diaria(p_ordem_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_super boolean; v_old public.bd_ordens_diarias_obra%ROWTYPE;
  v_count int; v_item record; v_snap jsonb;
  v_hoje_br date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado' USING ERRCODE='42501'; END IF;
  v_super := public.fn_is_super_admin(v_uid);
  IF NOT (v_super OR public.user_has_permission_action(v_uid,'engenharia_ordem_diaria_emitir','aprovar')) THEN
    RAISE EXCEPTION 'Sem permissão para emitir Ordem Diária' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_old FROM public.bd_ordens_diarias_obra WHERE id = p_ordem_id FOR UPDATE;
  IF v_old.id IS NULL THEN RAISE EXCEPTION 'Ordem não encontrada' USING ERRCODE='P0002'; END IF;
  IF v_old.status <> 'rascunho' THEN RAISE EXCEPTION 'Apenas rascunhos podem ser emitidos' USING ERRCODE='P0001'; END IF;

  -- FASE A: bloqueio retroativo
  IF v_old.data_ordem < v_hoje_br THEN
    RAISE EXCEPTION 'Não é possível emitir Ordem Diária retroativa. Replaneje a atividade para uma data atual ou futura.' USING ERRCODE='P0001';
  END IF;

  IF v_old.responsavel_funcionario_id IS NULL AND v_old.responsavel_profile_id IS NULL THEN
    RAISE EXCEPTION 'Defina um responsável antes de emitir' USING ERRCODE='P0001';
  END IF;
  IF NOT v_super AND NOT EXISTS (
    SELECT 1 FROM public.fn_planejamento_scope_centros_custo(v_uid) s WHERE s = v_old.centro_custo_id
  ) THEN
    RAISE EXCEPTION 'Centro de Custo fora do seu escopo' USING ERRCODE='42501';
  END IF;

  SELECT count(*) INTO v_count FROM public.bd_ordens_diarias_obra_itens WHERE ordem_id = p_ordem_id;
  IF v_count = 0 THEN RAISE EXCEPTION 'Ordem sem itens não pode ser emitida' USING ERRCODE='P0001'; END IF;

  PERFORM set_config('app.ordem_diaria_rpc','1',true);

  FOR v_item IN
    SELECT id, atividade_id FROM public.bd_ordens_diarias_obra_itens WHERE ordem_id = p_ordem_id
  LOOP
    IF v_item.atividade_id IS NULL THEN CONTINUE; END IF;
    v_snap := public.fn_ordem_diaria_build_item_snapshot(v_item.atividade_id);
    IF v_snap IS NULL THEN CONTINUE; END IF;
    UPDATE public.bd_ordens_diarias_obra_itens
       SET nome_atividade_snapshot = v_snap->>'nome_atividade_snapshot',
           codigo_eap_snapshot = v_snap->>'codigo_eap_snapshot',
           frente_servico_snapshot = v_snap->>'frente_servico_snapshot',
           status_atividade_snapshot = v_snap->>'status_atividade_snapshot',
           percentual_snapshot = NULLIF(v_snap->>'percentual_snapshot','')::numeric,
           fonte_progresso_snapshot = v_snap->>'fonte_progresso_snapshot',
           equipe_snapshot = COALESCE(v_snap->'equipe_snapshot','[]'::jsonb),
           equipamentos_snapshot = COALESCE(v_snap->'equipamentos_snapshot','[]'::jsonb),
           materiais_snapshot = COALESCE(v_snap->'materiais_snapshot','[]'::jsonb)
     WHERE id = v_item.id;
  END LOOP;

  UPDATE public.bd_ordens_diarias_obra
     SET status='emitida', emitido_por=v_uid, emitido_em=now()
   WHERE id = p_ordem_id;

  PERFORM set_config('app.ordem_diaria_rpc','0',true);

  INSERT INTO public.bd_auditoria_log(tabela, registro_id, operacao, dados_anteriores, dados_novos, campos_alterados, usuario_id)
  VALUES ('bd_ordens_diarias_obra', p_ordem_id::text, 'UPDATE',
    jsonb_build_object('status', v_old.status),
    jsonb_build_object('status','emitida','emitido_em', now()),
    ARRAY['status','emitido_por','emitido_em']::text[], v_uid);
END;
$function$;
