/**
 * CT-2.2 — Rótulos e bloqueios derivados do estado efetivo do ativo.
 *
 * Regras duras:
 *  - ativo comprometido (reservado, em transporte, entregue) NUNCA aparece livre;
 *  - compromisso vencido ainda ativo é conflito operacional e bloqueia;
 *  - estado não consultado (erro/ausência) é fail-closed: bloqueia a operação.
 */
import {
  CT_MSG_COMPROMISSO_RESTRITO,
  CT_MSG_ESTADO_NAO_CONSULTADO,
  type CtEstadoEfetivoAtivo,
  type CtEstadoExibicao,
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

const LABEL_ESTADO: Record<CtEstadoExibicao, string> = {
  DISPONIVEL: "Disponível",
  RESERVADO: "Reservado",
  EM_TRANSPORTE: "Em transporte",
  ALOCADO: "Alocado",
  COMPROMETIDO: "Comprometido",
  INDISPONIVEL_PARA_ATENDIMENTO: "Bloqueado",
  CONFLITO_OPERACIONAL: "Conflito operacional",
};

const periodoTexto = (inicio?: string | null, fim?: string | null): string | null =>
  inicio ? `${inicio} até ${fim ?? "—"}` : null;

/** Fail-closed: estado ausente/erro nunca é livre. */
export const BADGE_NAO_CONSULTADO: CtEstadoBadge = {
  label: CT_MSG_ESTADO_NAO_CONSULTADO,
  tom: "bloqueado",
  bloqueiaOperacao: true,
  detalhe: "Não foi possível confirmar o compromisso deste ativo. Tente novamente.",
};

/** Badge da dimensão "compromisso atual" (independente do status operacional). */
export const badgeDoCompromissoAtual = (
  estado: CtEstadoEfetivoAtivo | null | undefined,
): CtEstadoBadge => {
  if (!estado) return BADGE_NAO_CONSULTADO;

  if (estado.possuiAnomaliaSobreposicao) {
    return {
      label: "Conflito múltiplo",
      tom: "conflito",
      bloqueiaOperacao: true,
      detalhe: "Existem compromissos ativos sobrepostos para este ativo.",
    };
  }

  if (estado.possuiCompromissoVencidoAtivo) {
    return {
      label: "Compromisso vencido ativo",
      tom: "conflito",
      bloqueiaOperacao: true,
      detalhe:
        "Existe compromisso com período vencido que continua ativo; regularize antes de operar.",
    };
  }

  const atual = estado.compromissoAtual;
  if (atual) {
    return {
      label: LABEL_COMPROMISSO[atual.status] ?? "Comprometido",
      tom: "comprometido",
      bloqueiaOperacao: true,
      detalhe: atual.detalhesRestritos
        ? CT_MSG_COMPROMISSO_RESTRITO
        : (periodoTexto(atual.periodoInicio, atual.periodoFim)
            ? `Compromisso ativo de ${periodoTexto(atual.periodoInicio, atual.periodoFim)}.`
            : "Ativo com compromisso ativo registrado."),
    };
  }

  return {
    label: "Livre",
    tom: "disponivel",
    bloqueiaOperacao: false,
    detalhe:
      estado.proximoCompromisso && estado.proximoCompromisso.periodoInicio
        ? `Próxima reserva: ${periodoTexto(
            estado.proximoCompromisso.periodoInicio,
            estado.proximoCompromisso.periodoFim,
          )}.`
        : null,
  };
};

/**
 * Badge do ESTADO EFETIVO (precedência rigorosa):
 * conflito > em transporte > reservado > alocado > indisponível > disponível.
 */
export const badgeDoEstadoEfetivo = (
  estado: CtEstadoEfetivoAtivo | null | undefined,
): CtEstadoBadge => {
  if (!estado) return BADGE_NAO_CONSULTADO;

  if (
    estado.possuiAnomaliaSobreposicao ||
    estado.possuiCompromissoVencidoAtivo ||
    estado.estadoExibicao === "CONFLITO_OPERACIONAL"
  ) {
    return {
      label: "Conflito operacional — bloqueado",
      tom: "conflito",
      bloqueiaOperacao: true,
      detalhe: estado.possuiCompromissoVencidoAtivo
        ? "Compromisso vencido ainda ativo; regularize antes de operar."
        : "Existem compromissos ativos sobrepostos para este ativo; regularize antes de operar.",
    };
  }

  if (estado.estadoExibicao === "EM_TRANSPORTE" || estado.estadoExibicao === "RESERVADO") {
    const atual = estado.compromissoAtual;
    return {
      label: LABEL_ESTADO[estado.estadoExibicao],
      tom: "comprometido",
      bloqueiaOperacao: true,
      detalhe: atual?.detalhesRestritos
        ? CT_MSG_COMPROMISSO_RESTRITO
        : (periodoTexto(atual?.periodoInicio, atual?.periodoFim)
            ? `Compromisso ativo de ${periodoTexto(atual?.periodoInicio, atual?.periodoFim)}.`
            : null),
    };
  }

  if (estado.estadoExibicao === "ALOCADO") {
    return {
      label: "Alocado",
      tom: "comprometido",
      bloqueiaOperacao: !!estado.compromissoAtual,
      detalhe: estado.compromissoAtual
        ? "Ativo entregue a um compromisso operacional."
        : "Ativo alocado operacionalmente.",
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

  if (estado.estadoExibicao === "INDISPONIVEL_PARA_ATENDIMENTO") {
    return {
      label: estado.condicaoOperacional,
      tom: "bloqueado",
      bloqueiaOperacao: true,
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
  "RESERVADO",
  "EM_TRANSPORTE",
  "COMPROMETIDO",
]);

/** Texto do próximo compromisso, exibido separadamente do estado atual. */
export const textoProximaReserva = (
  estado: CtEstadoEfetivoAtivo | null | undefined,
): string | null => {
  const prox = estado?.proximoCompromisso;
  if (!prox?.periodoInicio) return null;
  return `Próxima reserva: ${prox.periodoInicio} a ${prox.periodoFim ?? "—"}`;
};

/**
 * Fail-closed da JANELA consultada: sem estado consultado, com sobreposição na
 * janela, conflito ou compromisso vencido ativo, a reserva não pode ser feita.
 */
export const janelaComprometida = (
  estado: CtEstadoEfetivoAtivo | null | undefined,
): boolean => {
  if (!estado) return true;
  return (
    estado.possuiSobreposicaoNaJanela ||
    estado.quantidadeCompromissosNaJanela > 0 ||
    estado.possuiAnomaliaSobreposicao ||
    estado.possuiCompromissoVencidoAtivo
  );
};
