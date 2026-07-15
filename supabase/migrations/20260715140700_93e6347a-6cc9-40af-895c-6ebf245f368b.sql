-- Regra oficial: funcionário com status='Férias' SEMPRE recebe valor_diaria_exclusiva
-- (base extraordinária), sobrepondo o ramo de FDS/feriado. Preserva contrato e fallbacks.
CREATE OR REPLACE FUNCTION public.fn_resolver_base_diaria(
  p_solicitacao_id uuid,
  p_funcionario_id uuid,
  p_data date
)
RETURNS TABLE(
  valor_base numeric,
  valor_refeicao numeric,
  recebe_refeicao boolean,
  usar_exclusiva boolean,
  funcao_id uuid
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_dow int;
  v_is_feriado boolean;
  v_excl boolean;
  v_conv jsonb;
  v_funcao_id uuid;
  v_fn_vd numeric;
  v_fn_vde numeric;
  v_fn_vref numeric;
  v_conv_vd numeric;
  v_conv_vde numeric;
  v_conv_vref numeric;
  v_conv_rr boolean;
  v_status_func text;
  v_is_ferias boolean := false;
BEGIN
  v_dow := EXTRACT(DOW FROM p_data)::int; -- 0=Sun, 6=Sat
  SELECT EXISTS(SELECT 1 FROM bd_feriados WHERE data = p_data) INTO v_is_feriado;
  v_excl := (v_dow = 0 OR v_dow = 6 OR v_is_feriado);

  -- Procurar item do funcionário em convocados_pre
  SELECT c
    INTO v_conv
  FROM bd_diaria_solicitacoes s
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s.convocados_pre,'[]'::jsonb)) c
  WHERE s.id = p_solicitacao_id
    AND (c->>'funcionario_id')::uuid = p_funcionario_id
  LIMIT 1;

  IF v_conv IS NOT NULL THEN
    v_funcao_id := NULLIF(v_conv->>'funcao_id','')::uuid;
    v_conv_vd   := NULLIF(v_conv->>'valor_diaria','')::numeric;
    v_conv_vde  := NULLIF(v_conv->>'valor_diaria_exclusiva','')::numeric;
    v_conv_vref := NULLIF(v_conv->>'valor_refeicao','')::numeric;
    v_conv_rr   := CASE WHEN v_conv ? 'recebe_refeicao' THEN (v_conv->>'recebe_refeicao')::boolean ELSE NULL END;
  END IF;

  -- Fallback: bd_funcionarios.funcao_id se convocado não trouxe
  IF v_funcao_id IS NULL THEN
    SELECT f.funcao_id INTO v_funcao_id FROM bd_funcionarios f WHERE f.id = p_funcionario_id;
  END IF;

  IF v_funcao_id IS NOT NULL THEN
    SELECT fn.valor_diaria, fn.valor_diaria_exclusiva, fn.valor_refeicao
      INTO v_fn_vd, v_fn_vde, v_fn_vref
    FROM bd_funcoes fn WHERE fn.id = v_funcao_id;
  END IF;

  -- REGRA NOVA: funcionário em Férias => base sempre exclusiva
  SELECT f.status INTO v_status_func FROM bd_funcionarios f WHERE f.id = p_funcionario_id;
  v_is_ferias := (TRIM(COALESCE(v_status_func, '')) ILIKE 'Férias' OR TRIM(COALESCE(v_status_func, '')) ILIKE 'Ferias');

  IF v_is_ferias OR v_excl THEN
    valor_base := COALESCE(v_fn_vde, v_conv_vde, v_conv_vd, v_fn_vd, 0);
    usar_exclusiva := true;
  ELSE
    valor_base := COALESCE(v_fn_vd, v_conv_vd, 0);
    usar_exclusiva := false;
  END IF;

  valor_refeicao := COALESCE(v_conv_vref, v_fn_vref, 0);
  recebe_refeicao := COALESCE(v_conv_rr, true);
  funcao_id := v_funcao_id;
  RETURN NEXT;
END;
$function$;