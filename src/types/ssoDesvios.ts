// Tipos para o módulo SSO - Registro de Desvios

export type StatusAcao = 'Aberto' | 'Em Tratativa' | 'Corrigido' | 'Encerrado' | 'Reincidente';
export type ClassificacaoDesvio = 'Leve' | 'Moderado' | 'Grave' | 'Crítico';

export type TipoDesvio = 
  | 'Falta de uso de EPI'
  | 'Uso incorreto de EPI'
  | 'Ação que oferece risco a terceiros'
  | 'Ação que oferece risco à própria integridade física'
  | 'Falta de EPC e sinalização de segurança'
  | 'Outros';

export const TIPOS_DESVIO: TipoDesvio[] = [
  'Falta de uso de EPI',
  'Uso incorreto de EPI',
  'Ação que oferece risco a terceiros',
  'Ação que oferece risco à própria integridade física',
  'Falta de EPC e sinalização de segurança',
  'Outros'
];

export const STATUS_ACAO: StatusAcao[] = [
  'Aberto',
  'Em Tratativa',
  'Corrigido',
  'Encerrado',
  'Reincidente'
];

export const CLASSIFICACAO_DESVIO: ClassificacaoDesvio[] = [
  'Leve',
  'Moderado',
  'Grave',
  'Crítico'
];

export interface SSODesvioFoto {
  id?: string;
  path: string;
  url?: string;
  legenda?: string;
  created_at: string;
}

export interface SSODesvio {
  id: string;
  obra_id: string;
  gerente_regional: string;
  engenheiro_obra: string;
  data_registro: string;
  numero_relatorio: string;
  tecnico_seguranca: string;
  encarregado_mestre?: string;
  tipos_desvio: string[];
  tipo_outros?: string;
  analise_tecnica: string;
  adequacao_imediata?: string;
  responsavel_acao?: string;
  prazo_correcao?: string;
  status_acao: StatusAcao;
  reincidencia: boolean;
  classificacao_desvio: ClassificacaoDesvio;
  criado_por: string;
  criado_em: string;
  atualizado_em: string;
  
  // Relações expandidas
  bd_centros_custo?: {
    id: string;
    nome_centro_custo: string;
    codigo_centro_custo: string;
  };
  profiles?: {
    id: string;
    nome_completo?: string;
    email?: string;
  };
  bd_registro_desvios_fotos?: SSODesvioFoto[];
}

export interface SSODesvioFormData {
  obra_id: string;
  gerente_regional: string;
  engenheiro_obra: string;
  data_registro: string;
  tecnico_seguranca: string;
  encarregado_mestre?: string;
  tipos_desvio: string[];
  tipo_outros?: string;
  analise_tecnica: string;
  adequacao_imediata?: string;
  responsavel_acao?: string;
  prazo_correcao?: string;
  status_acao: StatusAcao;
  reincidencia: boolean;
  classificacao_desvio: ClassificacaoDesvio;
}

export interface SSODesvioFilters {
  obra_id?: string;
  data_registro?: string;
  data_inicio?: string;
  data_fim?: string;
  tipo_desvio?: string;
  tecnico_seguranca?: string;
  classificacao_desvio?: ClassificacaoDesvio;
  status_acao?: StatusAcao;
}

// Helpers para cores de badges
export const getClassificacaoColor = (classificacao: ClassificacaoDesvio): string => {
  switch (classificacao) {
    case 'Leve':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'Moderado':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'Grave':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    case 'Crítico':
      return 'bg-red-900 text-white dark:bg-red-950 dark:text-red-100';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export const getStatusColor = (status: StatusAcao): string => {
  switch (status) {
    case 'Aberto':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    case 'Em Tratativa':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'Corrigido':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'Encerrado':
      return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
    case 'Reincidente':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};
