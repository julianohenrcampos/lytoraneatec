
-- =====================================================================
-- 1) check_convocados_pre_duplicidade
-- =====================================================================
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
  v_d           text;
  v_conflito    RECORD;
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

-- =====================================================================
-- 2) check_presenca_funcionario_duplicidade
-- =====================================================================
CREATE OR REPLACE FUNCTION public.check_presenca_funcionario_duplicidade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tipo_new          text;
  v_status_new        text;
  v_funcionario_nome  text;
  v_new_start         timestamp;
  v_new_end           timestamp;
  v_p_start           timestamp;
  v_p_end             timestamp;
  r                   RECORD;
BEGIN
  IF NEW.is_excecao = true THEN RETURN NEW; END IF;
  IF NEW.hora_entrada IS NULL THEN RETURN NEW; END IF;

  SELECT LOWER(COALESCE(s.tipo_solicitacao, 'normal')),
         LOWER(COALESCE(s.status, ''))
    INTO v_tipo_new, v_status_new
  FROM public.bd_diaria_solicitacoes s
  WHERE s.id = NEW.solicitacao_id;

  IF v_status_new IN ('cancelado','cancelada','reprovada') THEN
    RETURN NEW;
  END IF;

  FOR r IN
    SELECT p.id, p.data, p.hora_entrada, p.hora_saida,
           s.numero_solicitacao,
           LOWER(COALESCE(s.tipo_solicitacao, 'normal')) AS tipo_p
      FROM public.bd_diaria_presencas p
      JOIN public.bd_diaria_solicitacoes s ON s.id = p.solicitacao_id
     WHERE p.funcionario_id = NEW.funcionario_id
       AND p.data IN (NEW.data - 1, NEW.data, NEW.data + 1)
       AND p.hora_entrada IS NOT NULL
       AND COALESCE(p.is_excecao, false) = false
       AND p.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
       AND p.solicitacao_id <> NEW.solicitacao_id
       AND LOWER(COALESCE(s.status, '')) NOT IN ('cancelado','cancelada','reprovada')
  LOOP
    IF v_tipo_new = 'normal' AND r.tipo_p = 'normal' AND r.data = NEW.data THEN
      SELECT nome_completo INTO v_funcionario_nome
        FROM public.bd_funcionarios WHERE id = NEW.funcionario_id;
      RAISE EXCEPTION
        'FUNCIONARIO_DUPLICADO_NA_DATA: % já está em outra solicitação ativa (Nº %) na data %.',
        COALESCE(v_funcionario_nome, NEW.funcionario_id::text),
        r.numero_solicitacao,
        to_char(NEW.data, 'DD/MM/YYYY')
        USING ERRCODE = '23505';
    END IF;

    IF (v_tipo_new = 'extraordinaria' OR r.tipo_p = 'extraordinaria') THEN
      IF NEW.hora_saida IS NULL OR r.hora_saida IS NULL THEN
        CONTINUE;
      END IF;

      v_new_start := NEW.data::timestamp + NEW.hora_entrada;
      v_new_end   := NEW.data::timestamp + NEW.hora_saida;
      IF NEW.hora_saida <= NEW.hora_entrada THEN
        v_new_end := v_new_end + interval '1 day';
      END IF;

      v_p_start := r.data::timestamp + r.hora_entrada;
      v_p_end   := r.data::timestamp + r.hora_saida;
      IF r.hora_saida <= r.hora_entrada THEN
        v_p_end := v_p_end + interval '1 day';
      END IF;

      IF v_new_start < v_p_end AND v_new_end > v_p_start THEN
        SELECT nome_completo INTO v_funcionario_nome
          FROM public.bd_funcionarios WHERE id = NEW.funcionario_id;
        RAISE EXCEPTION
          'FUNCIONARIO_HORARIO_SOBREPOSTO: % já possui presença sobreposta na solicitação Nº % em % (%-%).',
          COALESCE(v_funcionario_nome, NEW.funcionario_id::text),
          r.numero_solicitacao,
          to_char(r.data, 'DD/MM/YYYY'),
          to_char(r.hora_entrada, 'HH24:MI'),
          to_char(r.hora_saida,   'HH24:MI')
          USING ERRCODE = '23505';
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

-- =====================================================================
-- 3) Recriar trigger
-- =====================================================================
DROP TRIGGER IF EXISTS trg_check_presenca_funcionario_duplicidade
  ON public.bd_diaria_presencas;

CREATE TRIGGER trg_check_presenca_funcionario_duplicidade
BEFORE INSERT OR UPDATE OF
  funcionario_id, data, solicitacao_id, hora_entrada, hora_saida, is_excecao
ON public.bd_diaria_presencas
FOR EACH ROW
EXECUTE FUNCTION public.check_presenca_funcionario_duplicidade();
