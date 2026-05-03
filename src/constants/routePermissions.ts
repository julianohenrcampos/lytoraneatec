/**
 * Fonte única de verdade para mapeamento de rotas → permissões.
 * Consumido por src/hooks/usePermission.ts e src/hooks/useRouteAccess.ts.
 *
 * Regras:
 * - SuperAdm sempre passa.
 * - permissions.includes('*') sempre passa (modo degradado).
 * - Rota não mapeada => permitida (mantém comportamento legado).
 * - Rota mapeada => exige ao menos UMA das permissões listadas.
 */
export const ROUTE_PERMISSIONS = {
  '/': ['dashboard_view'],
  '/dashboard-rh': ['dashboard_rh_view'],
  '/dashboard-maquinas': ['dashboard_maquinas_view'],
  '/dashboard-cbuq': ['dashboard_cbuq_view'],

  // Gestão de RH
  '/gestao-rh/empresas': ['gestao_rh_empresas_view'],
  '/gestao-rh/diretorias': ['gestao_rh_diretorias_view'],
  '/gestao-rh/departamentos': ['gestao_rh_departamentos_view'],
  '/gestao-rh/centros-custo': ['gestao_rh_centros_custo_view'],
  '/gestao-rh/funcoes': ['gestao_rh_funcoes_view'],
  '/gestao-rh/funcionarios': ['gestao_rh_funcionarios_view'],
  '/gestao-rh/equipes': ['gestao_rh_equipes_view'],
  '/gestao-rh/desligamentos': ['gestao_rh_funcionarios_view'],
  '/gestao-rh/arquivo-morto': ['gestao_rh_arquivo_morto_view'],

  // Veículos / Equipamentos
  '/gestao-maquinas/caminhoes': ['gestao_maquinas_caminhoes_view'],
  '/gestao-maquinas/caminhoes-equipamentos': ['gestao_maquinas_caminhoes_view'],
  '/gestao-maquinas/usinas': ['gestao_maquinas_usinas_view'],
  '/gestao-maquinas/relatorio-medicao': ['gestao_maquinas_relatorio_medicao_view'],
  '/gestao-maquinas/dashboard': ['dashboard_maquinas_view'],

  // Requisições / Logística
  '/registro-aplicacao': ['requisicoes_registro_aplicacao_view'],
  '/programacao-entrega': ['requisicoes_programacao_entrega_view'],
  '/requisicoes/cadastro': ['requisicoes_cadastro_view'],
  '/requisicoes/programacao-entrega': ['requisicoes_programacao_entrega_view'],
  '/requisicoes/registro-cargas': ['requisicoes_registro_cargas_view'],
  '/requisicoes/registro-aplicacao': ['requisicoes_registro_aplicacao_view'],
  '/requisicoes/apontamento-equipe': ['requisicoes_apontamento_equipe_view'],
  '/requisicoes/apontamento-caminhoes': ['requisicoes_apontamento_caminhoes_view'],
  '/requisicoes/chamados-os': ['requisicoes_chamados_os_view'],
  '/requisicoes/gestao-os': ['requisicoes_gestao_os_view'],
  '/relatorio-aplicacao-diaria': ['relatorio_aplicacao_view'],

  // Diárias
  '/requisicoes/diarias': ['diarias_view'],
  '/requisicoes/diarias/dashboard': ['diarias_dashboard_view'],
  '/requisicoes/diarias/solicitacoes': ['diarias_solicitacoes_view', 'diarias_view'],
  '/requisicoes/diarias/apontamento-campo': ['diarias_apontamento_view'],
  '/requisicoes/diarias/relatorio': ['diarias_relatorio_view'],
  '/gestao-aprovacoes-diarias': ['acesso_gestao_aprovacoes'],

  // SSO
  '/sso/checklists': ['acesso_sso_checklists'],
  '/sso/checklists/dashboard': ['acesso_sso_dashboard'],
  '/sso/desvios': ['acesso_sso_desvios'],
  '/sso/agendamento-exames': ['acesso_sso_agendamento_exames'],
  '/sso/ver-e-agir': ['acesso_sso_ver_agir'],

  // Licitações
  '/licitacoes/dashboard': ['dashboard_licitacoes_view'],
  '/licitacoes/monitoramento-pncp': ['acesso_monitoramento_pncp'],
  '/licitacoes/configuracoes-pncp': ['configuracoes_pncp_view'],
  '/licitacoes/relatorio': ['relatorio_licitacoes_view'],

  // Administração
  '/admin/permissoes': ['admin_permissoes_view'],
  '/admin/gestao-fluxos': ['admin_gestao_fluxos_view'],

  // Ponto
  '/ponto': ['ponto_registrar'],
} as const satisfies Record<string, readonly string[]>;

export type AppRoute = keyof typeof ROUTE_PERMISSIONS;

const _MAP = ROUTE_PERMISSIONS as Record<string, readonly string[]>;

export function getRoutePermissions(pathname: string): readonly string[] {
  return _MAP[pathname] ?? [];
}

export function hasRoutePermission(
  pathname: string,
  userPermissions: readonly string[],
  isSuperAdmin: boolean,
): boolean {
  if (isSuperAdmin) return true;
  if (userPermissions.includes('*')) return true;
  const required = _MAP[pathname];
  if (!required) return true; // rota não mapeada => permitida
  return required.some((p) => userPermissions.includes(p));
}
