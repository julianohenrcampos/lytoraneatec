-- Limpeza de fotos duplicadas (base64) no checklist SSO
-- Remove fotos com URL base64 (data:), mantendo apenas as do Storage válidas

UPDATE bd_sso_checklist_itens
SET fotos = (
  SELECT jsonb_agg(foto)
  FROM jsonb_array_elements(fotos) AS foto
  WHERE (foto->>'url' NOT LIKE 'data:%' OR foto->>'url' IS NULL)
    AND foto->>'path' LIKE '%/%'
)
WHERE checklist_id = 'ba9235b5-2c72-46bc-83a1-5e2a1ba07376'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(fotos) AS foto
    WHERE foto->>'url' LIKE 'data:%'
  );