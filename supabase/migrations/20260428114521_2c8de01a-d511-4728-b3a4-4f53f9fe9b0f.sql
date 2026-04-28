-- 1) RPC: validação por dia real (generate_series + hora_entrada IS NOT NULL)
CREATE OR REPLACE FUNCTION public.verificar_duplicidade_solicitacao(
  p_data_inicio date,
  p_data_fim date,
  p_funcionario_ids text[],
  p_solicitacao_atual_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_conflitos jsonb;
  v_numero text;
BEGIN
  IF p_funcionario_ids IS NULL OR array_length(p_funcionario_ids,1) IS NULL THEN
    RETURN jsonb_build_object('duplicada', false, 'numero_solicitacao','', 'funcionarios_conflito','[]'::jsonb);
  END IF;

  SELECT jsonb_agg(DISTINCT jsonb_build_object(
           'funcionario_id', p.funcionario_id,
           'nome', COALESCE(f.nome_completo, p.funcionario_id::text),
           'data', to_char(p.data,'YYYY-MM-DD'),
           'numero_solicitacao', s.numero_solicitacao
         ))
    INTO v_conflitos
  FROM generate_series(p_data_inicio, p_data_fim, interval '1 day') AS d(data)
  JOIN bd_diaria_presencas p           ON p.data = d.data::date
  JOIN bd_diaria_solicitacoes s        ON s.id = p.solicitacao_id
  LEFT JOIN bd_funcionarios f          ON f.id = p.funcionario_id
  WHERE p.funcionario_id::text = ANY(p_funcionario_ids)
    AND p.hora_entrada IS NOT NULL
    AND (p_solicitacao_atual_id IS NULL OR p.solicitacao_id <> p_solicitacao_atual_id)
    AND s.status NOT IN ('cancelado','reprovada','cancelada');

  IF v_conflitos IS NOT NULL AND jsonb_array_length(v_conflitos) > 0 THEN
    SELECT v_conflitos->0->>'numero_solicitacao' INTO v_numero;
    RETURN jsonb_build_object(
      'duplicada', true,
      'numero_solicitacao', COALESCE(v_numero,''),
      'funcionarios_conflito',
        (SELECT jsonb_agg(DISTINCT c->>'nome') FROM jsonb_array_elements(v_conflitos) c),
      'datas_conflito',
        (SELECT jsonb_agg(DISTINCT c->>'data') FROM jsonb_array_elements(v_conflitos) c)
    );
  END IF;

  RETURN jsonb_build_object('duplicada', false, 'numero_solicitacao','', 'funcionarios_conflito','[]'::jsonb);
END;
$function$;

-- 2) Trigger function em bd_diaria_solicitacoes: bloqueio por dia real
CREATE OR REPLACE FUNCTION public.check_convocados_pre_duplicidade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_funcionario_ids uuid[];
  v_conflito RECORD;
BEGIN
  IF NEW.status IN ('cancelado','reprovada','cancelada') THEN
    RETURN NEW;
  END IF;

  IF NEW.convocados_pre IS NULL OR jsonb_array_length(NEW.convocados_pre) = 0 THEN
    RETURN NEW;
  END IF;

  SELECT array_agg(DISTINCT (item->>'funcionario_id')::uuid)
    INTO v_funcionario_ids
  FROM jsonb_array_elements(NEW.convocados_pre) item
  WHERE item->>'funcionario_id' IS NOT NULL;

  IF v_funcionario_ids IS NULL OR array_length(v_funcionario_ids,1) IS NULL THEN
    RETURN NEW;
  END IF;

  -- Bloqueia somente se já houver presença REAL (hora_entrada preenchida)
  -- em outra solicitação ativa, em algum dia dentro do período desta solicitação.
  SELECT s.numero_solicitacao,
         f.nome_completo AS funcionario_nome,
         p.data
    INTO v_conflito
  FROM generate_series(NEW.data_inicio, NEW.data_fim, interval '1 day') AS d(data)
  JOIN bd_diaria_presencas p     ON p.data = d.data::date
  JOIN bd_diaria_solicitacoes s  ON s.id = p.solicitacao_id
  LEFT JOIN bd_funcionarios f    ON f.id = p.funcionario_id
  WHERE p.funcionario_id = ANY(v_funcionario_ids)
    AND p.hora_entrada IS NOT NULL
    AND s.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND s.status NOT IN ('cancelado','reprovada','cancelada')
  LIMIT 1;

  IF v_conflito.numero_solicitacao IS NOT NULL THEN
    RAISE EXCEPTION
      'FUNCIONARIO_DUPLICADO_NA_DATA: % já possui presença registrada na solicitação Nº % no dia %.',
      COALESCE(v_conflito.funcionario_nome,'Funcionário'),
      v_conflito.numero_solicitacao,
      to_char(v_conflito.data,'DD/MM/YYYY')
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$function$;

-- 3) Trigger function em bd_diaria_presencas: considerar apenas presença real
CREATE OR REPLACE FUNCTION public.check_presenca_funcionario_duplicidade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_outro_numero text;
  v_funcionario_nome text;
BEGIN
  -- Se a presença que está entrando NÃO tem hora_entrada, não bloqueia
  -- (presença planejada/falta não conflita com outras solicitações)
  IF NEW.hora_entrada IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT s.numero_solicitacao
    INTO v_outro_numero
  FROM bd_diaria_presencas p
  JOIN bd_diaria_solicitacoes s ON s.id = p.solicitacao_id
  WHERE p.funcionario_id = NEW.funcionario_id
    AND p.data = NEW.data
    AND p.hora_entrada IS NOT NULL
    AND p.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND p.solicitacao_id <> NEW.solicitacao_id
    AND s.status NOT IN ('cancelado','reprovada','cancelada')
  LIMIT 1;

  IF v_outro_numero IS NOT NULL THEN
    SELECT nome_completo INTO v_funcionario_nome
    FROM bd_funcionarios WHERE id = NEW.funcionario_id;

    RAISE EXCEPTION
      'FUNCIONARIO_DUPLICADO_NA_DATA: % já está em outra solicitação ativa (Nº %) na data %.',
      COALESCE(v_funcionario_nome, NEW.funcionario_id::text),
      v_outro_numero,
      to_char(NEW.data,'DD/MM/YYYY')
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$function$;