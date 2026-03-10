
DROP POLICY IF EXISTS "Funcionários: acesso por papel e departamento" ON bd_funcionarios;

CREATE POLICY "Funcionários: acesso por papel e departamento"
ON bd_funcionarios FOR SELECT
TO authenticated
USING (
  check_is_super_admin()
  OR
  (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.acesso_global = true))
  OR
  (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND 'AdmRH' = ANY(p.funcoes)))
  OR
  (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND ('AdmSSO' = ANY(p.funcoes) OR 'AdmOBRA' = ANY(p.funcoes))))
  OR
  (id = (SELECT profiles.funcionario_id FROM profiles WHERE profiles.id = auth.uid()))
  OR
  (
    (EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND ('TecSSO' = ANY(p.funcoes) OR 'AdmLogistica' = ANY(p.funcoes) OR 'AdmEquipamentos' = ANY(p.funcoes) OR 'Encarregado' = ANY(p.funcoes) OR 'Apontador' = ANY(p.funcoes) OR 'GerenteRegional' = ANY(p.funcoes))
    ))
    AND departamento_id = get_user_departamento_id()
    AND get_user_departamento_id() IS NOT NULL
  )
);
