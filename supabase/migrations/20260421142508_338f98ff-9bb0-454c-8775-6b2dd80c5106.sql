ALTER TABLE public.bd_ponto_config
  ADD COLUMN IF NOT EXISTS tempo_min_entre_batidas_min   integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS tempo_min_para_intervalo_min  integer NOT NULL DEFAULT 240,
  ADD COLUMN IF NOT EXISTS jornada_para_intervalo_min    integer NOT NULL DEFAULT 360,
  ADD COLUMN IF NOT EXISTS intervalo_padrao_min          integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS intervalo_padrao_inicio       time    NOT NULL DEFAULT '12:00';