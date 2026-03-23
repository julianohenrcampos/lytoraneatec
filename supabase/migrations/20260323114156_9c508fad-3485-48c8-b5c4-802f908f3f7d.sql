
-- Corrigir sábados: usar_diaria_exclusiva e valor_diaria_aplicada
UPDATE bd_diaria_presencas p
SET usar_diaria_exclusiva = true,
    valor_diaria_aplicada = COALESCE(f.valor_diaria_exclusiva, f.valor_diaria, p.valor_diaria_aplicada)
FROM bd_funcoes f
WHERE f.id = p.funcao_id
  AND EXTRACT(DOW FROM p.data::date) = 6
  AND (p.usar_diaria_exclusiva = false OR p.usar_diaria_exclusiva IS NULL);

-- Corrigir sábados: refeição para presentes com recebe_refeicao NULL
UPDATE bd_diaria_presencas p
SET recebe_refeicao = true,
    valor_refeicao_aplicado = COALESCE(f.valor_refeicao, 0)
FROM bd_funcoes f
WHERE f.id = p.funcao_id
  AND EXTRACT(DOW FROM p.data::date) = 6
  AND p.presente = true
  AND p.recebe_refeicao IS NULL;

-- Corrigir domingos: usar_diaria_exclusiva
UPDATE bd_diaria_presencas p
SET usar_diaria_exclusiva = true,
    valor_diaria_aplicada = COALESCE(f.valor_diaria_exclusiva, f.valor_diaria, p.valor_diaria_aplicada)
FROM bd_funcoes f
WHERE f.id = p.funcao_id
  AND EXTRACT(DOW FROM p.data::date) = 0
  AND (p.usar_diaria_exclusiva = false OR p.usar_diaria_exclusiva IS NULL);
