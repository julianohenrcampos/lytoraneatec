
-- =====================================================================
-- FASE 2.2 — M1: Funções SQL puras para cálculo financeiro de diária
-- =====================================================================
-- Espelho exato da regra do apontamento manual
-- (src/components/diarias/ApontamentoDiariasModal.tsx#calcularJornada/calcularValorDiaria
--  e supabase/functions/auto-finalizar-diarias).
-- Sem efeito colateral. Sem trigger. Sem cron.

-- 1) Cálculo puro: jornada -> (tipo_diaria, valor_diaria_aplicada)
CREATE OR REPLACE FUNCTION public.fn_calcular_diaria_aplicada(
  p_hora_entrada time,
  p_hora_saida   time,
  p_valor_base   numeric
)
RETURNS TABLE(tipo_diaria text, valor_diaria_aplicada numeric, horas_liquidas numeric, excede_12h boolean)
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  v_min int;
  v_horas_brutas numeric;
  v_horas_liq numeric;
  v_tipo text;
  v_mult numeric;
  v_excede12 boolean := false;
BEGIN
  IF p_hora_entrada IS NULL OR p_hora_saida IS NULL OR COALESCE(p_valor_base,0) <= 0 THEN
    tipo_diaria := NULL;
    valor_diaria_aplicada := 0;
    horas_liquidas := 0;
    excede_12h := false;
    RETURN NEXT;
    RETURN;
  END IF;

  -- minutos saida-entrada, +24h se negativo (turno noturno)
  v_min := (EXTRACT(HOUR FROM p_hora_saida)::int * 60 + EXTRACT(MINUTE FROM p_hora_saida)::int)
         - (EXTRACT(HOUR FROM p_hora_entrada)::int * 60 + EXTRACT(MINUTE FROM p_hora_entrada)::int);
  IF v_min < 0 THEN v_min := v_min + 24*60; END IF;

  v_horas_brutas := v_min::numeric / 60.0;
  -- desconto 1h almoço se bruto > 6h
  IF v_horas_brutas > 6 THEN
    v_horas_liq := v_horas_brutas - 1;
  ELSE
    v_horas_liq := v_horas_brutas;
  END IF;

  -- regra (idêntica ao frontend)
  IF v_horas_brutas > 12 THEN
    v_tipo := 'uma_e_meia'; v_mult := 1.5; v_excede12 := true;
  ELSIF v_horas_liq >= 9.75 THEN
    v_tipo := 'uma_e_meia'; v_mult := 1.5;
  ELSIF v_horas_liq >= 4.5 THEN
    v_tipo := 'completa'; v_mult := 1.0;
  ELSIF v_horas_liq > 0 THEN
    v_tipo := 'meia'; v_mult := 0.5;
  ELSE
    v_tipo := 'nenhuma'; v_mult := 0;
  END IF;

  tipo_diaria := v_tipo;
  valor_diaria_aplicada := ROUND((p_valor_base * v_mult)::numeric, 2);
  horas_liquidas := v_horas_liq;
  excede_12h := v_excede12;
  RETURN NEXT;
END;
$$;

-- 2) Resolução de base financeira a partir de convocados_pre + fallback bd_funcoes
-- Replica auto-finalizar-diarias: dia exclusivo = sábado/domingo OU feriado.
-- Prioridade exclusiva: bd_funcoes.valor_diaria_exclusiva > conv.valor_diaria_exclusiva > conv.valor_diaria
-- Prioridade comum:     bd_funcoes.valor_diaria > conv.valor_diaria
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
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$
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

  IF v_excl THEN
    valor_base := COALESCE(v_fn_vde, v_conv_vde, v_conv_vd, v_fn_vd, 0);
  ELSE
    valor_base := COALESCE(v_fn_vd, v_conv_vd, 0);
  END IF;
  valor_refeicao := COALESCE(v_conv_vref, v_fn_vref, 0);
  recebe_refeicao := COALESCE(v_conv_rr, true);
  usar_exclusiva := v_excl;
  funcao_id := v_funcao_id;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.fn_calcular_diaria_aplicada(time,time,numeric) IS
  'Fase 2.2 — regra financeira pura da diária (espelho de calcularJornada/calcularValorDiaria do modal manual).';
COMMENT ON FUNCTION public.fn_resolver_base_diaria(uuid,uuid,date) IS
  'Fase 2.2 — resolve valor_base/refeição/exclusividade a partir de convocados_pre + bd_funcoes + bd_feriados.';
