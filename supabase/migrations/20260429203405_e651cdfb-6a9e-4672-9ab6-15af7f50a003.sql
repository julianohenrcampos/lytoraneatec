CREATE OR REPLACE FUNCTION public.fn_adicionar_funcionario_no_dia(
  p_solicitacao_id uuid,
  p_funcionario_id uuid,
  p_data           date,
  p_funcao_id      uuid DEFAULT NULL,
  p_classificacao  jsonb DEFAULT '{}'::jsonb
)
RETURNS public.bd_diaria_presencas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid           uuid := auth.uid();
  v_solicitacao   RECORD;
  v_funcao_id     uuid;
  v_is_excecao    boolean;
  v_row           public.bd_diaria_presencas;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NAO_AUTENTICADO';
  END IF;
  IF p_solicitacao_id IS NULL THEN
    RAISE EXCEPTION 'SOLICITACAO_OBRIGATORIA';
  END IF;
  IF p_funcionario_id IS NULL THEN
    RAISE EXCEPTION 'FUNCIONARIO_OBRIGATORIO';
  END IF;
  IF p_data IS NULL THEN
    RAISE EXCEPTION 'DATA_OBRIGATORIA';
  END IF;

  SELECT id, status, data_inicio, data_fim, centro_custo_id
    INTO v_solicitacao
  FROM public.bd_diaria_solicitacoes
  WHERE id = p_solicitacao_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SOLICITACAO_NAO_ENCONTRADA';
  END IF;

  -- Permissão: reaproveita a função existente que valida acesso à solicitação
  IF NOT public.fn_user_can_access_diaria_solicitacao(v_uid, p_solicitacao_id) THEN
    RAISE EXCEPTION 'SEM_PERMISSAO_PARA_SOLICITACAO';
  END IF;

  -- Resolve funcao_id (parâmetro -> fallback do funcionário)
  v_funcao_id := p_funcao_id;
  IF v_funcao_id IS NULL THEN
    SELECT funcao_id INTO v_funcao_id
    FROM public.bd_funcionarios
    WHERE id = p_funcionario_id;
  END IF;

  v_is_excecao := COALESCE((p_classificacao ->> 'is_excecao')::boolean, false);

  -- Insert idempotente. O índice único uq_presenca_funcionario_data
  -- (solicitacao_id, funcionario_id, data) garante que não duplique.
  INSERT INTO public.bd_diaria_presencas (
    solicitacao_id,
    funcionario_id,
    data,
    funcao_id,
    presente,
    hora_entrada,
    hora_saida,
    valor_diaria_aplicada,
    recebe_refeicao,
    valor_refeicao_aplicado,
    tipo_apontamento,
    is_excecao,
    turno,
    tipo_diaria,
    modificado_por
  ) VALUES (
    p_solicitacao_id,
    p_funcionario_id,
    p_data,
    v_funcao_id,
    false,            -- estado neutro (excluído da MV do relatório financeiro)
    NULL,
    NULL,
    0,                -- coluna NOT NULL default 0; seguro pois MV filtra presente=false
    true,
    0,
    'normal',
    v_is_excecao,
    'diurno',
    'completa',
    v_uid
  )
  ON CONFLICT (solicitacao_id, funcionario_id, data) DO NOTHING
  RETURNING * INTO v_row;

  -- Se houve conflito (linha já existia), buscar a linha existente para retornar
  IF v_row.id IS NULL THEN
    SELECT * INTO v_row
    FROM public.bd_diaria_presencas
    WHERE solicitacao_id = p_solicitacao_id
      AND funcionario_id = p_funcionario_id
      AND data = p_data;
  END IF;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_adicionar_funcionario_no_dia(uuid, uuid, date, uuid, jsonb) TO authenticated;