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
  v_solicitacao RECORD;
  v_funcionario_id uuid;
  v_elegibilidade RECORD;
  v_convocados jsonb;
BEGIN
  SELECT id, data_inicio, data_fim, convocados_pre
    INTO v_solicitacao
  FROM public.bd_diaria_solicitacoes
  WHERE id = p_solicitacao_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;

  v_convocados := COALESCE(v_solicitacao.convocados_pre, '[]'::jsonb);
  v_funcionario_id := NULLIF(p_funcionario_data ->> 'funcionario_id', '')::uuid;

  IF v_funcionario_id IS NULL THEN
    RAISE EXCEPTION 'Funcionário inválido para operação';
  END IF;

  IF p_acao = 'remover' THEN
    -- Remove presenças não trabalhadas (sem hora_entrada ou marcadas como ausente).
    -- Preserva histórico de presenças válidas (trabalhadas).
    DELETE FROM public.bd_diaria_presencas
    WHERE solicitacao_id = p_solicitacao_id
      AND funcionario_id = v_funcionario_id
      AND (hora_entrada IS NULL OR presente = false);

    UPDATE public.bd_diaria_solicitacoes
    SET convocados_pre = COALESCE((
      SELECT jsonb_agg(item)
      FROM jsonb_array_elements(v_convocados) AS item
      WHERE item ->> 'funcionario_id' <> v_funcionario_id::text
    ), '[]'::jsonb),
    updated_at = now()
    WHERE id = p_solicitacao_id;

    RETURN;
  ELSIF p_acao <> 'adicionar' THEN
    RAISE EXCEPTION 'Ação inválida para gerenciamento de convocado';
  END IF;

  SELECT *
    INTO v_elegibilidade
  FROM public.fn_diaria_funcionario_elegibilidade(
    v_funcionario_id,
    v_solicitacao.data_inicio,
    v_solicitacao.data_fim,
    p_solicitacao_id
  )
  LIMIT 1;

  IF COALESCE(v_elegibilidade.elegivel, false) = false THEN
    RAISE EXCEPTION '%', COALESCE(v_elegibilidade.motivo_bloqueio, 'Funcionário inelegível para o período');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_convocados) AS item
    WHERE item ->> 'funcionario_id' = v_funcionario_id::text
  ) THEN
    RETURN;
  END IF;

  UPDATE public.bd_diaria_solicitacoes
  SET convocados_pre = v_convocados || jsonb_build_array(p_funcionario_data),
      updated_at = now()
  WHERE id = p_solicitacao_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gerenciar_convocado_diaria(uuid, jsonb, text) TO authenticated;