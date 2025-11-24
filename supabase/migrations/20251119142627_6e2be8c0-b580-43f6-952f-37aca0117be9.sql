-- Criar políticas de storage para o bucket sso-checklists

-- 1. Permitir upload de fotos para usuários autenticados
CREATE POLICY "Allow authenticated users to upload sso-checklist files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'sso-checklists');

-- 2. Permitir leitura pública das fotos
CREATE POLICY "Allow public read access on sso-checklists"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'sso-checklists');

-- 3. Permitir atualização pelo owner
CREATE POLICY "Allow users to update sso-checklist files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'sso-checklists' AND auth.uid() = owner)
WITH CHECK (bucket_id = 'sso-checklists');

-- 4. Permitir deleção pelo owner
CREATE POLICY "Allow users to delete sso-checklist files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'sso-checklists' AND auth.uid() = owner);