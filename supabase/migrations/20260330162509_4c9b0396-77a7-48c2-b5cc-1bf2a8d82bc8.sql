
-- Fix 1: Correct valor_diaria_aplicada for FDS records where tipo_diaria multiplier wasn't applied
-- (e.g., uma_e_meia should be val_exclusiva * 1.5, not val_exclusiva * 1.0)
UPDATE bd_diaria_presencas p
SET 
  valor_diaria_aplicada = COALESCE(sub.val_exclusiva, p.valor_diaria_aplicada) * sub.multiplier,
  usar_diaria_exclusiva = true
FROM (
  SELECT 
    p2.id,
    (conv->>'valor_diaria_exclusiva')::numeric AS val_exclusiva,
    CASE 
      WHEN p2.tipo_diaria = 'meia' THEN 0.5
      WHEN p2.tipo_diaria = 'uma_e_meia' THEN 1.5
      ELSE 1.0
    END AS multiplier
  FROM bd_diaria_presencas p2
  JOIN bd_diaria_solicitacoes s ON s.id = p2.solicitacao_id
  CROSS JOIN LATERAL jsonb_array_elements(s.convocados_pre) AS conv
  WHERE EXTRACT(DOW FROM p2.data::date) IN (0, 6)
    AND (conv->>'funcionario_id') = p2.funcionario_id::text
    AND s.convocados_pre IS NOT NULL
    AND p2.presente = true
    AND (conv->>'valor_diaria_exclusiva') IS NOT NULL
    AND p2.valor_diaria_aplicada != (conv->>'valor_diaria_exclusiva')::numeric * 
      CASE WHEN p2.tipo_diaria = 'meia' THEN 0.5 WHEN p2.tipo_diaria = 'uma_e_meia' THEN 1.5 ELSE 1.0 END
) sub
WHERE p.id = sub.id;

-- Fix 2: Correct meal values where recebe_refeicao=true but valor_refeicao_aplicado is 0 or NULL
UPDATE bd_diaria_presencas p
SET valor_refeicao_aplicado = sub.val_refeicao
FROM (
  SELECT 
    p2.id,
    (conv->>'valor_refeicao')::numeric AS val_refeicao
  FROM bd_diaria_presencas p2
  JOIN bd_diaria_solicitacoes s ON s.id = p2.solicitacao_id
  CROSS JOIN LATERAL jsonb_array_elements(s.convocados_pre) AS conv
  WHERE p2.recebe_refeicao = true
    AND (p2.valor_refeicao_aplicado IS NULL OR p2.valor_refeicao_aplicado = 0)
    AND (conv->>'funcionario_id') = p2.funcionario_id::text
    AND s.convocados_pre IS NOT NULL
    AND (conv->>'valor_refeicao')::numeric > 0
) sub
WHERE p.id = sub.id;

-- Fix 3: Ensure all FDS records have usar_diaria_exclusiva = true
UPDATE bd_diaria_presencas
SET usar_diaria_exclusiva = true
WHERE EXTRACT(DOW FROM data::date) IN (0, 6)
  AND (usar_diaria_exclusiva IS NULL OR usar_diaria_exclusiva = false)
  AND presente = true;
