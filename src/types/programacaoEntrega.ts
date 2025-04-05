
export interface ProgramacaoEntrega {
  id: string;
  requisicao_id: string;
  centro_custo_id: string;
  data_entrega: string;
  created_at?: string;
  updated_at?: string;
  
  // Relations
  requisicao?: {
    id: string;
    numero: string;
  };
  centro_custo?: {
    id: string;
    nome_centro_custo: string;
  };
}

export interface ListaProgramacaoEntrega {
  id: string;
  programacao_entrega_id: string;
  requisicao_id: string;
  logradouro: string;
  quantidade_massa: number;
  caminhao_id: string;
  tipo_lancamento: string;
  equipe_id: string;
  apontador_id: string;
  usina_id: string;
  status: 'Pendente' | 'Enviada' | 'Cancelada' | 'Entregue'; // Updated to include 'Entregue'
  cancelled?: boolean; // UI-only property for tracking cancellation state
  data_entrega: string; // Added field for individual delivery date
  created_at?: string;
  updated_at?: string;
  
  // Relations
  caminhao?: {
    id: string;
    placa: string;
    modelo: string;
  };
  equipe?: {
    id: string;
    nome_equipe: string;
  };
  apontador?: {
    id: string;
    nome_completo: string;
  };
  usina?: {
    id: string;
    nome_usina: string;
  };
  centro_custo?: {
    id: string;
    nome_centro_custo: string;
  };
}

export interface ProgramacaoEntregaWithItems extends ProgramacaoEntrega {
  itens: ListaProgramacaoEntrega[];
}

export interface ProgramacaoEntregaFilters {
  numero_requisicao?: string;
  centro_custo_id?: string;
  data_inicio?: Date;
  data_fim?: Date;
}

// Create a required interface for form submission
export interface ItemFormValues {
  id?: string;
  requisicao_id: string;
  logradouro: string;
  quantidade_massa: number;
  caminhao_id: string;
  tipo_lancamento: string;
  equipe_id: string;
  apontador_id: string;
  usina_id: string;
  status?: 'Pendente' | 'Enviada' | 'Cancelada' | 'Entregue'; // Updated to include 'Entregue'
  cancelled?: boolean; // UI-only property for tracking cancellation state
  data_entrega: string; // Added field for individual delivery date
}
