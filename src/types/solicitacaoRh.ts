// Tipos para Solicitações persistidas de Desligamento e Transferência.
// Não substituem bd_desligamentos; representam apenas o documento/pedido.

export type StatusSolicitacaoRh = 'rascunho' | 'emitida' | 'cancelada';

export interface SolicitacaoDesligamentoHeader {
  id: string;
  protocolo: string;
  data_solicitacao: string;
  solicitante_id: string | null;
  solicitante_nome_snapshot: string | null;
  status: StatusSolicitacaoRh;
  total_funcionarios: number;
  total_rescisao: number;
  gerente_area_nome_snapshot: string | null;
  diretor_area_nome_snapshot: string | null;
  diretoria_financeira_nome_snapshot: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SolicitacaoDesligamentoItem {
  id: string;
  solicitacao_id: string;
  funcionario_id: string | null;
  nome_snapshot: string;
  matricula_snapshot: string | null;
  cpf_snapshot: string | null;
  cargo_snapshot: string | null;
  centro_custo_id: string | null;
  centro_custo_snapshot: string | null;
  data_admissao_snapshot: string | null;
  salario_manual: number | null;
  valor_rescisao_manual: number | null;
  data_exame: string | null;
  data_desligamento: string | null;
}

export interface SolicitacaoTransferenciaHeader {
  id: string;
  protocolo: string;
  data_solicitacao: string;
  solicitante_id: string | null;
  solicitante_nome_snapshot: string | null;
  status: StatusSolicitacaoRh;
  total_funcionarios: number;
  total_salarios: number;
  gerente_area_nome_snapshot: string | null;
  diretor_area_nome_snapshot: string | null;
  diretoria_financeira_nome_snapshot: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SolicitacaoTransferenciaItem {
  id: string;
  solicitacao_id: string;
  funcionario_id: string | null;
  nome_snapshot: string;
  matricula_snapshot: string | null;
  cpf_snapshot: string | null;
  cargo_snapshot: string | null;
  centro_custo_origem_id: string | null;
  centro_custo_origem_snapshot: string | null;
  centro_custo_destino_id: string | null;
  centro_custo_destino_snapshot: string | null;
  data_admissao_snapshot: string | null;
  data_transferencia: string | null;
  salario_manual: number | null;
}

/** Payload de item no momento de salvar (sem id/solicitacao_id). */
export type DesligamentoItemInput = Omit<SolicitacaoDesligamentoItem, 'id' | 'solicitacao_id'>;
export type TransferenciaItemInput = Omit<SolicitacaoTransferenciaItem, 'id' | 'solicitacao_id'>;
