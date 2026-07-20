import { describe, it, expect } from "vitest";
import { normalizarTextoLogradouro } from "../normalizarTextoLogradouro";
import { formatarLogradouroExibicao } from "../formatarLogradouroExibicao";

describe("normalizarTextoLogradouro", () => {
  it("retorna string vazia para null/undefined", () => {
    expect(normalizarTextoLogradouro(null)).toBe("");
    expect(normalizarTextoLogradouro(undefined)).toBe("");
  });
  it("remove acentos, baixa caixa e colapsa espaços", () => {
    expect(normalizarTextoLogradouro("  Beco  do  João ")).toBe("beco do joao");
  });
});

describe("formatarLogradouroExibicao", () => {
  it("ambos vazios -> Sem logradouro", () => {
    expect(formatarLogradouroExibicao("", "")).toBe("Sem logradouro");
    expect(formatarLogradouroExibicao(null, null)).toBe("Sem logradouro");
  });
  it("apenas mapa", () => {
    expect(formatarLogradouroExibicao("Beco do Zé", "")).toBe("Beco do Zé");
  });
  it("apenas local", () => {
    expect(formatarLogradouroExibicao("", "Beco do João")).toBe("Beco do João");
  });
  it("equivalentes -> apenas mapa", () => {
    expect(formatarLogradouroExibicao("Beco do Zé", "  beco do  ze  ")).toBe("Beco do Zé");
  });
  it("diferentes -> Mapa / Local", () => {
    expect(formatarLogradouroExibicao("Beco do Zé", "Beco do João")).toBe(
      "Beco do Zé / Beco do João",
    );
  });
});
