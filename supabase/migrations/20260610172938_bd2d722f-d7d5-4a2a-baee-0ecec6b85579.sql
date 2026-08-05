ALTER TABLE public.bd_centros_custo
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.set_centro_custo_created_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_centro_custo_created_by ON public.bd_centros_custo;
CREATE TRIGGER trg_set_centro_custo_created_by
  BEFORE INSERT ON public.bd_centros_custo
  FOR EACH ROW
  EXECUTE FUNCTION public.set_centro_custo_created_by();