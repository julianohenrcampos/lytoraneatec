-- Atualizar política RLS de bd_funcionarios para incluir perfis SSO faltantes
DROP POLICY IF EXISTS "Funcionários: acesso por papel e departamento" ON bd_funcionarios;

CREATE POLICY "Funcionários: acesso por papel e departamento"
ON bd_funcionarios FOR SELECT TO authenticated
USING (
  -- SuperAdm: acesso total
  check_is_super_admin()
  -- Acesso global explícito
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.acesso_global = true)
  -- AdmRH: acesso total
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND 'AdmRH' = ANY(p.funcoes))
  -- AdmSSO/AdmOBRA: acesso global
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND ('AdmSSO' = ANY(p.funcoes) OR 'AdmOBRA' = ANY(p.funcoes)))
  -- Perfis SSO com acesso global (has_sso_full_access)
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND ('TecEnferSSO' = ANY(p.funcoes) OR 'ConsultaExames' = ANY(p.funcoes) OR 'AdmtreinoSSO' = ANY(p.funcoes)))
  -- Próprio registro
  OR id = (SELECT profiles.funcionario_id FROM profiles WHERE profiles.id = auth.uid())
  -- Perfis operacionais: filtrados por departamento
  OR (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND (
      'TecSSO' = ANY(p.funcoes) OR 'AdmLogistica' = ANY(p.funcoes) OR 'AdmEquipamentos' = ANY(p.funcoes)
      OR 'Encarregado' = ANY(p.funcoes) OR 'Apontador' = ANY(p.funcoes) OR 'GerenteRegional' = ANY(p.funcoes)
      OR 'AdmTec' = ANY(p.funcoes) OR 'JovemAdm' = ANY(p.funcoes) OR 'EnferAdm' = ANY(p.funcoes)
    ))
    AND departamento_id = get_user_departamento_id()
    AND get_user_departamento_id() IS NOT NULL
  )
);