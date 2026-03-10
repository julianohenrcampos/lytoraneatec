
-- Insert AdmtreinoSSO into bd_funcoes_permissao
INSERT INTO public.bd_funcoes_permissao (nome_funcao, descricao, permissoes)
SELECT 
  'AdmtreinoSSO',
  'Administrador de Treinamento SSO - Acesso ao módulo SSO com edição de Integração',
  (SELECT array_agg(id) FROM public.bd_permissoes 
   WHERE nome_permissao IN (
     'acesso_sso_checklists', 'acesso_sso_desvios', 'acesso_sso_dashboard',
     'acesso_sso_agendamento_exames', 'acesso_sso_ver_agir', 'dashboard_view'
   ))
WHERE NOT EXISTS (
  SELECT 1 FROM public.bd_funcoes_permissao WHERE nome_funcao = 'AdmtreinoSSO'
);
