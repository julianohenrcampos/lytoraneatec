-- POPs — Storage policies (bucket privado pops-documentos)
-- Nenhum acesso direto para anon/authenticated. Apenas service_role (Edges) opera.

DROP POLICY IF EXISTS "pops_documentos_service_role_all" ON storage.objects;

CREATE POLICY "pops_documentos_service_role_all"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'pops-documentos')
WITH CHECK (bucket_id = 'pops-documentos');