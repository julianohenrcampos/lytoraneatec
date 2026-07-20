-- Rodada 2A.5 — RPC read-only para recuperar progresso por arquivo SHA-256.
CREATE OR REPLACE FUNCTION public.fn_importador_v2_status_arquivo(p_arquivo_sha256 text)
RETURNS TABLE (
  linha_excel integer,
  codigo_ativo_canonico text,
  status text,
  equipamento_id uuid,
  execution_id uuid,
  mensagem text,
  created_at timestamptz,
  numero_tentativas integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH ranked AS (
    SELECT
      l.linha_excel,
      l.codigo_ativo_canonico,
      l.status,
      l.equipamento_id,
      l.execution_id,
      l.mensagem,
      l.created_at,
      ROW_NUMBER() OVER (
        PARTITION BY l.linha_excel, l.codigo_ativo_canonico
        ORDER BY l.created_at DESC
      ) AS rn,
      COUNT(*) OVER (
        PARTITION BY l.linha_excel, l.codigo_ativo_canonico
      )::int AS numero_tentativas
    FROM public.bd_importador_v2_linhas_processadas l
    WHERE l.arquivo_sha256 = p_arquivo_sha256
      AND public.user_has_permission_action(auth.uid(), 'gestao_maquinas_caminhoes_view', 'criar')
  )
  SELECT linha_excel, codigo_ativo_canonico, status, equipamento_id, execution_id,
         mensagem, created_at, numero_tentativas
  FROM ranked
  WHERE rn = 1;
$$;

REVOKE ALL ON FUNCTION public.fn_importador_v2_status_arquivo(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_importador_v2_status_arquivo(text) TO authenticated;

-- Alias `fn_importador_v2_abrir_execucao` (compat com nome usado no frontend)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='fn_importador_v2_abrir_execucao'
  ) AND EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='fn_importador_v2_iniciar_execucao'
  ) THEN
    EXECUTE $f$
      CREATE OR REPLACE FUNCTION public.fn_importador_v2_abrir_execucao(
        p_arquivo_sha256 text,
        p_arquivo_nome   text,
        p_execucao_anterior_id uuid DEFAULT NULL
      ) RETURNS uuid
      LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $body$
        SELECT public.fn_importador_v2_iniciar_execucao(p_arquivo_sha256, p_arquivo_nome, p_execucao_anterior_id);
      $body$;
      REVOKE ALL ON FUNCTION public.fn_importador_v2_abrir_execucao(text,text,uuid) FROM PUBLIC;
      GRANT EXECUTE ON FUNCTION public.fn_importador_v2_abrir_execucao(text,text,uuid) TO authenticated;
    $f$;
  END IF;
END $$;