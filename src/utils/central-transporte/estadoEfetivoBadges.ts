/**
 * CT-2.2 — Rótulos e bloqueios derivados do estado efetivo do ativo.
 *
 * Regra dura: um ativo comprometido (reservado, em transporte ou entregue)
 * NUNCA é exibido como livre; ele permanece visível, porém não operável.
 */
import type {
  CtEstadoEfetivoAtivo,
  CtEstadoExibicao,
} from "@/types/centralTransporteEstadoEfetivo";

export type CtBadgeTom = "disponivel" | "comprometido" | "bloqueado" | "conflito" | "neutro";

export interface CtEstadoBadge {
  label: string;
  tom: CtBadgeTom;
  /** true quando nenhuma operação de atendimento pode ser iniciada. */
  bloqueiaOperacao: boolean;
  detalhe: string | null;
}

const LABEL_COMPROMISSO: Record<string, string> = {
  RESERVADO: "Reservado",
  EM_TRANSPORTE: "Em transporte",
  ENTREGUE: "Alocado",
};

export const badgeDoEstadoEfetivo = (
  estado: CtEstadoEfetivoAtivo | null | undefined,
): CtEstadoBadge => {
  if (!estado) {
    return { label: "—", tom: "neutro", bloqueiaOperacao: false, detalhe: null };
  }

  if (estado.possuiAnomaliaSobreposicao || estado.estadoExibicao === "CONFLITO_OPERACIONAL") {
    return {
      label: "Conflito operacional — bloqueado",
      tom: "conflito",
      bloqueiaOperacao: true,
      detalhe: "Existem compromissos ativos sobrepostos para este ativo; regularize antes de operar.",
    };
  }

  if (!estado.possuiRegistroOperacional) {
    return {
      label: "Sem status — bloqueado",
      tom: "bloqueado",
      bloqueiaOperacao: true,
      detalhe: "Ativo sem disponibilidade operacional registrada (bloqueio do servidor).",
    };
  }

  if (estado.compromissoAtivo !== "LIVRE") {
    const periodo = estado.periodoComprometido;
    return {
      label: LABEL_COMPROMISSO[estado.compromissoAtivo] ?? "Comprometido",
      tom: "comprometido",
      bloqueiaOperacao: true,
      detalhe: periodo?.inicio
        ? `Compromisso ativo de ${periodo.inicio} até ${periodo.fim ?? "—"}.`
        : "Ativo com compromisso ativo registrado.",
    };
  }

  if (estado.quantidadeCompromissosNaJanela > 0) {
    return {
      label: "Período comprometido",
      tom: "comprometido",
      bloqueiaOperacao: true,
      detalhe: `${estado.quantidadeCompromissosNaJanela} compromisso(s) na janela solicitada.`,
    };
  }

  if (estado.condicaoOperacional !== "DISPONIVEL") {
    return {
      label: estado.condicaoOperacional,
      tom: "bloqueado",
      bloqueiaOperacao: false,
      detalhe: estado.previsaoLiberacao
        ? `Previsão de liberação: ${estado.previsaoLiberacao}.`
        : null,
    };
  }

  return {
    label: "Disponível",
    tom: "disponivel",
    bloqueiaOperacao: false,
    detalhe:
      estado.quantidadeCompromissosFuturos > 0
        ? `${estado.quantidadeCompromissosFuturos} compromisso(s) futuro(s) agendado(s).`
        : null,
  };
};

export const CLASSE_TOM: Record<CtBadgeTom, string> = {
  disponivel: "bg-emerald-600 text-primary-foreground",
  comprometido: "bg-blue-600 text-primary-foreground",
  bloqueado: "bg-amber-600 text-primary-foreground",
  conflito: "bg-destructive text-destructive-foreground",
  neutro: "bg-muted text-muted-foreground",
};

/** Estados de exibição que impedem qualquer atendimento novo. */
export const ESTADOS_BLOQUEANTES: ReadonlySet<CtEstadoExibicao> = new Set([
  "INDISPONIVEL_PARA_ATENDIMENTO",
  "CONFLITO_OPERACIONAL",
]);
