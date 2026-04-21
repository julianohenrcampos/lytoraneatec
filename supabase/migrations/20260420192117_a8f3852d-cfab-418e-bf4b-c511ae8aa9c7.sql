ALTER TABLE public.bd_ponto_dispositivos
  ADD COLUMN IF NOT EXISTS device_session_token TEXT,
  ADD COLUMN IF NOT EXISTS device_session_expires_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bd_ponto_dispositivos_session_token
  ON public.bd_ponto_dispositivos (device_session_token)
  WHERE device_session_token IS NOT NULL;