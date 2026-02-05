-- =====================================================
-- MIGRAÇÃO: Reverter acesso total do AdmSSO para departamental
-- AdmSSO pode INSERT em qualquer dept, mas SELECT apenas seu dept
-- =====================================================

-- 1. Remover política que dava acesso total ao AdmSSO
DROP POLICY IF EXISTS "Funcionários: acesso por papel e departamento" ON public.bd_funcionarios;

-- 2. Recriar política com AdmSSO tendo acesso APENAS departamental
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
  
  -- Próprio funcionário pode ver seus dados
  OR (id = (SELECT profiles.funcionario_id FROM profiles WHERE profiles.id = auth.uid()))
  
  -- AdmSSO com filtro departamental (REVERTIDO)
  OR (
    (EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND 'AdmSSO' = ANY(p.funcoes)
    ))
    AND departamento_id = get_user_departamento_id()
    AND get_user_departamento_id() IS NOT NULL
  )
  
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