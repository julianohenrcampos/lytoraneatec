CREATE OR REPLACE FUNCTION public.check_convocados_pre_duplicidade()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_item        jsonb;
  v_func_id     uuid;
  v_data_item   date;
  v_data_valida boolean;
  v_dias_arr    jsonb;
  v_datas       date[];
  v_datas_delta date[];
  v_d           text;
  v_conflito    RECORD;
  v_old_pares   jsonb := '{}'::jsonb; -- map funcionario_id::text -> array de datas (YYYY-MM-DD)
  v_old_datas   jsonb;
  v_data_txt    text;
  v_has_new     boolean;
BEGIN
  IF LOWER(COALESCE(NEW.status, '')) IN ('cancelado','cancelada','reprovada') THEN
    RETURN NEW;
  END IF;

  IF LOWER(COALESCE(NEW.tipo_solicitacao, 'normal')) = 'extraordinaria' THEN
    RETURN NEW;
  END IF;

  IF NEW.convocados_pre IS NULL OR jsonb_array_length(NEW.convocados_pre) = 0 THEN
    RETURN NEW;
  END IF;

  -- Delta-check: em UPDATE, monta mapa funcionario_id -> set de datas já presentes em OLD.
  -- Itens/data idênticos a OLD são pulados (não revalidados). Itens novos ou datas novas
  -- de funcionário existente são validados normalmente.
  IF TG_OP = 'UPDATE' AND OLD.convocados_pre IS NOT NULL AND jsonb_array_length(OLD.convocados_pre) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(OLD.convocados_pre) LOOP
      v_func_id := NULLIF(v_item ->> 'funcionario_id', '')::uuid;
      IF v_func_id IS NULL THEN CONTINUE; END IF;

      v_old_datas := COALESCE(v_old_pares -> v_func_id::text, '[]'::jsonb);

      IF v_item ? 'data' AND COALESCE(v_item ->> 'data','') <> '' THEN
        BEGIN
          v_data_txt := (v_item ->> 'data')::date::text;
          v_old_datas := v_old_datas || to_jsonb(v_data_txt);
        EXCEPTION WHEN others THEN NULL;
        END;
      END IF;

      IF v_item ? 'dias_solicitados'
         AND jsonb_typeof(v_item -> 'dias_solicitados') = 'array' THEN
        FOR v_d IN SELECT jsonb_array_elements_text(v_item -> 'dias_solicitados') LOOP
          BEGIN
            v_data_txt := v_d::date::text;
            v_old_datas := v_old_datas || to_jsonb(v_data_txt);
          EXCEPTION WHEN others THEN NULL;
          END;
        END LOOP;
      END IF;

      v_old_pares := jsonb_set(v_old_pares, ARRAY[v_func_id::text], v_old_datas, true);
    END LOOP;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.convocados_pre) LOOP
    v_func_id := NULLIF(v_item ->> 'funcionario_id', '')::uuid;
    IF v_func_id IS NULL THEN CONTINUE; END IF;

    v_datas       := NULL;
    v_data_valida := false;

    IF v_item ? 'data' AND COALESCE(v_item ->> 'data','') <> '' THEN
      BEGIN
        v_data_item   := (v_item ->> 'data')::date;
        v_datas       := ARRAY[v_data_item];
        v_data_valida := true;
      EXCEPTION WHEN others THEN
        v_data_valida := false;
      END;
    END IF;

    IF NOT v_data_valida
       AND v_item ? 'dias_solicitados'
       AND jsonb_typeof(v_item -> 'dias_solicitados') = 'array'
       AND jsonb_array_length(v_item -> 'dias_solicitados') > 0
    THEN
      v_dias_arr := v_item -> 'dias_solicitados';
      v_datas    := ARRAY[]::date[];
      FOR v_d IN SELECT jsonb_array_elements_text(v_dias_arr) LOOP
        BEGIN
          v_datas := v_datas || v_d::date;
        EXCEPTION WHEN others THEN
          NULL;
        END;
      END LOOP;

      IF array_length(v_datas, 1) IS NULL THEN
        RAISE EXCEPTION
          'DIAS_SOLICITADOS_INVALIDO: funcionário sem datas válidas para validação.'
          USING ERRCODE = '22023';
      END IF;
      v_data_valida := true;
    END IF;

    -- Delta-check: remove de v_datas as datas já existentes em OLD para esse funcionário.
    IF TG_OP = 'UPDATE' AND v_data_valida AND v_datas IS NOT NULL THEN
      v_old_datas := v_old_pares -> v_func_id::text;
      IF v_old_datas IS NOT NULL AND jsonb_typeof(v_old_datas) = 'array' THEN
        v_datas_delta := ARRAY(
          SELECT d FROM unnest(v_datas) AS d
          WHERE NOT (v_old_datas @> to_jsonb(d::text))
        );
        v_datas := v_datas_delta;
        IF v_datas IS NULL OR array_length(v_datas, 1) IS NULL THEN
          CONTINUE; -- nada novo para esse funcionário; pula validação
        END IF;
      END IF;
    END IF;

    IF v_data_valida THEN
      SELECT s.numero_solicitacao, f.nome_completo AS funcionario_nome, p.data
        INTO v_conflito
      FROM public.bd_diaria_presencas p
      JOIN public.bd_diaria_solicitacoes s ON s.id = p.solicitacao_id
      LEFT JOIN public.bd_funcionarios f   ON f.id = p.funcionario_id
      WHERE p.funcionario_id = v_func_id
        AND p.data = ANY(v_datas)
        AND p.hora_entrada IS NOT NULL
        AND COALESCE(p.is_excecao, false) = false
        AND s.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND LOWER(COALESCE(s.status, '')) NOT IN ('cancelado','cancelada','reprovada')
        AND LOWER(COALESCE(s.tipo_solicitacao, 'normal')) = 'normal'
      LIMIT 1;
    ELSE
      -- Item sem data nem dias_solicitados (formato apontamento_dia incompleto).
      -- Em UPDATE, só valida se o funcionário não existia em OLD (item totalmente novo).
      IF TG_OP = 'UPDATE' AND (v_old_pares ? v_func_id::text) THEN
        CONTINUE;
      END IF;

      SELECT s.numero_solicitacao, f.nome_completo AS funcionario_nome, p.data
        INTO v_conflito
      FROM generate_series(NEW.data_inicio, NEW.data_fim, interval '1 day') AS d(data)
      JOIN public.bd_diaria_presencas p     ON p.data = d.data::date
      JOIN public.bd_diaria_solicitacoes s  ON s.id = p.solicitacao_id
      LEFT JOIN public.bd_funcionarios f    ON f.id = p.funcionario_id
      WHERE p.funcionario_id = v_func_id
        AND p.hora_entrada IS NOT NULL
        AND COALESCE(p.is_excecao, false) = false
        AND s.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND LOWER(COALESCE(s.status, '')) NOT IN ('cancelado','cancelada','reprovada')
        AND LOWER(COALESCE(s.tipo_solicitacao, 'normal')) = 'normal'
      LIMIT 1;
    END IF;

    IF v_conflito.numero_solicitacao IS NOT NULL THEN
      RAISE EXCEPTION
        'FUNCIONARIO_DUPLICADO_NA_DATA: % já possui presença registrada na solicitação Nº % no dia %.',
        COALESCE(v_conflito.funcionario_nome, 'Funcionário'),
        v_conflito.numero_solicitacao,
        to_char(v_conflito.data, 'DD/MM/YYYY')
        USING ERRCODE = '23505';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;