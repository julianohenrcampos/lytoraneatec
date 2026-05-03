export const MODULOS = [
  { value: 'dashboard',                    label: 'Dashboards' },
  { value: 'gestao_rh',                    label: 'Gestão de RH' },
  { value: 'gestao_veiculos_equipamentos', label: 'Gestão de Veículos/Equipamentos' },
  { value: 'requisicoes_logistica',        label: 'Requisições e Logística' },
  { value: 'diarias',                      label: 'Diárias' },
  { value: 'sso_seguranca',                label: 'SSO - Segurança' },
  { value: 'licitacoes',                   label: 'Licitações' },
  { value: 'administracao',                label: 'Administração' },
  { value: 'ponto_eletronico',             label: 'Ponto Eletrônico' },
  { value: 'outros',                       label: 'Outros' },
] as const;

export type ModuloValue = typeof MODULOS[number]['value'];
export const MODULO_VALUES = MODULOS.map(m => m.value) as readonly string[];

export const isModuloValido = (v?: string | null): v is ModuloValue =>
  !!v && MODULO_VALUES.includes(v);

export const getModuloLabel = (v?: string | null): string | undefined =>
  MODULOS.find(m => m.value === v)?.label;

export function inferirModuloPorCodigo(codigo: string): ModuloValue | undefined {
  const c = (codigo || '').toLowerCase();
  if (!c) return undefined;
  if (c.startsWith('dashboard_') && !c.startsWith('dashboard_licitacoes')) return 'dashboard';
  if (c.startsWith('gestao_rh_') || c === 'acesso_sso_agendamento_exames') return 'gestao_rh';
  if (
    c.startsWith('gestao_maquinas_') ||
    c === 'requisicoes_chamados_os_view' ||
    c === 'requisicoes_gestao_os_view' ||
    c === 'requisicoes_apontamento_caminhoes_view'
  ) return 'gestao_veiculos_equipamentos';
  if (
    c.startsWith('requisicoes_') &&
    !['requisicoes_chamados_os_view', 'requisicoes_gestao_os_view', 'requisicoes_apontamento_caminhoes_view'].includes(c)
  ) return 'requisicoes_logistica';
  if (c.startsWith('diarias_') || c === 'acesso_gestao_aprovacoes') return 'diarias';
  if ((c.startsWith('acesso_sso_') && c !== 'acesso_sso_agendamento_exames') || c === 'acesso_sso_ver_agir') return 'sso_seguranca';
  if (
    c === 'acesso_monitoramento_pncp' ||
    c.startsWith('configuracoes_pncp') ||
    c.startsWith('dashboard_licitacoes') ||
    c.startsWith('relatorio_licitacoes')
  ) return 'licitacoes';
  if (c.startsWith('admin_')) return 'administracao';
  if (c.startsWith('ponto_') || c.startsWith('ponto_eletronico')) return 'ponto_eletronico';
  return undefined;
}

export function inferirModuloPorRota(rota?: string | null): ModuloValue | undefined {
  if (!rota) return undefined;
  const r = rota.toLowerCase();
  if (r.startsWith('/dashboard') && !r.startsWith('/dashboard-licitacoes')) return 'dashboard';
  if (r.startsWith('/gestao-rh') || r.startsWith('/rh')) return 'gestao_rh';
  if (r.startsWith('/gestao-maquinas') || r.startsWith('/veiculos') || r.startsWith('/equipamentos')) return 'gestao_veiculos_equipamentos';
  if (r.startsWith('/requisicoes') || r.startsWith('/logistica')) return 'requisicoes_logistica';
  if (r.startsWith('/diarias')) return 'diarias';
  if (r.startsWith('/sso')) return 'sso_seguranca';
  if (r.startsWith('/licitacoes') || r.startsWith('/pncp') || r.startsWith('/dashboard-licitacoes')) return 'licitacoes';
  if (r.startsWith('/admin')) return 'administracao';
  if (r.startsWith('/ponto')) return 'ponto_eletronico';
  return undefined;
}
