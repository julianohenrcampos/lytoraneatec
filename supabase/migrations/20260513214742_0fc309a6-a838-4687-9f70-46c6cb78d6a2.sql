ALTER TABLE public.bd_auditoria_log DROP CONSTRAINT bd_auditoria_log_operacao_check;

ALTER TABLE public.bd_auditoria_log
  ADD CONSTRAINT bd_auditoria_log_operacao_check
  CHECK (operacao = ANY (ARRAY[
    'INSERT'::text,
    'UPDATE'::text,
    'DELETE'::text,
    'SANEAMENTO_CONVOCADOS_PRE_AUTO'::text,
    'SANEAMENTO_CONVOCADOS_PRE_AUTO_REVERSAO'::text
  ]));