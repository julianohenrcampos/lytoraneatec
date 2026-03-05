-- Add AdmtreinoSSO to has_sso_permission
CREATE OR REPLACE FUNCTION public.has_sso_permission(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = p_user_id
    AND (
      'SuperAdm' = ANY(p.funcoes) OR
      'AdmSSO' = ANY(p.funcoes) OR
      'AdmOBRA' = ANY(p.funcoes) OR
      'TecSSO' = ANY(p.funcoes) OR
      'EnferAdm' = ANY(p.funcoes) OR
      'TecEnferSSO' = ANY(p.funcoes) OR
      'JovemAdm' = ANY(p.funcoes) OR
      'AdmTec' = ANY(p.funcoes) OR
      'ConsultaExames' = ANY(p.funcoes) OR
      'AdmtreinoSSO' = ANY(p.funcoes)
    )
  );
$$;

-- Add AdmtreinoSSO to has_sso_full_access
CREATE OR REPLACE FUNCTION public.has_sso_full_access(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = p_user_id
    AND (
      'SuperAdm' = ANY(p.funcoes) OR
      'AdmSSO' = ANY(p.funcoes) OR
      'AdmOBRA' = ANY(p.funcoes) OR
      'TecEnferSSO' = ANY(p.funcoes) OR
      'ConsultaExames' = ANY(p.funcoes) OR
      'AdmtreinoSSO' = ANY(p.funcoes)
    )
  );
$$;