WITH itens AS (
  SELECT s.id,
         s.data_inicio,
         s.data_fim,
         (c->>'valor_diaria')::numeric             AS vd,
         (c->>'valor_diaria_exclusiva')::numeric   AS vde,
         (c->>'valor_refeicao')::numeric           AS vr,
         CASE
           WHEN jsonb_typeof(c->'dias_solicitados') = 'array'
                AND jsonb_array_length(c->'dias_solicitados') > 0
             THEN jsonb_array_length(c->'dias_solicitados')
           ELSE GREATEST((s.data_fim - s.data_inicio) + 1, 1)
         END AS qtd_dias
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