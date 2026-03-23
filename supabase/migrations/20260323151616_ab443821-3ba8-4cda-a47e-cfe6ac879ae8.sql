-- 1. Insert AdmSede into bd_roles if not exists
INSERT INTO bd_roles (nome, descricao, ativo)
VALUES ('AdmSede', 'Administrador SEDE - acesso por Centro de Custo vinculado', true)
ON CONFLICT DO NOTHING;

-- 2. Link AdmSede to permissions in bd_role_permissions
INSERT INTO bd_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM bd_roles r, bd_permissions p
WHERE r.nome = 'AdmSede'
AND p.codigo IN (
  'dashboard_rh_view','gestao_rh_empresas_view','gestao_rh_departamentos_view',
  'gestao_rh_centros_custo_view','gestao_rh_funcoes_view','gestao_rh_funcionarios_view',
  'gestao_rh_equipes_view','acesso_sso_agendamento_exames',
  'diarias_view','diarias_dashboard_view','diarias_solicitacoes_view',
  'diarias_apontamento_view','diarias_relatorio_view','acesso_gestao_aprovacoes',
  'acesso_sso_dashboard','acesso_sso_checklists','acesso_sso_desvios'
)
ON CONFLICT DO NOTHING;

-- 3. Insert AdmSede into legacy bd_funcoes_permissao with UUID cast
INSERT INTO bd_funcoes_permissao (nome_funcao, descricao, permissoes)
VALUES (
  'AdmSede',
  'Administrador SEDE - acesso por Centro de Custo vinculado',
  ARRAY[
    '6d86adc2-33b9-4744-8371-68f8a2777f74'::uuid,
    '1829cdde-e370-4adb-9525-df00d4e3713e'::uuid,
    '7306f322-3707-4e9a-8e29-5afb1a5bc514'::uuid,
    'd117391f-5d28-4e0c-81f1-82af9bca4249'::uuid,
    'cba6fa42-9020-4690-a27d-8bba4cb7fac6'::uuid,
    '947635d1-8871-41e2-9f00-401f80a11d7b'::uuid,
    'df46f476-31f0-4a26-a56a-b22bfdf7253a'::uuid,
    'ab3c9470-03b8-4760-8b84-49fe6b2484ed'::uuid,
    'fb75190c-585e-4142-a971-1ff90b383b2f'::uuid,
    '771f872e-cd89-4e64-8918-621152cc0b79'::uuid,
    'b5650bf9-ebca-4322-949e-0e0df1dc1be0'::uuid,
    '45f4d516-6254-4c02-9691-1442798e40dc'::uuid,
    '6e2d1fb6-cc81-4391-bb1f-fc51b05c9826'::uuid,
    'aec356cf-143e-49b5-967c-a0b60efaea16'::uuid,
    '72695cce-553e-49f1-8089-c4901d603929'::uuid,
    'd0e1ed14-a3f0-4a8c-9be8-985c27ad1b7b'::uuid,
    'b2bd99ec-be04-4afe-94d1-2342e0df9c04'::uuid
  ]
)
ON CONFLICT DO NOTHING;