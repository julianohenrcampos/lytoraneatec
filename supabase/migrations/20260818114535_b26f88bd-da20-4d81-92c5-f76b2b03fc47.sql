DROP POLICY IF EXISTS "chi_anexos_select" ON storage.objects;
CREATE POLICY "chi_anexos_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'chamados-internos-anexos'
  AND public.fn_chamado_interno_can_read(((storage.foldername(name))[1])::uuid) IS TRUE
);

DROP POLICY IF EXISTS "chi_anexos_insert" ON storage.objects;
CREATE POLICY "chi_anexos_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chamados-internos-anexos'
  AND owner = auth.uid()
  AND public.fn_chamado_interno_can_read(((storage.foldername(name))[1])::uuid) IS TRUE
);

DROP POLICY IF EXISTS "chi_anexos_delete_owner" ON storage.objects;
CREATE POLICY "chi_anexos_delete_owner"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'chamados-internos-anexos'
  AND owner = auth.uid()
);