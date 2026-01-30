-- ===========================================
-- MIGRAÇÃO: Adicionar TecEnferSSO às Permissões SSO
-- ===========================================

-- 1. Atualizar profile da Beatriz para usar apenas TecEnferSSO
UPDATE profiles 
SET funcoes = ARRAY['TecEnferSSO']
WHERE email = 'bya1962@hotmail.com';

-- 2. Drop da função has_sso_permission (CASCADE remove políticas dependentes)
DROP FUNCTION IF EXISTS public.has_sso_permission(uuid) CASCADE;

-- 3. Recriar função com TecEnferSSO incluído
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
      'TecEnferSSO' = ANY(p.funcoes)
    )
  );
$$;

-- ===========================================
-- RECRIAR POLÍTICAS RLS - bd_sso_checklists
-- ===========================================

CREATE POLICY "SSO checklists: insert for SSO users"
ON public.bd_sso_checklists
FOR INSERT
TO authenticated
WITH CHECK (public.has_sso_permission(auth.uid()));

CREATE POLICY "SSO checklists: update for SSO users or creator"
ON public.bd_sso_checklists
FOR UPDATE
TO authenticated
USING (
  public.has_sso_permission(auth.uid()) OR 
  criado_por = auth.uid()
);

-- ===========================================
-- RECRIAR POLÍTICAS RLS - bd_sso_checklist_itens
-- ===========================================

CREATE POLICY "SSO checklist itens: select for SSO users"
ON public.bd_sso_checklist_itens
FOR SELECT
TO authenticated
USING (public.has_sso_permission(auth.uid()));

CREATE POLICY "SSO checklist itens: insert for SSO users"
ON public.bd_sso_checklist_itens
FOR INSERT
TO authenticated
WITH CHECK (public.has_sso_permission(auth.uid()));

CREATE POLICY "SSO checklist itens: update for SSO users"
ON public.bd_sso_checklist_itens
FOR UPDATE
TO authenticated
USING (public.has_sso_permission(auth.uid()));

CREATE POLICY "SSO checklist itens: delete for SSO users"
ON public.bd_sso_checklist_itens
FOR DELETE
TO authenticated
USING (public.has_sso_permission(auth.uid()));

-- ===========================================
-- RECRIAR POLÍTICAS RLS - bd_locais_atendimento
-- ===========================================

CREATE POLICY "Locais atendimento: select for SSO users"
ON public.bd_locais_atendimento
FOR SELECT
TO authenticated
USING (public.has_sso_permission(auth.uid()));

CREATE POLICY "Locais atendimento: insert for SSO users"
ON public.bd_locais_atendimento
FOR INSERT
TO authenticated
WITH CHECK (public.has_sso_permission(auth.uid()));

CREATE POLICY "Locais atendimento: update for SSO users"
ON public.bd_locais_atendimento
FOR UPDATE
TO authenticated
USING (public.has_sso_permission(auth.uid()));

CREATE POLICY "Locais atendimento: delete for SSO users"
ON public.bd_locais_atendimento
FOR DELETE
TO authenticated
USING (public.has_sso_permission(auth.uid()));

-- ===========================================
-- RECRIAR POLÍTICAS RLS - bd_agendamentos_exames
-- ===========================================

CREATE POLICY "Agendamentos exames: select for SSO users"
ON public.bd_agendamentos_exames
FOR SELECT
TO authenticated
USING (public.has_sso_permission(auth.uid()));

CREATE POLICY "Agendamentos exames: insert for SSO users"
ON public.bd_agendamentos_exames
FOR INSERT
TO authenticated
WITH CHECK (public.has_sso_permission(auth.uid()));

CREATE POLICY "Agendamentos exames: update for SSO users"
ON public.bd_agendamentos_exames
FOR UPDATE
TO authenticated
USING (public.has_sso_permission(auth.uid()));

CREATE POLICY "Agendamentos exames: delete for SSO users"
ON public.bd_agendamentos_exames
FOR DELETE
TO authenticated
USING (public.has_sso_permission(auth.uid()));

-- ===========================================
-- RECRIAR POLÍTICAS RLS - bd_agendamentos_exames_anexos
-- ===========================================

CREATE POLICY "Agendamentos anexos: select for SSO users"
ON public.bd_agendamentos_exames_anexos
FOR SELECT
TO authenticated
USING (public.has_sso_permission(auth.uid()));

CREATE POLICY "Agendamentos anexos: insert for SSO users"
ON public.bd_agendamentos_exames_anexos
FOR INSERT
TO authenticated
WITH CHECK (public.has_sso_permission(auth.uid()));

CREATE POLICY "Agendamentos anexos: delete for SSO users"
ON public.bd_agendamentos_exames_anexos
FOR DELETE
TO authenticated
USING (public.has_sso_permission(auth.uid()));

-- ===========================================
-- RECRIAR POLÍTICAS RLS - storage.objects (bucket exames_agendamentos)
-- ===========================================

CREATE POLICY "Exames storage: insert for SSO users"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'exames_agendamentos' AND
  public.has_sso_permission(auth.uid())
);

CREATE POLICY "Exames storage: delete for SSO users"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'exames_agendamentos' AND
  public.has_sso_permission(auth.uid())
);