
CREATE OR REPLACE FUNCTION public.gerenciar_convocado_diaria(
  p_solicitacao_id uuid,
  p_funcionario_data jsonb,
  p_acao text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_solicitacao record;
  v_current_list jsonb;
  v_user_id uuid := auth.uid();
  v_func_id text;
BEGIN
  -- Buscar solicitação
  SELECT id, criado_por, convocados_pre, status INTO v_solicitacao
  FROM bd_diaria_solicitacoes WHERE id = p_solicitacao_id;

  IF v_solicitacao IS NULL THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;

  -- Verificar permissão: criador, responsável em campo, gerente regional, ou SuperAdmin
  IF NOT (
    check_is_super_admin(v_user_id)
    OR v_solicitacao.criado_por = v_user_id
    OR EXISTS (
      SELECT 1 FROM bd_diaria_apontamentos a
      JOIN profiles p ON p.funcionario_id = a.responsavel_campo_id
      WHERE a.solicitacao_id = p_solicitacao_id AND p.id = v_user_id
    )
    OR EXISTS (
      SELECT 1 FROM bd_centros_custo cc
      JOIN profiles p ON p.funcionario_id = cc.aprovador_diarias_id
      JOIN bd_diaria_solicitacoes s ON s.centro_custo_id = cc.id
      WHERE s.id = p_solicitacao_id AND p.id = v_user_id
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar convocados';
  END IF;

  -- Executar ação
  v_current_list := COALESCE(v_solicitacao.convocados_pre::jsonb, '[]'::jsonb);

  IF p_acao = 'adicionar' THEN
    v_func_id := p_funcionario_data->>'funcionario_id';
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_current_list) elem WHERE elem->>'funcionario_id' = v_func_id) THEN
      RAISE EXCEPTION 'Funcionário já está na lista';
    END IF;
    v_current_list := v_current_list || jsonb_build_array(p_funcionario_data);

  ELSIF p_acao = 'remover' THEN
    v_func_id := p_funcionario_data->>'funcionario_id';
    SELECT jsonb_agg(elem) INTO v_current_list
    FROM jsonb_array_elements(v_current_list) elem
    WHERE elem->>'funcionario_id' != v_func_id;
    v_current_list := COALESCE(v_current_list, '[]'::jsonb);
  ELSE
    RAISE EXCEPTION 'Ação inválida: use adicionar ou remover';
  END IF;

  UPDATE bd_diaria_solicitacoes
  SET convocados_pre = v_current_list, updated_at = now()
  WHERE id = p_solicitacao_id;
END;
$$;
