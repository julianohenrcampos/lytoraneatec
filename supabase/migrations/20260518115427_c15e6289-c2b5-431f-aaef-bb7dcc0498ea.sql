
-- Fix 1: bd_aprovacoes_inclusao_funcionario — restrict SELECT
DROP POLICY IF EXISTS "Authenticated users can view inclusion approvals" ON public.bd_aprovacoes_inclusao_funcionario;

CREATE POLICY "Scoped view of inclusion approvals"
ON public.bd_aprovacoes_inclusao_funcionario
FOR SELECT
TO authenticated
USING (
  solicitado_por = auth.uid()
  OR aprovado_por = auth.uid()
  OR EXISTS (
    SELECT 1 FROM bd_user_roles ur
    JOIN bd_roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.nome = ANY (ARRAY['SuperAdm','AdmSede','Engenheiro','AdmRH'])
  )
  OR EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.funcionario_id = bd_aprovacoes_inclusao_funcionario.funcionario_id
  )
);

-- Fix 2: bd_funcionario_status_historico — restrict SELECT
DROP POLICY IF EXISTS "Authenticated users can view status history" ON public.bd_funcionario_status_historico;

CREATE POLICY "Scoped view of status history"
ON public.bd_funcionario_status_historico
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM bd_user_roles ur
    JOIN bd_roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.nome = ANY (ARRAY['SuperAdm','AdmRH','AdmSede','DP'])
  )
  OR EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.funcionario_id = bd_funcionario_status_historico.funcionario_id
  )
);

-- Fix 3: profiles — prevent privilege escalation via column guard trigger
CREATE OR REPLACE FUNCTION public.fn_profiles_block_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_super boolean;
BEGIN
  SELECT public.fn_is_super_admin() INTO v_is_super;

  IF v_is_super THEN
    RETURN NEW;
  END IF;

  IF NEW.acesso_global IS DISTINCT FROM OLD.acesso_global
     OR NEW.funcoes IS DISTINCT FROM OLD.funcoes
     OR NEW.funcao_sistema IS DISTINCT FROM OLD.funcao_sistema
     OR NEW.funcao_permissao IS DISTINCT FROM OLD.funcao_permissao
     OR NEW.cargo IS DISTINCT FROM OLD.cargo
  THEN
    RAISE EXCEPTION 'Privilege escalation blocked: only SuperAdm may modify acesso_global, funcoes, funcao_sistema, funcao_permissao, or cargo'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_block_privilege_escalation ON public.profiles;
CREATE TRIGGER trg_profiles_block_privilege_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.fn_profiles_block_privilege_escalation();
