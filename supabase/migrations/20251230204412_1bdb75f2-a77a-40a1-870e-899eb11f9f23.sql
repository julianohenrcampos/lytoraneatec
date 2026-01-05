-- Corrigir função trigger com search_path
CREATE OR REPLACE FUNCTION public.trg_pncp_contratacoes_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;