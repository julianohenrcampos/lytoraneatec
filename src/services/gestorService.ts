import { supabase } from '@/integrations/supabase/client';

export interface CreateGestorData {
  email: string;
  password: string;
  nomeCompleto: string;
  tipoAcesso: 'total' | 'personalizado';
  permissoes?: string[];
}

export interface CreateGestorResult {
  success: boolean;
  message: string;
  data?: {
    id: string;
    email: string;
    nome_completo: string;
    tipo_acesso: string;
    funcoes: string[];
  };
}

export const createGestor = async (data: CreateGestorData): Promise<CreateGestorResult> => {
  console.log('🚀 Chamando edge function create-gestor...');
  
  const { data: result, error } = await supabase.functions.invoke('create-gestor', {
    body: {
      email: data.email.toLowerCase().trim(),
      password: data.password,
      nome_completo: data.nomeCompleto.trim(),
      tipo_acesso: data.tipoAcesso,
      permissoes: data.permissoes || []
    }
  });

  if (error) {
    console.error('❌ Erro ao chamar edge function:', error);
    throw new Error(error.message || 'Erro ao cadastrar gestor');
  }

  if (result?.error) {
    console.error('❌ Erro retornado pela edge function:', result.error);
    throw new Error(result.error);
  }

  console.log('✅ Gestor criado com sucesso:', result);
  return result as CreateGestorResult;
};

// Lista de todas as permissões disponíveis no sistema, organizadas por categoria
export const PERMISSION_CATEGORIES = [
  {
    category: 'Dashboard',
    icon: '📊',
    permissions: [
      { key: 'dashboard_view', label: 'Dashboard Principal' },
      { key: 'dashboard_rh_view', label: 'Dashboard RH' },
      { key: 'dashboard_maquinas_view', label: 'Dashboard Máquinas' },
      { key: 'dashboard_cbuq_view', label: 'Dashboard CBUQ' },
    ]
  },
  {
    category: 'Gestão de RH',
    icon: '👥',
    permissions: [
      { key: 'gestao_rh_empresas_view', label: 'Empresas' },
      { key: 'gestao_rh_departamentos_view', label: 'Departamentos' },
      { key: 'gestao_rh_centros_custo_view', label: 'Centros de Custo' },
      { key: 'gestao_rh_funcoes_view', label: 'Funções' },
      { key: 'gestao_rh_funcionarios_view', label: 'Funcionários' },
      { key: 'gestao_rh_equipes_view', label: 'Equipes' },
    ]
  },
  {
    category: 'Gestão de Máquinas',
    icon: '🚛',
    permissions: [
      { key: 'gestao_maquinas_caminhoes_view', label: 'Caminhões e Equipamentos' },
      { key: 'gestao_maquinas_usinas_view', label: 'Usinas' },
      { key: 'gestao_maquinas_relatorio_medicao_view', label: 'Relatório de Medição' },
    ]
  },
  {
    category: 'Requisições',
    icon: '📋',
    permissions: [
      { key: 'requisicoes_cadastro_view', label: 'Cadastro de Requisições' },
      { key: 'requisicoes_programacao_entrega_view', label: 'Programação de Entrega' },
      { key: 'requisicoes_registro_cargas_view', label: 'Registro de Cargas' },
      { key: 'requisicoes_registro_aplicacao_view', label: 'Registro de Aplicação' },
      { key: 'requisicoes_apontamento_equipe_view', label: 'Apontamento de Equipe' },
      { key: 'requisicoes_apontamento_caminhoes_view', label: 'Apontamento de Caminhões' },
      { key: 'requisicoes_chamados_os_view', label: 'Chamados OS' },
      { key: 'requisicoes_gestao_os_view', label: 'Gestão de OS' },
    ]
  },
  {
    category: 'Licitações PNCP',
    icon: '⚖️',
    permissions: [
      { key: 'dashboard_licitacoes_view', label: 'Dashboard de Licitações' },
      { key: 'acesso_monitoramento_pncp', label: 'Monitoramento PNCP' },
      { key: 'configuracoes_pncp_view', label: 'Configurações PNCP' },
    ]
  },
  {
    category: 'Relatórios',
    icon: '📈',
    permissions: [
      { key: 'relatorio_aplicacao_view', label: 'Relatório de Aplicação' },
    ]
  },
  {
    category: 'Administração',
    icon: '⚙️',
    permissions: [
      { key: 'admin_permissoes_view', label: 'Gestão de Permissões' },
    ]
  },
];

// Retorna todas as permissões como array flat
export const getAllPermissions = (): string[] => {
  return PERMISSION_CATEGORIES.flatMap(cat => cat.permissions.map(p => p.key));
};
