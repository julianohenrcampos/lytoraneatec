-- A) get_funcionarios_ativos_global: incluir 'Férias'
CREATE OR REPLACE FUNCTION public.get_funcionarios_ativos_global(p_search text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_ids uuid[] DEFAULT NULL::uuid[], p_centro_custo uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, nome_completo text, cpf text, funcao_id uuid, centro_custo_id uuid, matricula text, status text, email text, nome_funcao text, valor_diaria numeric, valor_diaria_exclusiva numeric, valor_refeicao numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_term        text := NULLIF(btrim(p_search), '');
  v_term_lower  text;
  v_term_digits text;
  v_lim         int  := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  v_term_lower  := lower(v_term);
  v_term_digits := regexp_replace(COALESCE(v_term, ''), '\D', '', 'g');

  RETURN QUERY
  SELECT
    f.id, f.nome_completo, f.cpf, f.funcao_id, f.centro_custo_id, f.matricula,
    f.status, f.email, bf.nome_funcao,
    COALESCE(bf.valor_diaria, 0), bf.valor_diaria_exclusiva, COALESCE(bf.valor_refeicao, 0)
  FROM public.bd_funcionarios f
  LEFT JOIN public.bd_funcoes bf ON bf.id = f.funcao_id
  WHERE f.status IN ('Ativo','Ativo sem Registro','Férias')
    AND (
      (p_ids IS NOT NULL AND f.id = ANY(p_ids))
      OR (
        p_ids IS NULL
        AND (
          v_term IS NULL
          OR lower(f.nome_completo) LIKE '%' || v_term_lower || '%'
          OR (length(v_term_digits) >= 3 AND f.cpf LIKE '%' || v_term_digits || '%')
          OR (f.matricula IS NOT NULL AND f.matricula ILIKE '%' || v_term || '%')
          OR (bf.nome_funcao IS NOT NULL AND lower(bf.nome_funcao) LIKE '%' || v_term_lower || '%')
        )
      )
    )
  ORDER BY
    CASE WHEN p_centro_custo IS NOT NULL AND f.centro_custo_id = p_centro_custo THEN 0 ELSE 1 END,
    f.nome_completo ASC
  LIMIT v_lim;
END;
$function$;

-- B) fn_diaria_funcionario_elegibilidade: remover 'FÉRIAS'/'FERIAS' do bloqueio
-- e emitir alerta informando que todas as diárias usarão valor_diaria_exclusiva.
CREATE OR REPLACE FUNCTION public.fn_diaria_funcionario_elegibilidade(p_funcionario_id uuid, p_data_inicio date, p_data_fim date, p_solicitacao_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(elegivel boolean, motivo_bloqueio text, status text, alerta_mensagem text, conflito_solicitacao text, conflito_data date, conflito_solicitacao_id uuid, conflito_centro_custo text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_status text;
  v_is_ferias boolean := false;
  v_ferias_msg text := 'Funcionário em Férias — todas as diárias serão calculadas pelo valor de Diária Exclusiva.';
  v_block_numero text; v_block_data date; v_block_id uuid; v_block_cc text;
  v_alert_numero text; v_alert_data date; v_alert_id uuid; v_alert_cc text;
BEGIN
  BEGIN
    -- 1) STATUS RH
    SELECT COALESCE(NULLIF(TRIM(f.status), ''), 'Sem status') INTO v_status
    FROM public.bd_funcionarios f WHERE f.id = p_funcionario_id;

    IF v_status IS NULL THEN
      RETURN QUERY SELECT false, 'Funcionário não localizado para validação'::text,
        'bloqueado'::text, NULL::text, NULL::text, NULL::date, NULL::uuid, NULL::text;
      RETURN;
    END IF;

    -- Bloqueio duro apenas para status realmente inelegíveis (Férias removido)
    IF UPPER(v_status) IN ('INATIVO','INSS','AFASTADO','AVISO PRÉVIO','AVISO PREVIO') THEN
      RETURN QUERY SELECT false, format('Funcionário com status inelegível: %s', v_status)::text,
        'bloqueado'::text, NULL::text, NULL::text, NULL::date, NULL::uuid, NULL::text;
      RETURN;
    END IF;

    v_is_ferias := UPPER(v_status) IN ('FÉRIAS','FERIAS');

    -- 2) CONFLITO REAL (presença com hora_entrada) — inalterado
    SELECT s.numero_solicitacao, p.data, s.id,
      COALESCE(cc.codigo_centro_custo,'') ||
        CASE WHEN cc.nome_centro_custo IS NOT NULL THEN ' - ' || cc.nome_centro_custo ELSE '' END
      INTO v_block_numero, v_block_data, v_block_id, v_block_cc
    FROM generate_series(p_data_inicio, p_data_fim, interval '1 day') AS d(data_ref)
    JOIN public.bd_diaria_presencas p
      ON p.funcionario_id = p_funcionario_id AND p.data = d.data_ref::date
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
        format('Funcionário já apontado na solicitação %s%s em %s. Inclusão exigirá justificativa.%s',
          v_block_numero,
          CASE WHEN v_block_cc <> '' THEN ' (' || v_block_cc || ')' ELSE '' END,
          to_char(v_block_data, 'DD/MM/YYYY'),
          CASE WHEN v_is_ferias THEN ' ' || v_ferias_msg ELSE '' END)::text,
        v_block_numero, v_block_data, v_block_id, v_block_cc;
      RETURN;
    END IF;

    -- 3) PREVISÃO sem entrada (permitido) — inalterado
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
           ((c.item ? 'data') AND (c.item->>'data')::date = d.data_ref::date)
           OR
           (NOT (c.item ? 'data') AND s.data_inicio = s.data_fim AND s.data_inicio = d.data_ref::date)
         )
     )
    LEFT JOIN public.bd_centros_custo cc ON cc.id = s.centro_custo_id
    ORDER BY d.data_ref
    LIMIT 1;

    IF v_alert_numero IS NULL THEN
      SELECT s.numero_solicitacao, p.data, s.id,
        COALESCE(cc.codigo_centro_custo,'') ||
          CASE WHEN cc.nome_centro_custo IS NOT NULL THEN ' - ' || cc.nome_centro_custo ELSE '' END
        INTO v_alert_numero, v_alert_data, v_alert_id, v_alert_cc
      FROM generate_series(p_data_inicio, p_data_fim, interval '1 day') AS d(data_ref)
      JOIN public.bd_diaria_presencas p
        ON p.funcionario_id = p_funcionario_id AND p.data = d.data_ref::date
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
        ('Funcionário previsto em outra obra, mas ainda sem apontamento. Pode prosseguir.' ||
         CASE WHEN v_is_ferias THEN ' ' || v_ferias_msg ELSE '' END)::text,
        v_alert_numero, v_alert_data, v_alert_id, v_alert_cc;
      RETURN;
    END IF;

    -- 4) LIVRE (ou Férias sem conflito → permitido com alerta informativo)
    IF v_is_ferias THEN
      RETURN QUERY SELECT true, NULL::text, 'permitido'::text,
        v_ferias_msg, NULL::text, NULL::date, NULL::uuid, NULL::text;
      RETURN;
    END IF;

    RETURN QUERY SELECT true, NULL::text, 'livre'::text,
      NULL::text, NULL::text, NULL::date, NULL::uuid, NULL::text;

  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT false, format('Falha na validação de elegibilidade: %s', SQLERRM)::text,
      'bloqueado'::text, NULL::text, NULL::text, NULL::date, NULL::uuid, NULL::text;
  END;
END;
$function$;