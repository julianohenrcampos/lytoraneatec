/**
 * CT-2.2 — Estado efetivo dos ativos (contrato da RPC fn_ct_estado_efetivo_lote).
 *
 * Três dimensões independentes, nunca colapsadas em um único status:
 *  - condicaoOperacional  → bd_disponibilidade_equipamentos (registro mais recente);
 *  - compromissoAtivo     → bd_solicitacao_item_atendimentos (reserva/transporte/entrega);
 *  - estadoExibicao       → decisão derivada usada na UI (fail-closed).
 */

export const CT_ESTADO_EFETIVO_MAX_IDS = 500;

export type CtCompromissoAtivo =
  | "LIVRE"
  | "RESERVADO"
  | "EM_TRANSPORTE"
  | "ENTREGUE"
  | "CONFLITO_MULTIPLO";

export type CtEstadoExibicao =
  | "DISPONIVEL"
  | "COMPROMETIDO"
  | "INDISPONIVEL_PARA_ATENDIMENTO"
  | "CONFLITO_OPERACIONAL";

/** Nesta fase a dimensão logística ainda não é consultada (CT-3C). */
export type CtEstadoLogistico = "SEM_MOVIMENTACAO";

export interface CtCompromisso {
  atendimentoId: string;
  status: string;
  periodoInicio: string | null;
  periodoFim: string | null;
  solicitacaoId: string | null;
  solicitacaoItemId: string | null;
}

export interface CtEstadoEfetivoAtivo {
  equipamentoId: string;
  centroCustoId: string | null;
  condicaoOperacional: string;
  possuiRegistroOperacional: boolean;
  previsaoLiberacao: string | null;
  compromissoAtivo: CtCompromissoAtivo;
  compromissoAtual: CtCompromisso | null;
  proximoCompromisso: CtCompromisso | null;
  quantidadeCompromissosFuturos: number;
  compromissosNaJanela: CtCompromisso[];
  quantidadeCompromissosNaJanela: number;
  /** true apenas quando compromissos existentes se sobrepõem ENTRE SI. */
  possuiAnomaliaSobreposicao: boolean;
  periodoComprometido: { inicio: string | null; fim: string | null } | null;
  atendimentoId: string | null;
  solicitacaoId: string | null;
  solicitacaoItemId: string | null;
  estadoLogistico: CtEstadoLogistico;
  estadoExibicao: CtEstadoExibicao;
  alertas: string[];
  bloqueios: string[];
  origemDecisao: string;
}

export type CtEstadoEfetivoMap = ReadonlyMap<string, CtEstadoEfetivoAtivo>;

export interface CtEstadoEfetivoParams {
  equipamentoIds: string[];
  centroCustoIds?: string[] | null;
  periodoInicio?: string | null;
  periodoFim?: string | null;
}
