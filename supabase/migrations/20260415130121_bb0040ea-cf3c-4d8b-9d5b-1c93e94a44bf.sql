-- Correção solicitação 2026-154: Reajustar valor diária WELLITON (08/04)
-- Valor correto para férias trabalhadas = R$ 200,00
UPDATE bd_diaria_presencas 
SET valor_diaria_aplicada = 200,
    updated_at = now()
WHERE id = 'ccee38a5-3296-4df6-b59c-1f07620f5ab0';