/**
 * CT-4 — cancelamento do planejamento: composição do motivo e presença das
 * canceladas no conjunto operacional (regras puras, sem servidor).
 */
import { describe, expect, it } from "vitest";
import { montarMotivoCancelamento } from "@/components/central-transporte/mov-direta/CancelarPlanejamentoDialog";
import {
  filtrarMovimentacoes,
  filtroVazio,
} from "@/lib/central-transporte/movimentacoesWorkspace";
import type { CtOrdemMotorista, CtViagemStatus } from "@/types/centralTransporteMobilizacao";

const mov = (id: string, status: CtViagemStatus): CtOrdemMotorista =>
  ({
    id,
    codigo: id,
    status,
    paradas: [],
    cargas: [],
    dataPrevistaSaida: null,
    motoristaId: null,
    motoristaNome: null,
    placaTransportador: null,
    origemCentroCusto: null,
    origemEndereco: null,
    rotaGeometria: null,
  }) as unknown as CtOrdemMotorista;

describe("montarMotivoCancelamento", () => {
  it("usa só o motivo quando não há detalhes", () => {
    expect(montarMotivoCancelamento("Obra impedida", "", "")).toBe("Obra impedida");
  });

  it("compõe motivo + descrição + observação de forma determinística", () => {
    expect(
      montarMotivoCancelamento("Condições climáticas", "fortes chuvas", "retomar na segunda"),
    ).toBe("Condições climáticas — fortes chuvas | retomar na segunda");
  });
});

describe("filtro operacional das movimentações", () => {
  const lista = [mov("A", "PROGRAMADA"), mov("B", "CANCELADA")];

  it("no filtro padrão a cancelada fica fora do conjunto ativo", () => {
    expect(filtrarMovimentacoes(lista, filtroVazio()).map((v) => v.id)).toEqual(["A"]);
  });

  it("com Status = Cancelada a movimentação aparece como histórico", () => {
    expect(
      filtrarMovimentacoes(lista, { ...filtroVazio(), status: "CANCELADA" }).map((v) => v.id),
    ).toEqual(["B"]);
  });
});
