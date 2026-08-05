
-- Fase B — Equipe Designada: UX simplificada + conflito com Diárias

-- Recriar fn_detectar_conflito_designacao com tipos novos e supressão de detalhes fora de escopo
DROP FUNCTION IF EXISTS public.fn_detectar_conflito_designacao(uuid, date, date, uuid);

CREATE OR REPLACE FUNCTION public.fn_detectar_conflito_designacao(
  p_funcionario_id uuid,
  p_semana_inicio date,
  p_semana_fim date,
  p_ignorar_id uuid DEFAULT NULL,
  p_cc_atividade uuid DEFAULT NULL
) RETURNS TABLE(
  tipo_conflito text,
  id uuid,
  atividade_id uuid,
  semana_inicio date,
  semana_fim date,
  centro_custo_id uuid,
  tem_escopo boolean,
  motivo text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_super boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado' USING ERRCODE='42501'; END IF;
  v_super := fn_is_super_admin(v_uid);
  IF NOT (v_super
          OR user_has_permission_action(v_uid,'engenharia_planejamento_equipe_view','visualizar')
          OR user_has_permission_action(v_uid,'engenharia_planejamento_equipe_manage','criar')) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501';
  END IF;

  -- 1) Conflito com equipe designada (overlap de período)
  RETURN QUERY
  SELECT
    'equipe'::text,
    e.id,
    e.atividade_id,
    e.semana_inicio,
    e.semana_fim,
    e.centro_custo_id,
    (v_super OR EXISTS (
      SELECT 1 FROM public.fn_planejamento_scope_centros_custo(v_uid) s WHERE s = e.centro_custo_id
    )) AS tem_escopo,
    CASE
      WHEN v_super OR EXISTS (
        SELECT 1 FROM public.fn_planejamento_scope_centros_custo(v_uid) s WHERE s = e.centro_custo_id
      ) THEN 'Funcionário já designado em outra atividade neste período.'
      ELSE 'Funcionário já possui conflito no período.'
    END
  FROM public.bd_planejamento_atividade_equipe e
  WHERE e.funcionario_id = p_funcionario_id
    AND e.status IN ('rascunho','confirmado')
    AND (p_ignorar_id IS NULL OR e.id <> p_ignorar_id)
    AND daterange(e.semana_inicio, e.semana_fim, '[]') && daterange(p_semana_inicio, p_semana_fim, '[]');

  -- 2) Presença real em diária em outro CC (BLOQUEIA na designação)
  IF p_cc_atividade IS NOT NULL THEN
    RETURN QUERY
    SELECT
      'diaria_outro_cc'::text,
      pp.id,
      NULL::uuid,
      pp.data,
      pp.data,
      ss.centro_custo_id,
      (v_super OR EXISTS (
        SELECT 1 FROM public.fn_planejamento_scope_centros_custo(v_uid) sc WHERE sc = ss.centro_custo_id
      )) AS tem_escopo,
      CASE
        WHEN v_super OR EXISTS (
          SELECT 1 FROM public.fn_planejamento_scope_centros_custo(v_uid) sc WHERE sc = ss.centro_custo_id
        ) THEN 'Funcionário com presença real em diária neste Centro de Custo.'
        ELSE 'Funcionário já possui conflito no período.'
      END
    FROM public.bd_diaria_presencas pp
    JOIN public.bd_diaria_solicitacoes ss ON ss.id = pp.solicitacao_id
    WHERE pp.funcionario_id = p_funcionario_id
      AND pp.hora_entrada IS NOT NULL
      AND pp.data BETWEEN p_semana_inicio AND p_semana_fim
      AND ss.centro_custo_id <> p_cc_atividade;

    -- 3) Convocação prevista em outro CC sem presença real (ALERTA, não bloqueia)
    RETURN QUERY
    WITH previstas AS (
      SELECT s.id AS solicitacao_id, s.centro_custo_id, s.data_inicio AS dt_ini, s.data_fim AS dt_fim
      FROM public.bd_diaria_solicitacoes s
      WHERE COALESCE(s.status::text, '') NOT IN ('cancelado','cancelada','rejeitado','rejeitada')
        AND daterange(s.data_inicio, s.data_fim, '[]') && daterange(p_semana_inicio, p_semana_fim, '[]')
        AND s.centro_custo_id <> p_cc_atividade
        AND s.convocados_pre IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(s.convocados_pre) c
          WHERE (c->>'funcionario_id') = p_funcionario_id::text
        )
      UNION
      SELECT s.id, s.centro_custo_id, lf.data, lf.data
      FROM public.bd_diaria_lote_funcionarios lf
      JOIN public.bd_diaria_lotes_convocacao l ON l.id = lf.lote_id
      JOIN public.bd_diaria_solicitacoes s ON s.id = l.solicitacao_id
      WHERE lf.funcionario_id = p_funcionario_id
        AND COALESCE(lf.status::text, '') IN ('aprovado','pendente')
        AND lf.data BETWEEN p_semana_inicio AND p_semana_fim
        AND s.centro_custo_id <> p_cc_atividade
    )
    SELECT
      'diaria_previsto'::text,
      pr.solicitacao_id,
      NULL::uuid,
      pr.dt_ini,
      pr.dt_fim,
      pr.centro_custo_id,
      (v_super OR EXISTS (
        SELECT 1 FROM public.fn_planejamento_scope_centros_custo(v_uid) sc WHERE sc = pr.centro_custo_id
      )) AS tem_escopo,
      CASE
        WHEN v_super OR EXISTS (
          SELECT 1 FROM public.fn_planejamento_scope_centros_custo(v_uid) sc WHERE sc = pr.centro_custo_id
        ) THEN 'Funcionário com diária prevista/aprovada em outro Centro de Custo neste período.'
        ELSE 'Funcionário já possui conflito no período.'
      END
    FROM previstas pr
    WHERE NOT EXISTS (
      SELECT 1 FROM public.bd_diaria_presencas pp
      JOIN public.bd_diaria_solicitacoes ss ON ss.id = pp.solicitacao_id
      WHERE pp.funcionario_id = p_funcionario_id
        AND pp.hora_entrada IS NOT NULL
        AND pp.data BETWEEN pr.dt_ini AND pr.dt_fim
        AND ss.centro_custo_id = pr.centro_custo_id
    );
  END IF;
END; $$;

GRANT EXECUTE ON FUNCTION public.fn_detectar_conflito_designacao(uuid, date, date, uuid, uuid) TO authenticated;

-- Recriar fn_listar_funcionarios_disponiveis_designacao: incluir_outros_cc + CPF mascarado + busca por CPF + 3 conflitos
DROP FUNCTION IF EXISTS public.fn_listar_funcionarios_disponiveis_designacao(uuid, text, text, date, date);

CREATE OR REPLACE FUNCTION public.fn_listar_funcionarios_disponiveis_designacao(
  p_atividade_id uuid,
  p_incluir_outros_cc boolean DEFAULT false,
  p_busca text DEFAULT NULL,
  p_semana_inicio date DEFAULT NULL,
  p_semana_fim date DEFAULT NULL
) RETURNS TABLE(
  funcionario_id uuid,
  nome_completo text,
  matricula text,
  cpf_mascarado text,
  status text,
  funcao_id uuid,
  nome_funcao text,
  centro_custo_id uuid,
  codigo_centro_custo text,
  nome_centro_custo text,
  tem_conflito_equipe boolean,
  tem_conflito_diaria_outro_cc boolean,
  tem_conflito_diaria_previsto boolean,
  motivo_conflito text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_super boolean;
  v_cc_atividade uuid;
  v_ini date;
  v_fim date;
  v_emprestimo boolean;
  v_incluir boolean;
  v_digits text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado' USING ERRCODE='42501'; END IF;
  v_super := fn_is_super_admin(v_uid);
  IF NOT (v_super OR user_has_permission_action(v_uid,'engenharia_planejamento_equipe_view','visualizar')) THEN
    RAISE EXCEPTION 'Sem permissão para visualizar equipe designada' USING ERRCODE='42501';
  END IF;

  SELECT po.centro_custo_id, COALESCE(p_semana_inicio, a.data_inicio), COALESCE(p_semana_fim, a.data_fim)
    INTO v_cc_atividade, v_ini, v_fim
  FROM public.bd_planejamento_atividades a
  JOIN public.bd_planejamentos_obra po ON po.id = a.planejamento_id
  WHERE a.id = p_atividade_id;

  IF v_cc_atividade IS NULL THEN
    RAISE EXCEPTION 'Atividade não encontrada' USING ERRCODE='P0002';
  END IF;

  IF NOT v_super AND NOT EXISTS (
    SELECT 1 FROM public.fn_planejamento_scope_centros_custo(v_uid) s WHERE s = v_cc_atividade
  ) THEN
    RAISE EXCEPTION 'Centro de Custo da atividade fora do seu escopo' USING ERRCODE='42501';
  END IF;

  v_emprestimo := v_super OR user_has_permission_action(v_uid,'engenharia_planejamento_equipe_emprestimo','criar');
  v_incluir := COALESCE(p_incluir_outros_cc, false) AND v_emprestimo;

  v_digits := NULLIF(regexp_replace(COALESCE(p_busca, ''), '\D', '', 'g'), '');

  RETURN QUERY
  SELECT
    f.id,
    f.nome_completo,
    f.matricula,
    CASE
      WHEN sf.cpf IS NULL THEN NULL
      WHEN length(regexp_replace(sf.cpf, '\D', '', 'g')) = 11
        THEN '***.' || substring(regexp_replace(sf.cpf, '\D', '', 'g'), 4, 3) || '.' ||
             substring(regexp_replace(sf.cpf, '\D', '', 'g'), 7, 3) || '-**'
      ELSE '***'
    END AS cpf_mascarado,
    f.status::text,
    f.funcao_id,
    fn.nome_funcao,
    f.centro_custo_id,
    cc.codigo_centro_custo,
    cc.nome_centro_custo,
    EXISTS (
      SELECT 1 FROM public.fn_detectar_conflito_designacao(f.id, v_ini, v_fim, NULL, v_cc_atividade) c
      WHERE c.tipo_conflito = 'equipe'
    ) AS tem_conflito_equipe,
    EXISTS (
      SELECT 1 FROM public.fn_detectar_conflito_designacao(f.id, v_ini, v_fim, NULL, v_cc_atividade) c
      WHERE c.tipo_conflito = 'diaria_outro_cc'
    ) AS tem_conflito_diaria_outro_cc,
    EXISTS (
      SELECT 1 FROM public.fn_detectar_conflito_designacao(f.id, v_ini, v_fim, NULL, v_cc_atividade) c
      WHERE c.tipo_conflito = 'diaria_previsto'
    ) AS tem_conflito_diaria_previsto,
    NULL::text AS motivo_conflito
  FROM public.bd_funcionarios f
  LEFT JOIN public.bd_funcoes fn ON fn.id = f.funcao_id
  LEFT JOIN public.bd_centros_custo cc ON cc.id = f.centro_custo_id
  LEFT JOIN public.bd_funcionarios_sensivel sf ON sf.funcionario_id = f.id
  WHERE UPPER(TRIM(f.status::text)) IN ('ATIVO','ATIVO SEM REGISTRO')
    AND (
      f.centro_custo_id = v_cc_atividade
      OR (v_incluir AND f.centro_custo_id <> v_cc_atividade)
    )
    AND (
      p_busca IS NULL OR btrim(p_busca) = ''
      OR f.nome_completo ILIKE '%' || p_busca || '%'
      OR f.matricula ILIKE '%' || p_busca || '%'
      OR (v_digits IS NOT NULL AND length(v_digits) >= 3
          AND regexp_replace(COALESCE(sf.cpf, ''), '\D', '', 'g') LIKE v_digits || '%')
    )
  ORDER BY f.nome_completo
  LIMIT 200;
END; $$;

GRANT EXECUTE ON FUNCTION public.fn_listar_funcionarios_disponiveis_designacao(uuid, boolean, text, date, date) TO authenticated;

-- Recriar fn_designar_equipe_atividade: derivação no servidor + validações novas
CREATE OR REPLACE FUNCTION public.fn_designar_equipe_atividade(
  p_atividade_id uuid,
  p_funcionario_id uuid,
  p_funcao_id uuid,
  p_papel papel_equipe_tarefa,
  p_semana_inicio date,
  p_semana_fim date,
  p_dias numeric DEFAULT NULL,
  p_horas numeric DEFAULT NULL,
  p_observacao text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_super boolean;
  v_atv RECORD;
  v_func RECORD;
  v_tipo public.tipo_alocacao_equipe;
  v_new_id uuid;
  v_n int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado' USING ERRCODE='42501'; END IF;
  v_super := fn_is_super_admin(v_uid);

  SELECT a.id, a.planejamento_id, po.centro_custo_id INTO v_atv
  FROM public.bd_planejamento_atividades a
  JOIN public.bd_planejamentos_obra po ON po.id = a.planejamento_id
  WHERE a.id = p_atividade_id FOR UPDATE OF a;
  IF v_atv.id IS NULL THEN RAISE EXCEPTION 'Atividade não encontrada' USING ERRCODE='P0002'; END IF;

  IF NOT (v_super OR user_has_permission_action(v_uid,'engenharia_planejamento_equipe_manage','criar')) THEN
    RAISE EXCEPTION 'Sem permissão para designar equipe' USING ERRCODE='42501';
  END IF;

  IF NOT v_super AND NOT EXISTS (
    SELECT 1 FROM public.fn_planejamento_scope_centros_custo(v_uid) s WHERE s = v_atv.centro_custo_id
  ) THEN
    RAISE EXCEPTION 'Centro de Custo da atividade fora do seu escopo' USING ERRCODE='42501';
  END IF;

  SELECT id, centro_custo_id, status INTO v_func
  FROM public.bd_funcionarios WHERE id = p_funcionario_id;
  IF v_func.id IS NULL THEN RAISE EXCEPTION 'Funcionário não encontrado' USING ERRCODE='P0002'; END IF;
  IF UPPER(TRIM(v_func.status::text)) NOT IN ('ATIVO','ATIVO SEM REGISTRO') THEN
    RAISE EXCEPTION 'Funcionário não está ativo para designação.' USING ERRCODE='P0001';
  END IF;

  -- Origem é SEMPRE derivada no servidor; cliente não escolhe
  v_tipo := CASE WHEN v_func.centro_custo_id = v_atv.centro_custo_id
                 THEN 'proprio_cc'::public.tipo_alocacao_equipe
                 ELSE 'emprestado_outra_obra'::public.tipo_alocacao_equipe END;

  IF v_tipo = 'emprestado_outra_obra' AND NOT v_super
     AND NOT user_has_permission_action(v_uid,'engenharia_planejamento_equipe_emprestimo','criar') THEN
    RAISE EXCEPTION 'Você não possui permissão para designar funcionário de outro Centro de Custo.' USING ERRCODE='42501';
  END IF;

  -- Conflito com equipe designada (bloqueia)
  SELECT count(*) INTO v_n
  FROM public.fn_detectar_conflito_designacao(p_funcionario_id, p_semana_inicio, p_semana_fim, NULL, v_atv.centro_custo_id) c
  WHERE c.tipo_conflito = 'equipe';
  IF v_n > 0 THEN
    RAISE EXCEPTION 'Funcionário já designado em outra tarefa no período.' USING ERRCODE='P0001';
  END IF;

  -- Presença real em diária em outro CC (bloqueia)
  SELECT count(*) INTO v_n
  FROM public.fn_detectar_conflito_designacao(p_funcionario_id, p_semana_inicio, p_semana_fim, NULL, v_atv.centro_custo_id) c
  WHERE c.tipo_conflito = 'diaria_outro_cc';
  IF v_n > 0 THEN
    RAISE EXCEPTION 'Funcionário já possui presença registrada em diária para outro Centro de Custo neste período.' USING ERRCODE='P0001';
  END IF;

  INSERT INTO public.bd_planejamento_atividade_equipe(
    planejamento_id, atividade_id, centro_custo_id, funcionario_id, funcao_id,
    centro_custo_origem_id, tipo_alocacao, papel_na_tarefa,
    semana_inicio, semana_fim, dias_previstos, horas_previstas,
    status, observacao, criado_por, modificado_por
  ) VALUES (
    v_atv.planejamento_id, p_atividade_id, v_atv.centro_custo_id, p_funcionario_id, p_funcao_id,
    v_func.centro_custo_id, v_tipo, p_papel,
    p_semana_inicio, p_semana_fim, p_dias, p_horas,
    'rascunho', p_observacao, v_uid, v_uid
  ) RETURNING id INTO v_new_id;
  RETURN v_new_id;
END; $$;
