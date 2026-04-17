CREATE OR REPLACE FUNCTION public.get_data_operacional_atual()
RETURNS date
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date;
$$;

GRANT EXECUTE ON FUNCTION public.get_data_operacional_atual() TO authenticated, anon;