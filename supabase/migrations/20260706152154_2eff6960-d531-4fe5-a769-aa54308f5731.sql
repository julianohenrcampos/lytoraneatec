ALTER TABLE public.bd_auditoria_log
  DROP CONSTRAINT IF EXISTS bd_auditoria_log_operacao_check;

ALTER TABLE public.bd_auditoria_log
  ADD CONSTRAINT bd_auditoria_log_operacao_check
  CHECK (operacao IN (
    'INSERT',
    'UPDATE',
    'DELETE',
    'DOWNLOAD',
    'SANEAMENTO_CONVOCADOS_PRE_AUTO',
    'SANEAMENTO_CONVOCADOS_PRE_AUTO_REVERSAO'
  ));