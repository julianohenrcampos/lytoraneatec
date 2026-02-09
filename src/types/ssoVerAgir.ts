export type VerAgirStatus = 'RASCUNHO' | 'ENVIADO' | 'CONCLUIDO';

export const STATUS_VER_AGIR: VerAgirStatus[] = ['RASCUNHO', 'ENVIADO', 'CONCLUIDO'];

export interface VerAgir {
  id: string;
  created_at: string;
  updated_at?: string;
  criado_por: string;
  obra: string;
  local: string;
  data_registro: string;
  hora_registro: string;
  tecnico_seguranca_id?: string;
  tecnico_seguranca_nome: string;
  engenheiro_id?: string;
  engenheiro_nome: string;
  descricao_nao_conformidade: string;
  resultado_alcancado_solucao: string;
  foto_antes_url?: string;
  foto_depois_url?: string;
  status: VerAgirStatus;
  
  // Relações expandidas
  profiles?: {
    id: string;
    nome_completo?: string;
  };
}

export interface VerAgirFormData {
  obra: string;
  centro_custo_id?: string;
  local?: string;
  data_registro: string;
  hora_registro: string;
  tecnico_seguranca_id?: string;
  tecnico_seguranca_nome: string;
  engenheiro_id?: string;
  engenheiro_nome: string;
  descricao_nao_conformidade: string;
  resultado_alcancado_solucao: string;
}

export interface VerAgirFilters {
  data_inicio?: string;
  data_fim?: string;
  status?: VerAgirStatus | 'all';
  obra?: string;
}

// Helpers para cores de status
export const getStatusColor = (status: VerAgirStatus): string => {
  switch (status) {
    case 'RASCUNHO':
      return 'bg-gray-100 text-gray-800';
    case 'ENVIADO':
      return 'bg-blue-100 text-blue-800';
    case 'CONCLUIDO':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export const getStatusLabel = (status: VerAgirStatus): string => {
  switch (status) {
    case 'RASCUNHO':
      return 'Rascunho';
    case 'ENVIADO':
      return 'Enviado';
    case 'CONCLUIDO':
      return 'Concluído';
    default:
      return status;
  }
};
