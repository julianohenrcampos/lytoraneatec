/**
 * Race condition test: dado query keys segmentadas por CC, a resposta atrasada
 * de um CC anterior nunca sobrescreve a resposta do CC atual, porque o
 * consumidor lê o cache pela chave do CC atualmente selecionado.
 */
import { describe, it, expect } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { carimboKeys } from "@/hooks/relatorio-aps/useRelatorioApsCarimbos";

describe("useRelatorioApsCarimbos — race protection", () => {
  it("query key da lista muda com o centro de custo", () => {
    expect(carimboKeys.lista("cc-A")).toEqual([
      "relatorio-aps-carimbos",
      "cc-A",
    ]);
    expect(carimboKeys.lista("cc-B")).toEqual([
      "relatorio-aps-carimbos",
      "cc-B",
    ]);
    expect(carimboKeys.lista(null)).toEqual([
      "relatorio-aps-carimbos",
      "gerais",
    ]);
  });

  it("query key do padrão é por centro de custo", () => {
    expect(carimboKeys.padrao("cc-A")).toEqual([
      "relatorio-aps-carimbo-padrao",
      "cc-A",
    ]);
    expect(carimboKeys.padrao("cc-B")).toEqual([
      "relatorio-aps-carimbo-padrao",
      "cc-B",
    ]);
  });

  it("resposta atrasada do CC A não corrompe cache do CC B", () => {
    const qc = new QueryClient();
    qc.setQueryData(carimboKeys.padrao("cc-B"), { id: "carimbo-B" });
    // Chegada tardia de A grava apenas em A
    qc.setQueryData(carimboKeys.padrao("cc-A"), { id: "carimbo-A" });
    expect(qc.getQueryData(carimboKeys.padrao("cc-B"))).toEqual({
      id: "carimbo-B",
    });
    expect(qc.getQueryData(carimboKeys.padrao("cc-A"))).toEqual({
      id: "carimbo-A",
    });
  });
});
