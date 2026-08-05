/**
 * CT-2.3 — Formatação pura da agenda do ativo.
 *
 * Consome exclusivamente o objeto `agenda` projetado pelo servidor
 * (fn_ct_estado_efetivo_lote), que já une os intervalos comprometidos.
 * Nada aqui autoriza ou bloqueia: a decisão permanece server-side.
 */
import type { CtAgendaAtivo, CtEstadoEfetivoAtivo } from "@/types/centralTransporteEstadoEfetivo";
import { formatDateBR } from "@/utils/formatDateBR";

export const AGENDA_NAO_CONSULTADA = "Agenda não consultada";
export const AGENDA_SEM_COMPROMISSOS = "Sem compromissos registrados";

const dia = (iso: string | null | undefined): string | null =>
  iso ? formatDateBR(iso) : null;

/** Frase única e legível da agenda; null quando não há nada a informar. */
export const frasesDaAgenda = (agenda: CtAgendaAtivo | null | undefined): string[] => {
  if (!agenda) return [];
  const out: string[] = [];

  if (agenda.conflitoOperacional) {
    out.push(
      agenda.motivoConflito === "COMPROMISSO_VENCIDO_ATIVO"
        ? "Compromisso vencido ainda ativo — regularize antes de operar."
        : "Compromissos sobrepostos detectados — regularize antes de operar.",
    );
  }

  const inicio = dia(agenda.blocoComprometidoInicio);
  const fim = dia(agenda.blocoComprometidoFim);
  const livreAte = dia(agenda.disponivelAte);
  const proxima = dia(agenda.proximaDisponibilidade);

  if (livreAte) out.push(`Livre até ${livreAte}`);
  if (inicio) out.push(`Comprometido de ${inicio} a ${fim ?? "—"}`);
  if (proxima) out.push(`Próxima disponibilidade: ${proxima}`);

  return out;
};

/** Texto consolidado (uma linha) da agenda, com fallbacks explícitos. */
export const textoAgendaAtivo = (
  estado: CtEstadoEfetivoAtivo | null | undefined,
): string => {
  if (!estado) return AGENDA_NAO_CONSULTADA;
  const frases = frasesDaAgenda(estado.agenda);
  if (frases.length === 0) return AGENDA_SEM_COMPROMISSOS;
  return frases.join(" · ");
};

export default textoAgendaAtivo;
