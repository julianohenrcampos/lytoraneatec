/**
 * Fase operacional do processo vinculado ao Chamado Interno.
 *
 * IMPORTANTE: a fase operacional é INDEPENDENTE do status do CHI
 * (`aberto/resolvido/...`) e não altera o ENUM `chamado_interno_status`.
 * Ela é derivada de fontes autoritativas já existentes:
 *  - estado corrente da aprovação (`fn_chamado_interno_processo_operacional`
 *    → `fn_aprovacao_corporativa_status` / `status_fluxo` da SOL);
 *  - marcos materiais já gravados em `bd_chamado_interno_eventos`
 *    (payload.acao), que a Central do Transporte emite quando avança.
 * Nenhuma consulta adicional é feita por evento (zero N+1).
 */
import type { ProcessoOperacionalChamado } from "@/services/chamadoOperacionalService";

export type FaseOperacional =
  | "AGUARDANDO_APROVACAO"
  | "REJEITADO"
  | "DISPONIVEL_ATENDIMENTO"
  | "EM_PLANEJAMENTO"
  | "PLANEJAMENTO_PROGRAMADO"
  | "EM_TRANSPORTE"
  | "ENTREGA_REALIZADA"
  | "RECEBIMENTO_CONFIRMADO"
  | "CONCLUIDO"
  | "CANCELADO"
  | "SEM_FLUXO";

export const FASE_OPERACIONAL_LABEL: Record<FaseOperacional, string> = {
  AGUARDANDO_APROVACAO: "Aguardando aprovação",
  REJEITADO: "Rejeitado",
  DISPONIVEL_ATENDIMENTO: "Disponível para atendimento",
  EM_PLANEJAMENTO: "Em planejamento",
  PLANEJAMENTO_PROGRAMADO: "Programado — aguardando execução",
  EM_TRANSPORTE: "Em transporte",
  ENTREGA_REALIZADA: "Entrega realizada",
  RECEBIMENTO_CONFIRMADO: "Recebimento confirmado",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
  SEM_FLUXO: "Sem fluxo configurado",
};

export const FASE_OPERACIONAL_CLASSES: Record<FaseOperacional, string> = {
  AGUARDANDO_APROVACAO: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  REJEITADO: "bg-destructive/15 text-destructive",
  DISPONIVEL_ATENDIMENTO: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  EM_PLANEJAMENTO: "bg-primary/10 text-primary",
  PLANEJAMENTO_PROGRAMADO: "bg-primary/15 text-primary",
  EM_TRANSPORTE: "bg-primary/20 text-primary",
  ENTREGA_REALIZADA: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  RECEBIMENTO_CONFIRMADO: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  CONCLUIDO: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
  CANCELADO: "bg-destructive/10 text-destructive",
  SEM_FLUXO: "bg-muted text-muted-foreground",
};

/** Marcos materiais da CT → fase, do mais avançado para o menos avançado. */
const MARCOS_CT: Array<[string, FaseOperacional]> = [
  ["SOLICITACAO_ATENDIDA", "CONCLUIDO"],
  ["RECEBIMENTO_CONFIRMADO", "RECEBIMENTO_CONFIRMADO"],
  ["ENTREGA_REALIZADA", "ENTREGA_REALIZADA"],
  ["CHEGADA_DESTINO", "EM_TRANSPORTE"],
  ["TRANSPORTE_INICIADO", "EM_TRANSPORTE"],
  ["PLANEJAMENTO_PROGRAMADO", "PLANEJAMENTO_PROGRAMADO"],
  ["ATIVO_SELECIONADO", "EM_PLANEJAMENTO"],
  ["ATIVO_DEPARTAMENTO_ALTERNATIVO_SELECIONADO", "EM_PLANEJAMENTO"],
  ["PLANEJAMENTO_RASCUNHO_SALVO", "EM_PLANEJAMENTO"],
  ["ANALISE_DISPONIBILIDADE_INICIADA", "EM_PLANEJAMENTO"],
];

const CANCELAMENTOS = new Set(["SOLICITACAO_CANCELADA", "PLANEJAMENTO_CANCELADO"]);

export interface EventoFaseLike {
  tipo: string;
  payload?: unknown;
}

const acaoDe = (ev: EventoFaseLike): string | null => {
  if (ev.tipo !== "evento_operacional") return null;
  const p = ev.payload;
  if (!p || typeof p !== "object" || Array.isArray(p)) return null;
  const acao = (p as Record<string, unknown>).acao;
  return typeof acao === "string" ? acao : null;
};

export interface FaseOperacionalResultado {
  fase: FaseOperacional;
  label: string;
  classes: string;
  /** Nome de quem o processo está aguardando (aprovador atual), quando aplicável. */
  aguardando: string | null;
  /** Aprovação corrente já concluída (libera Assumir/planejamento). */
  aprovado: boolean;
  rejeitado: boolean;
}

export function derivarFaseOperacional(
  processo: ProcessoOperacionalChamado | null | undefined,
  eventos: EventoFaseLike[] = [],
  chamadoCancelado = false,
): FaseOperacionalResultado | null {
  if (!processo?.tem_processo) return null;

  const statusAprov = String(processo.aprovacao?.status ?? "AGUARDANDO");
  const aprovado = statusAprov === "APROVADO" || processo.status_fluxo === "APROVADO";
  const rejeitado = statusAprov === "REJEITADO" || processo.status_fluxo === "NEGADO";
  const aguardando = processo.aprovacao?.etapa_atual?.aprovador_nome ?? null;

  const acoes = eventos.map(acaoDe).filter((a): a is string => !!a);

  let fase: FaseOperacional;
  if (chamadoCancelado || processo.status_fluxo === "CANCELADO" || acoes.some((a) => CANCELAMENTOS.has(a))) {
    fase = "CANCELADO";
  } else if (rejeitado) {
    fase = "REJEITADO";
  } else if (!aprovado) {
    fase = statusAprov === "SEM_FLUXO_CONFIGURADO" ? "SEM_FLUXO" : "AGUARDANDO_APROVACAO";
  } else {
    const marco = MARCOS_CT.find(([acao]) => acoes.includes(acao));
    fase = marco ? marco[1] : "DISPONIVEL_ATENDIMENTO";
  }

  return {
    fase,
    label: FASE_OPERACIONAL_LABEL[fase],
    classes: FASE_OPERACIONAL_CLASSES[fase],
    aguardando: fase === "AGUARDANDO_APROVACAO" ? aguardando : null,
    aprovado,
    rejeitado,
  };
}

/** Gate de apresentação do botão "Assumir" — server-side permanece autoritativo. */
export function podeAssumirPorFase(fase: FaseOperacionalResultado | null): boolean {
  if (!fase) return true; // chamado comum, sem processo operacional
  if (fase.fase === "SEM_FLUXO") return true;
  return fase.aprovado && !fase.rejeitado;
}
