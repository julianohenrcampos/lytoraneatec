/**
 * CT-2.2 — Estado efetivo dos ativos (contrato da RPC fn_ct_estado_efetivo_lote).
 *
 * Dimensões independentes, nunca colapsadas em um único status:
 *  - condicaoOperacional  → bd_disponibilidade_equipamentos (registro mais recente);
 *  - compromissoAtual     → atendimento vigente na data de referência do negócio;
 *  - compromissosNaJanela → atendimentos que intersectam a janela consultada;
 *  - proximoCompromisso   → primeiro atendimento futuro;
 *  - estadoExibicao       → decisão derivada usada na UI (fail-closed).
 *
 * A data de referência é calculada no servidor no fuso America/Sao_Paulo.
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
  | "RESERVADO"
  | "EM_TRANSPORTE"
  | "ALOCADO"
  | "COMPROMETIDO"
  | "INDISPONIVEL_PARA_ATENDIMENTO"
  | "CONFLITO_OPERACIONAL";

/** Nesta fase a dimensão logística ainda não é consultada (CT-3C). */
export type CtEstadoLogistico = "SEM_MOVIMENTACAO";

export interface CtCompromisso {
  /** null quando o usuário não tem acesso à solicitação do compromisso. */
  atendimentoId: string | null;
  status: string;
  periodoInicio: string | null;
  periodoFim: string | null;
  solicitacaoId: string | null;
  solicitacaoItemId: string | null;
  /** true ⇒ período e status visíveis, identificadores redigidos no servidor. */
  detalhesRestritos: boolean;
}

/**
 * CT-2.3 — Agenda do ativo projetada no servidor (intervalos já unidos).
 * Datas ISO (yyyy-MM-dd) no fuso America/Sao_Paulo. Apresentação apenas:
 * a autorização continua sendo decidida pelas RPCs de atendimento.
 */
export interface CtAgendaAtivo {
  /** Último dia livre antes do próximo bloco comprometido (livre agora). */
  disponivelAte: string | null;
  blocoComprometidoInicio: string | null;
  blocoComprometidoFim: string | null;
  /** Primeiro dia livre após o bloco comprometido. */
  proximaDisponibilidade: string | null;
  proximaReservaInicio: string | null;
  proximaReservaFim: string | null;
  conflitoOperacional: boolean;
  motivoConflito: "COMPROMISSO_VENCIDO_ATIVO" | "SOBREPOSICAO_DETECTADA" | null;
}

/**
 * CT-2.4 — Vigência do compromisso PRINCIPAL do ativo.
 *  - ATUAL           → compromisso vigente na data de referência;
 *  - FUTURO          → nenhum vigente, mas existe compromisso agendado;
 *  - CONFLITO        → anomalia real (sobreposição ou compromisso vencido ativo);
 *  - SEM_COMPROMISSO → nem atual, nem futuro.
 */
export type CtCompromissoVigencia = "ATUAL" | "FUTURO" | "CONFLITO" | "SEM_COMPROMISSO";

/**
 * CT-2.4 — Situação da mobilização DERIVADA (não persistida).
 * Enquanto a CT-3C não existir, a única derivação possível é
 * AGUARDANDO_MOBILIZACAO para reservas sem integração logística.
 */
export type CtSituacaoMobilizacaoDerivada = "AGUARDANDO_MOBILIZACAO" | null;

export interface CtEstadoEfetivoAtivo {
  equipamentoId: string;
  centroCustoId: string | null;
  condicaoOperacional: string;
  possuiRegistroOperacional: boolean;
  previsaoLiberacao: string | null;
  /** Vigência do status operacional (bd_disponibilidade_equipamentos.data_inicio). */
  dataInicioDisponibilidade: string | null;
  /** Agenda consolidada; null quando o servidor não projetou nada. */
  agenda: CtAgendaAtivo | null;
  compromissoAtivo: CtCompromissoAtivo;

  compromissoAtual: CtCompromisso | null;
  proximoCompromisso: CtCompromisso | null;
  quantidadeCompromissosFuturos: number;
  compromissosNaJanela: CtCompromisso[];
  quantidadeCompromissosNaJanela: number;
  possuiSobreposicaoNaJanela: boolean;
  /** true apenas quando compromissos existentes se sobrepõem ENTRE SI. */
  possuiAnomaliaSobreposicao: boolean;
  /** true quando há compromisso vencido em status ativo (nunca é LIVRE). */
  possuiCompromissoVencidoAtivo: boolean;

  /* ---------- CT-2.4 (ADITIVO — apenas apresentação) ---------- */
  /** true quando existe compromisso vigente OU futuro (a reserva já "existe"). */
  possuiCompromissoAtualOuFuturo: boolean;
  /** Compromisso vigente; na ausência dele, o próximo agendado. */
  compromissoPrincipal: CtCompromisso | null;
  compromissoPrincipalStatus: string | null;
  compromissoPrincipalInicio: string | null;
  compromissoPrincipalFim: string | null;
  compromissoPrincipalVigencia: CtCompromissoVigencia;
  /** true quando o compromisso principal está RESERVADO/EM_TRANSPORTE/ENTREGUE. */
  reservadoPelaCentral: boolean;
  /* ------------------- fim CT-2.4 ---------------------------- */

  /** FASE C — OS de manutenção aberta (decidido pelo servidor). */
  emManutencao: boolean;
  /** Número da OS de manutenção aberta, quando disponível. */
  osManutencao: string | null;

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

/** Fail-closed: enquanto não houver consulta confirmada, nada é operável. */
export type CtEstadoConsultaStatus = "CARREGANDO" | "CONSULTADO" | "ERRO";

export const CT_MSG_COMPROMISSO_RESTRITO =
  "Equipamento reservado no período informado por outro compromisso operacional.";

export const CT_MSG_ESTADO_NAO_CONSULTADO = "Estado de compromisso não consultado";

export const CT_MSG_PERIODO_OBRIGATORIO = "Informe o período completo da reserva";
