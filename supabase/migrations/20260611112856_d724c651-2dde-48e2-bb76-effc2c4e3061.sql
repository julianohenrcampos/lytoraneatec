
-- Restrict writes on bd_diaria_calendario_operacional to privileged users only.
DROP POLICY IF EXISTS "Calendario operacional pode ser atualizado por autenticados" ON public.bd_diaria_calendario_operacional;
DROP POLICY IF EXISTS "Calendario operacional pode ser criado por autenticados" ON public.bd_diaria_calendario_operacional;
DROP POLICY IF EXISTS "Calendario operacional pode ser removido por autenticados" ON public.bd_diaria_calendario_operacional;

CREATE OR REPLACE FUNCTION public.fn_can_manage_diaria_calendario(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE((SELECT acesso_global FROM public.profiles WHERE id = _user_id), false)
    OR EXISTS (
      SELECT 1
      FROM public.bd_user_roles ur
      JOIN public.bd_role_permission_actions rpa ON rpa.role_id = ur.role_id
      JOIN public.bd_permissions p ON p.id = rpa.permission_id
      WHERE ur.user_id = _user_id
        AND p.codigo = 'diarias_autorizar'
    );
$$;

CREATE POLICY "Calendario operacional insert privilegiado"
  ON public.bd_diaria_calendario_operacional
  FOR INSERT TO authenticated
  WITH CHECK (public.fn_can_manage_diaria_calendario(auth.uid()));

CREATE POLICY "Calendario operacional update privilegiado"
  ON public.bd_diaria_calendario_operacional
  FOR UPDATE TO authenticated
  USING (public.fn_can_manage_diaria_calendario(auth.uid()))
  WITH CHECK (public.fn_can_manage_diaria_calendario(auth.uid()));

CREATE POLICY "Calendario operacional delete privilegiado"
  ON public.bd_diaria_calendario_operacional
  FOR DELETE TO authenticated
  USING (public.fn_can_manage_diaria_calendario(auth.uid()));
