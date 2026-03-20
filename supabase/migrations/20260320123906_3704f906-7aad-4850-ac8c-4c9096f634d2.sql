
-- Recalcular tipo_diaria e valor_diaria_aplicada com desconto de 1h de almoço para jornadas > 6h
-- Novos thresholds: >= 9.75h líquidas = uma_e_meia, >= 4.5h = completa, > 0 = meia

UPDATE bd_diaria_presencas p
SET 
  tipo_diaria = calc.novo_tipo,
  valor_diaria_aplicada = calc.novo_valor
FROM (
  SELECT 
    id,
    CASE
      WHEN horas_liquidas >= 9.75 THEN 'uma_e_meia'
      WHEN horas_liquidas >= 4.5 THEN 'completa'
      WHEN horas_liquidas > 0 THEN 'meia'
      ELSE 'nenhuma'
    END as novo_tipo,
    CASE
      WHEN horas_liquidas >= 9.75 THEN valor_base * 1.5
      WHEN horas_liquidas >= 4.5 THEN valor_base * 1.0
      WHEN horas_liquidas > 0 THEN valor_base * 0.5
      ELSE 0
    END as novo_valor
  FROM (
    SELECT 
      id,
      tipo_diaria as tipo_atual,
      valor_diaria_aplicada as valor_atual,
      CASE 
        WHEN horas_brutas > 6 THEN horas_brutas - 1
        ELSE horas_brutas
      END as horas_liquidas,
      -- Reverter o multiplicador atual para obter o valor base
      CASE tipo_diaria
        WHEN 'uma_e_meia' THEN valor_diaria_aplicada / 1.5
        WHEN 'completa' THEN valor_diaria_aplicada / 1.0
        WHEN 'meia' THEN valor_diaria_aplicada / 0.5
        ELSE valor_diaria_aplicada
      END as valor_base
    FROM (
      SELECT 
        id,
        tipo_diaria,
        valor_diaria_aplicada,
        (EXTRACT(EPOCH FROM (hora_saida::time - hora_entrada::time)) / 3600.0
         + CASE WHEN hora_saida::time < hora_entrada::time THEN 24 ELSE 0 END
        ) as horas_brutas
      FROM bd_diaria_presencas
      WHERE presente = true 
        AND hora_entrada IS NOT NULL 
        AND hora_saida IS NOT NULL 
        AND valor_diaria_aplicada > 0
    ) raw
  ) with_liquidas
) calc
WHERE p.id = calc.id;
