-- 1) Tabela de arquivo (mesmo schema + archived_at)
CREATE TABLE IF NOT EXISTS public.bd_auditoria_log_archive (
  id uuid PRIMARY KEY,
  tabela text NOT NULL,
  registro_id text,
  operacao text NOT NULL,
  dados_anteriores jsonb,
  dados_novos jsonb,
  campos_alterados text[],
  usuario_id uuid,
  created_at timestamptz NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now()
);

-- 2) RLS espelhando bd_auditoria_log (somente SuperAdm lê)
ALTER TABLE public.bd_auditoria_log_archive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "SuperAdmin pode ver auditoria archive" ON public.bd_auditoria_log_archive;
CREATE POLICY "SuperAdmin pode ver auditoria archive"
  ON public.bd_auditoria_log_archive
  FOR SELECT
  TO authenticated
  USING (check_is_super_admin(auth.uid()));

-- 3) Índices mínimos (apenas data e tabela, conforme solicitado)
CREATE INDEX IF NOT EXISTS idx_audit_archive_created
  ON public.bd_auditoria_log_archive (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_archive_tabela
  ON public.bd_auditoria_log_archive (tabela);

-- 4) Função de arquivamento em lote (idempotente, security definer)
CREATE OR REPLACE FUNCTION public.fn_arquivar_auditoria_log(
  p_lote int DEFAULT 5000
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count bigint := 0;
BEGIN
  WITH movidos AS (
    DELETE FROM public.bd_auditoria_log
    WHERE id IN (
      SELECT id FROM public.bd_auditoria_log
      WHERE created_at < now() - interval '12 months'
      ORDER BY created_at
      LIMIT p_lote
    )
    RETURNING *
  )
  INSERT INTO public.bd_auditoria_log_archive
    (id, tabela, registro_id, operacao, dados_anteriores, dados_novos,
     campos_alterados, usuario_id, created_at)
  SELECT id, tabela, registro_id, operacao, dados_anteriores, dados_novos,
         campos_alterados, usuario_id, created_at
  FROM movidos;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Execução restrita
REVOKE ALL ON FUNCTION public.fn_arquivar_auditoria_log(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_arquivar_auditoria_log(int) TO authenticated;

-- 5) Cron diário às 03:15 UTC (00:15 BRT)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'arquivar-auditoria-diario') THEN
    PERFORM cron.unschedule('arquivar-auditoria-diario');
  END IF;
END $$;

SELECT cron.schedule(
  'arquivar-auditoria-diario',
  '15 3 * * *',
  $cron$ SELECT public.fn_arquivar_auditoria_log(50000); $cron$
);

-- 6) View unificada (security_invoker = respeita RLS de cada tabela base)
CREATE OR REPLACE VIEW public.vw_auditoria_log_completo
WITH (security_invoker = true) AS
  SELECT id, tabela, registro_id, operacao,
         dados_anteriores, dados_novos, campos_alterados,
         usuario_id, created_at, false AS arquivado
  FROM public.bd_auditoria_log
  UNION ALL
  SELECT id, tabela, registro_id, operacao,
         dados_anteriores, dados_novos, campos_alterados,
         usuario_id, created_at, true AS arquivado
  FROM public.bd_auditoria_log_archive;

COMMENT ON TABLE public.bd_auditoria_log_archive IS
  'Arquivo de bd_auditoria_log: registros com mais de 12 meses, movidos por fn_arquivar_auditoria_log via pg_cron diario.';