-- 1. Bucket privado para assinaturas dos funcionários
INSERT INTO storage.buckets (id, name, public)
VALUES ('assinaturas-funcionarios', 'assinaturas-funcionarios', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Políticas de storage: apenas SuperAdm pode ler/escrever
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'assinaturas_func_select_admin' AND tablename = 'objects' AND schemaname='storage') THEN
    CREATE POLICY "assinaturas_func_select_admin"
      ON storage.objects FOR SELECT
      USING (
        bucket_id = 'assinaturas-funcionarios'
        AND public.is_super_admin(auth.uid())
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'assinaturas_func_insert_admin' AND tablename = 'objects' AND schemaname='storage') THEN
    CREATE POLICY "assinaturas_func_insert_admin"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'assinaturas-funcionarios'
        AND public.is_super_admin(auth.uid())
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'assinaturas_func_update_admin' AND tablename = 'objects' AND schemaname='storage') THEN
    CREATE POLICY "assinaturas_func_update_admin"
      ON storage.objects FOR UPDATE
      USING (
        bucket_id = 'assinaturas-funcionarios'
        AND public.is_super_admin(auth.uid())
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'assinaturas_func_delete_admin' AND tablename = 'objects' AND schemaname='storage') THEN
    CREATE POLICY "assinaturas_func_delete_admin"
      ON storage.objects FOR DELETE
      USING (
        bucket_id = 'assinaturas-funcionarios'
        AND public.is_super_admin(auth.uid())
      );
  END IF;
END$$;

-- 3. Colunas para registrar a assinatura no funcionário
ALTER TABLE public.bd_funcionarios
  ADD COLUMN IF NOT EXISTS assinatura_url text,
  ADD COLUMN IF NOT EXISTS assinatura_hash text,
  ADD COLUMN IF NOT EXISTS assinatura_updated_at timestamptz;

-- 4. RPC para salvar/atualizar a assinatura (SuperAdm)
CREATE OR REPLACE FUNCTION public.salvar_assinatura_funcionario(
  p_funcionario_id uuid,
  p_assinatura_url text,
  p_assinatura_hash text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT public.is_super_admin(v_uid) THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar assinaturas';
  END IF;

  IF p_assinatura_url IS NULL OR length(trim(p_assinatura_url)) = 0 THEN
    RAISE EXCEPTION 'p_assinatura_url é obrigatório';
  END IF;

  UPDATE public.bd_funcionarios
     SET assinatura_url        = p_assinatura_url,
         assinatura_hash       = COALESCE(p_assinatura_hash, assinatura_hash),
         assinatura_updated_at = now()
   WHERE id = p_funcionario_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Funcionário não encontrado: %', p_funcionario_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'funcionario_id', p_funcionario_id,
    'assinatura_url', p_assinatura_url,
    'updated_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.salvar_assinatura_funcionario(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salvar_assinatura_funcionario(uuid, text, text) TO authenticated;