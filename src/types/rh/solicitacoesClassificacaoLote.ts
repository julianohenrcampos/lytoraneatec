// Tipos para Solicitações de Classificação em Lote (Fase 2B).
// Não persistir salário aqui — limitação documentada.

export type SolicitacaoClassificacaoLoteStatus =
  | 'rascunho'
  | 'emitida'
  | 'cancelada';

export interface SolicitacaoClassificacaoLoteHeader {
  id: string;
  protocolo: string;
  status: SolicitacaoClassificacaoLoteStatus;
  data_solicitacao: string;
  solicitante_id: string;
  solicitante_nome_snapshot: string | null;
  observacoes: string | null;
  motivo_cancelamento: string | null;
  cancelado_por: string | null;
  cancelado_em: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

/** Cabeçalho enriquecido com contagem agregada de itens vinculados. */
export interface SolicitacaoClassificacaoLoteHeaderListado
  extends SolicitacaoClassificacaoLoteHeader {
  total_itens: number;
  /** `rascunho` + total_itens>0 = inconsistência operacional (Fase 2B v3). */
  inconsistente: boolean;
}

export interface SolicitacaoClassificacaoLoteItem {
  id: string;
  solicitacao_lote_id: string | null;
  funcionario_id: string;
  centro_custo_id: string;
  cargo_atual_id: string | null;
  cargo_atual_nome: string | null;
  cargo_novo_id: string;
  cargo_novo_nome: string;
  motivo: string;
  observacao: string | null;
  data_efetivacao_desejada: string | null;
  precisa_exame: boolean;
  status: string;
  solicitado_em: string;
  solicitado_por: string;
}

/** Item editável em memória dentro do dialog (ainda não persistido). */
export interface ItemRascunhoEmMemoria {
  tempId: string;
  funcionario_id: string;
  funcionario_nome: string;
  centro_custo_id: string;
  centro_custo_label: string;
  cargo_atual_id: string | null;
  cargo_atual_nome: string | null;
  cargo_novo_id: string;
  cargo_novo_nome: string;
  motivo: string;
  observacao: string | null;
  data_efetivacao_desejada: string | null;
  precisa_exame: boolean;
}
