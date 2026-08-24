import { describe, expect, it } from "vitest";
import { podeSelecionarAtivoParada } from "../elegibilidadeSelecaoParada";

const base = { jaNestaParada: false, usadoEmOutraParada: false };

describe("CT-4 · seleção de ativos na parada", () => {
  it("DISPONIVEL elegível é selecionável", () => {
    expect(podeSelecionarAtivoParada({ ...base, elegivel: true })).toBe(true);
  });

  it("ALOCADO elegível é selecionável (mesmo sem previsão de liberação)", () => {
    // O servidor devolve elegivel=true para ALOCADO sem compromisso/OS.
    expect(podeSelecionarAtivoParada({ ...base, elegivel: true })).toBe(true);
  });

  it("MANUTENCAO (elegivel=false) é bloqueado", () => {
    expect(podeSelecionarAtivoParada({ ...base, elegivel: false })).toBe(false);
  });

  it("SEM_REGISTRO (elegivel=false) é bloqueado", () => {
    expect(podeSelecionarAtivoParada({ ...base, elegivel: false })).toBe(false);
  });

  it("compromisso concorrente (elegivel=false) é bloqueado", () => {
    expect(podeSelecionarAtivoParada({ ...base, elegivel: false })).toBe(false);
  });

  it("ativo já usado em outra parada não pode ser duplicado", () => {
    expect(
      podeSelecionarAtivoParada({ ...base, elegivel: true, usadoEmOutraParada: true }),
    ).toBe(false);
  });

  it("ativo já nesta parada permanece interativo para remoção", () => {
    expect(
      podeSelecionarAtivoParada({ elegivel: false, jaNestaParada: true, usadoEmOutraParada: false }),
    ).toBe(true);
  });
});
