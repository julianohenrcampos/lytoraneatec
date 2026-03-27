-- Add logo_url column to bd_empresas
ALTER TABLE public.bd_empresas ADD COLUMN IF NOT EXISTS logo_url text;

-- Create empresas-logos storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('empresas-logos', 'empresas-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access
CREATE POLICY "Allow public read access on empresas-logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'empresas-logos');

-- Authenticated users can upload
CREATE POLICY "Allow authenticated upload on empresas-logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'empresas-logos');

-- Authenticated users can update
CREATE POLICY "Allow authenticated update on empresas-logos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'empresas-logos');

-- Authenticated users can delete
CREATE POLICY "Allow authenticated delete on empresas-logos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'empresas-logos');