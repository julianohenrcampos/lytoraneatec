/**
 * CT-3E / CT-3F — Contratos de operação da viagem (checklist de saída, início do
 * transporte, chegada, recebimento e linha do tempo logística).
 *
 * Toda decisão de autorização e de transição é do servidor. Estes tipos apenas
 * descrevem o que as RPCs devolvem e o que a UI envia.
 */
import type { CtOrdemMotorista } from "./centralTransporteMobilizacao";

export type CtChecklistTipo = "TRANSPORTADOR" | "CARGA";
export type CtChecklistStatus = "RASCUNHO" | "CONCLUIDO";

export type CtRecebimentoResultado = "ACEITO" | "ACEITO_COM_RESSALVA" | "RECUSADO";

export type CtNaoConformidadeTipo =
  | "AVARIA"
  | "FALTA_ACESSORIO"
  | "DOCUMENTACAO"
  | "LIMPEZA"
  | "OUTRO";

export interface CtChecklistItemResposta {
  status: "OK" | "NAO_OK" | "NA" | null;
  observacao: string | null;
  fotos: string[];
}

export interface CtChecklistPersistido {
  id: string;
  tipo: CtChecklistTipo;
  movimentacaoId: string | null;
  checklistCodigo: string;
  checklistVersao: number;
  status: CtChecklistStatus;
  /** CT-3E.3 — snapshot do checklist oficial C&E (itens + grupos + resumo). */
  respostas: Record<string, unknown>;
  realizadoEm: string | null;
}

export interface CtRecebimentoItemPersistido {
  movimentacaoId: string;
  equipamentoId: string;
  resultado: CtRecebimentoResultado;
  naoConformidadeTipo: string | null;
  observacao: string | null;
  fotos: string[];
}

export interface CtRecebimentoPersistido {
  id: string;
  status: string;
  recebidoEm: string | null;
  recebedorNome: string | null;
  observacoes: string | null;
  itens: CtRecebimentoItemPersistido[];
}

/** Estado operacional completo da viagem (fonte única para habilitar botões). */
export interface CtViagemOperacaoDetalhe {
  viagem: CtOrdemMotorista;
  /** CT-4 — parada com chegada registrada aguardando conferência. */
  paradaAtualId: string | null;
  souMotorista: boolean;
  checklistsPendentes: number;
  totalCargas: number;
  podeRegistrarChecklist: boolean;
  podeIniciar: boolean;
  podeRegistrarChegada: boolean;
  podeReceber: boolean;
  checklists: CtChecklistPersistido[];
  recebimento: CtRecebimentoPersistido | null;
}

/* ---------------- payloads enviados às RPCs ---------------- */

export interface CtChecklistSaidaPayload {
  tipo: CtChecklistTipo;
  movimentacaoId: string | null;
  checklistCodigo: string;
  checklistVersao: number;
  status: CtChecklistStatus;
  respostas: Record<string, unknown>;
  latitude: number | null;
  longitude: number | null;
  /** Obrigatória apenas na conclusão do checklist do transportador. */
  assinaturaConfirmada: boolean;
}

export interface CtRecebimentoItemPayload {
  movimentacaoId: string;
  resultado: CtRecebimentoResultado;
  naoConformidadeTipo: CtNaoConformidadeTipo | null;
  observacao: string | null;
  fotos: string[];
  /** Snapshot comparativo do recebimento (nova avaliação, não a saída). */
  respostas: Record<string, unknown>;
}

export interface CtRecebimentoPayload {
  /** CT-4 — parada conferida (null em viagens sem paradas). */
  paradaId?: string | null;
  recebedorNome: string;
  recebedorDocumento: string | null;
  observacoes: string | null;
  latitude: number | null;
  longitude: number | null;
  fotos: string[];
  assinaturaConfirmada: boolean;
  itens: CtRecebimentoItemPayload[];
}

/* ---------------- linha do tempo do solicitante ---------------- */

export type CtSituacaoLogistica =
  | "AGUARDANDO_SELECAO"
  | "ATIVOS_RESERVADOS"
  | "CHECKLIST_PENDENTE"
  | "PRONTO_PARA_SAIDA"
  | "A_CAMINHO"
  | "AGUARDANDO_RECEBIMENTO"
  | "ENTREGUE"
  | "ENTREGUE_COM_RESSALVA"
  | "PENDENTE_TRATATIVA";

export type CtTimelineTipo =
  | "MOBILIZACAO_PROGRAMADA"
  | "CHECKLIST_SAIDA"
  | "TRANSPORTE_INICIADO"
  | "CHEGADA"
  | "RECEBIMENTO";

export interface CtTimelineEvento {
  tipo: CtTimelineTipo;
  em: string | null;
  viagem: string | null;
  responsavel: string | null;
  equipamento: string | null;
  estado: "CONCLUIDO" | "RESSALVA" | "RECUSA";
  resultado: string | null;
  observacao: string | null;
}

export interface CtSolicitacaoTimeline {
  solicitacaoId: string;
  situacaoLogistica: CtSituacaoLogistica;
  statusFluxo: string | null;
  eventos: CtTimelineEvento[];
}

export const CT_SITUACAO_LOGISTICA_LABEL: Record<CtSituacaoLogistica, string> = {
  AGUARDANDO_SELECAO: "Aguardando seleção de ativos",
  ATIVOS_RESERVADOS: "Ativos reservados",
  CHECKLIST_PENDENTE: "Checklist de saída pendente",
  PRONTO_PARA_SAIDA: "Pronto para saída",
  A_CAMINHO: "A caminho",
  AGUARDANDO_RECEBIMENTO: "Aguardando recebimento",
  ENTREGUE: "Entregue",
  ENTREGUE_COM_RESSALVA: "Entregue com ressalva",
  PENDENTE_TRATATIVA: "Pendente de tratativa",
};

export const CT_RESULTADO_LABEL: Record<CtRecebimentoResultado, string> = {
  ACEITO: "Aceito",
  ACEITO_COM_RESSALVA: "Aceito com ressalva",
  RECUSADO: "Recusado",
};

export const CT_NAO_CONFORMIDADE_LABEL: Record<CtNaoConformidadeTipo, string> = {
  AVARIA: "Avaria física",
  FALTA_ACESSORIO: "Falta de acessório",
  DOCUMENTACAO: "Documentação",
  LIMPEZA: "Limpeza / conservação",
  OUTRO: "Outro",
};
