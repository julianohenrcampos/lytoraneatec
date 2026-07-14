
-- 1) Colunas
ALTER TABLE public.bd_localizacao_equipamentos
  ADD COLUMN IF NOT EXISTS apontamento_id uuid NULL;

ALTER TABLE public.bd_localizacao_equipamentos
  ADD COLUMN IF NOT EXISTS precisao_gps numeric NULL;

-- 2) FK para apontamento (com cascade)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_localizacao_apontamento'
      AND conrelid = 'public.bd_localizacao_equipamentos'::regclass
  ) THEN
    ALTER TABLE public.bd_localizacao_equipamentos
      ADD CONSTRAINT fk_localizacao_apontamento
      FOREIGN KEY (apontamento_id)
      REFERENCES public.bd_registro_apontamento_cam_equipa(id)
      ON DELETE CASCADE;
  END IF;
END$$;

-- 3) UNIQUE (permite múltiplos NULLs; compatível com ON CONFLICT (apontamento_id))
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_localizacao_apontamento'
      AND conrelid = 'public.bd_localizacao_equipamentos'::regclass
  ) THEN
    ALTER TABLE public.bd_localizacao_equipamentos
      ADD CONSTRAINT uq_localizacao_apontamento UNIQUE (apontamento_id);
  END IF;
END$$;

-- 4) Índice para dashboards e "última posição"
CREATE INDEX IF NOT EXISTS idx_loc_equip_data_desc
  ON public.bd_localizacao_equipamentos (equipamento_id, data_registro DESC);

-- 5) Função única de validação
CREATE OR REPLACE FUNCTION public.fn_loc_valida_coords()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog','public'
AS $fn$
BEGIN
  -- Precisão
  IF NEW.precisao_gps IS NOT NULL AND NEW.precisao_gps < 0 THEN
    RAISE EXCEPTION 'localizacao_precisao_invalida' USING ERRCODE='23514';
  END IF;

  -- Coordenadas completas (ou ambas nulas, ou ambas preenchidas)
  IF (NEW.latitude IS NULL) <> (NEW.longitude IS NULL) THEN
    RAISE EXCEPTION 'localizacao_coordenadas_incompletas' USING ERRCODE='23514';
  END IF;

  IF NEW.latitude IS NOT NULL THEN
    IF NEW.latitude < -90 OR NEW.latitude > 90 THEN
      RAISE EXCEPTION 'localizacao_latitude_invalida' USING ERRCODE='23514';
    END IF;
    IF NEW.longitude < -180 OR NEW.longitude > 180 THEN
      RAISE EXCEPTION 'localizacao_longitude_invalida' USING ERRCODE='23514';
    END IF;
    IF NEW.latitude = 0 AND NEW.longitude = 0 THEN
      RAISE EXCEPTION 'localizacao_zero_zero' USING ERRCODE='23514';
    END IF;
  END IF;

  -- Data não pode estar excessivamente no futuro
  IF NEW.data_registro IS NOT NULL AND NEW.data_registro > (now() + interval '5 minutes') THEN
    RAISE EXCEPTION 'localizacao_data_futura' USING ERRCODE='23514';
  END IF;

  -- Regras específicas para APONTAMENTO_CE
  IF NEW.origem = 'APONTAMENTO_CE' THEN
    IF NEW.apontamento_id IS NULL THEN
      RAISE EXCEPTION 'localizacao_apontamento_obrigatorio' USING ERRCODE='23502';
    END IF;
    IF NEW.latitude IS NULL OR NEW.longitude IS NULL THEN
      RAISE EXCEPTION 'localizacao_coordenadas_incompletas' USING ERRCODE='23502';
    END IF;
    IF NEW.data_registro IS NULL THEN
      RAISE EXCEPTION 'localizacao_data_obrigatoria' USING ERRCODE='23502';
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;

-- 6) Trigger única (recria idempotente)
DROP TRIGGER IF EXISTS trg_loc_valida_coords ON public.bd_localizacao_equipamentos;
CREATE TRIGGER trg_loc_valida_coords
  BEFORE INSERT OR UPDATE ON public.bd_localizacao_equipamentos
  FOR EACH ROW EXECUTE FUNCTION public.fn_loc_valida_coords();
