
-- =====================================================================
-- Ordem Diária 1B — Responsável por item + validação JSONB
-- =====================================================================

-- 1. Novas colunas no item
ALTER TABLE public.bd_ordens_diarias_obra_itens
  ADD COLUMN IF NOT EXISTS responsavel_item_funcionario_id uuid REFERENCES public.bd_funcionarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS responsavel_item_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS responsavel_item_nome_snapshot text,
  ADD COLUMN IF NOT EXISTS responsavel_item_funcao_snapshot text;

CREATE INDEX IF NOT EXISTS ix_ordens_diarias_itens_resp_func
  ON public.bd_ordens_diarias_obra_itens (responsavel_item_funcionario_id);

-- 2. Helper para resolver nome/função de funcionário (reutilizado nas RPCs)
CREATE OR REPLACE FUNCTION public.fn_ordem_diaria_resolver_responsavel(
  p_funcionario_id uuid,
  p_profile_id uuid
) RETURNS TABLE(nome text, funcao text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF p_funcionario_id IS NOT NULL THEN
    RETURN QUERY
      SELECT f.nome_completo, fn.nome_funcao
        FROM public.bd_funcionarios f
        LEFT JOIN public.bd_funcoes fn ON fn.id = f.funcao_id
       WHERE f.id = p_funcionario_id;
  ELSIF p_profile_id IS NOT NULL THEN
    RETURN QUERY
      SELECT p.nome_completo::text, NULL::text FROM public.profiles p WHERE p.id = p_profile_id;
  ELSE
    RETURN;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.fn_ordem_diaria_resolver_responsavel(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_ordem_diaria_resolver_responsavel(uuid,uuid) TO authenticated;

-- 3. DROP assinaturas antigas e recriar com novo parâmetro p_responsaveis_por_item

DROP FUNCTION IF EXISTS public.fn_gerar_ordem_diaria_rascunho(uuid,date,uuid,uuid,uuid[],text);
DROP FUNCTION IF EXISTS public.fn_atualizar_ordem_diaria_rascunho(uuid,uuid,uuid,uuid[],text,jsonb);

-- 3.1 GERAR RASCUNHO
CREATE OR REPLACE FUNCTION public.fn_gerar_ordem_diaria_rascunho(
  p_planejamento_id uuid,
  p_data_ordem date,
  p_responsavel_funcionario_id uuid,
  p_responsavel_profile_id uuid,
  p_atividade_ids uuid[],
  p_observacao_geral text,
  p_responsaveis_por_item jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_super boolean; v_cc uuid; v_inicio date; v_fim date;
  v_ordem_id uuid;
  v_nome text; v_funcao text;
  v_aid uuid; v_snap jsonb;
  v_resp_func_id uuid; v_resp_prof_id uuid;
  v_item_nome text; v_item_funcao text;
  v_validas uuid[];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado' USING ERRCODE='42501'; END IF;
  v_super := public.fn_is_super_admin(v_uid);
  IF NOT (v_super OR public.user_has_permission_action(v_uid,'engenharia_ordem_diaria_manage','criar')) THEN
    RAISE EXCEPTION 'Sem permissão para criar Ordem Diária' USING ERRCODE='42501';
  END IF;
  IF p_atividade_ids IS NULL OR cardinality(p_atividade_ids) = 0 THEN
    RAISE EXCEPTION 'Selecione ao menos uma atividade' USING ERRCODE='P0001';
  END IF;

  SELECT centro_custo_id, periodo_inicio, periodo_fim INTO v_cc, v_inicio, v_fim
  FROM public.bd_planejamentos_obra WHERE id = p_planejamento_id;
  IF v_cc IS NULL THEN RAISE EXCEPTION 'Planejamento não encontrado' USING ERRCODE='P0002'; END IF;
  IF p_data_ordem < v_inicio OR p_data_ordem > v_fim THEN
    RAISE EXCEPTION 'Data da ordem fora do período do planejamento' USING ERRCODE='P0001';
  END IF;
  IF NOT v_super AND NOT EXISTS (
    SELECT 1 FROM public.fn_planejamento_scope_centros_custo(v_uid) s WHERE s = v_cc
  ) THEN
    RAISE EXCEPTION 'Centro de Custo fora do seu escopo' USING ERRCODE='42501';
  END IF;

  -- Validar que todas as atividades pertencem ao planejamento
  SELECT array_agg(a.id) INTO v_validas
    FROM public.bd_planejamento_atividades a
   WHERE a.planejamento_id = p_planejamento_id AND a.id = ANY(p_atividade_ids);
  IF v_validas IS NULL OR cardinality(v_validas) <> cardinality(p_atividade_ids) THEN
    RAISE EXCEPTION 'Atividade(s) selecionada(s) não pertencem ao planejamento' USING ERRCODE='P0001';
  END IF;

  -- Responsável principal
  SELECT nome, funcao INTO v_nome, v_funcao
    FROM public.fn_ordem_diaria_resolver_responsavel(p_responsavel_funcionario_id, p_responsavel_profile_id);

  PERFORM set_config('app.ordem_diaria_rpc','1',true);

  INSERT INTO public.bd_ordens_diarias_obra(
    centro_custo_id, planejamento_id, data_ordem, semana_inicio, semana_fim,
    responsavel_funcionario_id, responsavel_profile_id,
    responsavel_nome_snapshot, responsavel_funcao_snapshot,
    status, observacao_geral, criado_por
  ) VALUES (
    v_cc, p_planejamento_id, p_data_ordem,
    (date_trunc('week', p_data_ordem::timestamp)::date),
    (date_trunc('week', p_data_ordem::timestamp)::date + 6),
    p_responsavel_funcionario_id, p_responsavel_profile_id,
    v_nome, v_funcao,
    'rascunho', NULLIF(btrim(coalesce(p_observacao_geral,'')),''), v_uid
  ) RETURNING id INTO v_ordem_id;

  FOREACH v_aid IN ARRAY p_atividade_ids LOOP
    v_snap := public.fn_ordem_diaria_build_item_snapshot(v_aid);
    IF v_snap IS NULL THEN CONTINUE; END IF;

    -- Responsável específico (se informado)
    v_resp_func_id := NULL; v_resp_prof_id := NULL;
    IF p_responsaveis_por_item IS NOT NULL AND p_responsaveis_por_item ? v_aid::text THEN
      v_resp_func_id := NULLIF(p_responsaveis_por_item -> v_aid::text ->> 'funcionario_id','')::uuid;
      v_resp_prof_id := NULLIF(p_responsaveis_por_item -> v_aid::text ->> 'profile_id','')::uuid;

      -- Validar que funcionário existe e pertence ao mesmo CC
      IF v_resp_func_id IS NOT NULL THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.bd_funcionarios f
           WHERE f.id = v_resp_func_id AND f.centro_custo_id = v_cc
        ) THEN
          RAISE EXCEPTION 'Responsável da tarefa (%) não pertence ao CC da ordem', v_resp_func_id USING ERRCODE='P0001';
        END IF;
      END IF;
    END IF;

    -- Herda o responsável principal se nenhum específico foi definido
    IF v_resp_func_id IS NULL AND v_resp_prof_id IS NULL THEN
      v_resp_func_id := p_responsavel_funcionario_id;
      v_resp_prof_id := p_responsavel_profile_id;
    END IF;

    v_item_nome := NULL; v_item_funcao := NULL;
    SELECT nome, funcao INTO v_item_nome, v_item_funcao
      FROM public.fn_ordem_diaria_resolver_responsavel(v_resp_func_id, v_resp_prof_id);

    INSERT INTO public.bd_ordens_diarias_obra_itens(
      ordem_id, atividade_id,
      nome_atividade_snapshot, codigo_eap_snapshot, frente_servico_snapshot,
      status_atividade_snapshot, percentual_snapshot, fonte_progresso_snapshot,
      equipe_snapshot, equipamentos_snapshot, materiais_snapshot,
      responsavel_item_funcionario_id, responsavel_item_profile_id,
      responsavel_item_nome_snapshot, responsavel_item_funcao_snapshot
    ) VALUES (
      v_ordem_id, v_aid,
      v_snap->>'nome_atividade_snapshot',
      v_snap->>'codigo_eap_snapshot',
      v_snap->>'frente_servico_snapshot',
      v_snap->>'status_atividade_snapshot',
      NULLIF(v_snap->>'percentual_snapshot','')::numeric,
      v_snap->>'fonte_progresso_snapshot',
      COALESCE(v_snap->'equipe_snapshot','[]'::jsonb),
      COALESCE(v_snap->'equipamentos_snapshot','[]'::jsonb),
      COALESCE(v_snap->'materiais_snapshot','[]'::jsonb),
      v_resp_func_id, v_resp_prof_id, v_item_nome, v_item_funcao
    );
  END LOOP;

  PERFORM set_config('app.ordem_diaria_rpc','0',true);

  INSERT INTO public.bd_auditoria_log(tabela, registro_id, operacao, dados_anteriores, dados_novos, campos_alterados, usuario_id)
  VALUES ('bd_ordens_diarias_obra', v_ordem_id::text, 'INSERT', NULL,
    jsonb_build_object('status','rascunho','data_ordem',p_data_ordem,'atividades',to_jsonb(p_atividade_ids)),
    ARRAY['status','data_ordem','itens']::text[], v_uid);
  RETURN v_ordem_id;
END $$;

REVOKE ALL ON FUNCTION public.fn_gerar_ordem_diaria_rascunho(uuid,date,uuid,uuid,uuid[],text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_gerar_ordem_diaria_rascunho(uuid,date,uuid,uuid,uuid[],text,jsonb) TO authenticated;

-- 3.2 ATUALIZAR RASCUNHO
CREATE OR REPLACE FUNCTION public.fn_atualizar_ordem_diaria_rascunho(
  p_ordem_id uuid,
  p_responsavel_funcionario_id uuid,
  p_responsavel_profile_id uuid,
  p_atividade_ids uuid[],
  p_observacao_geral text,
  p_observacao_por_item jsonb,
  p_responsaveis_por_item jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_super boolean; v_old public.bd_ordens_diarias_obra%ROWTYPE;
  v_nome text; v_funcao text; v_aid uuid; v_snap jsonb; v_obs text;
  v_resp_func_id uuid; v_resp_prof_id uuid;
  v_item_nome text; v_item_funcao text;
  v_validas uuid[];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado' USING ERRCODE='42501'; END IF;
  v_super := public.fn_is_super_admin(v_uid);
  IF NOT (v_super OR public.user_has_permission_action(v_uid,'engenharia_ordem_diaria_manage','editar')) THEN
    RAISE EXCEPTION 'Sem permissão para editar Ordem Diária' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_old FROM public.bd_ordens_diarias_obra WHERE id = p_ordem_id FOR UPDATE;
  IF v_old.id IS NULL THEN RAISE EXCEPTION 'Ordem não encontrada' USING ERRCODE='P0002'; END IF;
  IF v_old.status <> 'rascunho' THEN RAISE EXCEPTION 'Apenas rascunhos podem ser editados' USING ERRCODE='P0001'; END IF;

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
END $$;

REVOKE ALL ON FUNCTION public.fn_atualizar_ordem_diaria_rascunho(uuid,uuid,uuid,uuid[],text,jsonb,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_atualizar_ordem_diaria_rascunho(uuid,uuid,uuid,uuid[],text,jsonb,jsonb) TO authenticated;

-- 3.3 EMITIR (preserva responsavel_item_* e observacao_item)
CREATE OR REPLACE FUNCTION public.fn_emitir_ordem_diaria(p_ordem_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_super boolean; v_old public.bd_ordens_diarias_obra%ROWTYPE;
  v_count int; v_item record; v_snap jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado' USING ERRCODE='42501'; END IF;
  v_super := public.fn_is_super_admin(v_uid);
  IF NOT (v_super OR public.user_has_permission_action(v_uid,'engenharia_ordem_diaria_emitir','aprovar')) THEN
    RAISE EXCEPTION 'Sem permissão para emitir Ordem Diária' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_old FROM public.bd_ordens_diarias_obra WHERE id = p_ordem_id FOR UPDATE;
  IF v_old.id IS NULL THEN RAISE EXCEPTION 'Ordem não encontrada' USING ERRCODE='P0002'; END IF;
  IF v_old.status <> 'rascunho' THEN RAISE EXCEPTION 'Apenas rascunhos podem ser emitidos' USING ERRCODE='P0001'; END IF;
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
    -- Regrava apenas snapshots operacionais; preserva responsavel_item_* e observacao_item
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
END $$;

REVOKE ALL ON FUNCTION public.fn_emitir_ordem_diaria(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_emitir_ordem_diaria(uuid) TO authenticated;
