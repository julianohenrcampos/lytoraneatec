-- Backfill: corrigir registros com refeição NULL que já foram finalizados
-- Preenche recebe_refeicao = true e valor_refeicao_aplicado com valor da função
UPDATE bd_diaria_presencas p
SET 
  recebe_refeicao = true,
  valor_refeicao_aplicado = COALESCE(f.valor_refeicao, 0)
FROM bd_funcoes f
WHERE p.funcao_id = f.id
  AND p.presente = true
  AND p.hora_saida IS NOT NULL
  AND (p.recebe_refeicao IS NULL)
  AND (p.valor_refeicao_aplicado IS NULL OR p.valor_refeicao_aplicado = 0);