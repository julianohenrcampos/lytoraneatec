CREATE OR REPLACE FUNCTION public.verificar_duplicidade_solicitacao(
  p_data_inicio date,
  p_data_fim date,
  p_funcionario_ids text[],
  p_solicitacao_atual_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_solicitacao RECORD;
  v_convocado jsonb;
  v_funcionarios_conflito text[] := '{}';
  v_numero_solicitacao text := '';
BEGIN
  IF p_funcionario_ids IS NULL OR array_length(p_funcionario_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('duplicada', false, 'numero_solicitacao', '', 'funcionarios_conflito', '[]'::jsonb);
  END IF;

  FOR v_solicitacao IN
    SELECT id, numero_solicitacao, convocados_pre
    FROM bd_diaria_solicitacoes
    WHERE status NOT IN ('reprovada')
      AND (p_solicitacao_atual_id IS NULL OR id != p_solicitacao_atual_id)
      AND data_inicio <= p_data_fim
      AND data_fim >= p_data_inicio
      AND convocados_pre IS NOT NULL
      AND jsonb_array_length(convocados_pre) > 0
  LOOP
    FOR v_convocado IN SELECT * FROM jsonb_array_elements(v_solicitacao.convocados_pre)
    LOOP
      IF (v_convocado->>'funcionario_id') = ANY(p_funcionario_ids) THEN
        IF NOT (v_convocado->>'nome_funcionario') = ANY(v_funcionarios_conflito) THEN
          v_funcionarios_conflito := array_append(v_funcionarios_conflito, v_convocado->>'nome_funcionario');
        END IF;
        v_numero_solicitacao := v_solicitacao.numero_solicitacao;
      END IF;
    END LOOP;

    IF array_length(v_funcionarios_conflito, 1) > 0 THEN
      RETURN jsonb_build_object(
        'duplicada', true,
        'numero_solicitacao', v_numero_solicitacao,
        'funcionarios_conflito', to_jsonb(v_funcionarios_conflito)
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object('duplicada', false, 'numero_solicitacao', '', 'funcionarios_conflito', '[]'::jsonb);
END;
$$;