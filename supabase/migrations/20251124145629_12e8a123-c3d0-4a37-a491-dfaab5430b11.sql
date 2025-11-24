-- Cria funções de permissão para SSO (Segurança do Trabalho)
-- AdmSSO: Administrador SSO com acesso completo a Gestão de RH e SSO
-- TecSSO: Técnico SSO com acesso apenas aos checklists

-- Função AdmSSO: Acesso completo a Gestão de RH + SSO
INSERT INTO bd_funcoes_permissao (nome_funcao, descricao, permissoes)
VALUES (
  'AdmSSO',
  'Administrador de SSO - Acesso completo a Gestão de RH e módulos de Segurança',
  ARRAY[
    'f534a5e2-7650-4a2a-aa84-918081497da6', -- dashboard_view
    '6d86adc2-33b9-4744-8371-68f8a2777f74', -- dashboard_rh_view
    '1829cdde-e370-4adb-9525-df00d4e3713e', -- gestao_rh_empresas_view
    '7306f322-3707-4e9a-8e29-5afb1a5bc514', -- gestao_rh_departamentos_view
    'd117391f-5d28-4e0c-81f1-82af9bca4249', -- gestao_rh_centros_custo_view
    'cba6fa42-9020-4690-a27d-8bba4cb7fac6', -- gestao_rh_funcoes_view
    '947635d1-8871-41e2-9f00-401f80a11d7b', -- gestao_rh_funcionarios_view
    'df46f476-31f0-4a26-a56a-b22bfdf7253a', -- gestao_rh_equipes_view
    'd0e1ed14-a3f0-4a8c-9be8-985c27ad1b7b', -- acesso_sso_checklists
    '72695cce-553e-49f1-8089-c4901d603929'  -- acesso_sso_dashboard
  ]::uuid[]
)
ON CONFLICT (nome_funcao) DO UPDATE
SET 
  descricao = EXCLUDED.descricao,
  permissoes = EXCLUDED.permissoes,
  updated_at = now();

-- Função TecSSO: Acesso apenas aos checklists
INSERT INTO bd_funcoes_permissao (nome_funcao, descricao, permissoes)
VALUES (
  'TecSSO',
  'Técnico de SSO - Acesso aos checklists de segurança NR-18',
  ARRAY[
    'f534a5e2-7650-4a2a-aa84-918081497da6', -- dashboard_view
    'd0e1ed14-a3f0-4a8c-9be8-985c27ad1b7b'  -- acesso_sso_checklists
  ]::uuid[]
)
ON CONFLICT (nome_funcao) DO UPDATE
SET 
  descricao = EXCLUDED.descricao,
  permissoes = EXCLUDED.permissoes,
  updated_at = now();