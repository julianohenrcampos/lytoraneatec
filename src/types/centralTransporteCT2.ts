/**
 * CT-2 / M4 — Contratos TypeScript do atendimento por item da Central do Transporte.
 *
 * Espelham 1:1 o retorno vivo das RPCs:
 *   fn_ct_atendimento_json      → CtAtendimento (20 campos, sem request_id)
 *   fn_ct_contadores_item       → CtContadores (exatamente 8 chaves)
 *   fn_ct_item_resumo_json      → CtItemResumo
 *   fn_ct_atendimento_listar    → CtAtendimentoListarResult
 *
 * Nenhum contador é calculado no frontend.
 */

export const CT_TEXTO_MIN = 20;

export type CtModalidade = "INTERNO" | "RESERVA_FUTURA";

export type CtAtendimentoStatus =
  | "RESERVADO"
  | "EM_TRANSPORTE"
  | "ENTREGUE"
  | "CANCELADO"
  | "LIBERADO";

/** Status de encerramento aceitos por fn_ct_atendimento_encerrar. */
export type CtEncerramentoStatus = Extract<CtAtendimentoStatus, "CANCELADO" | "LIBERADO">;

export type CtMatchTipo = "EXATO" | "PARCIAL";

export type CtStatusItem =
  | "PENDENTE"
  | "EM_ANALISE"
  | "PLANEJADO"
  | "EM_COTACAO"
  | "ATENDIDO";

export const CT_MODALIDADE_LABELS: Record<CtModalidade, string> = {
  INTERNO: "Atendimento interno",
  RESERVA_FUTURA: "Reserva futura",
};

export const CT_ATENDIMENTO_STATUS_LABELS: Record<CtAtendimentoStatus, string> = {
  RESERVADO: "Reservado",
  EM_TRANSPORTE: "Em transporte",
  ENTREGUE: "Entregue",
  CANCELADO: "Cancelado",
  LIBERADO: "Liberado",
};

/** Retorno de fn_ct_atendimento_json — 20 campos, sem request_id. */
export interface CtAtendimento {
  id: string;
  solicitacao_item_id: string;
  equipamento_id: string;
  equipamento_frota: string | null;
  equipamento_numero: string | null;
  equipamento_placa: string | null;
  modalidade: CtModalidade;
  status: CtAtendimentoStatus;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  janela_aprovada_inicio: string | null;
  janela_aprovada_fim: string | null;
  override_periodo: boolean | null;
  override_disponibilidade: boolean | null;
  match_tipo: CtMatchTipo | null;
  justificativa_override: string | null;
  contexto_decisao: Record<string, unknown> | null;
  encerrado_em: string | null;
  motivo_encerramento: string | null;
  created_at: string | null;
}

/** Retorno de fn_ct_contadores_item — exatamente estas 8 chaves. */
export interface CtContadores {
  reservado: number;
  em_transporte: number;
  entregue: number;
  cancelado: number;
  liberado: number;
  comprometidos: number;
  historico: number;
  pendentes: number;
}

export interface CtItemResumo {
  solicitacao_item_id: string;
  quantidade: number;
  status_item: CtStatusItem | string;
  contadores: CtContadores;
}

export interface CtItemComAtendimentos extends CtItemResumo {
  atendimentos: CtAtendimento[];
}

export interface CtAtendimentoListarResult {
  ok: true;
  solicitacao_id: string;
  itens: CtItemComAtendimentos[];
}

export interface CtAtribuirResult {
  ok: true;
  replay: boolean;
  atendimento: CtAtendimento;
  item: CtItemResumo;
}

export type CtEncerrarResult = CtAtribuirResult;

export interface CtSubstituirResult {
  ok: true;
  replay: boolean;
  atendimento_encerrado: CtAtendimento;
  atendimento_novo: CtAtendimento;
  item: CtItemResumo;
}

/* ------------------------------------------------------------------ */
/* Motor de idempotência                                               */
/* ------------------------------------------------------------------ */

export type CtOperationKind =
  | "ATRIBUIR"
  | "ENCERRAR"
  | "SUBSTITUIR"
  /* CT-3E / CT-3F — operação da viagem */
  | "CHECKLIST_SAIDA"
  | "VIAGEM_INICIAR"
  | "VIAGEM_CHEGADA"
  | "RECEBIMENTO_FINALIZAR"
  /* CT-4 — movimentação direta (viagem sem solicitação) */
  | "MOV_DIRETA_RASCUNHO"
  | "MOV_DIRETA_PROGRAMAR"
  | "MOV_DIRETA_CANCELAR"
  /* CT-5 — puxadas (transporte de material com N caminhões) */
  | "PUXADA_RASCUNHO"
  | "PUXADA_PROGRAMAR"
  | "PUXADA_CANCELAR";


export type CtAttemptState = "READY" | "PENDING" | "UNCERTAIN";

export interface CtPendingAttempt {
  operation: CtOperationKind;
  requestId: string;
  materialKey: string;
  state: CtAttemptState;
  createdAt: number;
  /** Recursos travados pela tentativa (item, atendimento, equipamento). */
  resourceIds: string[];
  /**
   * CT-3D.5 — escopo da tentativa (ex.: `CT3_MOBILIZACAO|<solicitacao>|<planejamento>`).
   * Bloqueios só se aplicam DENTRO do mesmo escopo: uma tentativa de seleção de
   * ativo nunca pode travar a Mobilização, e vice-versa.
   */
  scope: string | null;
}


/* ------------------------------------------------------------------ */
/* Seleção de candidato (adapter sobre a análise CT-1)                 */
/* ------------------------------------------------------------------ */

export type CtCandidateOrigem = "PROPRIA" | "GRUPO" | "PREVISAO";

export interface CtCandidateSelection {
  equipamentoId: string;
  origem: CtCandidateOrigem;
  matchTipo: CtMatchTipo;
  disponibilidadeStatus: string;
  previsaoLiberacao: string | null;
  /** CT-3B.1 — vigência do status operacional (data_inicio); nunca confundida com previsão. */
  dataInicioDisponibilidade: string | null;
  permiteInterno: boolean;
  permiteReservaFutura: boolean;
  /** G0: true quando o ativo não possui linha operacional e exige regularização. */
  precisaRegularizarDisponibilidade: boolean;
  /** Dados mínimos para exibição no modal de confirmação. */
  frota: string | null;
  numeroFrota: string | null;
  placa: string | null;
  centroCustoLabel: string | null;

  /* --- D1 / F2 — contexto reconciliado exibido na confirmação --- */
  /** false quando o ativo não possui linha em bd_disponibilidade_equipamentos. */
  possuiRegistroDisponibilidade: boolean;
  /** false quando não há Centro de Custo atual confirmado. */
  possuiCentroCustoAtual: boolean;
  /** true quando o ativo já está no Centro de Custo de destino. */
  jaNoCentroCustoDestino: boolean;
  /** Situação cadastral crua do ativo. */
  situacaoCadastral: string | null;
  /** Divergência entre situação cadastral e disponibilidade operacional. */
  conflitoCadastral: boolean;
  conflitoCadastralMotivo: string | null;
  /** Motivo pelo qual o ativo não pode ser atendido agora (se houver). */
  bloqueioMotivo: string | null;
  /** Motivo do rebaixamento para match PARCIAL (se houver). */
  matchMotivo: string | null;

  /* --- CT-2.2 — compromisso real do ativo (fn_ct_estado_efetivo_lote) --- */
  /** LIVRE | RESERVADO | EM_TRANSPORTE | ENTREGUE | CONFLITO_MULTIPLO; null quando não consultado. */
  compromissoAtivo: string | null;
  /** Estado de exibição derivado no servidor. */
  estadoExibicao: string | null;
  /** true quando o compromisso/condição impede iniciar atendimento. */
  compromissoBloqueia: boolean;
  compromissoLabel: string | null;
  compromissoDetalhe: string | null;
  /** true apenas quando compromissos existentes se sobrepõem entre si. */
  possuiAnomaliaSobreposicao: boolean;
  /** true quando existe compromisso vencido ainda ativo (bloqueia tudo). */
  possuiCompromissoVencidoAtivo: boolean;
  /** false quando o estado efetivo não pôde ser consultado (fail-closed). */
  estadoConsultado: boolean;

  /* --- CT-2.4 (ADITIVO) — apresentação; não participa da elegibilidade --- */
  /** Rótulo de "Situação na Central" (contempla reserva vigente E futura). */
  situacaoCentralLabel: string;
  /** Ex.: "Inicia em 05/08/2026". */
  situacaoCentralComplemento: string | null;
  /** ATUAL | FUTURO | CONFLITO | SEM_COMPROMISSO; null quando não consultado. */
  compromissoPrincipalVigencia: string | null;
  /** true quando o compromisso principal foi criado pela Central. */
  reservadoPelaCentral: boolean;
  possuiCompromissoAtualOuFuturo: boolean;
  /** Derivada (não persistida): AGUARDANDO_MOBILIZACAO ou null. */
  situacaoMobilizacao: "AGUARDANDO_MOBILIZACAO" | null;
}

