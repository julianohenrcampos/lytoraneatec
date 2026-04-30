-- 1) Nova RPC diária: inclui funcionário validando apenas o dia selecionado
CREATE OR REPLACE FUNCTION public.gerenciar_convocado_diaria_no_dia(
  p_solicitacao_id uuid,
  p_funcionario_data jsonb,
  p_data_apontamento date,
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
  v_convocados jsonb;
  v_conflito RECORD;
  v_funcionario_nome text;
  v_item jsonb;
BEGIN
  IF p_data_apontamento IS NULL THEN
    RAISE EXCEPTION 'Data do apontamento é obrigatória.';
  END IF;
  IF p_acao IS NULL OR p_acao <> 'adicionar' THEN
    RAISE EXCEPTION 'Ação inválida para inclusão diária.';
  END IF;

  SELECT id, status, convocados_pre
    INTO v_solicitacao
  FROM public.bd_diaria_solicitacoes
  WHERE id = p_solicitacao_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;

  v_funcionario_id := NULLIF(p_funcionario_data ->> 'funcionario_id', '')::uuid;
  IF v_funcionario_id IS NULL THEN
    RAISE EXCEPTION 'Funcionário inválido para operação';
  END IF;

  v_convocados := COALESCE(v_solicitacao.convocados_pre, '[]'::jsonb);

  -- Validação de conflito SOMENTE no dia exato (presença real em outra solicitação ativa).
  SELECT s.numero_solicitacao, p.data
    INTO v_conflito
  FROM public.bd_diaria_presencas p
  JOIN public.bd_diaria_solicitacoes s ON s.id = p.solicitacao_id
  WHERE p.funcionario_id = v_funcionario_id
    AND p.data = p_data_apontamento
    AND p.hora_entrada IS NOT NULL
    AND COALESCE(p.is_excecao, false) = false
    AND p.solicitacao_id <> p_solicitacao_id
    AND COALESCE(s.status, '') NOT IN ('cancelado','cancelada','reprovada')
  LIMIT 1;

  IF v_conflito.numero_solicitacao IS NOT NULL THEN
    SELECT nome_completo INTO v_funcionario_nome
      FROM public.bd_funcionarios WHERE id = v_funcionario_id;
    RAISE EXCEPTION
      'FUNCIONARIO_DUPLICADO_NA_DATA: % já está em outra solicitação ativa (Nº %) na data %.',
      COALESCE(v_funcionario_nome, v_funcionario_id::text),
      v_conflito.numero_solicitacao,
      to_char(v_conflito.data, 'DD/MM/YYYY')
      USING ERRCODE = '23505';
  END IF;

  -- Idempotência por (funcionario_id, data) dentro do JSON.
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_convocados) AS item
    WHERE item ->> 'funcionario_id' = v_funcionario_id::text
      AND COALESCE(item ->> 'data', '') = p_data_apontamento::text
  ) THEN
    RETURN;
  END IF;

  -- Anexa explicitamente data + origem_inclusao para que o trigger
  -- siga o caminho diário e NÃO caia no fallback legado por período.
  v_item := p_funcionario_data
            || jsonb_build_object(
                 'data', p_data_apontamento::text,
                 'origem_inclusao', 'apontamento_dia'
               );

  UPDATE public.bd_diaria_solicitacoes
  SET convocados_pre = v_convocados || jsonb_build_array(v_item),
      updated_at = now()
  WHERE id = p_solicitacao_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gerenciar_convocado_diaria_no_dia(uuid, jsonb, date, text) TO authenticated;

-- 2) Trigger ajustado: respeita item->>'data' quando válido; fallback legado quando ausente/inválido
CREATE OR REPLACE FUNCTION public.check_convocados_pre_duplicidade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_func_id uuid;
  v_data_item date;
  v_data_valida boolean;
  v_conflito RECORD;
  v_func_ids_legado uuid[];
BEGIN
  IF NEW.status IN ('cancelado','reprovada','cancelada') THEN
    RETURN NEW;
  END IF;

  IF NEW.convocados_pre IS NULL OR jsonb_array_length(NEW.convocados_pre) = 0 THEN
    RETURN NEW;
  END IF;

  -- Itera por item, escolhendo o caminho de validação
  FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.convocados_pre) LOOP
    v_func_id := NULLIF(v_item ->> 'funcionario_id', '')::uuid;
    IF v_func_id IS NULL THEN CONTINUE; END IF;

    v_data_item := NULL;
    v_data_valida := false;

    IF v_item ? 'data' AND COALESCE(v_item ->> 'data','') <> '' THEN
      BEGIN
        v_data_item := (v_item ->> 'data')::date;
        v_data_valida := true;
      EXCEPTION WHEN others THEN
        v_data_valida := false;
      END;
    END IF;

    IF v_data_valida THEN
      -- CAMINHO DIÁRIO: valida apenas a data declarada no item.
      SELECT s.numero_solicitacao,
             f.nome_completo AS funcionario_nome,
             p.data
        INTO v_conflito
      FROM public.bd_diaria_presencas p
      JOIN public.bd_diaria_solicitacoes s ON s.id = p.solicitacao_id
      LEFT JOIN public.bd_funcionarios f ON f.id = p.funcionario_id
      WHERE p.funcionario_id = v_func_id
        AND p.data = v_data_item
        AND p.hora_entrada IS NOT NULL
        AND COALESCE(p.is_excecao, false) = false
        AND s.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND COALESCE(s.status, '') NOT IN ('cancelado','cancelada','reprovada')
      LIMIT 1;

      IF v_conflito.numero_solicitacao IS NOT NULL THEN
        RAISE EXCEPTION
          'FUNCIONARIO_DUPLICADO_NA_DATA: % já possui presença registrada na solicitação Nº % no dia %.',
          COALESCE(v_conflito.funcionario_nome, 'Funcionário'),
          v_conflito.numero_solicitacao,
          to_char(v_conflito.data, 'DD/MM/YYYY')
          USING ERRCODE = '23505';
      END IF;
    ELSE
      -- FALLBACK LEGADO: item sem data → varre o período inteiro.
      v_func_ids_legado := ARRAY[v_func_id];

      SELECT s.numero_solicitacao,
             f.nome_completo AS funcionario_nome,
             p.data
        INTO v_conflito
      FROM generate_series(NEW.data_inicio, NEW.data_fim, interval '1 day') AS d(data)
      JOIN public.bd_diaria_presencas p     ON p.data = d.data::date
      JOIN public.bd_diaria_solicitacoes s  ON s.id = p.solicitacao_id
      LEFT JOIN public.bd_funcionarios f    ON f.id = p.funcionario_id
      WHERE p.funcionario_id = ANY(v_func_ids_legado)
        AND p.hora_entrada IS NOT NULL
        AND COALESCE(p.is_excecao, false) = false
        AND s.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND COALESCE(s.status, '') NOT IN ('cancelado','cancelada','reprovada')
      LIMIT 1;

      IF v_conflito.numero_solicitacao IS NOT NULL THEN
        RAISE EXCEPTION
          'FUNCIONARIO_DUPLICADO_NA_DATA: % já possui presença registrada na solicitação Nº % no dia %.',
          COALESCE(v_conflito.funcionario_nome, 'Funcionário'),
          v_conflito.numero_solicitacao,
          to_char(v_conflito.data, 'DD/MM/YYYY')
          USING ERRCODE = '23505';
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- 3) Índice parcial para acelerar validação por dia
CREATE INDEX IF NOT EXISTS idx_diaria_presencas_funcionario_data_hora
  ON public.bd_diaria_presencas (funcionario_id, data)
  WHERE hora_entrada IS NOT NULL;