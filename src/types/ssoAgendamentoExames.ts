// Tipos para Agendamento de Exames - Módulo SSO

export type TipoExame = 'Admissional' | 'Periódico' | 'Mudança de Risco' | 'Demissional' | 'Retorno ao Trabalho';
export type StatusAgendamento = 'Pendente' | 'Agendado' | 'Realizado' | 'Cancelado';

export const TIPOS_EXAME: TipoExame[] = ['Admissional', 'Periódico', 'Mudança de Risco', 'Demissional', 'Retorno ao Trabalho'];
export const STATUS_AGENDAMENTO: StatusAgendamento[] = ['Pendente', 'Agendado', 'Realizado', 'Cancelado'];

export interface LocalAtendimento {
  id: string;
  nome_local: string;
  endereco: string;
  cidade: string | null;
  telefone: string | null;
  ativo: boolean;
  criado_em: string;
}

export interface AgendamentoExame {
  id: string;
  empresa: string;
  contrato: string | null;
  nome_colaborador: string;
  funcao: string;
  data_nascimento: string | null;
  rg: string | null;
  cpf: string | null;
  tipo_exame: TipoExame;
  data_agendamento: string;
  horario_agendamento: string;
  local_atendimento_id: string;
  observacoes: string | null;
  documentos_anexados: boolean;
  status: StatusAgendamento;
  tecnico_seguranca: string | null;
  criado_em: string;
  criado_por: string;
  // Relações
  bd_locais_atendimento?: LocalAtendimento;
  profiles?: {
    id: string;
    nome_completo: string | null;
    email: string | null;
  };
}

export interface AgendamentoExameFormData {
  empresa: string;
  contrato: string;
  nome_colaborador: string;
  funcao: string;
  data_nascimento: string;
  rg: string;
  cpf: string;
  tipo_exame: TipoExame;
  data_agendamento: string;
  horario_agendamento: string;
  local_atendimento_id: string;
  observacoes: string;
  documentos_anexados: boolean;
  status: StatusAgendamento;
  tecnico_seguranca: string;
}

export interface AgendamentoExameAnexo {
  id: string;
  agendamento_id: string;
  arquivo_nome: string;
  arquivo_path: string;
  tipo: string | null;
  criado_em: string;
  criado_por: string;
  profiles?: {
    id: string;
    nome_completo: string | null;
    email: string | null;
  };
}

export interface AgendamentoExameFilters {
  data?: string;
  status?: string;
  tipo_exame?: string;
  local_atendimento_id?: string;
  empresa?: string;
  nome_colaborador?: string;
  cpf?: string;
}

// Helper functions para badges de status
export const getStatusColor = (status: StatusAgendamento): "default" | "secondary" | "success" | "destructive" | "info" => {
  switch (status) {
    case 'Pendente':
      return 'secondary';
    case 'Agendado':
      return 'info';
    case 'Realizado':
      return 'success';
    case 'Cancelado':
      return 'destructive';
    default:
      return 'default';
  }
};

export const getTipoExameColor = (tipo: TipoExame): "default" | "secondary" | "success" | "warning" | "info" => {
  switch (tipo) {
    case 'Admissional':
      return 'success';
    case 'Periódico':
      return 'info';
    case 'Mudança de Risco':
      return 'warning';
    case 'Demissional':
      return 'secondary';
    case 'Retorno ao Trabalho':
      return 'info';
    default:
      return 'default';
  }
};
