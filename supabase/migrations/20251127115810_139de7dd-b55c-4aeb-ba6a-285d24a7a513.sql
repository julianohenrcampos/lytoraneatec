-- Corrigir função get_sso_admin_users para usar arquitetura correta
-- A função anterior referenciava a tabela bd_usuarios_permissoes que não existe
-- A arquitetura correta usa o array funcoes[] na tabela profiles

CREATE OR REPLACE FUNCTION public.get_sso_admin_users()
RETURNS TABLE(user_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT p.id
  FROM profiles p
  WHERE 
    -- SuperAdm tem acesso a todas as notificações
    'SuperAdm' = ANY(p.funcoes)
    -- AdmSSO também recebe notificações SSO críticas
    OR 'AdmSSO' = ANY(p.funcoes);
$$;