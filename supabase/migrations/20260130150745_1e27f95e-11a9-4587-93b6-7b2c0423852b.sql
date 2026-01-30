-- Criar função para verificar acesso total (admins SSO)
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

-- Função auxiliar para verificar se pode deletar (SuperAdm ou AdmSSO)
CREATE OR REPLACE FUNCTION public.can_delete_agendamento_exame(p_user_id uuid DEFAULT auth.uid())
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
      'AdmSSO' = ANY(p.funcoes)
    )
  );
$$;

-- Atualizar política de SELECT para agendamentos (visibilidade restrita)
DROP POLICY IF EXISTS "Agendamentos exames: select for SSO users" 
  ON public.bd_agendamentos_exames;

CREATE POLICY "Agendamentos exames: select com visibilidade restrita"
  ON public.bd_agendamentos_exames
  FOR SELECT
  TO authenticated
  USING (
    has_sso_full_access(auth.uid())
    OR criado_por = auth.uid()
  );

-- Atualizar política de UPDATE (apenas admins com acesso total)
DROP POLICY IF EXISTS "Agendamentos exames: update for SSO users"
  ON public.bd_agendamentos_exames;

CREATE POLICY "Agendamentos exames: update apenas admins"
  ON public.bd_agendamentos_exames
  FOR UPDATE
  TO authenticated
  USING (has_sso_full_access(auth.uid()));

-- Atualizar política de DELETE (apenas SuperAdm e AdmSSO)
DROP POLICY IF EXISTS "Agendamentos exames: delete for SSO users"
  ON public.bd_agendamentos_exames;

CREATE POLICY "Agendamentos exames: delete apenas super admins"
  ON public.bd_agendamentos_exames
  FOR DELETE
  TO authenticated
  USING (can_delete_agendamento_exame(auth.uid()));