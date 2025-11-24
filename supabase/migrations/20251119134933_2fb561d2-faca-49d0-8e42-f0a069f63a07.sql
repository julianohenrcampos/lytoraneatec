-- Relaxar política de INSERT para permitir qualquer usuário autenticado criar checklists
DROP POLICY IF EXISTS "sso_checklists_insert" ON public.bd_sso_checklists;

CREATE POLICY "sso_checklists_insert"
ON public.bd_sso_checklists
FOR INSERT
TO authenticated
WITH CHECK (criado_por = auth.uid());