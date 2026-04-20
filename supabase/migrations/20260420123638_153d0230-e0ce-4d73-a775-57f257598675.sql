
-- 1. CAMPOS DE QUALIDADE DE GEOCODING
ALTER TABLE public.bd_centros_custo
  ADD COLUMN IF NOT EXISTS endereco_normalizado TEXT,
  ADD COLUMN IF NOT EXISTS mapbox_place_name TEXT,
  ADD COLUMN IF NOT EXISTS geocoding_source TEXT,
  ADD COLUMN IF NOT EXISTS geocoding_relevance NUMERIC,
  ADD COLUMN IF NOT EXISTS geocoding_updated_at TIMESTAMPTZ;

ALTER TABLE public.bd_empresas
  ADD COLUMN IF NOT EXISTS endereco_normalizado TEXT,
  ADD COLUMN IF NOT EXISTS mapbox_place_name TEXT,
  ADD COLUMN IF NOT EXISTS geocoding_status TEXT,
  ADD COLUMN IF NOT EXISTS geocoding_source TEXT,
  ADD COLUMN IF NOT EXISTS geocoding_relevance NUMERIC,
  ADD COLUMN IF NOT EXISTS geocoding_updated_at TIMESTAMPTZ;

ALTER TABLE public.bd_funcionarios
  ADD COLUMN IF NOT EXISTS endereco_normalizado TEXT,
  ADD COLUMN IF NOT EXISTS mapbox_place_name TEXT,
  ADD COLUMN IF NOT EXISTS latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS longitude NUMERIC,
  ADD COLUMN IF NOT EXISTS geocoding_status TEXT,
  ADD COLUMN IF NOT EXISTS geocoding_source TEXT,
  ADD COLUMN IF NOT EXISTS geocoding_relevance NUMERIC,
  ADD COLUMN IF NOT EXISTS geocoding_updated_at TIMESTAMPTZ;

ALTER TABLE public.bd_locais_atendimento
  ADD COLUMN IF NOT EXISTS endereco_completo TEXT,
  ADD COLUMN IF NOT EXISTS endereco_normalizado TEXT,
  ADD COLUMN IF NOT EXISTS mapbox_place_name TEXT,
  ADD COLUMN IF NOT EXISTS latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS longitude NUMERIC,
  ADD COLUMN IF NOT EXISTS geocoding_status TEXT,
  ADD COLUMN IF NOT EXISTS geocoding_source TEXT,
  ADD COLUMN IF NOT EXISTS geocoding_relevance NUMERIC,
  ADD COLUMN IF NOT EXISTS geocoding_updated_at TIMESTAMPTZ;

UPDATE public.bd_locais_atendimento
   SET endereco_completo = endereco
 WHERE endereco_completo IS NULL AND endereco IS NOT NULL;

ALTER TABLE public.bd_cache_enderecos
  ADD COLUMN IF NOT EXISTS endereco_original TEXT,
  ADD COLUMN IF NOT EXISTS endereco_normalizado TEXT,
  ADD COLUMN IF NOT EXISTS place_name TEXT,
  ADD COLUMN IF NOT EXISTS relevance NUMERIC,
  ADD COLUMN IF NOT EXISTS place_type TEXT,
  ADD COLUMN IF NOT EXISTS geocoding_status TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_cache_enderecos_normalizado
  ON public.bd_cache_enderecos (endereco_normalizado);

CREATE TABLE IF NOT EXISTS public.bd_geocoding_falhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endereco_original TEXT,
  endereco_normalizado TEXT,
  motivo TEXT NOT NULL,
  contexto TEXT,
  detalhes JSONB,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_geocoding_falhas_motivo
  ON public.bd_geocoding_falhas (motivo, created_at DESC);

ALTER TABLE public.bd_geocoding_falhas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "SuperAdm pode ver falhas de geocoding" ON public.bd_geocoding_falhas;
CREATE POLICY "SuperAdm pode ver falhas de geocoding"
  ON public.bd_geocoding_falhas
  FOR SELECT
  USING (public.check_is_super_admin());

DROP POLICY IF EXISTS "Sistema pode inserir falhas" ON public.bd_geocoding_falhas;
CREATE POLICY "Sistema pode inserir falhas"
  ON public.bd_geocoding_falhas
  FOR INSERT
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.fn_proteger_geocoding_manual()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_old_status TEXT;
  v_new_source TEXT;
  v_old_lat NUMERIC;
  v_old_lng NUMERIC;
  v_new_lat NUMERIC;
  v_new_lng NUMERIC;
BEGIN
  v_old_status := to_jsonb(OLD)->>'geocoding_status';
  v_new_source := to_jsonb(NEW)->>'geocoding_source';

  v_old_lat := COALESCE((to_jsonb(OLD)->>'latitude')::NUMERIC, (to_jsonb(OLD)->>'endereco_latitude')::NUMERIC);
  v_old_lng := COALESCE((to_jsonb(OLD)->>'longitude')::NUMERIC, (to_jsonb(OLD)->>'endereco_longitude')::NUMERIC);
  v_new_lat := COALESCE((to_jsonb(NEW)->>'latitude')::NUMERIC, (to_jsonb(NEW)->>'endereco_latitude')::NUMERIC);
  v_new_lng := COALESCE((to_jsonb(NEW)->>'longitude')::NUMERIC, (to_jsonb(NEW)->>'endereco_longitude')::NUMERIC);

  IF v_old_status = 'manual'
     AND COALESCE(v_new_source, '') <> 'manual'
     AND (v_old_lat IS DISTINCT FROM v_new_lat OR v_old_lng IS DISTINCT FROM v_new_lng) THEN

    IF to_jsonb(NEW) ? 'latitude' THEN
      NEW.latitude := v_old_lat;
      NEW.longitude := v_old_lng;
    END IF;
    IF to_jsonb(NEW) ? 'endereco_latitude' THEN
      NEW.endereco_latitude := v_old_lat;
      NEW.endereco_longitude := v_old_lng;
    END IF;
    NEW.geocoding_status := 'manual';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_validar_geocoding_no_save()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_endereco TEXT;
  v_lat NUMERIC;
  v_lng NUMERIC;
  v_status TEXT;
BEGIN
  v_lat := COALESCE((to_jsonb(NEW)->>'latitude')::NUMERIC, (to_jsonb(NEW)->>'endereco_latitude')::NUMERIC);
  v_lng := COALESCE((to_jsonb(NEW)->>'longitude')::NUMERIC, (to_jsonb(NEW)->>'endereco_longitude')::NUMERIC);
  v_status := to_jsonb(NEW)->>'geocoding_status';

  IF v_lat IS NULL AND v_lng IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_lat IS NULL OR v_lng IS NULL THEN
    RAISE EXCEPTION 'Coordenadas incompletas: latitude e longitude devem ser fornecidas juntas';
  END IF;

  v_endereco := COALESCE(
    to_jsonb(NEW)->>'endereco_completo',
    to_jsonb(NEW)->>'endereco_texto',
    to_jsonb(NEW)->>'endereco'
  );

  IF v_status = 'aproximado' THEN
    INSERT INTO public.bd_geocoding_falhas (
      endereco_original, endereco_normalizado, motivo, contexto, user_id
    ) VALUES (
      v_endereco,
      to_jsonb(NEW)->>'endereco_normalizado',
      'tentativa_save_aproximado',
      TG_TABLE_NAME,
      auth.uid()
    );
    RAISE EXCEPTION 'Endereço aproximado precisa ser confirmado manualmente (status=manual) antes de salvar';
  END IF;

  IF v_status = 'erro' THEN
    RAISE EXCEPTION 'Endereço com erro de geocoding não pode ser salvo. Ajuste no mapa.';
  END IF;

  IF v_status IS NOT NULL AND v_status NOT IN ('auto','manual') THEN
    RAISE EXCEPTION 'geocoding_status inválido: %', v_status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proteger_geocoding_manual_cc ON public.bd_centros_custo;
CREATE TRIGGER trg_proteger_geocoding_manual_cc
  BEFORE UPDATE ON public.bd_centros_custo
  FOR EACH ROW EXECUTE FUNCTION public.fn_proteger_geocoding_manual();

DROP TRIGGER IF EXISTS trg_validar_geocoding_cc ON public.bd_centros_custo;
CREATE TRIGGER trg_validar_geocoding_cc
  BEFORE INSERT OR UPDATE ON public.bd_centros_custo
  FOR EACH ROW EXECUTE FUNCTION public.fn_validar_geocoding_no_save();

DROP TRIGGER IF EXISTS trg_proteger_geocoding_manual_emp ON public.bd_empresas;
CREATE TRIGGER trg_proteger_geocoding_manual_emp
  BEFORE UPDATE ON public.bd_empresas
  FOR EACH ROW EXECUTE FUNCTION public.fn_proteger_geocoding_manual();

DROP TRIGGER IF EXISTS trg_validar_geocoding_emp ON public.bd_empresas;
CREATE TRIGGER trg_validar_geocoding_emp
  BEFORE INSERT OR UPDATE ON public.bd_empresas
  FOR EACH ROW EXECUTE FUNCTION public.fn_validar_geocoding_no_save();

DROP TRIGGER IF EXISTS trg_proteger_geocoding_manual_func ON public.bd_funcionarios;
CREATE TRIGGER trg_proteger_geocoding_manual_func
  BEFORE UPDATE ON public.bd_funcionarios
  FOR EACH ROW EXECUTE FUNCTION public.fn_proteger_geocoding_manual();

DROP TRIGGER IF EXISTS trg_validar_geocoding_func ON public.bd_funcionarios;
CREATE TRIGGER trg_validar_geocoding_func
  BEFORE INSERT OR UPDATE ON public.bd_funcionarios
  FOR EACH ROW EXECUTE FUNCTION public.fn_validar_geocoding_no_save();

DROP TRIGGER IF EXISTS trg_proteger_geocoding_manual_loc ON public.bd_locais_atendimento;
CREATE TRIGGER trg_proteger_geocoding_manual_loc
  BEFORE UPDATE ON public.bd_locais_atendimento
  FOR EACH ROW EXECUTE FUNCTION public.fn_proteger_geocoding_manual();

DROP TRIGGER IF EXISTS trg_validar_geocoding_loc ON public.bd_locais_atendimento;
CREATE TRIGGER trg_validar_geocoding_loc
  BEFORE INSERT OR UPDATE ON public.bd_locais_atendimento
  FOR EACH ROW EXECUTE FUNCTION public.fn_validar_geocoding_no_save();
