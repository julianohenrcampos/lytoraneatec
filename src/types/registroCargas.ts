
import { ListaProgramacaoEntrega, ProgramacaoEntrega } from "./programacaoEntrega";

export interface RegistroCarga {
  id: string;
  lista_entrega_id: string;
  programacao_id: string;
  data_saida: string;
  hora_saida: string;
  temperatura_saida?: number;
  tonelada_saida: number;
  imagem_ticket_saida: string;
  tonelada_retorno?: number;
  imagem_ticket_retorno?: string;
  tonelada_real: number;
  status_registro: 'Ativo' | 'Cancelado' | 'Concluído';
  
  // Relations
  lista_entrega?: ListaProgramacaoEntrega;
  programacao?: ProgramacaoEntrega;
}

export interface RegistroCargaFormValues {
  lista_entrega_id: string;
  programacao_id: string;
  data_saida: string;
  hora_saida: string;
  temperatura_saida?: number | null;
  tonelada_saida: number;
  imagem_ticket_saida: string | File | null;
  tonelada_retorno?: number | null;
  imagem_ticket_retorno?: string | File | null;
  status_registro?: 'Ativo' | 'Cancelado' | 'Concluído';
}

export interface RegistroCargaFilters {
  logradouro?: string;
  caminhao_id?: string;
  data_inicio?: Date;
}
