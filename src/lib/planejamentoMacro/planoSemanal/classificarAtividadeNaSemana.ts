// Fase 7A — Classificação de uma atividade dentro de uma semana.
// Multi-flags + flag principal por prioridade explícita.

import type {
  AtividadeBruta,
  ClassificacaoSemanaAtividade,
  SemanaRef,
} from "./tipos";

const PRIORIDADE: ClassificacaoSemanaAtividade[] = [
  "atrasada",
  "reprogramada",
  "marco",
  "inicia_semana",
  "termina_semana",
  "em_andamento",
  "antecipavel",
];

function hojeIso(now: Date = new Date()): string {
  // BRT (UTC-3)
  const brt = new Date(now.getTime() - 3 * 3600_000);
  const y = brt.getUTCFullYear();
  const m = String(brt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(brt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Calcula flags semanais para uma atividade.
 *
 * - inicia_semana: data_inicio ∈ [semana.inicio, semana.fim]
 * - termina_semana: data_fim ∈ [semana.inicio, semana.fim]
 * - em_andamento: data_inicio < semana.inicio && data_fim > semana.fim
 * - atrasada: data_fim < hoje && status ∉ {concluida, cancelada}
 * - marco: a.is_marco === true
 * - reprogramada / antecipavel: reservadas (sempre false na 7A)
 */
export function classificarAtividadeNaSemana(
  a: AtividadeBruta,
  semana: SemanaRef,
  refHoje: string = hojeIso(),
): {
  flags: ClassificacaoSemanaAtividade[];
  flagPrincipal: ClassificacaoSemanaAtividade;
} {
  const flags: ClassificacaoSemanaAtividade[] = [];

  if (a.data_inicio >= semana.inicio && a.data_inicio <= semana.fim) {
    flags.push("inicia_semana");
  }
  if (a.data_fim >= semana.inicio && a.data_fim <= semana.fim) {
    flags.push("termina_semana");
  }
  if (a.data_inicio < semana.inicio && a.data_fim > semana.fim) {
    flags.push("em_andamento");
  }
  const status = (a.status ?? "").toLowerCase();
  if (
    a.data_fim < refHoje &&
    status !== "concluida" &&
    status !== "concluída" &&
    status !== "cancelada"
  ) {
    flags.push("atrasada");
  }
  if (a.is_marco) flags.push("marco");

  // Sem flags semanais → fallback: em_andamento (a atividade cruzou a semana).
  if (flags.length === 0) flags.push("em_andamento");

  const principal =
    PRIORIDADE.find((p) => flags.includes(p)) ?? flags[0];

  return { flags, flagPrincipal: principal };
}
