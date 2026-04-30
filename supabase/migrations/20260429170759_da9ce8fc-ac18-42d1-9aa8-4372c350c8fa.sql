CREATE OR REPLACE FUNCTION public.fn_diaria_funcionario_elegibilidade(
  p_funcionario_id uuid,
  p_data_inicio date,
  p_data_fim date,
  p_solicitacao_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  elegivel boolean,
  motivo_bloqueio text,
  status text,
  alerta_mensagem text,
  conflito_solicitacao text,
  conflito_data date,
  conflito_solicitacao_id uuid,
  conflito_centro_custo text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status text;
  v_block_numero text; v_block_data date; v_block_id uuid; v_block_cc text;
  v_alert_numero text; v_alert_data date; v_alert_id uuid; v_alert_cc text;
BEGIN
  BEGIN
    -- ============================================================
    -- 1) STATUS RH (bloqueio duro, inalterado)
    -- ============================================================
    SELECT COALESCE(NULLIF(TRIM(f.status), ''), 'Sem status') INTO v_status
    FROM public.bd_funcionarios f WHERE f.id = p_funcionario_id;

    IF v_status IS NULL THEN
      RETURN QUERY SELECT false, 'Funcionário não localizado para validação'::text,
        'bloqueado'::text, NULL::text, NULL::text, NULL::date, NULL::uuid, NULL::text;
      RETURN;
    END IF;

    IF UPPER(v_status) IN ('INATIVO','INSS','AFASTADO','FÉRIAS','FERIAS') THEN
      RETURN QUERY SELECT false, format('Funcionário com status inelegível: %s', v_status)::text,
        'bloqueado'::text, NULL::text, NULL::text, NULL::date, NULL::uuid, NULL::text;
      RETURN;
    END IF;

    -- ============================================================
    -- 2) CONFLITO REAL (alerta) — DIA A DIA via generate_series
    --    Igualdade EXATA de p.data com cada dia do range.
    --    Exceções aprovadas não geram novo conflito.
    -- ============================================================
    SELECT s.numero_solicitacao, p.data, s.id,
      COALESCE(cc.codigo_centro_custo,'') ||
        CASE WHEN cc.nome_centro_custo IS NOT NULL THEN ' - ' || cc.nome_centro_custo ELSE '' END
      INTO v_block_numero, v_block_data, v_block_id, v_block_cc
    FROM generate_series(p_data_inicio, p_data_fim, interval '1 day') AS d(data_ref)
    JOIN public.bd_diaria_presencas p
      ON p.funcionario_id = p_funcionario_id
     AND p.data = d.data_ref::date
    JOIN public.bd_diaria_solicitacoes s ON s.id = p.solicitacao_id
    LEFT JOIN public.bd_centros_custo cc ON cc.id = s.centro_custo_id
    WHERE p.hora_entrada IS NOT NULL
      AND COALESCE(p.is_excecao, false) = false
      AND COALESCE(s.status, '') NOT IN ('cancelado','cancelada','reprovada')
      AND (p_solicitacao_id IS NULL OR s.id <> p_solicitacao_id)
    ORDER BY p.data
    LIMIT 1;

    IF v_block_numero IS NOT NULL THEN
      RETURN QUERY SELECT true, NULL::text, 'alerta'::text,
        format('Funcionário já apontado na solicitação %s%s em %s. Inclusão exigirá justificativa.',
          v_block_numero,
          CASE WHEN v_block_cc <> '' THEN ' (' || v_block_cc || ')' ELSE '' END,
          to_char(v_block_data, 'DD/MM/YYYY'))::text,
        v_block_numero, v_block_data, v_block_id, v_block_cc;
      RETURN;
    END IF;

    -- ============================================================
    -- 3) PREVISÃO sem entrada (permitido) — DIA A DIA
    --    3a) convocados_pre com mesma data
    -- ============================================================
    SELECT s.numero_solicitacao, d.data_ref::date, s.id,
      COALESCE(cc.codigo_centro_custo,'') ||
        CASE WHEN cc.nome_centro_custo IS NOT NULL THEN ' - ' || cc.nome_centro_custo ELSE '' END
      INTO v_alert_numero, v_alert_data, v_alert_id, v_alert_cc
    FROM generate_series(p_data_inicio, p_data_fim, interval '1 day') AS d(data_ref)
    JOIN public.bd_diaria_solicitacoes s
      ON COALESCE(s.status, '') NOT IN ('cancelado','cancelada','reprovada')
     AND (p_solicitacao_id IS NULL OR s.id <> p_solicitacao_id)
     AND s.convocados_pre IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM jsonb_array_elements(s.convocados_pre) AS c(item)
       WHERE (c.item->>'funcionario_id')::uuid = p_funcionario_id
         AND (
           -- Caso ideal: cada item carrega sua própria data
           ((c.item ? 'data') AND (c.item->>'data')::date = d.data_ref::date)
           OR
           -- Fallback: solicitação de um único dia coincidindo com d.data_ref
           (NOT (c.item ? 'data') AND s.data_inicio = s.data_fim AND s.data_inicio = d.data_ref::date)
         )
     )
    LEFT JOIN public.bd_centros_custo cc ON cc.id = s.centro_custo_id
    ORDER BY d.data_ref
    LIMIT 1;

    -- 3b) Se não achou em convocados_pre, busca presença SEM hora_entrada na data exata
    IF v_alert_numero IS NULL THEN
      SELECT s.numero_solicitacao, p.data, s.id,
        COALESCE(cc.codigo_centro_custo,'') ||
          CASE WHEN cc.nome_centro_custo IS NOT NULL THEN ' - ' || cc.nome_centro_custo ELSE '' END
        INTO v_alert_numero, v_alert_data, v_alert_id, v_alert_cc
      FROM generate_series(p_data_inicio, p_data_fim, interval '1 day') AS d(data_ref)
      JOIN public.bd_diaria_presencas p
        ON p.funcionario_id = p_funcionario_id
       AND p.data = d.data_ref::date
      JOIN public.bd_diaria_solicitacoes s ON s.id = p.solicitacao_id
      LEFT JOIN public.bd_centros_custo cc ON cc.id = s.centro_custo_id
      WHERE p.hora_entrada IS NULL
        AND COALESCE(p.is_excecao, false) = false
        AND COALESCE(s.status, '') NOT IN ('cancelado','cancelada','reprovada')
        AND (p_solicitacao_id IS NULL OR s.id <> p_solicitacao_id)
      ORDER BY p.data
      LIMIT 1;
    END IF;

    IF v_alert_numero IS NOT NULL THEN
      RETURN QUERY SELECT true, NULL::text, 'permitido'::text,
        'Funcionário previsto em outra obra, mas ainda sem apontamento. Pode prosseguir.'::text,
        v_alert_numero, v_alert_data, v_alert_id, v_alert_cc;
      RETURN;
    END IF;

    -- ============================================================
    -- 4) LIVRE
    -- ============================================================
    RETURN QUERY SELECT true, NULL::text, 'livre'::text,
      NULL::text, NULL::text, NULL::date, NULL::uuid, NULL::text;

  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT false, format('Falha na validação de elegibilidade: %s', SQLERRM)::text,
      'bloqueado'::text, NULL::text, NULL::text, NULL::date, NULL::uuid, NULL::text;
  END;
END;
$function$;