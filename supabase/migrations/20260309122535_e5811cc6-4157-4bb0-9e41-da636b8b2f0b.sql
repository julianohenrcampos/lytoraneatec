UPDATE public.bd_funcoes_permissao
SET permissoes = (
  SELECT array_agg(id) FROM public.bd_permissoes 
  WHERE nome_permissao IN (
    'acesso_sso_checklists', 'acesso_sso_desvios', 'acesso_sso_dashboard',
    'acesso_sso_agendamento_exames', 'acesso_sso_ver_agir', 'dashboard_view',
    'dashboard_rh_view',
    'gestao_rh_empresas_view', 'gestao_rh_departamentos_view',
    'gestao_rh_funcionarios_view', 'gestao_rh_funcoes_view',
    'gestao_rh_centros_custo_view', 'gestao_rh_equipes_view',
    'diarias_view', 'diarias_dashboard_view', 'diarias_solicitacoes_view',
    'diarias_apontamento_view', 'diarias_relatorio_view'
  )
)
WHERE nome_funcao = 'AdmtreinoSSO';