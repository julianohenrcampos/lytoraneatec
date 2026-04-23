CREATE OR REPLACE FUNCTION public.fn_diaria_funcionario_elegibilidade(
  p_funcionario_id uuid,
  p_data_inicio date,
  p_data_fim date,
  p_solicitacao_id uuid DEFAULT NULL
)
RETURNS TABLE(elegivel boolean, motivo_bloqueio text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_conflito_numero text;
BEGIN
  BEGIN
    SELECT COALESCE(NULLIF(TRIM(f.status), ''), 'Sem status')
      INTO v_status
    FROM public.bd_funcionarios f
    WHERE f.id = p_funcionario_id;

    IF v_status IS NULL THEN
      RETURN QUERY SELECT false, 'Funcionário não localizado para validação';
      RETURN;
    END IF;

    IF UPPER(v_status) IN ('INATIVO', 'INSS', 'AFASTADO', 'FÉRIAS', 'FERIAS') THEN
      RETURN QUERY SELECT false, format('Funcionário com status inelegível: %s', v_status);
      RETURN;
    END IF;

    SELECT s.numero_solicitacao
      INTO v_conflito_numero
    FROM public.bd_diaria_solicitacoes s
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s.convocados_pre, '[]'::jsonb)) AS convocado(item)
    WHERE COALESCE(s.status, '') <> 'cancelado'
      AND (p_solicitacao_id IS NULL OR s.id <> p_solicitacao_id)
      AND s.data_inicio <= p_data_fim
      AND s.data_fim >= p_data_inicio
      AND (convocado.item ->> 'funcionario_id')::uuid = p_funcionario_id
    ORDER BY s.created_at DESC NULLS LAST
    LIMIT 1;

    IF v_conflito_numero IS NOT NULL THEN
      RETURN QUERY SELECT false, format('Conflito com diária já existente na solicitação %s', v_conflito_numero);
      RETURN;
    END IF;

    RETURN QUERY SELECT true, NULL::text;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT false, format('Falha na validação de elegibilidade: %s', SQLERRM);
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_diaria_get_funcionarios_disponiveis(
  p_data_inicio date,
  p_data_fim date,
  p_centro_custo_solicitacao_id uuid DEFAULT NULL,
  p_solicitacao_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  nome_completo text,
  cpf text,
  funcao_id uuid,
  centro_custo_id uuid,
  matricula text,
  status_funcionario text,
  email text,
  funcao_nome text,
  valor_diaria numeric,
  valor_diaria_exclusiva numeric,
  valor_refeicao numeric,
  elegivel boolean,
  motivo_bloqueio text,
  fora_centro_custo_solicitacao boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.id,
    f.nome_completo,
    f.cpf,
    f.funcao_id,
    f.centro_custo_id,
    f.matricula,
    f.status AS status_funcionario,
    f.email,
    bf.nome_funcao AS funcao_nome,
    COALESCE(bf.valor_diaria, 0) AS valor_diaria,
    bf.valor_diaria_exclusiva,
    COALESCE(bf.valor_refeicao, 0) AS valor_refeicao,
    elig.elegivel,
    elig.motivo_bloqueio,
    CASE
      WHEN p_centro_custo_solicitacao_id IS NULL THEN false
      ELSE f.centro_custo_id IS DISTINCT FROM p_centro_custo_solicitacao_id
    END AS fora_centro_custo_solicitacao
  FROM public.bd_funcionarios f
  LEFT JOIN public.bd_funcoes bf ON bf.id = f.funcao_id
  CROSS JOIN LATERAL public.fn_diaria_funcionario_elegibilidade(
    f.id,
    p_data_inicio,
    p_data_fim,
    p_solicitacao_id
  ) AS elig
  WHERE f.id IS NOT NULL
  ORDER BY elig.elegivel DESC, f.nome_completo ASC;
$$;

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

GRANT EXECUTE ON FUNCTION public.fn_diaria_funcionario_elegibilidade(uuid, date, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_diaria_get_funcionarios_disponiveis(date, date, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gerenciar_convocado_diaria(uuid, jsonb, text) TO authenticated;