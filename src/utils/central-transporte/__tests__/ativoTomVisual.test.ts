/**
 * CT-3E — T03: tom visual (verde/laranja/vermelho) derivado da superfície canônica.
 */
import { describe, expect, it } from "vitest";
import { tomDoCandidato } from "@/utils/central-transporte/ativoTomVisual";
import type { CtCandidateSelection } from "@/types/centralTransporteCT2";

const base = (over: Partial<CtCandidateSelection> = {}): CtCandidateSelection =>
  ({
    equipamentoId: "eq-1",
    origem: "PROPRIA",
    matchTipo: "EXATO",
    disponibilidadeStatus: "DISPONIVEL",
    previsaoLiberacao: null,
    dataInicioDisponibilidade: null,
    permiteInterno: true,
    permiteReservaFutura: true,
    precisaRegularizarDisponibilidade: false,
    frota: "LYC",
    numeroFrota: "001",
    placa: null,
    centroCustoLabel: null,
    possuiRegistroDisponibilidade: true,
    possuiCentroCustoAtual: true,
    jaNoCentroCustoDestino: false,
    situacaoCadastral: null,
    conflitoCadastral: false,
    conflitoCadastralMotivo: null,
    bloqueioMotivo: null,
    matchMotivo: null,
    compromissoAtivo: null,
    estadoExibicao: null,
    compromissoBloqueia: false,
    compromissoLabel: "",
    compromissoDetalhe: "",
    possuiAnomaliaSobreposicao: false,
    possuiCompromissoVencidoAtivo: false,
    estadoConsultado: true,
    ...over,
  }) as unknown as CtCandidateSelection;

describe("tomDoCandidato", () => {
  it("verde quando o ativo permite atendimento interno imediato", () => {
    expect(tomDoCandidato(base()).tom).toBe("VERDE");
  });

  it("laranja quando só há reserva futura", () => {
    expect(tomDoCandidato(base({ permiteInterno: false })).tom).toBe("LARANJA");
  });

  it("laranja quando disponível mas compatibilidade parcial", () => {
    expect(tomDoCandidato(base({ matchTipo: "PARCIAL" })).tom).toBe("LARANJA");
  });

  it("vermelho quando comprometido, sem registro ou sem estado consultado", () => {
    expect(tomDoCandidato(base({ compromissoBloqueia: true })).tom).toBe("VERMELHO");
    expect(tomDoCandidato(base({ precisaRegularizarDisponibilidade: true })).tom).toBe("VERMELHO");
    expect(tomDoCandidato(base({ estadoConsultado: false })).tom).toBe("VERMELHO");
    expect(tomDoCandidato(base({ disponibilidadeStatus: "MANUTENCAO" })).tom).toBe("VERMELHO");
    expect(tomDoCandidato(null).tom).toBe("VERMELHO");
  });
});
