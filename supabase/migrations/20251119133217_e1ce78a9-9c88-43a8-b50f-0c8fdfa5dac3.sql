-- Criar bucket para fotos de checklists SSO
INSERT INTO storage.buckets (id, name, public)
VALUES ('sso-checklists', 'sso-checklists', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: Permitir inserção para usuários autenticados
CREATE POLICY "Usuários autenticados podem fazer upload de fotos SSO"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'sso-checklists');

-- RLS: Permitir leitura pública
CREATE POLICY "Qualquer um pode ver fotos de checklists SSO"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'sso-checklists');

-- RLS: Permitir deletar próprios arquivos
CREATE POLICY "Usuários podem deletar próprias fotos SSO"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'sso-checklists');