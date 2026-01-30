-- 1. Remover restrição de MIME types do bucket sso-checklists
UPDATE storage.buckets 
SET allowed_mime_types = NULL
WHERE id = 'sso-checklists';

-- 2. Limpar políticas duplicadas do storage para sso-checklists
DROP POLICY IF EXISTS "Allow authenticated users to upload sso-checklist files" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem fazer upload de fotos SSO" ON storage.objects;
DROP POLICY IF EXISTS "sso_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access on sso-checklists" ON storage.objects;
DROP POLICY IF EXISTS "Qualquer um pode ver fotos de checklists SSO" ON storage.objects;
DROP POLICY IF EXISTS "sso_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update sso-checklist files" ON storage.objects;
DROP POLICY IF EXISTS "sso_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete sso-checklist files" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem deletar próprias fotos SSO" ON storage.objects;
DROP POLICY IF EXISTS "sso_storage_delete" ON storage.objects;

-- 3. Recriar políticas únicas para sso-checklists
CREATE POLICY "SSO Checklists: INSERT para usuários autenticados"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'sso-checklists' AND auth.uid() IS NOT NULL);

CREATE POLICY "SSO Checklists: SELECT público"
ON storage.objects FOR SELECT
USING (bucket_id = 'sso-checklists');

CREATE POLICY "SSO Checklists: UPDATE pelo owner"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'sso-checklists' AND owner = auth.uid());

CREATE POLICY "SSO Checklists: DELETE pelo owner"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'sso-checklists' AND owner = auth.uid());