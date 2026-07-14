CREATE OR REPLACE FUNCTION public.fn_checklist_ce_catalog_raw()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $fn$
  SELECT jsonb_object_agg(substring(chave from 23), valor::jsonb)
    FROM public.bd_configuracoes_sistema
   WHERE chave LIKE 'checklist_ce_template_%' AND ativo = true
$fn$;