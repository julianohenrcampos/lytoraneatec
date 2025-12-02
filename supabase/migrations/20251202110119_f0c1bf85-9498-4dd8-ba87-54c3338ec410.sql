-- Restauração das fotos SSO do checklist afetado
-- Mapeia as 5 fotos do Storage para os primeiros 5 itens NC do checklist

-- CTE para buscar as fotos do Storage
WITH fotos_storage AS (
  SELECT 
    name as path,
    ROW_NUMBER() OVER (ORDER BY created_at) as rn
  FROM storage.objects
  WHERE bucket_id = 'sso-checklists'
    AND name LIKE 'ba9235b5-2c72-46bc-83a1-5e2a1ba07376/%'
  LIMIT 5
),
-- CTE para buscar os itens NC ordenados
itens_nc AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (ORDER BY ordem) as rn
  FROM bd_sso_checklist_itens
  WHERE checklist_id = 'ba9235b5-2c72-46bc-83a1-5e2a1ba07376'
    AND avaliacao = 'Não Conforme'
  LIMIT 5
)
-- Atualizar os itens com as fotos correspondentes
UPDATE bd_sso_checklist_itens
SET fotos = jsonb_build_array(
  jsonb_build_object(
    'path', f.path,
    'url', '',
    'created_at', NOW()::text
  )
)
FROM fotos_storage f
JOIN itens_nc n ON f.rn = n.rn
WHERE bd_sso_checklist_itens.id = n.id;