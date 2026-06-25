-- 1) convocados_pre: marcar usar_diaria_exclusiva=true em todas extraordinárias
UPDATE bd_diaria_solicitacoes
SET convocados_pre = (
  SELECT jsonb_agg(item || jsonb_build_object('usar_diaria_exclusiva', true))
  FROM jsonb_array_elements(convocados_pre) item
)
WHERE tipo_solicitacao = 'extraordinaria'
  AND convocados_pre IS NOT NULL
  AND jsonb_typeof(convocados_pre) = 'array';

-- 2) valor_estimado_total: recalcular com valor exclusivo
WITH itens AS (
  SELECT s.id,
         (c->>'valor_diaria')::numeric             AS vd,
         (c->>'valor_diaria_exclusiva')::numeric   AS vde,
         (c->>'valor_refeicao')::numeric           AS vr,
         jsonb_array_length(COALESCE(c->'dias_solicitados', '[]'::jsonb)) AS qtd_dias
  FROM bd_diaria_solicitacoes s,
       jsonb_array_elements(s.convocados_pre) c
  WHERE s.tipo_solicitacao = 'extraordinaria'
),
tot AS (
  SELECT id, ROUND(SUM(qtd_dias * (COALESCE(vde, vd * 1.2) + COALESCE(vr, 0))), 2) AS novo
  FROM itens
  GROUP BY id
)
UPDATE bd_diaria_solicitacoes s
SET valor_estimado_total = tot.novo
FROM tot
WHERE s.id = tot.id;

-- 3) bd_diaria_presencas: recalcular valor_diaria_aplicada usando exclusiva
WITH conv AS (
  SELECT s.id AS sol_id,
         (c->>'funcionario_id')::uuid                AS funcionario_id,
         (c->>'valor_diaria_exclusiva')::numeric     AS vde
  FROM bd_diaria_solicitacoes s,
       jsonb_array_elements(s.convocados_pre) c
  WHERE s.tipo_solicitacao = 'extraordinaria'
)
UPDATE bd_diaria_presencas p
SET usar_diaria_exclusiva = true,
    valor_diaria_aplicada = ROUND(
      conv.vde * CASE p.tipo_diaria
        WHEN 'completa'   THEN 1.0
        WHEN 'meia'       THEN 0.5
        WHEN 'uma_e_meia' THEN 1.5
      END, 2)
FROM conv
WHERE p.solicitacao_id = conv.sol_id
  AND p.funcionario_id = conv.funcionario_id
  AND p.tipo_diaria IN ('completa','meia','uma_e_meia')
  AND COALESCE(p.valor_diaria_aplicada, 0) > 0
  AND conv.vde IS NOT NULL
  AND conv.vde > 0;