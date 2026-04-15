-- Correção solicitação 2026-154: Ajustar AMBOS os dias para R$ 200,00 (férias trabalhadas)
UPDATE bd_diaria_presencas
SET valor_diaria_aplicada = 200,
    tipo_apontamento = 'ferias_trabalhadas',
    updated_at = now()
WHERE id IN (
  'ce7e2ae5-f0cb-4cf2-91de-31fcab37bc51',
  'ccee38a5-3296-4df6-b59c-1f07620f5ab0'
);