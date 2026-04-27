
-- =========================================================
-- 1. Função de cálculo dinâmico do valor da diária
-- =========================================================
CREATE OR REPLACE FUNCTION public.calcular_valor_diaria(
  p_data date,
  p_funcionario_id uuid,
  p_tipo_diaria text DEFAULT 'completa',
  p_usar_exclusiva_manual boolean DEFAULT false
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_funcao_id uuid;
  v_valor_normal numeric;
  v_valor_exclusiva numeric;
  v_eh_excecao boolean;
  v_dow int;
  v_valor_base numeric;
BEGIN
  IF p_data IS NULL OR p_funcionario_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT funcao_id INTO v_funcao_id
  FROM public.bd_funcionarios
  WHERE id = p_funcionario_id;

  IF v_funcao_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(valor_diaria, 0), COALESCE(valor_diaria_exclusiva, 0)
    INTO v_valor_normal, v_valor_exclusiva
  FROM public.bd_funcoes
  WHERE id = v_funcao_id;

  v_dow := EXTRACT(DOW FROM p_data);
  v_eh_excecao := (
    v_dow IN (0, 6)
    OR EXISTS (SELECT 1 FROM public.bd_feriados WHERE data = p_data)
    OR p_usar_exclusiva_manual
  );

  v_valor_base := CASE WHEN v_eh_excecao THEN v_valor_exclusiva ELSE v_valor_normal END;

  -- Tipo de diária
  IF p_tipo_diaria = 'meia' THEN
    RETURN ROUND(v_valor_base / 2.0, 2);
  END IF;

  RETURN v_valor_base;
END;
$$;

-- =========================================================
-- 2. Materialized View do relatório
-- =========================================================
DROP MATERIALIZED VIEW IF EXISTS public.mv_relatorio_diarias CASCADE;

CREATE MATERIALIZED VIEW public.mv_relatorio_diarias AS
SELECT
  p.id                              AS presenca_id,
  p.data                            AS data,
  p.solicitacao_id,
  p.funcionario_id,
  s.centro_custo_id,
  f.funcao_id,
  COALESCE(p.tipo_diaria, 'completa') AS tipo_diaria,
  p.presente,
  p.recebe_refeicao,
  COALESCE(p.usar_diaria_exclusiva, false) AS usar_diaria_exclusiva,
  -- Valor real aplicado quando existir; senão, valor calculado dinâmico
  COALESCE(
    p.valor_diaria_aplicada,
    public.calcular_valor_diaria(
      p.data, p.funcionario_id,
      COALESCE(p.tipo_diaria, 'completa'),
      COALESCE(p.usar_diaria_exclusiva, false)
    )
  )                                 AS valor_calculado,
  COALESCE(p.valor_refeicao_aplicado, 0) AS valor_refeicao,
  -- Snapshots
  f.nome_completo                   AS nome_funcionario,
  fn.nome_funcao                    AS nome_funcao,
  cc.codigo_centro_custo,
  cc.nome_centro_custo,
  s.numero_solicitacao,
  s.status_fluxo,
  -- Flag se o dia é exceção (FDS ou feriado)
  (
    EXTRACT(DOW FROM p.data) IN (0, 6)
    OR EXISTS (SELECT 1 FROM public.bd_feriados fer WHERE fer.data = p.data)
  )                                 AS eh_excecao
FROM public.bd_diaria_presencas p
JOIN public.bd_diaria_solicitacoes s ON s.id = p.solicitacao_id
LEFT JOIN public.bd_funcionarios f   ON f.id = p.funcionario_id
LEFT JOIN public.bd_funcoes fn       ON fn.id = COALESCE(p.funcao_id, f.funcao_id)
LEFT JOIN public.bd_centros_custo cc ON cc.id = s.centro_custo_id
WHERE p.presente IS DISTINCT FROM false;

-- Índices
CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_rel_diarias_presenca
  ON public.mv_relatorio_diarias (presenca_id);
CREATE INDEX IF NOT EXISTS ix_mv_rel_diarias_cc_data
  ON public.mv_relatorio_diarias (centro_custo_id, data DESC);
CREATE INDEX IF NOT EXISTS ix_mv_rel_diarias_data
  ON public.mv_relatorio_diarias (data DESC);
CREATE INDEX IF NOT EXISTS ix_mv_rel_diarias_func_data
  ON public.mv_relatorio_diarias (funcionario_id, data DESC);

-- =========================================================
-- 3. Tabela de flag dirty + triggers leves
-- =========================================================
CREATE TABLE IF NOT EXISTS public._mv_relatorio_diarias_dirty (
  id boolean PRIMARY KEY DEFAULT true,
  dirty boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT _mv_dirty_singleton CHECK (id = true)
);

INSERT INTO public._mv_relatorio_diarias_dirty (id, dirty)
VALUES (true, true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public._mv_relatorio_diarias_dirty ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dirty_no_access" ON public._mv_relatorio_diarias_dirty;
CREATE POLICY "dirty_no_access" ON public._mv_relatorio_diarias_dirty FOR ALL USING (false);

CREATE OR REPLACE FUNCTION public._mark_mv_relatorio_diarias_dirty()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public._mv_relatorio_diarias_dirty
     SET dirty = true, updated_at = now()
   WHERE id = true AND dirty = false;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_dirty_presencas ON public.bd_diaria_presencas;
CREATE TRIGGER trg_mark_dirty_presencas
AFTER INSERT OR UPDATE OR DELETE ON public.bd_diaria_presencas
FOR EACH STATEMENT EXECUTE FUNCTION public._mark_mv_relatorio_diarias_dirty();

DROP TRIGGER IF EXISTS trg_mark_dirty_solicitacoes ON public.bd_diaria_solicitacoes;
CREATE TRIGGER trg_mark_dirty_solicitacoes
AFTER INSERT OR UPDATE OR DELETE ON public.bd_diaria_solicitacoes
FOR EACH STATEMENT EXECUTE FUNCTION public._mark_mv_relatorio_diarias_dirty();

DROP TRIGGER IF EXISTS trg_mark_dirty_feriados ON public.bd_feriados;
CREATE TRIGGER trg_mark_dirty_feriados
AFTER INSERT OR UPDATE OR DELETE ON public.bd_feriados
FOR EACH STATEMENT EXECUTE FUNCTION public._mark_mv_relatorio_diarias_dirty();

DROP TRIGGER IF EXISTS trg_mark_dirty_funcoes ON public.bd_funcoes;
CREATE TRIGGER trg_mark_dirty_funcoes
AFTER INSERT OR UPDATE OR DELETE ON public.bd_funcoes
FOR EACH STATEMENT EXECUTE FUNCTION public._mark_mv_relatorio_diarias_dirty();

-- =========================================================
-- 4. Função de refresh seguro
-- =========================================================
CREATE OR REPLACE FUNCTION public.refresh_relatorio_diarias(p_force boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_dirty boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NAO_AUTENTICADO';
  END IF;

  SELECT dirty INTO v_dirty FROM public._mv_relatorio_diarias_dirty WHERE id = true;

  IF NOT p_force AND NOT COALESCE(v_dirty, true) THEN
    RETURN jsonb_build_object('refreshed', false, 'reason', 'not_dirty');
  END IF;

  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_relatorio_diarias;

  UPDATE public._mv_relatorio_diarias_dirty
     SET dirty = false, updated_at = now()
   WHERE id = true;

  RETURN jsonb_build_object('refreshed', true, 'at', now());
END;
$$;

-- População inicial
REFRESH MATERIALIZED VIEW public.mv_relatorio_diarias;
UPDATE public._mv_relatorio_diarias_dirty SET dirty = false WHERE id = true;

-- =========================================================
-- 5. pg_cron: refresh automático a cada 10 minutos se dirty
-- =========================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $do$
BEGIN
  PERFORM cron.unschedule('refresh-mv-relatorio-diarias');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$do$;

SELECT cron.schedule(
  'refresh-mv-relatorio-diarias',
  '*/10 * * * *',
  $cron$
  DO $$
  DECLARE v_dirty boolean;
  BEGIN
    SELECT dirty INTO v_dirty FROM public._mv_relatorio_diarias_dirty WHERE id = true;
    IF COALESCE(v_dirty, false) THEN
      REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_relatorio_diarias;
      UPDATE public._mv_relatorio_diarias_dirty SET dirty = false, updated_at = now() WHERE id = true;
    END IF;
  END
  $$;
  $cron$
);

-- =========================================================
-- 6. RPC paginada: get_relatorio_diarias
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_relatorio_diarias(
  p_data_inicio date,
  p_data_fim date,
  p_centro_custo_ids uuid[] DEFAULT NULL,
  p_funcionario_ids uuid[] DEFAULT NULL,
  p_offset int DEFAULT 0,
  p_limit int DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_global boolean;
  v_scope_ccs uuid[];
  v_limit int;
  v_rows jsonb;
  v_total bigint := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NAO_AUTENTICADO';
  END IF;

  IF p_data_inicio IS NULL OR p_data_fim IS NULL THEN
    RAISE EXCEPTION 'PERIODO_OBRIGATORIO';
  END IF;

  IF p_data_fim < p_data_inicio THEN
    RAISE EXCEPTION 'PERIODO_INVALIDO';
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);

  v_global := public.fn_diaria_has_global_access(v_uid);

  IF NOT v_global THEN
    SELECT COALESCE(array_agg(cc), ARRAY[]::uuid[])
      INTO v_scope_ccs
    FROM public.fn_diaria_scope_centros_custo(v_uid) AS cc;

    IF v_scope_ccs IS NULL OR array_length(v_scope_ccs, 1) IS NULL THEN
      RETURN jsonb_build_object('rows', '[]'::jsonb, 'total_count', 0);
    END IF;
  END IF;

  WITH base AS (
    SELECT m.*, COUNT(*) OVER() AS _total
    FROM public.mv_relatorio_diarias m
    WHERE m.data BETWEEN p_data_inicio AND p_data_fim
      AND (v_global OR m.centro_custo_id = ANY(v_scope_ccs))
      AND (p_centro_custo_ids IS NULL OR m.centro_custo_id = ANY(p_centro_custo_ids))
      AND (p_funcionario_ids IS NULL OR m.funcionario_id = ANY(p_funcionario_ids))
    ORDER BY m.data DESC, m.nome_funcionario ASC
    OFFSET GREATEST(p_offset, 0)
    LIMIT v_limit
  )
  SELECT
    COALESCE(jsonb_agg(to_jsonb(b) - '_total'), '[]'::jsonb),
    COALESCE(MAX(_total), 0)
  INTO v_rows, v_total
  FROM base b;

  RETURN jsonb_build_object('rows', v_rows, 'total_count', v_total);
END;
$$;

-- =========================================================
-- 7. RPC de exportação: get_relatorio_diarias_full
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_relatorio_diarias_full(
  p_data_inicio date,
  p_data_fim date,
  p_centro_custo_ids uuid[] DEFAULT NULL,
  p_funcionario_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_global boolean;
  v_scope_ccs uuid[];
  v_count bigint;
  v_rows jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NAO_AUTENTICADO';
  END IF;

  IF p_data_inicio IS NULL OR p_data_fim IS NULL THEN
    RAISE EXCEPTION 'PERIODO_OBRIGATORIO';
  END IF;

  IF p_data_fim < p_data_inicio THEN
    RAISE EXCEPTION 'PERIODO_INVALIDO';
  END IF;

  IF (p_data_fim - p_data_inicio) > 92 THEN
    RAISE EXCEPTION 'PERIODO_MAXIMO_EXCEDIDO';
  END IF;

  v_global := public.fn_diaria_has_global_access(v_uid);

  IF NOT v_global THEN
    SELECT COALESCE(array_agg(cc), ARRAY[]::uuid[])
      INTO v_scope_ccs
    FROM public.fn_diaria_scope_centros_custo(v_uid) AS cc;

    IF v_scope_ccs IS NULL OR array_length(v_scope_ccs, 1) IS NULL THEN
      RETURN jsonb_build_object('rows', '[]'::jsonb, 'total_count', 0);
    END IF;
  END IF;

  -- Cap defensivo de volume
  SELECT COUNT(*) INTO v_count
  FROM public.mv_relatorio_diarias m
  WHERE m.data BETWEEN p_data_inicio AND p_data_fim
    AND (v_global OR m.centro_custo_id = ANY(v_scope_ccs))
    AND (p_centro_custo_ids IS NULL OR m.centro_custo_id = ANY(p_centro_custo_ids))
    AND (p_funcionario_ids IS NULL OR m.funcionario_id = ANY(p_funcionario_ids));

  IF v_count > 50000 THEN
    RAISE EXCEPTION 'VOLUME_EXCEDIDO';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(m) ORDER BY m.data DESC, m.nome_funcionario ASC), '[]'::jsonb)
    INTO v_rows
  FROM public.mv_relatorio_diarias m
  WHERE m.data BETWEEN p_data_inicio AND p_data_fim
    AND (v_global OR m.centro_custo_id = ANY(v_scope_ccs))
    AND (p_centro_custo_ids IS NULL OR m.centro_custo_id = ANY(p_centro_custo_ids))
    AND (p_funcionario_ids IS NULL OR m.funcionario_id = ANY(p_funcionario_ids));

  RETURN jsonb_build_object('rows', v_rows, 'total_count', v_count);
END;
$$;

-- =========================================================
-- 8. Permissões de execução
-- =========================================================
GRANT EXECUTE ON FUNCTION public.calcular_valor_diaria(date, uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_relatorio_diarias(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_relatorio_diarias(date, date, uuid[], uuid[], int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_relatorio_diarias_full(date, date, uuid[], uuid[]) TO authenticated;
