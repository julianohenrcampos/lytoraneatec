/**
 * CT-2 / M4 — Elegibilidade de candidatos.
 * A elegibilidade deriva dos dados do ativo + estado efetivo consultado
 * (CT-2.2: sem consulta confirmada nada é operável — fail-closed).
 */
import { describe, it, expect } from "vitest";
import { toCandidateSelection, candidateLabel } from "@/utils/central-transporte/ctCandidateAdapter";
import type { AtivoAnalise } from "@/services/centralTransporteService";
import type { CtEstadoEfetivoAtivo } from "@/types/centralTransporteEstadoEfetivo";

const ativo = (over: Partial<AtivoAnalise> = {}): AtivoAnalise =>
  ({
    equipamento_id: "eq-1",
    frota: "FR",
    numero_frota: "001",
    placa: "ABC1D23",
    compatibilidade: "EXATA",
    status_operacional: "DISPONIVEL",
    // G0: elegibilidade exige linha operacional confirmada.
    possui_registro_disponibilidade: true,
    previsao_liberacao: null,
    centro_custo_codigo: "CC01",
    centro_custo_nome: "Obra A",
    ...over,
  }) as AtivoAnalise;

/** Estado efetivo consultado e livre (padrão dos casos operáveis). */
const estadoLivre = (over: Partial<CtEstadoEfetivoAtivo> = {}): CtEstadoEfetivoAtivo => ({
  equipamentoId: "eq-1",
  centroCustoId: null,
  condicaoOperacional: "DISPONIVEL",
  possuiRegistroOperacional: true,
  previsaoLiberacao: null,
  dataInicioDisponibilidade: null,
  agenda: null,
  compromissoAtivo: "LIVRE",
  possuiCompromissoAtualOuFuturo: false,
  compromissoPrincipal: null,
  compromissoPrincipalStatus: null,
  compromissoPrincipalInicio: null,
  compromissoPrincipalFim: null,
  compromissoPrincipalVigencia: "SEM_COMPROMISSO",
  reservadoPelaCentral: false,
  compromissoAtual: null,
  proximoCompromisso: null,
  quantidadeCompromissosFuturos: 0,
  compromissosNaJanela: [],
  quantidadeCompromissosNaJanela: 0,
  possuiAnomaliaSobreposicao: false,
  possuiSobreposicaoNaJanela: false,
  possuiCompromissoVencidoAtivo: false,
  periodoComprometido: null,
  atendimentoId: null,
  solicitacaoId: null,
  solicitacaoItemId: null,
  estadoLogistico: "SEM_MOVIMENTACAO",
  estadoExibicao: "DISPONIVEL",
  alertas: [],
  bloqueios: [],
  origemDecisao: "CT2_2",
  ...over,
});

describe("ctCandidateAdapter — elegibilidade CT-2", () => {
  it("ativo DISPONIVEL com estado consultado permite atendimento interno", () => {
    const c = toCandidateSelection(ativo(), "PROPRIA", estadoLivre());
    expect(c?.permiteInterno).toBe(true);
    expect(c?.permiteReservaFutura).toBe(true);
  });

  it("sem estado efetivo consultado nada é operável (fail-closed)", () => {
    const c = toCandidateSelection(ativo(), "PROPRIA");
    expect(c?.permiteInterno).toBe(false);
    expect(c?.permiteReservaFutura).toBe(false);
  });

  it("ativo ocupado com previsão permite apenas reserva futura", () => {
    const c = toCandidateSelection(
      ativo({ status_operacional: "ALOCADO", previsao_liberacao: "2026-08-10" }),
      "PREVISAO",
      estadoLivre({ condicaoOperacional: "ALOCADO", previsaoLiberacao: "2026-08-10" }),
    );
    expect(c?.permiteInterno).toBe(false);
    expect(c?.permiteReservaFutura).toBe(true);
  });

  it("ativo indisponível não permite nenhuma modalidade", () => {
    const c = toCandidateSelection(
      ativo({ status_operacional: "MANUTENCAO" }),
      "GRUPO",
      estadoLivre({
        condicaoOperacional: "MANUTENCAO",
        estadoExibicao: "INDISPONIVEL_PARA_ATENDIMENTO",
      }),
    );
    expect(c?.permiteInterno).toBe(false);
    expect(c?.permiteReservaFutura).toBe(false);
  });

  it("compatibilidade EXATA vira match EXATO e demais viram PARCIAL", () => {
    expect(toCandidateSelection(ativo(), "PROPRIA")?.matchTipo).toBe("EXATO");
    expect(
      toCandidateSelection(ativo({ compatibilidade: "PARCIAL" }), "PROPRIA")?.matchTipo,
    ).toBe("PARCIAL");
  });

  it("origem é preservada e não altera a elegibilidade", () => {
    const base = ativo({ status_operacional: "DISPONIVEL" });
    const propria = toCandidateSelection(base, "PROPRIA");
    const grupo = toCandidateSelection(base, "GRUPO");
    expect(propria?.origem).toBe("PROPRIA");
    expect(grupo?.origem).toBe("GRUPO");
    expect(grupo?.permiteInterno).toBe(propria?.permiteInterno);
  });

  it("ativo sem equipamento_id não vira candidato", () => {
    expect(toCandidateSelection(ativo({ equipamento_id: undefined }), "PROPRIA")).toBeNull();
  });

  it("rótulo usa frota+número e cai para placa quando ausentes", () => {
    expect(candidateLabel(toCandidateSelection(ativo(), "PROPRIA")!)).toBe("FR 001");
    const semFrota = toCandidateSelection(ativo({ frota: null, numero_frota: null }), "PROPRIA")!;
    expect(candidateLabel(semFrota)).toBe("ABC1D23");
  });

  it("centro de custo é exibido como código — nome", () => {
    expect(toCandidateSelection(ativo(), "PROPRIA")?.centroCustoLabel).toBe("CC01 — Obra A");
  });
});
