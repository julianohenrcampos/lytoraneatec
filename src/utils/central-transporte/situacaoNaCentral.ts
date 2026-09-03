/**
 * CT-2.4 — "Situação na Central" (apresentação, ADITIVA).
 *
 * Corrige apenas o CONTRATO DE APRESENTAÇÃO: um ativo com reserva futura
 * deixa de aparecer como "Livre" na Central, mesmo que a vigência comece em
 * data posterior à data de referência.
 *
 * O que este módulo NÃO faz:
 *  - não altera `estadoExibicao` (contrato legado preservado);
 *  - não altera a condição operacional do ativo;
 *  - não bloqueia nem autoriza operação (`bloqueiaOperacao` continua vindo de
 *    `badgeDoEstadoEfetivo`, e a autorização final é sempre server-side);
 *  - não inventa planejamento logístico persistido (ver CT-3C).
 */
import {
  CT_MSG_COMPROMISSO_RESTRITO,
  CT_MSG_ESTADO_NAO_CONSULTADO,
  type CtEstadoEfetivoAtivo,
  type CtSituacaoMobilizacaoDerivada,
} from "@/types/centralTransporteEstadoEfetivo";
import type { CtBadgeTom } from "@/utils/central-transporte/estadoEfetivoBadges";
import { formatDateBR } from "@/utils/formatDateBR";

export const LABEL_SITUACAO_NA_CENTRAL = "Situação na Central";

const LABEL_STATUS: Record<string, string> = {
  RESERVADO: "RESERVADO",
  EM_TRANSPORTE: "EM TRANSPORTE",
  ENTREGUE: "ENTREGUE",
};

export interface CtSituacaoNaCentral {
  /** Rótulo apresentado no lugar do antigo "Compromisso atual". */
  label: string;
  tom: CtBadgeTom;
  /** Ex.: "Inicia em 05/08/2026"; null quando não há complemento. */
  complemento: string | null;
  /** Cópia da vigência devolvida pelo servidor. */
  vigencia: CtEstadoEfetivoAtivo["compromissoPrincipalVigencia"] | "NAO_CONSULTADO";
  periodoInicio: string | null;
  periodoFim: string | null;
  /** true quando o servidor marcou o compromisso principal como da Central. */
  reservadoPelaCentral: boolean;
  /** Identificadores redigidos no servidor (usuário sem acesso à solicitação). */
  detalhesRestritos: boolean;
}

const dia = (iso: string | null | undefined): string | null =>
  iso ? formatDateBR(iso) : null;

/** Fail-closed: estado não consultado nunca é apresentado como livre. */
export const SITUACAO_NAO_CONSULTADA: CtSituacaoNaCentral = {
  label: CT_MSG_ESTADO_NAO_CONSULTADO,
  tom: "bloqueado",
  complemento: "Não foi possível confirmar a situação deste ativo na Central.",
  vigencia: "NAO_CONSULTADO",
  periodoInicio: null,
  periodoFim: null,
  reservadoPelaCentral: false,
  detalhesRestritos: false,
};

export const situacaoNaCentral = (
  estado: CtEstadoEfetivoAtivo | null | undefined,
): CtSituacaoNaCentral => {
  if (!estado) return SITUACAO_NAO_CONSULTADA;

  const inicio = estado.compromissoPrincipalInicio;
  const fim = estado.compromissoPrincipalFim;
  const restrito = estado.compromissoPrincipal?.detalhesRestritos === true;

  // 1) Anomalia real tem precedência absoluta.
  if (estado.compromissoPrincipalVigencia === "CONFLITO") {
    return {
      label: "CONFLITO OPERACIONAL",
      tom: "conflito",
      complemento: estado.possuiCompromissoVencidoAtivo
        ? "Compromisso vencido ainda ativo — regularize antes de operar."
        : "Compromissos sobrepostos detectados — regularize antes de operar.",
      vigencia: "CONFLITO",
      periodoInicio: inicio,
      periodoFim: fim,
      reservadoPelaCentral: estado.reservadoPelaCentral,
      detalhesRestritos: restrito,
    };
  }

  // 4) Nenhum compromisso vigente nem futuro ⇒ realmente livre.
  if (!estado.possuiCompromissoAtualOuFuturo || !estado.compromissoPrincipalStatus) {
    return {
      label: "LIVRE",
      tom: "disponivel",
      complemento: null,
      vigencia: "SEM_COMPROMISSO",
      periodoInicio: null,
      periodoFim: null,
      reservadoPelaCentral: false,
      detalhesRestritos: false,
    };
  }

  const label =
    LABEL_STATUS[estado.compromissoPrincipalStatus] ?? estado.compromissoPrincipalStatus;

  // 2) Vigente hoje  /  3) Vigência futura — ambos apresentam o status real.
  const futuro = estado.compromissoPrincipalVigencia === "FUTURO";
  const complemento = restrito
    ? CT_MSG_COMPROMISSO_RESTRITO
    : futuro && dia(inicio)
      ? `Inicia em ${dia(inicio)}`
      : dia(inicio)
        ? `Vigente de ${dia(inicio)} a ${dia(fim) ?? "—"}`
        : null;

  return {
    label,
    tom: "comprometido",
    complemento,
    vigencia: estado.compromissoPrincipalVigencia,
    periodoInicio: inicio,
    periodoFim: fim,
    reservadoPelaCentral: estado.reservadoPelaCentral,
    detalhesRestritos: restrito,
  };
};

/**
 * CT-2.4 — Situação de mobilização DERIVADA (nunca persistida).
 * Enquanto a CT-3C (integração logística) não existir, a única derivação
 * legítima é AGUARDANDO_MOBILIZACAO para atendimento RESERVADO.
 */
export const situacaoMobilizacaoDerivada = (
  estado: CtEstadoEfetivoAtivo | null | undefined,
): CtSituacaoMobilizacaoDerivada => {
  if (!estado) return null;
  if (estado.compromissoPrincipalVigencia === "CONFLITO") return null;
  return estado.compromissoPrincipalStatus === "RESERVADO" ? "AGUARDANDO_MOBILIZACAO" : null;
};

export const LABEL_MOBILIZACAO_DERIVADA = "Aguardando mobilização";
export const AVISO_MOBILIZACAO_DERIVADA =
  "Informação derivada da reserva — não há programação logística registrada.";

/**
 * CT-2.4 — Frases da agenda enunciadas na linguagem da Central.
 * Consome exclusivamente a agenda projetada pelo servidor (CT-2.3).
 */
export const frasesAgendaNaCentral = (
  estado: CtEstadoEfetivoAtivo | null | undefined,
): string[] => {
  if (!estado) return [];
  const ag = estado.agenda;
  if (!ag) return [];
  const out: string[] = [];

  const livreAte = dia(ag.disponivelAte);
  const ini = dia(ag.blocoComprometidoInicio);
  const fim = dia(ag.blocoComprometidoFim);
  const prox = dia(ag.proximaDisponibilidade);
  const verbo = estado.reservadoPelaCentral ? "Reservado" : "Comprometido";

  if (livreAte) out.push(`Disponível até ${livreAte}.`);
  if (ini) out.push(`${verbo} de ${ini} a ${fim ?? "—"}.`);
  if (prox) out.push(`Novamente disponível em ${prox}.`);

  return out;
};

/** Frase única dos Detalhes do Ativo (seção Agenda de utilização). */
export const textoAgendaNaCentral = (
  estado: CtEstadoEfetivoAtivo | null | undefined,
): string | null => {
  const frases = frasesAgendaNaCentral(estado);
  return frases.length ? frases.join(" ") : null;
};

export default situacaoNaCentral;
