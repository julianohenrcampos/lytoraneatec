
-- Presença 01/04 (meia)
UPDATE bd_diaria_presencas
SET valor_diaria_aplicada = 100.00, updated_at = NOW()
WHERE id = '88c04adf-709a-4be8-9352-e73d10c99b96';

-- Presença 02/04 (completa)
UPDATE bd_diaria_presencas
SET valor_diaria_aplicada = 200.00, updated_at = NOW()
WHERE id = 'f938c7c5-ec1a-4d76-aac5-ee45f56ece89';

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
WHERE id = 'f75534fa-2aa4-4bfa-8f7c-84f9a63a3730';
