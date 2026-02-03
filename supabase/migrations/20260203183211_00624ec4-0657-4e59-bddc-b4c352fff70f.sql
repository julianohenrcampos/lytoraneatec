-- =====================================================
-- PERMISSÕES GRANULARES - MÓDULO DIÁRIAS
-- =====================================================

INSERT INTO bd_permissoes (nome_permissao, descricao, rota) VALUES
  ('diarias_dashboard_view', 'Ver Dashboard de Diárias', '/requisicoes/diarias/dashboard'),
  ('diarias_solicitacoes_view', 'Ver página de Solicitações de Diárias', '/requisicoes/diarias/solicitacoes'),
  ('diarias_apontamento_view', 'Ver página de Apontamento de Campo', '/requisicoes/diarias/apontamento-campo'),
  ('diarias_relatorio_view', 'Ver página de Relatório/Folha de Diárias', '/requisicoes/diarias/relatorio'),
  ('diarias_solicitar_create', 'Criar novas solicitações de diária', NULL),
  ('diarias_solicitar_edit_own', 'Editar próprias solicitações de diária', NULL),
  ('diarias_solicitar_cancel_own', 'Cancelar/Excluir próprias solicitações', NULL),
  ('diarias_solicitar_resend_own', 'Reenviar solicitações reprovadas ou canceladas', NULL),
  ('diarias_aprovar', 'Aprovar ou reprovar solicitações de diária', NULL),
  ('diarias_apontar_own', 'Registrar presença nos apontamentos atribuídos', NULL),
  ('diarias_export', 'Exportar relatórios em PDF e Excel', NULL)
ON CONFLICT (nome_permissao) DO NOTHING;