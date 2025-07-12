-- Remover bucket de storage desnecessário criado anteriormente
DELETE FROM storage.objects WHERE bucket_id = 'apontamentos';
DELETE FROM storage.buckets WHERE id = 'apontamentos';

-- Log da operação
DO $$
BEGIN
    RAISE NOTICE 'Bucket "apontamentos" removido - não era necessário';
END $$;