CREATE OR REPLACE FUNCTION public.fn_diaria_funcionario_elegibilidade(
  p_funcionario_id uuid,
  p_data_inicio date,
  p_data_fim date,
  p_solicitacao_id uuid DEFAULT NULL
)
RETURNS TABLE (
  elegivel boolean,
  motivo_bloqueio text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_conflito_solicitacao text;
  v_conflito_apontamento boolean;
BEGIN
  IF p_funcionario_id IS NULL THEN
    RETURN QUERY SELECT false, 'Funcionário não informado'::text;
    RETURN;
  END IF;

  IF p_data_inicio IS NULL OR p_data_fim IS NULL THEN
    RETURN QUERY SELECT false, 'Período da solicitação inválido'::text;
    RETURN;
  END IF;

  IF p_data_fim < p_data_inicio THEN
    RETURN QUERY SELECT false, 'Período da solicitação inválido'::text;
    RETURN;
  END IF;

  SELECT COALESCE(f.status, '')
    INTO v_status
  FROM public.bd_funcionarios f
  WHERE f.id = p_funcionario_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Funcionário não encontrado'::text;
    RETURN;
  END IF;

  IF upper(trim(v_status)) IN ('INATIVO', 'INSS', 'AFASTADO', 'FÉRIAS', 'FERIAS') THEN
    RETURN QUERY SELECT false, format('Funcionário com status inelegível: %s', v_status)::text;
    RETURN;
  END IF;

  SELECT s.numero_solicitacao
    INTO v_conflito_solicitacao
  FROM public.bd_diaria_solicitacoes s
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s.convocados_pre, '[]'::jsonb)) convocado(item)
  WHERE (convocado.item ->> 'funcionario_id')::uuid = p_funcionario_id
    AND (p_solicitacao_id IS NULL OR s.id <> p_solicitacao_id)
    AND COALESCE(s.status, '') <> 'cancelada'
    AND s.data_inicio <= p_data_fim
    AND s.data_fim >= p_data_inicio
  ORDER BY s.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_conflito_solicitacao IS NOT NULL THEN
    RETURN QUERY SELECT false, format('Funcionário já convocado na solicitação %s no período informado', v_conflito_solicitacao)::text;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.bd_diaria_apontamentos a
    WHERE a.funcionario_id = p_funcionario_id
      AND COALESCE(a.status, '') <> 'FINALIZADO'
      AND a.data >= p_data_inicio
      AND a.data <= p_data_fim
  )
  INTO v_conflito_apontamento;

  IF v_conflito_apontamento THEN
    RETURN QUERY SELECT false, 'Funcionário possui apontamento ativo no período informado'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, NULL::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_diaria_get_funcionarios_disponiveis(
  p_data_inicio date,
  p_data_fim date,
  p_centro_custo_solicitacao_id uuid DEFAULT NULL,
  p_solicitacao_id uuid DEFAULT NULL
)
RETURNS TABLE (
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
    bf.valor_diaria,
    bf.valor_diaria_exclusiva,
    bf.valor_refeicao,
    elig.elegivel,
    elig.motivo_bloqueio,
    CASE
      WHEN p_centro_custo_solicitacao_id IS NULL OR f.centro_custo_id IS NULL THEN false
      ELSE f.centro_custo_id <> p_centro_custo_solicitacao_id
    END AS fora_centro_custo_solicitacao
  FROM public.bd_funcionarios f
  LEFT JOIN public.bd_funcoes bf ON bf.id = f.funcao_id
  CROSS JOIN LATERAL public.fn_diaria_funcionario_elegibilidade(
    f.id,
    p_data_inicio,
    p_data_fim,
    p_solicitacao_id
  ) elig
  ORDER BY f.nome_completo;
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
  v_solicitacao public.bd_diaria_solicitacoes%ROWTYPE;
  v_funcionario_id uuid;
  v_convocados jsonb;
  v_item jsonb;
  v_exists boolean;
  v_elegivel boolean;
  v_motivo text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT *
    INTO v_solicitacao
  FROM public.bd_diaria_solicitacoes
  WHERE id = p_solicitacao_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;

  IF COALESCE(v_solicitacao.status, 'rascunho') <> 'rascunho' THEN
    RAISE EXCEPTION 'Somente solicitações em rascunho podem ter convocados alterados';
  END IF;

  v_convocados := COALESCE(v_solicitacao.convocados_pre, '[]'::jsonb);
  v_funcionario_id := NULLIF(p_funcionario_data ->> 'funcionario_id', '')::uuid;

  IF v_funcionario_id IS NULL THEN
    v_funcionario_id := NULLIF(p_funcionario_data ->> 'id', '')::uuid;
  END IF;

  IF v_funcionario_id IS NULL THEN
    RAISE EXCEPTION 'Funcionário não informado';
  END IF;

  IF p_acao = 'adicionar' THEN
    SELECT elegivel, motivo_bloqueio
      INTO v_elegivel, v_motivo
    FROM public.fn_diaria_funcionario_elegibilidade(
      v_funcionario_id,
      v_solicitacao.data_inicio,
      v_solicitacao.data_fim,
      v_solicitacao.id
    );

    IF COALESCE(v_elegivel, false) = false THEN
      RAISE EXCEPTION '%', COALESCE(v_motivo, 'Funcionário inelegível para o período informado');
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_convocados) item
      WHERE (item ->> 'funcionario_id')::uuid = v_funcionario_id
    )
    INTO v_exists;

    IF NOT v_exists THEN
      v_item := jsonb_set(
        COALESCE(p_funcionario_data, '{}'::jsonb),
        '{funcionario_id}',
        to_jsonb(v_funcionario_id::text),
        true
      );

      UPDATE public.bd_diaria_solicitacoes
      SET convocados_pre = v_convocados || jsonb_build_array(v_item),
          updated_at = now(),
          modificado_por = auth.uid()
      WHERE id = p_solicitacao_id;
    END IF;

    RETURN;
  ELSIF p_acao = 'remover' THEN
    UPDATE public.bd_diaria_solicitacoes
    SET convocados_pre = COALESCE((
          SELECT jsonb_agg(item)
          FROM jsonb_array_elements(v_convocados) item
          WHERE (item ->> 'funcionario_id')::uuid IS DISTINCT FROM v_funcionario_id
        ), '[]'::jsonb),
        updated_at = now(),
        modificado_por = auth.uid()
    WHERE id = p_solicitacao_id;

    RETURN;
  ELSE
    RAISE EXCEPTION 'Ação inválida para gerenciar convocado';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_diaria_funcionario_elegibilidade(uuid, date, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_diaria_get_funcionarios_disponiveis(date, date, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gerenciar_convocado_diaria(uuid, jsonb, text) TO authenticated;