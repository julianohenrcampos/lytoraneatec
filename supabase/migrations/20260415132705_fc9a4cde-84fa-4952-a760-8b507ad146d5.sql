UPDATE public.bd_diaria_presencas
SET valor_diaria_aplicada = CASE
      WHEN id = 'ce7e2ae5-f0cb-4cf2-91de-31fcab37bc51' THEN 300
      WHEN id = 'ccee38a5-3296-4df6-b59c-1f07620f5ab0' THEN 200
    END,
    tipo_apontamento = 'ferias_trabalhadas',
    usar_diaria_exclusiva = true,
    updated_at = now()
WHERE id IN (
  'ce7e2ae5-f0cb-4cf2-91de-31fcab37bc51',
  'ccee38a5-3296-4df6-b59c-1f07620f5ab0'
);