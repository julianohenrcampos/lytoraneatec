/**
 * T24–T27 — Critérios de filtro (atendimento preferencial) e busca (CHI/SOL/CC).
 *
 * O filtro de atendimento preferencial NUNCA se confunde com o departamento do
 * centro de custo solicitante, e "Avaliar disponibilidade" é exatamente IS NULL.
 */
import { describe, expect, it } from "vitest";
import {
  SEM_PREFERENCIA,
  filtrarPorBusca,
  montarCriterioPreferencia,
} from "../filtroCentralTransporte";

const DEP_TRANSPORTE = "11111111-1111-1111-1111-111111111111";
const DEP_ASFALTO = "22222222-2222-2222-2222-222222222222";

describe("T24/T25/T26 — critério de atendimento preferencial", () => {
  it("T24 — Transporte filtra pelo UUID real do departamento", () => {
    expect(montarCriterioPreferencia(DEP_TRANSPORTE)).toEqual({
      tipo: "EQ",
      departamentoId: DEP_TRANSPORTE,
    });
  });

  it("T25 — Asfalto filtra pelo UUID real do departamento", () => {
    expect(montarCriterioPreferencia(DEP_ASFALTO)).toEqual({
      tipo: "EQ",
      departamentoId: DEP_ASFALTO,
    });
  });

  it("T26 — Avaliar disponibilidade significa IS NULL (nunca 'A_DEFINIR')", () => {
    expect(montarCriterioPreferencia(SEM_PREFERENCIA)).toEqual({ tipo: "IS_NULL" });
  });

  it("sem seleção não restringe a consulta", () => {
    expect(montarCriterioPreferencia("all")).toEqual({ tipo: "TODOS" });
    expect(montarCriterioPreferencia(undefined)).toEqual({ tipo: "TODOS" });
  });
});

describe("T27 — busca da Central", () => {
  const linhas = [
    {
      id: "a1b2c3d4-0000-0000-0000-000000000000",
      chamado_protocolo: "CHI-2026-000123",
      codigo_centro_custo: "L448",
      nome_centro_custo: "Obra Ipanema",
    },
    {
      id: "ffffffff-0000-0000-0000-000000000000",
      chamado_protocolo: null, // SOL legada, sem CHI
      codigo_centro_custo: "L123",
      nome_centro_custo: "Obra Guarujá",
    },
  ];

  it("T27 — encontra pelo protocolo CHI", () => {
    expect(filtrarPorBusca(linhas, "CHI-2026-000123").map((l) => l.id)).toEqual([linhas[0].id]);
    expect(filtrarPorBusca(linhas, "000123")).toHaveLength(1);
  });

  it("T27-B — encontra pelo protocolo SOL derivado do id", () => {
    expect(filtrarPorBusca(linhas, "SOL-A1B2C3D4").map((l) => l.id)).toEqual([linhas[0].id]);
    expect(filtrarPorBusca(linhas, "a1b2c3d4")).toHaveLength(1);
  });

  it("encontra por código e nome do centro de custo, ignorando acento", () => {
    expect(filtrarPorBusca(linhas, "L123").map((l) => l.id)).toEqual([linhas[1].id]);
    expect(filtrarPorBusca(linhas, "guaruja").map((l) => l.id)).toEqual([linhas[1].id]);
  });

  it("T28 — SOL legada sem CHI continua visível e pesquisável", () => {
    expect(filtrarPorBusca(linhas, "")).toHaveLength(2);
    expect(filtrarPorBusca(linhas, "SOL-FFFFFFFF")).toHaveLength(1);
  });
});
