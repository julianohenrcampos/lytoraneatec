import { describe, it, expect } from "vitest";
import {
  criarChaveRelatorioRua,
  SEM_LOGRADOURO_SENTINELA,
} from "../criarChaveRelatorioRua";

describe("criarChaveRelatorioRua", () => {
  it("usa chave_normalizada como base quando disponível", () => {
    const k = criarChaveRelatorioRua({
      chaveNormalizada: "rua principal|centro|cidade x|sp",
      logradouroMapa: "Rua Principal",
      logradouroLocal: "",
    });
    expect(k.startsWith("rua principal|centro|cidade x|sp|local:")).toBe(true);
  });

  it("cai no logradouroMapa quando não há chave_normalizada", () => {
    const k = criarChaveRelatorioRua({
      chaveNormalizada: "",
      logradouroMapa: "Beco do Zé",
      logradouroLocal: "",
    });
    expect(k).toBe("beco do ze|local:");
  });

  it("usa sentinela para logradouro totalmente vazio", () => {
    const k = criarChaveRelatorioRua({
      chaveNormalizada: null,
      logradouroMapa: null,
      logradouroLocal: null,
    });
    expect(k).toBe(`${SEM_LOGRADOURO_SENTINELA}|local:`);
  });

  it("aliases locais diferentes geram chaves diferentes para mesma base", () => {
    const base = { chaveNormalizada: "rua x|bairro|cidade|uf" };
    const a = criarChaveRelatorioRua({ ...base, logradouroLocal: "Beco do João" });
    const b = criarChaveRelatorioRua({ ...base, logradouroLocal: "Beco da Maria" });
    expect(a).not.toBe(b);
  });

  it("mesma base + mesmo local (com acento/caixa/espaço) colidem intencionalmente", () => {
    const base = { chaveNormalizada: "rua x|bairro|cidade|uf" };
    const a = criarChaveRelatorioRua({ ...base, logradouroLocal: "  Beco do João  " });
    const b = criarChaveRelatorioRua({ ...base, logradouroLocal: "beco do joao" });
    expect(a).toBe(b);
  });

  it("bairros diferentes NÃO colidem (chave_normalizada distinta)", () => {
    const a = criarChaveRelatorioRua({
      chaveNormalizada: "rua x|centro|cidade|uf",
      logradouroLocal: "",
    });
    const b = criarChaveRelatorioRua({
      chaveNormalizada: "rua x|vila nova|cidade|uf",
      logradouroLocal: "",
    });
    expect(a).not.toBe(b);
  });

  it("sem chave_normalizada + mapas iguais + bairros diferentes SIM colidem — limitação conhecida", () => {
    // Documenta que o fallback puro por logradouroMapa não separa bairros.
    // A separação real depende de chave_normalizada persistida no banco.
    const a = criarChaveRelatorioRua({ logradouroMapa: "Rua X", logradouroLocal: "" });
    const b = criarChaveRelatorioRua({ logradouroMapa: "Rua X", logradouroLocal: "" });
    expect(a).toBe(b);
  });
});
