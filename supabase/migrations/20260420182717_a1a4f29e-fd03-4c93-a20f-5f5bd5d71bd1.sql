ALTER TABLE public.bd_ponto_dispositivos
  DROP CONSTRAINT bd_ponto_dispositivos_modo_check;

ALTER TABLE public.bd_ponto_dispositivos
  ADD CONSTRAINT bd_ponto_dispositivos_modo_check
  CHECK (modo_operacao IN ('fixo', 'contingencia', 'compartilhado'));