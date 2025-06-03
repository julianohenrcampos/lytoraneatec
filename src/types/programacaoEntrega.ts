
import { RegistroCarga } from "./registroCargas";

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
    centro_custo?: {
      id: string;
      nome_centro_custo: string;
    };
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
  usina_id: string;
  apontador_id: string;
  equipe_id: string;
  caminhao_id: string;
  data_entrega: string;
  logradouro: string;
  quantidade_massa: number;
  tipo_lancamento: string;
  status: string;
  programacao_id?: string;
  massa_remanescente?: number;
  created_at?: string;
  updated_at?: string;
  cancelled?: boolean;
  centro_custo_nome?: string;
  
  // Relations
  caminhao?: {
    id: string;
    placa: string;
    modelo: string;
    marca?: string;
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
  requisicao?: {
    id: string;
    numero: string;
    centro_custo_id: string;
    centro_custo?: {
      id: string;
      nome_centro_custo: string;
    };
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

export interface ItemFormValues {
  id?: string;
  requisicao_id: string;
  centro_custo_nome?: string;
  logradouro?: string;
  quantidade_massa: number;
  caminhao_id: string;
  tipo_lancamento: string;
  equipe_id: string;
  apontador_id: string;
  usina_id: string;
  status?: 'Pendente' | 'Enviada' | 'Cancelada' | 'Entregue';
  data_entrega?: string;
  
  // UI specific fields
  cancelled?: boolean;
  cancelReason?: string;
}
