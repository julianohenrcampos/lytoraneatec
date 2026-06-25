-- =====================================================
-- Fase 2D — fn_backfill_lotes_dry_run (read-only)
-- =====================================================
CREATE OR REPLACE FUNCTION public.fn_backfill_lotes_dry_run(
  p_solicitacao_id uuid DEFAULT NULL,
  p_limit          int  DEFAULT NULL
)
RETURNS TABLE (
  solicitacao_id                uuid,
  numero_solicitacao            text,
  centro_custo_id               uuid,
  periodo_inicio                date,
  periodo_fim                   date,
  dias_periodo                  int,
  convocados_pre_qtd            int,
  itens_legado_sem_data_qtd     int,
  itens_apontamento_dia_qtd     int,
  lotes_simulados               int,
  itens_simulados               int,
  valor_total_simulado_diaria   numeric,
  valor_total_simulado_refeicao numeric,
  status_simulado               text,
  inconsistencias_bloqueantes   jsonb,
  warnings                      jsonb,
  pode_migrar                   boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $fn$
DECLARE
  v_known_keys text[] := ARRAY[
    'funcionario_id','funcao_id','nome_funcionario','nome_funcao',
    'cpf','matricula','valor_diaria','valor_diaria_exclusiva',
    'valor_refeicao','usar_diaria_exclusiva',
    'origem_inclusao','data','extras'
  ];
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT
      s.id,
      s.numero_solicitacao::text                    AS numero_solicitacao,
      s.centro_custo_id,
      s.data_inicio                                 AS periodo_inicio,
      s.data_fim                                    AS periodo_fim,
      s.status                                      AS status_origem,
      COALESCE(s.convocados_pre, '[]'::jsonb)       AS convocados_pre,
      s.created_at
    FROM public.bd_diaria_solicitacoes s
    WHERE (p_solicitacao_id IS NULL OR s.id = p_solicitacao_id)
    ORDER BY s.created_at ASC, s.id ASC
    LIMIT CASE WHEN p_limit IS NULL THEN NULL ELSE p_limit END
  ),
  -- Itens do jsonb com campos normalizados (root + extras)
  items AS (
    SELECT
      b.id AS sol_id,
      b.periodo_inicio,
      b.periodo_fim,
      ord.idx,
      elem,
      COALESCE(elem->>'origem_inclusao',
               elem->'extras'->>'origem_inclusao')               AS origem_inclusao,
      NULLIF(COALESCE(elem->>'data',
                      elem->'extras'->>'data'), '')              AS data_txt,
      NULLIF(elem->>'funcionario_id','')::uuid                   AS funcionario_id,
      NULLIF(elem->>'funcao_id','')::uuid                        AS funcao_id,
      NULLIF(elem->>'valor_diaria','')::numeric                  AS valor_diaria,
      NULLIF(elem->>'valor_refeicao','')::numeric                AS valor_refeicao,
      NULLIF(elem->>'valor_diaria_exclusiva','')::numeric        AS valor_diaria_exclusiva,
      COALESCE((elem->>'usar_diaria_exclusiva')::boolean, false) AS usar_diaria_exclusiva
    FROM base b
    LEFT JOIN LATERAL jsonb_array_elements(b.convocados_pre)
      WITH ORDINALITY AS ord(elem, idx) ON true
  ),
  -- Conversão segura da data
  items2 AS (
    SELECT
      i.*,
      CASE
        WHEN i.data_txt IS NULL THEN NULL
        WHEN i.data_txt ~ '^\d{4}-\d{2}-\d{2}' THEN
          (SUBSTRING(i.data_txt FROM 1 FOR 10))::date
        ELSE NULL
      END AS data_item
    FROM items i
    WHERE i.elem IS NOT NULL
  ),
  -- Validações por item
  items_val AS (
    SELECT
      i.*,
      (i.origem_inclusao = 'apontamento_dia')                                    AS is_apontamento_dia,
      (i.funcionario_id IS NULL OR f.id IS NULL)                                 AS func_invalido,
      (i.funcao_id IS NULL OR fc.id IS NULL)                                     AS funcao_invalida,
      (i.valor_diaria IS NULL OR i.valor_diaria <= 0)                            AS vdiaria_invalido,
      (i.valor_refeicao IS NULL OR i.valor_refeicao < 0)                         AS vref_invalido,
      f.status                                                                   AS func_status,
      -- chaves desconhecidas
      (
        SELECT COALESCE(array_agg(k), ARRAY[]::text[])
        FROM jsonb_object_keys(i.elem) k
        WHERE k <> ALL (v_known_keys)
      )                                                                          AS extras_desconhecidos_keys
    FROM items2 i
    LEFT JOIN public.bd_funcionarios f  ON f.id  = i.funcionario_id
    LEFT JOIN public.bd_funcoes      fc ON fc.id = i.funcao_id
  ),
  -- Itens expandidos (somente os que serão "materializados" em simulação)
  items_exp AS (
    SELECT
      iv.sol_id,
      iv.valor_diaria,
      iv.valor_refeicao
    FROM items_val iv
    CROSS JOIN LATERAL (
      SELECT d::date AS data_gerada
      FROM generate_series(iv.periodo_inicio, iv.periodo_fim, '1 day') d
      WHERE NOT iv.is_apontamento_dia
        AND NOT iv.func_invalido
        AND NOT iv.funcao_invalida
        AND NOT iv.vdiaria_invalido
        AND NOT iv.vref_invalido
        AND iv.periodo_inicio IS NOT NULL
        AND iv.periodo_fim   IS NOT NULL
      UNION ALL
      SELECT iv.data_item
      WHERE iv.is_apontamento_dia
        AND iv.data_item IS NOT NULL
        AND iv.data_item BETWEEN iv.periodo_inicio AND iv.periodo_fim
        AND NOT iv.func_invalido
        AND NOT iv.funcao_invalida
        AND NOT iv.vdiaria_invalido
        AND NOT iv.vref_invalido
    ) ex
  ),
  -- Agregação financeira e contagens
  agg_items AS (
    SELECT
      sol_id,
      COUNT(*)::int                  AS itens_simulados,
      COALESCE(SUM(valor_diaria),0)  AS total_diaria,
      COALESCE(SUM(valor_refeicao),0) AS total_refeicao
    FROM items_exp
    GROUP BY sol_id
  ),
  agg_cat AS (
    SELECT
      sol_id,
      COUNT(*) FILTER (WHERE NOT is_apontamento_dia)::int AS itens_legado_sem_data_qtd,
      COUNT(*) FILTER (WHERE is_apontamento_dia)::int     AS itens_apontamento_dia_qtd
    FROM items_val
    GROUP BY sol_id
  ),
  -- Bloqueantes por item
  blocks AS (
    SELECT iv.sol_id, jsonb_build_object('codigo','funcionario_id_invalido','detalhe', jsonb_build_object('idx',iv.idx)) AS b
      FROM items_val iv WHERE iv.func_invalido
    UNION ALL
    SELECT iv.sol_id, jsonb_build_object('codigo','funcao_id_invalido','detalhe', jsonb_build_object('idx',iv.idx))
      FROM items_val iv WHERE iv.funcao_invalida
    UNION ALL
    SELECT iv.sol_id, jsonb_build_object('codigo','valor_diaria_invalido','detalhe', jsonb_build_object('idx',iv.idx))
      FROM items_val iv WHERE iv.vdiaria_invalido
    UNION ALL
    SELECT iv.sol_id, jsonb_build_object('codigo','valor_refeicao_invalido','detalhe', jsonb_build_object('idx',iv.idx))
      FROM items_val iv WHERE iv.vref_invalido
    UNION ALL
    SELECT iv.sol_id, jsonb_build_object('codigo','apontamento_dia_sem_data','detalhe', jsonb_build_object('idx',iv.idx))
      FROM items_val iv WHERE iv.is_apontamento_dia AND iv.data_item IS NULL
    UNION ALL
    SELECT iv.sol_id, jsonb_build_object('codigo','data_fora_do_periodo','detalhe', jsonb_build_object('idx',iv.idx,'data',iv.data_item))
      FROM items_val iv
      WHERE iv.is_apontamento_dia
        AND iv.data_item IS NOT NULL
        AND iv.periodo_inicio IS NOT NULL AND iv.periodo_fim IS NOT NULL
        AND (iv.data_item < iv.periodo_inicio OR iv.data_item > iv.periodo_fim)
  ),
  -- Bloqueantes por solicitação
  blocks_sol AS (
    SELECT b.id AS sol_id, jsonb_build_object('codigo','solicitacao_sem_periodo') AS b
      FROM base b WHERE b.periodo_inicio IS NULL OR b.periodo_fim IS NULL
    UNION ALL
    SELECT b.id, jsonb_build_object('codigo','convocados_pre_vazio')
      FROM base b WHERE jsonb_array_length(b.convocados_pre) = 0
    UNION ALL
    SELECT b.id, jsonb_build_object('codigo','centro_custo_invalido')
      FROM base b LEFT JOIN public.bd_centros_custo cc ON cc.id = b.centro_custo_id
      WHERE b.centro_custo_id IS NULL OR cc.id IS NULL
  ),
  blocks_all AS (
    SELECT sol_id, b FROM blocks
    UNION ALL
    SELECT sol_id, b FROM blocks_sol
  ),
  blocks_agg AS (
    SELECT sol_id, jsonb_agg(b) AS arr FROM blocks_all GROUP BY sol_id
  ),
  -- Warnings
  warns AS (
    SELECT iv.sol_id, jsonb_build_object('codigo','extras_desconhecidos','detalhe', jsonb_build_object('idx',iv.idx,'keys', to_jsonb(iv.extras_desconhecidos_keys))) AS w
      FROM items_val iv WHERE array_length(iv.extras_desconhecidos_keys,1) > 0
    UNION ALL
    SELECT iv.sol_id, jsonb_build_object('codigo','valor_diaria_exclusiva_sem_flag','detalhe', jsonb_build_object('idx',iv.idx))
      FROM items_val iv WHERE iv.valor_diaria_exclusiva IS NOT NULL AND NOT iv.usar_diaria_exclusiva
    UNION ALL
    SELECT iv.sol_id, jsonb_build_object('codigo','funcionario_inativo','detalhe', jsonb_build_object('idx',iv.idx,'status',iv.func_status))
      FROM items_val iv
      WHERE NOT iv.func_invalido
        AND iv.func_status IS NOT NULL
        AND iv.func_status NOT IN ('Ativo','Ativo sem Registro','Férias')
  ),
  warns_agg AS (
    SELECT sol_id, jsonb_agg(w) AS arr FROM warns GROUP BY sol_id
  )
  SELECT
    b.id,
    b.numero_solicitacao,
    b.centro_custo_id,
    b.periodo_inicio,
    b.periodo_fim,
    CASE
      WHEN b.periodo_inicio IS NULL OR b.periodo_fim IS NULL THEN 0
      ELSE (b.periodo_fim - b.periodo_inicio + 1)::int
    END AS dias_periodo,
    jsonb_array_length(b.convocados_pre)                                    AS convocados_pre_qtd,
    COALESCE(ac.itens_legado_sem_data_qtd, 0)                               AS itens_legado_sem_data_qtd,
    COALESCE(ac.itens_apontamento_dia_qtd, 0)                               AS itens_apontamento_dia_qtd,
    1                                                                       AS lotes_simulados,
    COALESCE(ai.itens_simulados, 0)                                         AS itens_simulados,
    COALESCE(ai.total_diaria, 0)                                            AS valor_total_simulado_diaria,
    COALESCE(ai.total_refeicao, 0)                                          AS valor_total_simulado_refeicao,
    CASE b.status_origem
      WHEN 'rascunho'   THEN 'rascunho'
      WHEN 'enviada'    THEN 'pendente_aprovacao'
      WHEN 'autorizada' THEN 'aprovado'
      WHEN 'reprovada'  THEN 'rejeitado'
      WHEN 'cancelada'  THEN 'cancelado'
      ELSE b.status_origem
    END                                                                     AS status_simulado,
    COALESCE(ba.arr, '[]'::jsonb)                                           AS inconsistencias_bloqueantes,
    COALESCE(wa.arr, '[]'::jsonb)                                           AS warnings,
    (COALESCE(jsonb_array_length(ba.arr), 0) = 0)                           AS pode_migrar
  FROM base b
  LEFT JOIN agg_items ai ON ai.sol_id = b.id
  LEFT JOIN agg_cat   ac ON ac.sol_id = b.id
  LEFT JOIN blocks_agg ba ON ba.sol_id = b.id
  LEFT JOIN warns_agg  wa ON wa.sol_id = b.id
  ORDER BY b.created_at ASC, b.id ASC;
END;
$fn$;

REVOKE ALL ON FUNCTION public.fn_backfill_lotes_dry_run(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_backfill_lotes_dry_run(uuid, int) TO postgres, service_role;