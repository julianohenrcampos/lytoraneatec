import { describe, expect, it } from "vitest";
import type { CtAgendaAtivo, CtEstadoEfetivoAtivo } from "@/types/centralTransporteEstadoEfetivo";
import {
  AGENDA_NAO_CONSULTADA,
  AGENDA_SEM_COMPROMISSOS,
  frasesDaAgenda,
  textoAgendaAtivo,
} from "../agendaAtivo";

const agenda = (over: Partial<CtAgendaAtivo> = {}): CtAgendaAtivo => ({
  disponivelAte: null,
  blocoComprometidoInicio: null,
  blocoComprometidoFim: null,
  proximaDisponibilidade: null,
  proximaReservaInicio: null,
  proximaReservaFim: null,
  conflitoOperacional: false,
  motivoConflito: null,
  ...over,
});

const estado = (ag: CtAgendaAtivo | null): CtEstadoEfetivoAtivo =>
  ({ equipamentoId: "eq-1", agenda: ag } as unknown as CtEstadoEfetivoAtivo);

describe("CT-2.3 agenda do ativo", () => {
  it("fail-closed: estado ausente nunca informa agenda livre", () => {
    expect(textoAgendaAtivo(null)).toBe(AGENDA_NAO_CONSULTADA);
  });

  it("agenda vazia informa ausência de compromissos", () => {
    expect(textoAgendaAtivo(estado(agenda()))).toBe(AGENDA_SEM_COMPROMISSOS);
  });

  it("livre agora com bloco futuro informa limite e retomada", () => {
    const frases = frasesDaAgenda(
      agenda({
        disponivelAte: "2026-08-09",
        blocoComprometidoInicio: "2026-08-10",
        blocoComprometidoFim: "2026-08-15",
        proximaDisponibilidade: "2026-08-16",
      }),
    );
    expect(frases[0]).toContain("Livre até 09/08/2026");
    expect(frases[1]).toContain("Comprometido de 10/08/2026 a 15/08/2026");
    expect(frases[2]).toContain("Próxima disponibilidade: 16/08/2026");
  });

  it("compromisso vencido ativo aparece como conflito na primeira frase", () => {
    const frases = frasesDaAgenda(
      agenda({ conflitoOperacional: true, motivoConflito: "COMPROMISSO_VENCIDO_ATIVO" }),
    );
    expect(frases[0]).toContain("vencido");
  });

  it("sobreposição detectada é sinalizada", () => {
    const frases = frasesDaAgenda(
      agenda({ conflitoOperacional: true, motivoConflito: "SOBREPOSICAO_DETECTADA" }),
    );
    expect(frases[0]).toContain("sobrepostos");
  });
});
