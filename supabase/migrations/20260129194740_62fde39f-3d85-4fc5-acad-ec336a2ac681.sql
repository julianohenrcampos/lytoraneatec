
-- Drop function with cascade and recreate with EnferAdm
DROP FUNCTION IF EXISTS public.has_sso_permission(uuid) CASCADE;

-- Recreate the has_sso_permission function with EnferAdm
CREATE FUNCTION public.has_sso_permission(p_user_id uuid DEFAULT auth.uid())
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
      'EnferAdm' = ANY(p.funcoes)
    )
  );
$$;

COMMENT ON FUNCTION public.has_sso_permission(uuid) IS 'Check if user has SSO module permissions (SuperAdm, AdmSSO, TecSSO, EnferAdm)';

-- Recreate RLS policies for bd_sso_checklists
CREATE POLICY "SSO checklists: insert for SSO users"
  ON public.bd_sso_checklists FOR INSERT
  TO authenticated
  WITH CHECK (has_sso_permission(auth.uid()));

CREATE POLICY "SSO checklists: update for SSO users or creator"
  ON public.bd_sso_checklists FOR UPDATE
  TO authenticated
  USING (has_sso_permission(auth.uid()));

-- Recreate RLS policies for bd_sso_checklist_itens
CREATE POLICY "SSO checklist itens: select for SSO users"
  ON public.bd_sso_checklist_itens FOR SELECT
  TO authenticated
  USING (has_sso_permission(auth.uid()));

CREATE POLICY "SSO checklist itens: insert for SSO users"
  ON public.bd_sso_checklist_itens FOR INSERT
  TO authenticated
  WITH CHECK (has_sso_permission(auth.uid()));

CREATE POLICY "SSO checklist itens: update for SSO users"
  ON public.bd_sso_checklist_itens FOR UPDATE
  TO authenticated
  USING (has_sso_permission(auth.uid()));

CREATE POLICY "SSO checklist itens: delete for SSO users"
  ON public.bd_sso_checklist_itens FOR DELETE
  TO authenticated
  USING (has_sso_permission(auth.uid()));

-- Recreate RLS policies for bd_locais_atendimento
CREATE POLICY "Locais atendimento: manage for SSO users"
  ON public.bd_locais_atendimento FOR ALL
  TO authenticated
  USING (has_sso_permission(auth.uid()));

-- Recreate RLS policies for bd_agendamentos_exames
CREATE POLICY "Agendamentos exames: select for SSO users"
  ON public.bd_agendamentos_exames FOR SELECT
  TO authenticated
  USING (has_sso_permission(auth.uid()));

CREATE POLICY "Agendamentos exames: insert for SSO users"
  ON public.bd_agendamentos_exames FOR INSERT
  TO authenticated
  WITH CHECK (has_sso_permission(auth.uid()));

CREATE POLICY "Agendamentos exames: update for SSO users"
  ON public.bd_agendamentos_exames FOR UPDATE
  TO authenticated
  USING (has_sso_permission(auth.uid()));

CREATE POLICY "Agendamentos exames: delete for SSO users"
  ON public.bd_agendamentos_exames FOR DELETE
  TO authenticated
  USING (has_sso_permission(auth.uid()));

-- Recreate RLS policies for bd_agendamentos_exames_anexos
CREATE POLICY "Anexos exames: select for SSO users"
  ON public.bd_agendamentos_exames_anexos FOR SELECT
  TO authenticated
  USING (has_sso_permission(auth.uid()));

CREATE POLICY "Anexos exames: insert for SSO users"
  ON public.bd_agendamentos_exames_anexos FOR INSERT
  TO authenticated
  WITH CHECK (has_sso_permission(auth.uid()));

CREATE POLICY "Anexos exames: delete for SSO users"
  ON public.bd_agendamentos_exames_anexos FOR DELETE
  TO authenticated
  USING (has_sso_permission(auth.uid()));

-- Recreate storage policies for exames_agendamentos bucket
CREATE POLICY "Exames storage: insert for SSO users"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'exames_agendamentos' AND has_sso_permission(auth.uid()));

CREATE POLICY "Exames storage: delete for SSO users"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'exames_agendamentos' AND has_sso_permission(auth.uid()));
