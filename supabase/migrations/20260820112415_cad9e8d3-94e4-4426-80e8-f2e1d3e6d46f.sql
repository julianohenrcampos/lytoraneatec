CREATE OR REPLACE FUNCTION public.fn_adicionar_funcionario_no_dia(p_solicitacao_id uuid, p_funcionario_id uuid, p_data date, p_funcao_id uuid DEFAULT NULL::uuid, p_classificacao jsonb DEFAULT '{}'::jsonb)
 RETURNS bd_diaria_presencas
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid           uuid := auth.uid();
  v_solicitacao   RECORD;
  v_funcao_id     uuid;
  v_is_excecao    boolean;
  v_status        text;
  v_exclusiva     boolean := false;
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

  IF NOT public.fn_user_can_access_diaria_solicitacao(v_uid, p_solicitacao_id) THEN
    RAISE EXCEPTION 'SEM_PERMISSAO_PARA_SOLICITACAO';
  END IF;

  v_funcao_id := p_funcao_id;
  SELECT COALESCE(v_funcao_id, funcao_id), status
    INTO v_funcao_id, v_status
  FROM public.bd_funcionarios
  WHERE id = p_funcionario_id;

  -- REGRA RH: funcionário em Férias recebe sempre diária exclusiva.
  v_exclusiva := (btrim(COALESCE(v_status, '')) = 'Férias');

  v_is_excecao := COALESCE((p_classificacao ->> 'is_excecao')::boolean, false);

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
    usar_diaria_exclusiva,
    modificado_por
  ) VALUES (
    p_solicitacao_id,
    p_funcionario_id,
    p_data,
    v_funcao_id,
    false,
    NULL,
    NULL,
    0,
    true,
    0,
    'normal',
    v_is_excecao,
    'diurno',
    'completa',
    v_exclusiva,
    v_uid
  )
  ON CONFLICT (solicitacao_id, funcionario_id, data) DO NOTHING
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    SELECT * INTO v_row
    FROM public.bd_diaria_presencas
    WHERE solicitacao_id = p_solicitacao_id
      AND funcionario_id = p_funcionario_id
      AND data = p_data;
  END IF;

  RETURN v_row;
END;
$function$;