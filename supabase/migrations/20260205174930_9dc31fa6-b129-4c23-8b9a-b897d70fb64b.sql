-- =====================================================
-- MIGRAÇÃO: Dar acesso total de leitura ao AdmSSO
-- =====================================================

-- 1. Remover políticas SELECT antigas
DROP POLICY IF EXISTS "Funcionários: acesso global ou departamental" ON public.bd_funcionarios;
DROP POLICY IF EXISTS "Funcionários: acesso seguro por papel" ON public.bd_funcionarios;

-- 2. Criar nova política SELECT unificada com AdmSSO tendo acesso total
CREATE POLICY "Funcionários: acesso por papel e departamento"
ON public.bd_funcionarios
FOR SELECT
TO authenticated
USING (
  -- SuperAdmin tem acesso total
  check_is_super_admin()
  
  -- Acesso global (campo no perfil)
  OR (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.acesso_global = true
  ))
  
  -- AdmRH tem acesso total
  OR (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND 'AdmRH' = ANY(p.funcoes)
  ))
  
  -- AdmSSO tem acesso total (CORREÇÃO)
  OR (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND 'AdmSSO' = ANY(p.funcoes)
  ))
  
  -- Próprio funcionário pode ver seus dados
  OR (id = (SELECT profiles.funcionario_id FROM profiles WHERE profiles.id = auth.uid()))
  
  -- Outros papéis com filtro departamental
  OR (
    (EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND (
        'TecSSO' = ANY(p.funcoes)
        OR 'AdmLogistica' = ANY(p.funcoes)
        OR 'AdmEquipamentos' = ANY(p.funcoes)
        OR 'Encarregado' = ANY(p.funcoes)
        OR 'Apontador' = ANY(p.funcoes)
      )
    ))
    AND departamento_id = get_user_departamento_id()
    AND get_user_departamento_id() IS NOT NULL
  )
);