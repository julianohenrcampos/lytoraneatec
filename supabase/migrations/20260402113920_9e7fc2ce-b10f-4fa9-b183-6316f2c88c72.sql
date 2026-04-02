
-- Etapa 1: Inserir 4 permissões faltantes
INSERT INTO bd_permissions (codigo, nome, descricao, rota, tipo) VALUES
('gestao_rh_diretorias_view', 'Visualizar Diretorias', 'Acesso à página de Diretorias', '/gestao-rh/diretorias', 'page'),
('acesso_sso_ver_agir', 'Ver e Agir SSO', 'Acesso ao módulo Ver e Agir SSO', '/sso/ver-e-agir', 'page'),
('admin_gestao_fluxos_view', 'Gestão de Fluxos', 'Acesso à gestão de fluxos de aprovação', '/admin/gestao-fluxos', 'page'),
('acesso_gestao_aprovacoes', 'Gestão Aprovações Diárias', 'Acesso à gestão de aprovações de diárias', '/gestao-aprovacoes-diarias', 'page')
ON CONFLICT (codigo) DO NOTHING;

-- Etapa 2: Atualizar nomes legíveis das permissões existentes
UPDATE bd_permissions SET nome = 'Agendamento de Exames SSO', descricao = 'Acesso ao módulo de Agendamento de Exames SSO' WHERE codigo = 'acesso_sso_agendamento_exames';
UPDATE bd_permissions SET nome = 'Checklists NR-18', descricao = 'Acesso ao módulo SSO - Checklists NR-18' WHERE codigo = 'acesso_sso_checklists';
UPDATE bd_permissions SET nome = 'Dashboard SSO', descricao = 'Acesso ao Dashboard de Análise SSO NR-18' WHERE codigo = 'acesso_sso_dashboard';
UPDATE bd_permissions SET nome = 'Registro de Desvios SSO', descricao = 'Acesso ao módulo de Registro de Desvios SSO' WHERE codigo = 'acesso_sso_desvios';
UPDATE bd_permissions SET nome = 'Gestão de Permissões', descricao = 'Acesso à página de gestão de permissões (admin)' WHERE codigo = 'admin_permissoes_view';
UPDATE bd_permissions SET nome = 'Dashboard CBUQ', descricao = 'Acesso ao Dashboard CBUQ' WHERE codigo = 'dashboard_cbuq_view';
UPDATE bd_permissions SET nome = 'Dashboard Máquinas', descricao = 'Acesso ao Dashboard de Máquinas/Equipamentos' WHERE codigo = 'dashboard_maquinas_view';
UPDATE bd_permissions SET nome = 'Dashboard RH', descricao = 'Acesso ao Dashboard de Recursos Humanos' WHERE codigo = 'dashboard_rh_view';
UPDATE bd_permissions SET nome = 'Portal Principal', descricao = 'Acesso ao portal/dashboard principal' WHERE codigo = 'dashboard_view';
UPDATE bd_permissions SET nome = 'Apontamento de Diárias', descricao = 'Acesso à página de apontamento de campo' WHERE codigo = 'diarias_apontamento_view';
UPDATE bd_permissions SET nome = 'Aprovar Diárias', descricao = 'Permissão para aprovar ou reprovar solicitações de diária' WHERE codigo = 'diarias_aprovar';
UPDATE bd_permissions SET nome = 'Autorizar Diárias', descricao = 'Permissão para autorizar solicitações de diária' WHERE codigo = 'diarias_autorizar';
UPDATE bd_permissions SET nome = 'Dashboard Diárias', descricao = 'Acesso ao Dashboard de Diárias' WHERE codigo = 'diarias_dashboard_view';
UPDATE bd_permissions SET nome = 'Exportar Diárias', descricao = 'Permissão para exportar relatórios de diárias' WHERE codigo = 'diarias_export';
UPDATE bd_permissions SET nome = 'Exportar Diárias Excel', descricao = 'Permissão para exportar diárias em Excel' WHERE codigo = 'diarias_exportar_excel';
UPDATE bd_permissions SET nome = 'Relatório de Diárias', descricao = 'Acesso ao relatório/folha de diárias' WHERE codigo = 'diarias_relatorio_view';
UPDATE bd_permissions SET nome = 'Solicitações de Diárias', descricao = 'Acesso à página de solicitações de diárias' WHERE codigo = 'diarias_solicitacoes_view';
UPDATE bd_permissions SET nome = 'Solicitar Diárias', descricao = 'Permissão para criar e editar solicitações de diária' WHERE codigo = 'diarias_solicitar';
UPDATE bd_permissions SET nome = 'Cancelar Próprias Diárias', descricao = 'Permissão para cancelar/excluir próprias solicitações' WHERE codigo = 'diarias_solicitar_cancel_own';
UPDATE bd_permissions SET nome = 'Criar Solicitação de Diária', descricao = 'Permissão para criar novas solicitações de diária' WHERE codigo = 'diarias_solicitar_create';
UPDATE bd_permissions SET nome = 'Editar Próprias Diárias', descricao = 'Permissão para editar próprias solicitações' WHERE codigo = 'diarias_solicitar_edit_own';
UPDATE bd_permissions SET nome = 'Reenviar Diárias', descricao = 'Permissão para reenviar solicitações reprovadas' WHERE codigo = 'diarias_solicitar_resend_own';
UPDATE bd_permissions SET nome = 'Visualizar Diárias', descricao = 'Permissão geral para visualizar módulo de diárias' WHERE codigo = 'diarias_view';
UPDATE bd_permissions SET nome = 'Centros de Custo', descricao = 'Acesso à gestão de centros de custo' WHERE codigo = 'gestao_rh_centros_custo_view';
UPDATE bd_permissions SET nome = 'Departamentos', descricao = 'Acesso à gestão de departamentos' WHERE codigo = 'gestao_rh_departamentos_view';
UPDATE bd_permissions SET nome = 'Empresas', descricao = 'Acesso à gestão de empresas' WHERE codigo = 'gestao_rh_empresas_view';
UPDATE bd_permissions SET nome = 'Equipes', descricao = 'Acesso à gestão de equipes' WHERE codigo = 'gestao_rh_equipes_view';
UPDATE bd_permissions SET nome = 'Funções (Cargos)', descricao = 'Acesso à gestão de funções/cargos' WHERE codigo = 'gestao_rh_funcoes_view';
UPDATE bd_permissions SET nome = 'Funcionários', descricao = 'Acesso à gestão de funcionários' WHERE codigo = 'gestao_rh_funcionarios_view';
UPDATE bd_permissions SET nome = 'Caminhões e Equipamentos', descricao = 'Acesso à gestão de caminhões e equipamentos' WHERE codigo = 'gestao_maquinas_caminhoes_view';
UPDATE bd_permissions SET nome = 'Relatório de Medição', descricao = 'Acesso ao relatório de medição de máquinas' WHERE codigo = 'gestao_maquinas_relatorio_medicao_view';
UPDATE bd_permissions SET nome = 'Usinas', descricao = 'Acesso à gestão de usinas' WHERE codigo = 'gestao_maquinas_usinas_view';
UPDATE bd_permissions SET nome = 'Apontamento de Caminhões', descricao = 'Acesso ao apontamento de caminhões' WHERE codigo = 'requisicoes_apontamento_caminhoes_view';
UPDATE bd_permissions SET nome = 'Apontamento de Equipe', descricao = 'Acesso ao apontamento de equipe' WHERE codigo = 'requisicoes_apontamento_equipe_view';
UPDATE bd_permissions SET nome = 'Cadastro de Requisições', descricao = 'Acesso ao cadastro de requisições' WHERE codigo = 'requisicoes_cadastro_view';
UPDATE bd_permissions SET nome = 'Chamados/OS', descricao = 'Acesso aos chamados e ordens de serviço' WHERE codigo = 'requisicoes_chamados_os_view';
UPDATE bd_permissions SET nome = 'Gestão de OS', descricao = 'Acesso à gestão de ordens de serviço' WHERE codigo = 'requisicoes_gestao_os_view';
UPDATE bd_permissions SET nome = 'Programação de Entrega', descricao = 'Acesso à programação de entrega' WHERE codigo = 'requisicoes_programacao_entrega_view';
UPDATE bd_permissions SET nome = 'Registro de Cargas', descricao = 'Acesso ao registro de cargas' WHERE codigo = 'requisicoes_registro_cargas_view';
UPDATE bd_permissions SET nome = 'Registro de Aplicação', descricao = 'Acesso ao registro de aplicação' WHERE codigo = 'requisicoes_registro_aplicacao_view';
UPDATE bd_permissions SET nome = 'Relatório de Licitações', descricao = 'Acesso ao relatório de licitações' WHERE codigo = 'relatorio_licitacoes_view';
