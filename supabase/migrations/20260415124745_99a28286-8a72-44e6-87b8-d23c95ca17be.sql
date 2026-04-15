-- Correção solicitação 2026-154: WELLITON DOS SANTOS GUERRA (férias)
-- Dia 08/04: valor_diaria_aplicada 200 → 150, tipo_apontamento → ferias_trabalhadas
UPDATE bd_diaria_presencas 
SET valor_diaria_aplicada = 150, 
    tipo_apontamento = 'ferias_trabalhadas',
    updated_at = now()
WHERE id = 'ccee38a5-3296-4df6-b59c-1f07620f5ab0';

-- Dia 07/04: tipo_apontamento → ferias_trabalhadas (valor já correto: 225)
UPDATE bd_diaria_presencas 
SET tipo_apontamento = 'ferias_trabalhadas',
    updated_at = now()
WHERE id = 'ce7e2ae5-f0cb-4cf2-91de-31fcab37bc51';