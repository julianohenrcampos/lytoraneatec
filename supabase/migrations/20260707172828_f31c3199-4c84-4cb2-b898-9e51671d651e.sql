CREATE OR REPLACE FUNCTION public.fn_gerar_ordem_diaria_rascunho(p_planejamento_id uuid, p_data_ordem date, p_responsavel_funcionario_id uuid, p_responsavel_profile_id uuid, p_atividade_ids uuid[], p_observacao_geral text, p_responsaveis_por_item jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
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
  v_at record;
  v_ordem_exec int := 0;
  v_resp_item jsonb;
  v_resp_item_func uuid;
  v_resp_item_prof uuid;
  v_resp_item_nome text;
  v_resp_item_funcao text;
BEGIN
  SELECT centro_custo_id INTO v_cc
    FROM public.bd_planejamentos_obra
    WHERE id = p_planejamento_id;
  IF v_cc IS NULL THEN
    RAISE EXCEPTION 'Planejamento não encontrado';
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
        WHERE e.atividade_id = v_at.id AND COALESCE(e.ativo, true)
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