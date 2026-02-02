-- Ajustar permissões do AdmTec no Agendamento de Exames
-- AdmTec: pode criar, vê apenas os que criou, não edita/altera status/exclui

-- 1. Adicionar AdmTec à função has_sso_permission (permissão básica do módulo - permite INSERT)
CREATE OR REPLACE FUNCTION public.has_sso_permission(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = p_user_id
    AND (
      'SuperAdm' = ANY(p.funcoes) OR
      'AdmSSO' = ANY(p.funcoes) OR
      'TecSSO' = ANY(p.funcoes) OR
      'EnferAdm' = ANY(p.funcoes) OR
      'TecEnferSSO' = ANY(p.funcoes) OR
      'JovemAdm' = ANY(p.funcoes) OR
      'AdmTec' = ANY(p.funcoes)
    )
  );
$$;

-- 2. Remover AdmTec da função has_sso_full_access (visibilidade global e edição)
CREATE OR REPLACE FUNCTION public.has_sso_full_access(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = p_user_id
    AND (
      'SuperAdm' = ANY(p.funcoes) OR
      'AdmSSO' = ANY(p.funcoes) OR
      'TecEnferSSO' = ANY(p.funcoes)
    )
  );
$$;