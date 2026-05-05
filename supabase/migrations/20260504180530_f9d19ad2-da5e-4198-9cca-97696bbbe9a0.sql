
-- =====================================================================
-- Fase 5B-2.4 — bd_rbac_legacy_map + vw_rbac_legacy_map_drift
-- =====================================================================

-- 1) Tabela canônica de mapeamento legado → RBAC novo
CREATE TABLE public.bd_rbac_legacy_map (
  legacy_nome   text PRIMARY KEY,
  status        text NOT NULL,
  new_codigo    text NULL,
  action_padrao text NULL,
  observacao    text NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bd_rbac_legacy_map_status_chk
    CHECK (status IN ('match_direto','substituir','obsoleta')),
  CONSTRAINT bd_rbac_legacy_map_action_chk
    CHECK (action_padrao IS NULL
           OR action_padrao IN ('visualizar','criar','editar','excluir','aprovar')),
  CONSTRAINT bd_rbac_legacy_map_obsoleta_null_chk
    CHECK (status <> 'obsoleta' OR (new_codigo IS NULL AND action_padrao IS NULL)),
  CONSTRAINT bd_rbac_legacy_map_ativa_required_chk
    CHECK (status = 'obsoleta' OR (new_codigo IS NOT NULL AND action_padrao IS NOT NULL)),
  CONSTRAINT bd_rbac_legacy_map_new_codigo_fk
    FOREIGN KEY (new_codigo) REFERENCES public.bd_permissions(codigo)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX idx_bd_rbac_legacy_map_status_codigo
  ON public.bd_rbac_legacy_map (status, new_codigo);

-- 2) Trigger updated_at
CREATE TRIGGER trg_bd_rbac_legacy_map_updated_at
  BEFORE UPDATE ON public.bd_rbac_legacy_map
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) RLS
ALTER TABLE public.bd_rbac_legacy_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY rbac_legacy_map_select_authenticated
  ON public.bd_rbac_legacy_map
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY rbac_legacy_map_write_admin
  ON public.bd_rbac_legacy_map
  FOR ALL TO authenticated
  USING (public.fn_can_manage_permission_catalog(auth.uid()))
  WITH CHECK (public.fn_can_manage_permission_catalog(auth.uid()));

-- 4) Seed das 71 permissões legadas (46 match_direto, 8 substituir, 17 obsoleta)
INSERT INTO public.bd_rbac_legacy_map
  (legacy_nome, status, new_codigo, action_padrao, observacao) VALUES
-- 46 match_direto
('acesso_gestao_aprovacoes',                'match_direto', 'acesso_gestao_aprovacoes',                'visualizar', NULL),
('acesso_monitoramento_pncp',               'match_direto', 'acesso_monitoramento_pncp',               'visualizar', NULL),
('acesso_sso_agendamento_exames',           'match_direto', 'acesso_sso_agendamento_exames',           'visualizar', NULL),
('acesso_sso_checklists',                   'match_direto', 'acesso_sso_checklists',                   'visualizar', NULL),
('acesso_sso_dashboard',                    'match_direto', 'acesso_sso_dashboard',                    'visualizar', NULL),
('acesso_sso_desvios',                      'match_direto', 'acesso_sso_desvios',                      'visualizar', NULL),
('admin_permissoes_view',                   'match_direto', 'admin_permissoes_view',                   'visualizar', NULL),
('configuracoes_pncp_view',                 'match_direto', 'configuracoes_pncp_view',                 'visualizar', NULL),
('dashboard_cbuq_view',                     'match_direto', 'dashboard_cbuq_view',                     'visualizar', NULL),
('dashboard_licitacoes_view',               'match_direto', 'dashboard_licitacoes_view',               'visualizar', NULL),
('dashboard_maquinas_view',                 'match_direto', 'dashboard_maquinas_view',                 'visualizar', NULL),
('dashboard_rh_view',                       'match_direto', 'dashboard_rh_view',                       'visualizar', NULL),
('dashboard_view',                          'match_direto', 'dashboard_view',                          'visualizar', NULL),
('diarias_apontamento_view',                'match_direto', 'diarias_apontamento_view',                'visualizar', NULL),
('diarias_aprovar',                         'match_direto', 'diarias_aprovar',                         'aprovar',    NULL),
('diarias_autorizar',                       'match_direto', 'diarias_autorizar',                       'aprovar',    NULL),
('diarias_dashboard_view',                  'match_direto', 'diarias_dashboard_view',                  'visualizar', NULL),
('diarias_export',                          'match_direto', 'diarias_export',                          'visualizar', NULL),
('diarias_exportar_excel',                  'match_direto', 'diarias_exportar_excel',                  'visualizar', NULL),
('diarias_relatorio_view',                  'match_direto', 'diarias_relatorio_view',                  'visualizar', NULL),
('diarias_solicitacoes_view',               'match_direto', 'diarias_solicitacoes_view',               'visualizar', NULL),
('diarias_solicitar',                       'match_direto', 'diarias_solicitar',                       'criar',      NULL),
('diarias_solicitar_cancel_own',            'match_direto', 'diarias_solicitar_cancel_own',            'excluir',    NULL),
('diarias_solicitar_create',                'match_direto', 'diarias_solicitar_create',                'criar',      NULL),
('diarias_solicitar_edit_own',              'match_direto', 'diarias_solicitar_edit_own',              'editar',     NULL),
('diarias_solicitar_resend_own',            'match_direto', 'diarias_solicitar_resend_own',            'editar',     NULL),
('diarias_view',                            'match_direto', 'diarias_view',                            'visualizar', NULL),
('gestao_maquinas_caminhoes_view',          'match_direto', 'gestao_maquinas_caminhoes_view',          'visualizar', NULL),
('gestao_maquinas_relatorio_medicao_view',  'match_direto', 'gestao_maquinas_relatorio_medicao_view',  'visualizar', NULL),
('gestao_maquinas_usinas_view',             'match_direto', 'gestao_maquinas_usinas_view',             'visualizar', NULL),
('gestao_rh_centros_custo_view',            'match_direto', 'gestao_rh_centros_custo_view',            'visualizar', NULL),
('gestao_rh_departamentos_view',            'match_direto', 'gestao_rh_departamentos_view',            'visualizar', NULL),
('gestao_rh_empresas_view',                 'match_direto', 'gestao_rh_empresas_view',                 'visualizar', NULL),
('gestao_rh_equipes_view',                  'match_direto', 'gestao_rh_equipes_view',                  'visualizar', NULL),
('gestao_rh_funcionarios_view',             'match_direto', 'gestao_rh_funcionarios_view',             'visualizar', NULL),
('gestao_rh_funcoes_view',                  'match_direto', 'gestao_rh_funcoes_view',                  'visualizar', NULL),
('relatorio_aplicacao_view',                'match_direto', 'relatorio_aplicacao_view',                'visualizar', NULL),
('relatorio_licitacoes_view',               'match_direto', 'relatorio_licitacoes_view',               'visualizar', NULL),
('requisicoes_apontamento_caminhoes_view',  'match_direto', 'requisicoes_apontamento_caminhoes_view',  'visualizar', NULL),
('requisicoes_apontamento_equipe_view',     'match_direto', 'requisicoes_apontamento_equipe_view',     'visualizar', NULL),
('requisicoes_cadastro_view',               'match_direto', 'requisicoes_cadastro_view',               'visualizar', NULL),
('requisicoes_chamados_os_view',            'match_direto', 'requisicoes_chamados_os_view',            'visualizar', NULL),
('requisicoes_gestao_os_view',              'match_direto', 'requisicoes_gestao_os_view',              'visualizar', NULL),
('requisicoes_programacao_entrega_view',    'match_direto', 'requisicoes_programacao_entrega_view',    'visualizar', NULL),
('requisicoes_registro_aplicacao_view',     'match_direto', 'requisicoes_registro_aplicacao_view',     'visualizar', NULL),
('requisicoes_registro_cargas_view',        'match_direto', 'requisicoes_registro_cargas_view',        'visualizar', NULL),
-- 8 substituir
('abastecimento_view',           'substituir', 'gestao_abastecimento_view',          'visualizar', 'Renomeada para padrão gestao_*'),
('aplicacoes_view',              'substituir', 'relatorio_aplicacao_view',           'visualizar', 'Substituída pelo relatório de aplicação'),
('entregas_view',                'substituir', 'requisicoes_programacao_entrega_view','visualizar', 'Convergiu para programação de entrega'),
('funcionarios_visualizar',      'substituir', 'gestao_rh_funcionarios_view',        'visualizar', 'Renomeada para padrão gestao_rh_*'),
('funcionarios_criar',           'substituir', 'gestao_rh_funcionarios_view',        'criar',      'Action criar do mesmo recurso'),
('funcionarios_editar',          'substituir', 'gestao_rh_funcionarios_view',        'editar',     'Action editar do mesmo recurso'),
('funcionarios_excluir',         'substituir', 'gestao_rh_funcionarios_view',        'excluir',    'Action excluir do mesmo recurso'),
('diarias_relatorio_aprovar',    'substituir', 'diarias_relatorio_view',             'aprovar',    'Aprovação dentro do relatório'),
-- 17 obsoleta
('aplicacoes_create',           'obsoleta', NULL, NULL, 'CRUD legado de aplicações descontinuado'),
('aplicacoes_edit',             'obsoleta', NULL, NULL, 'CRUD legado de aplicações descontinuado'),
('aplicacoes_delete',           'obsoleta', NULL, NULL, 'CRUD legado de aplicações descontinuado'),
('entregas_create',             'obsoleta', NULL, NULL, 'CRUD legado de entregas descontinuado'),
('entregas_edit',               'obsoleta', NULL, NULL, 'CRUD legado de entregas descontinuado'),
('entregas_delete',             'obsoleta', NULL, NULL, 'CRUD legado de entregas descontinuado'),
('relatorios_financeiros',      'obsoleta', NULL, NULL, 'Relatório financeiro legado removido'),
('relatorios_operacionais',     'obsoleta', NULL, NULL, 'Relatório operacional legado removido'),
('ponto_teste',                 'obsoleta', NULL, NULL, 'Permissão residual de teste do módulo Ponto'),
('diarias_apontar',             'obsoleta', NULL, NULL, 'Substituída pelo fluxo apontamento_view + actions'),
('diarias_apontar_own',         'obsoleta', NULL, NULL, 'Substituída pelo fluxo apontamento_view + actions'),
('diarias_aprovar_convocacao',  'obsoleta', NULL, NULL, 'Convocação fundida em diarias_aprovar'),
('diarias_confirmar_presenca',  'obsoleta', NULL, NULL, 'Fluxo de presença movido para apontamento'),
('diarias_convocar',            'obsoleta', NULL, NULL, 'Convocação fundida em diarias_solicitar'),
('diarias_criar',               'obsoleta', NULL, NULL, 'Substituída por diarias_solicitar_create'),
('diarias_editar',              'obsoleta', NULL, NULL, 'Substituída por diarias_solicitar_edit_own'),
('diarias_visualizar',          'obsoleta', NULL, NULL, 'Substituída por diarias_view');

-- 5) View de drift
CREATE OR REPLACE VIEW public.vw_rbac_legacy_map_drift
WITH (security_invoker = true) AS
WITH legacy AS (
  SELECT DISTINCT btrim(nome_permissao) AS legacy_nome FROM public.bd_permissoes
)
SELECT 'legacy_sem_mapa'::text AS drift_kind,
       l.legacy_nome,
       NULL::text AS status,
       NULL::text AS new_codigo,
       NULL::text AS action_padrao,
       'Permissão legada existe em bd_permissoes mas não está no mapa'::text AS detalhe
  FROM legacy l
  LEFT JOIN public.bd_rbac_legacy_map m ON m.legacy_nome = l.legacy_nome
 WHERE m.legacy_nome IS NULL
UNION ALL
SELECT 'mapa_sem_legacy', m.legacy_nome, m.status, m.new_codigo, m.action_padrao,
       'Linha do mapa não tem mais correspondente em bd_permissoes'
  FROM public.bd_rbac_legacy_map m
  LEFT JOIN legacy l ON l.legacy_nome = m.legacy_nome
 WHERE l.legacy_nome IS NULL
UNION ALL
SELECT 'new_codigo_inexistente', m.legacy_nome, m.status, m.new_codigo, m.action_padrao,
       'new_codigo não existe em bd_permissions.codigo'
  FROM public.bd_rbac_legacy_map m
  LEFT JOIN public.bd_permissions p ON p.codigo = m.new_codigo
 WHERE m.new_codigo IS NOT NULL AND p.codigo IS NULL
UNION ALL
SELECT 'status_invalido', m.legacy_nome, m.status, m.new_codigo, m.action_padrao,
       'status fora do conjunto permitido'
  FROM public.bd_rbac_legacy_map m
 WHERE m.status NOT IN ('match_direto','substituir','obsoleta')
UNION ALL
SELECT 'action_invalida', m.legacy_nome, m.status, m.new_codigo, m.action_padrao,
       'action_padrao fora do conjunto permitido'
  FROM public.bd_rbac_legacy_map m
 WHERE m.action_padrao IS NOT NULL
   AND m.action_padrao NOT IN ('visualizar','criar','editar','excluir','aprovar')
UNION ALL
SELECT 'ativa_incompleta', m.legacy_nome, m.status, m.new_codigo, m.action_padrao,
       'Status ativo (match_direto/substituir) requer new_codigo e action_padrao'
  FROM public.bd_rbac_legacy_map m
 WHERE m.status <> 'obsoleta'
   AND (m.new_codigo IS NULL OR m.action_padrao IS NULL)
UNION ALL
SELECT 'obsoleta_com_dados', m.legacy_nome, m.status, m.new_codigo, m.action_padrao,
       'Status obsoleta deve ter new_codigo e action_padrao nulos'
  FROM public.bd_rbac_legacy_map m
 WHERE m.status = 'obsoleta'
   AND (m.new_codigo IS NOT NULL OR m.action_padrao IS NOT NULL);

GRANT SELECT ON public.vw_rbac_legacy_map_drift TO authenticated;
