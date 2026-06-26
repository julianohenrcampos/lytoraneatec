
BEGIN;
SET LOCAL session_replication_role = 'replica';

UPDATE public.profiles p
SET acesso_global = false
WHERE lower(p.email) IN ('paulalohara2015@gmail.com','silvane.santos@lytoranea.com.br')
  AND p.acesso_global IS TRUE
  AND NOT EXISTS (
    SELECT 1 FROM public.bd_user_roles ur
    JOIN public.bd_roles r ON r.id = ur.role_id
    WHERE ur.user_id = p.id
      AND lower(btrim(r.nome)) = 'superadm'
  );

COMMIT;
