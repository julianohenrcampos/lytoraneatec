-- Presença 06/04 (completa)
UPDATE bd_diaria_presencas
SET valor_diaria_aplicada = 200.00, updated_at = NOW()
WHERE id = 'a8955dff-e766-48e8-907e-c74e7e722884';

-- Presença 07/04 (completa)
UPDATE bd_diaria_presencas
SET valor_diaria_aplicada = 200.00, updated_at = NOW()
WHERE id = 'fe2e0052-3509-4d98-8927-a84ee8314e7c';

-- Atualizar snapshot convocados_pre
UPDATE bd_diaria_solicitacoes
SET convocados_pre = (
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'funcionario_id' = '18fa4e67-81c4-4dc6-bf43-8058e64ade65'
      THEN jsonb_set(jsonb_set(elem, '{valor_diaria}', '200'), '{valor_diaria_exclusiva}', '250')
      ELSE elem
    END
  )
  FROM jsonb_array_elements(convocados_pre::jsonb) elem
),
updated_at = NOW()
WHERE id = 'ea886a56-09ca-4a44-ad8c-6d04aec5b2ff';