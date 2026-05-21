CREATE OR REPLACE FUNCTION public.fn_server_now_brt()
RETURNS timestamp
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::timestamp;
$$;

GRANT EXECUTE ON FUNCTION public.fn_server_now_brt() TO authenticated, anon;