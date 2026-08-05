
ALTER TABLE public.bd_permissions DISABLE TRIGGER USER;
ALTER TABLE public.bd_role_permission_actions DISABLE TRIGGER USER;

INSERT INTO public.bd_permissions (codigo, nome, descricao, rota, tipo, ativo)
SELECT 'engenharia_planejamento_equipe_emprestimo',
       'Equipe designada — emprestar de outra obra',
       'Permite designar funcionário lotado em outro Centro de Custo (empréstimo entre obras)',
       '/engenharia/planejamento-macro', 'page', true
WHERE NOT EXISTS (SELECT 1 FROM public.bd_permissions WHERE codigo='engenharia_planejamento_equipe_emprestimo');

WITH perms AS (
  SELECT codigo, id FROM public.bd_permissions
   WHERE codigo IN ('engenharia_planejamento_equipe_view','engenharia_planejamento_equipe_manage','engenharia_planejamento_equipe_emprestimo')
),
roles AS (SELECT nome, id FROM public.bd_roles WHERE nome IN ('GerenteRegional','AdmOBRA')),
matriz(role_nome, perm_codigo, acao) AS (VALUES
    ('GerenteRegional','engenharia_planejamento_equipe_view','visualizar'),
    ('GerenteRegional','engenharia_planejamento_equipe_manage','criar'),
    ('GerenteRegional','engenharia_planejamento_equipe_manage','editar'),
    ('GerenteRegional','engenharia_planejamento_equipe_manage','excluir'),
    ('GerenteRegional','engenharia_planejamento_equipe_emprestimo','criar'),
    ('AdmOBRA','engenharia_planejamento_equipe_view','visualizar'),
    ('AdmOBRA','engenharia_planejamento_equipe_manage','criar'),
    ('AdmOBRA','engenharia_planejamento_equipe_manage','editar'),
    ('AdmOBRA','engenharia_planejamento_equipe_manage','excluir'))
INSERT INTO public.bd_role_permission_actions (role_id, permission_id, acao)
SELECT r.id, p.id, m.acao FROM matriz m
  JOIN roles r ON r.nome=m.role_nome
  JOIN perms p ON p.codigo=m.perm_codigo
ON CONFLICT DO NOTHING;

ALTER TABLE public.bd_role_permission_actions ENABLE TRIGGER USER;
ALTER TABLE public.bd_permissions ENABLE TRIGGER USER;

CREATE OR REPLACE FUNCTION public.fn_planejamento_scope_centros_custo(p_user_id uuid DEFAULT auth.uid())
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT * FROM public.fn_diaria_scope_centros_custo(p_user_id); $$;
GRANT EXECUTE ON FUNCTION public.fn_planejamento_scope_centros_custo(uuid) TO authenticated;

DROP POLICY IF EXISTS paeq_select ON public.bd_planejamento_atividade_equipe;
DROP POLICY IF EXISTS paeq_insert ON public.bd_planejamento_atividade_equipe;

CREATE POLICY paeq_select ON public.bd_planejamento_atividade_equipe
FOR SELECT TO authenticated
USING (
  fn_is_super_admin(auth.uid())
  OR (user_has_permission_action(auth.uid(),'engenharia_planejamento_equipe_view','visualizar')
      AND centro_custo_id IN (SELECT fn_planejamento_scope_centros_custo(auth.uid())))
);

CREATE POLICY paeq_insert ON public.bd_planejamento_atividade_equipe
FOR INSERT TO authenticated
WITH CHECK (
  fn_is_super_admin(auth.uid())
  OR (user_has_permission_action(auth.uid(),'engenharia_planejamento_equipe_manage','criar')
      AND centro_custo_id IN (SELECT fn_planejamento_scope_centros_custo(auth.uid())))
);

CREATE OR REPLACE FUNCTION public.fn_listar_funcionarios_disponiveis_designacao(
  p_atividade_id uuid, p_origem text DEFAULT 'proprio_cc', p_busca text DEFAULT NULL,
  p_semana_inicio date DEFAULT NULL, p_semana_fim date DEFAULT NULL
)
RETURNS TABLE(funcionario_id uuid, nome_completo text, matricula text, status text,
  funcao_id uuid, nome_funcao text, centro_custo_id uuid, codigo_centro_custo text,
  nome_centro_custo text, tem_conflito boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_uid uuid := auth.uid(); v_super boolean; v_cc_atividade uuid; v_ini date; v_fim date;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado' USING ERRCODE='42501'; END IF;
  v_super := fn_is_super_admin(v_uid);
  IF NOT (v_super OR user_has_permission_action(v_uid,'engenharia_planejamento_equipe_view','visualizar')) THEN
    RAISE EXCEPTION 'Sem permissão para visualizar equipe designada' USING ERRCODE='42501';
  END IF;

  SELECT po.centro_custo_id, COALESCE(p_semana_inicio,a.data_inicio), COALESCE(p_semana_fim,a.data_fim)
    INTO v_cc_atividade, v_ini, v_fim
  FROM public.bd_planejamento_atividades a
  JOIN public.bd_planejamentos_obra po ON po.id=a.planejamento_id
  WHERE a.id=p_atividade_id;

  IF v_cc_atividade IS NULL THEN
    RAISE EXCEPTION 'Atividade não encontrada' USING ERRCODE='P0002';
  END IF;

  IF NOT v_super AND NOT EXISTS (
    SELECT 1 FROM public.fn_planejamento_scope_centros_custo(v_uid) s WHERE s=v_cc_atividade
  ) THEN
    RAISE EXCEPTION 'Centro de Custo da atividade fora do seu escopo' USING ERRCODE='42501';
  END IF;

  IF p_origem='emprestado_outra_obra' THEN
    IF NOT (v_super OR user_has_permission_action(v_uid,'engenharia_planejamento_equipe_emprestimo','criar')) THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  SELECT f.id, f.nome_completo, f.matricula, f.status::text, f.funcao_id, fn.nome_funcao,
         f.centro_custo_id, cc.codigo_centro_custo, cc.nome_centro_custo,
         EXISTS (SELECT 1 FROM public.bd_planejamento_atividade_equipe e
                  WHERE e.funcionario_id=f.id AND e.status IN ('rascunho','confirmado')
                    AND v_ini IS NOT NULL AND v_fim IS NOT NULL
                    AND daterange(e.semana_inicio,e.semana_fim,'[]') && daterange(v_ini,v_fim,'[]')) AS tem_conflito
  FROM public.bd_funcionarios f
  LEFT JOIN public.bd_funcoes fn ON fn.id=f.funcao_id
  LEFT JOIN public.bd_centros_custo cc ON cc.id=f.centro_custo_id
  WHERE f.status IN ('Ativo','Ativo sem Registro')
    AND ((p_origem='proprio_cc' AND f.centro_custo_id=v_cc_atividade)
      OR (p_origem='emprestado_outra_obra' AND f.centro_custo_id<>v_cc_atividade))
    AND (p_busca IS NULL OR f.nome_completo ILIKE '%'||p_busca||'%' OR f.matricula ILIKE '%'||p_busca||'%')
  ORDER BY f.nome_completo;
END; $$;

CREATE OR REPLACE FUNCTION public.fn_detectar_conflito_designacao(
  p_funcionario_id uuid, p_semana_inicio date, p_semana_fim date, p_ignorar_id uuid DEFAULT NULL
)
RETURNS TABLE(id uuid, atividade_id uuid, semana_inicio date, semana_fim date, centro_custo_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado' USING ERRCODE='42501'; END IF;
  IF NOT (fn_is_super_admin(v_uid)
          OR user_has_permission_action(v_uid,'engenharia_planejamento_equipe_view','visualizar')
          OR user_has_permission_action(v_uid,'engenharia_planejamento_equipe_manage','criar')) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
  SELECT e.id, e.atividade_id, e.semana_inicio, e.semana_fim, e.centro_custo_id
  FROM public.bd_planejamento_atividade_equipe e
  WHERE e.funcionario_id=p_funcionario_id
    AND e.status IN ('rascunho','confirmado')
    AND (p_ignorar_id IS NULL OR e.id<>p_ignorar_id)
    AND daterange(e.semana_inicio,e.semana_fim,'[]') && daterange(p_semana_inicio,p_semana_fim,'[]');
END; $$;

CREATE OR REPLACE FUNCTION public.fn_designar_equipe_atividade(
  p_atividade_id uuid, p_funcionario_id uuid, p_funcao_id uuid,
  p_papel papel_equipe_tarefa, p_semana_inicio date, p_semana_fim date,
  p_dias numeric DEFAULT NULL, p_horas numeric DEFAULT NULL, p_observacao text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_uid uuid := auth.uid(); v_super boolean; v_atv RECORD; v_func RECORD;
        v_tipo public.tipo_alocacao_equipe; v_conflito_count int; v_new_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado' USING ERRCODE='42501'; END IF;
  v_super := fn_is_super_admin(v_uid);

  SELECT a.id, a.planejamento_id, po.centro_custo_id INTO v_atv
  FROM public.bd_planejamento_atividades a
  JOIN public.bd_planejamentos_obra po ON po.id=a.planejamento_id
  WHERE a.id=p_atividade_id FOR UPDATE OF a;

  IF v_atv.id IS NULL THEN RAISE EXCEPTION 'Atividade não encontrada' USING ERRCODE='P0002'; END IF;

  IF NOT (v_super OR user_has_permission_action(v_uid,'engenharia_planejamento_equipe_manage','criar')) THEN
    RAISE EXCEPTION 'Sem permissão para designar equipe' USING ERRCODE='42501';
  END IF;

  IF NOT v_super AND NOT EXISTS (
    SELECT 1 FROM public.fn_planejamento_scope_centros_custo(v_uid) s WHERE s=v_atv.centro_custo_id
  ) THEN
    RAISE EXCEPTION 'Centro de Custo da atividade fora do seu escopo' USING ERRCODE='42501';
  END IF;

  SELECT id, centro_custo_id, status INTO v_func
  FROM public.bd_funcionarios WHERE id=p_funcionario_id;
  IF v_func.id IS NULL THEN RAISE EXCEPTION 'Funcionário não encontrado' USING ERRCODE='P0002'; END IF;
  IF v_func.status NOT IN ('Ativo','Ativo sem Registro') THEN
    RAISE EXCEPTION 'Funcionário não está ativo (status: %)', v_func.status USING ERRCODE='P0001';
  END IF;

  v_tipo := CASE WHEN v_func.centro_custo_id=v_atv.centro_custo_id
                 THEN 'proprio_cc'::public.tipo_alocacao_equipe
                 ELSE 'emprestado_outra_obra'::public.tipo_alocacao_equipe END;

  IF v_tipo='emprestado_outra_obra' AND NOT v_super
     AND NOT user_has_permission_action(v_uid,'engenharia_planejamento_equipe_emprestimo','criar') THEN
    RAISE EXCEPTION 'Sem permissão para empréstimo entre obras' USING ERRCODE='42501';
  END IF;

  SELECT count(*) INTO v_conflito_count
  FROM public.fn_detectar_conflito_designacao(p_funcionario_id,p_semana_inicio,p_semana_fim,NULL);
  IF v_conflito_count>0 THEN
    RAISE EXCEPTION 'Funcionário já designado em outra atividade no período %–%', p_semana_inicio,p_semana_fim
      USING ERRCODE='P0001';
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
