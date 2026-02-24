
-- 1. Criar função GerenteRegional em bd_funcoes_permissao
INSERT INTO bd_funcoes_permissao (nome_funcao, descricao, permissoes)
VALUES (
  'GerenteRegional',
  'Gerente Regional - Acesso a Gestão de RH (restrito ao departamento) e Diárias (centros de custo vinculados)',
  ARRAY[
    'f534a5e2-7650-4a2a-aa84-918081497da6'::uuid,
    '6d86adc2-33b9-4744-8371-68f8a2777f74'::uuid,
    '947635d1-8871-41e2-9f00-401f80a11d7b'::uuid,
    'd117391f-5d28-4e0c-81f1-82af9bca4249'::uuid,
    '7306f322-3707-4e9a-8e29-5afb1a5bc514'::uuid,
    'cba6fa42-9020-4690-a27d-8bba4cb7fac6'::uuid,
    'fb75190c-585e-4142-a971-1ff90b383b2f'::uuid,
    'b5650bf9-ebca-4322-949e-0e0df1dc1be0'::uuid,
    '723e6c21-8217-49dc-89c3-123a488d8a19'::uuid,
    'f7fc89e1-8143-4350-8aec-257d269ccbe2'::uuid,
    '45f4d516-6254-4c02-9691-1442798e40dc'::uuid,
    '6e2d1fb6-cc81-4391-bb1f-fc51b05c9826'::uuid,
    '771f872e-cd89-4e64-8918-621152cc0b79'::uuid
  ]
);

-- 2. Atualizar política RLS SELECT de bd_funcionarios para incluir GerenteRegional no filtro departamental
DROP POLICY IF EXISTS "Funcionários: acesso por papel e departamento" ON bd_funcionarios;

CREATE POLICY "Funcionários: acesso por papel e departamento"
ON bd_funcionarios
FOR SELECT
USING (
  check_is_super_admin()
  OR (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.acesso_global = true
  ))
  OR (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND 'AdmRH'::text = ANY(p.funcoes)
  ))
  OR (id = (
    SELECT profiles.funcionario_id FROM profiles WHERE profiles.id = auth.uid()
  ))
  OR (
    (EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND 'AdmSSO'::text = ANY(p.funcoes)
    ))
    AND departamento_id = get_user_departamento_id()
    AND get_user_departamento_id() IS NOT NULL
  )
  OR (
    (EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND (
        'TecSSO'::text = ANY(p.funcoes)
        OR 'AdmLogistica'::text = ANY(p.funcoes)
        OR 'AdmEquipamentos'::text = ANY(p.funcoes)
        OR 'Encarregado'::text = ANY(p.funcoes)
        OR 'Apontador'::text = ANY(p.funcoes)
        OR 'GerenteRegional'::text = ANY(p.funcoes)
      )
    ))
    AND departamento_id = get_user_departamento_id()
    AND get_user_departamento_id() IS NOT NULL
  )
);
