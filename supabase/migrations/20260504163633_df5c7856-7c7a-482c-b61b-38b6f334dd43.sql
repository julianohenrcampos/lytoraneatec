-- Fase 5A-4.1: Corrigir profiles.acesso_global em 3 usuarios
-- Apenas profiles.acesso_global. Nenhuma alteracao em bd_roles, bd_user_roles,
-- bd_role_permission_actions, triggers, functions, RLS, schema ou tabelas legadas.

-- (1) SuperAdm legitimo recebe acesso_global=true
UPDATE public.profiles
   SET acesso_global = true
 WHERE id = 'e8be73b1-600f-4dfa-913c-615e48ef00dc'
   AND EXISTS (
     SELECT 1 FROM public.bd_user_roles ur
     JOIN public.bd_roles r ON r.id = ur.role_id
     WHERE ur.user_id = profiles.id
       AND trim(r.nome) = 'SuperAdm'
   );

-- (2) acesso_global indevido em gestores customizados
UPDATE public.profiles
   SET acesso_global = false
 WHERE id IN (
     '93ab0d07-79a3-45eb-831b-3fa3a0c60f4b',
     '0b218dc4-258b-4f31-ac71-c92409f8208c'
   )
   AND NOT EXISTS (
     SELECT 1 FROM public.bd_user_roles ur
     JOIN public.bd_roles r ON r.id = ur.role_id
     WHERE ur.user_id = profiles.id
       AND trim(r.nome) = 'SuperAdm'
   );