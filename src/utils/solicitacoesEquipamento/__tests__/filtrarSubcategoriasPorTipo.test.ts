import { describe, it, expect } from "vitest";
import {
  filtrarSubcategoriasPorTipo,
  pertenceAoTipo,
  type SubcategoriaOption,
} from "../filtrarSubcategoriasPorTipo";

const OPTS: SubcategoriaOption[] = [
  { value: "1", label: "CAMINHÃO BASCULANTE", categoriaNome: "VEICULO" },
  { value: "2", label: "CAMINHÃO BAÚ", categoriaNome: "VEICULO" },
  { value: "3", label: "ESCAVADEIRA HIDRÁULICA", categoriaNome: "EQUIPAMENTO" },
  { value: "4", label: "ROLO COMPACTADOR", categoriaNome: "EQUIPAMENTO" },
  { value: "5", label: "SEM VÍNCULO", categoriaNome: null },
];

describe("pertenceAoTipo", () => {
  it("classifica por categoria", () => {
    expect(pertenceAoTipo("VEICULO", "VEICULO")).toBe(true);
    expect(pertenceAoTipo("VEICULO", "EQUIPAMENTO")).toBe(false);
    expect(pertenceAoTipo("EQUIPAMENTO", "EQUIPAMENTO")).toBe(true);
  });
  it("sem categoria não esconde", () => {
    expect(pertenceAoTipo(null, "VEICULO")).toBe(true);
    expect(pertenceAoTipo("", "EQUIPAMENTO")).toBe(true);
  });
});

describe("filtrarSubcategoriasPorTipo", () => {
  it("EQUIPAMENTO não retorna subcategorias de veículo", () => {
    const r = filtrarSubcategoriasPorTipo(OPTS, "EQUIPAMENTO");
    expect(r.map((o) => o.value)).toEqual(["3", "4", "5"]);
  });

  it("VEICULO retorna somente veículos (mais os sem vínculo)", () => {
    const r = filtrarSubcategoriasPorTipo(OPTS, "VEICULO");
    expect(r.map((o) => o.value)).toEqual(["1", "2", "5"]);
  });

  it("combina com categoriaMatch", () => {
    const r = filtrarSubcategoriasPorTipo(OPTS, "VEICULO", ["caminhao"]);
    expect(r.map((o) => o.value)).toEqual(["1", "2"]);
  });

  it("categoriaMatch sem resultado cai no filtro por tipo", () => {
    const r = filtrarSubcategoriasPorTipo(OPTS, "EQUIPAMENTO", ["caminhao"]);
    expect(r.map((o) => o.value)).toEqual(["3", "4", "5"]);
  });
});
