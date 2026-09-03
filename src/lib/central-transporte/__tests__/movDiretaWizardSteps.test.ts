import { describe, expect, it } from "vitest";
import { rascunhoVazio, paradaVazia } from "../movDiretaRascunho";
import {
  ETAPAS,
  errosEtapaOrigem,
  errosEtapaParadas,
  indiceEtapa,
} from "../movDiretaWizardSteps";

describe("movDiretaWizardSteps", () => {
  it("tem três etapas na ordem Origem → Paradas → Revisão", () => {
    expect(ETAPAS.map((e) => e.id)).toEqual(["ORIGEM", "PARADAS", "REVISAO"]);
    expect(indiceEtapa("REVISAO")).toBe(2);
  });

  it("acusa pendências da origem em rascunho vazio", () => {
    const erros = errosEtapaOrigem(rascunhoVazio());
    expect(erros.length).toBeGreaterThan(0);
    expect(erros.some((e) => e.includes("data prevista"))).toBe(true);
  });

  it("origem completa não tem erros", () => {
    const r = {
      ...rascunhoVazio(),
      dataPrevistaSaida: "2026-08-21",
      origemCentroCustoId: "cc-1",
      modalidade: "RODANTE" as const,
      motoristaId: "m-1",
    };
    expect(errosEtapaOrigem(r)).toEqual([]);
  });

  it("paradas exigem centro de custo e ativos", () => {
    const erros = errosEtapaParadas(rascunhoVazio());
    expect(erros.some((e) => e.includes("centro de custo"))).toBe(true);
    expect(erros.some((e) => e.includes("ativos entregues"))).toBe(true);
  });

  it("parada preenchida com ativo é válida", () => {
    const p = { ...paradaVazia(), centroCustoId: "cc-2", equipamentos: ["eq-1"] };
    const r = { ...rascunhoVazio(), paradas: [p], ativosPlanejados: ["eq-1"] };
    expect(errosEtapaParadas(r)).toEqual([]);
  });
});
