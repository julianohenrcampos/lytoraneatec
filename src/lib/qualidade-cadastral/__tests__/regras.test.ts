import { describe, it, expect } from "vitest";
import {
  REGRAS,
  getRegra,
  calcularScore,
  mediaScores,
  faixaAtualizacao,
  diasSemAtualizacao,
  resolverResponsavel,
  ehDuplicidadeExata,
  ehPossivelDuplicidade,
  baseNomeFuncao,
  PENALIDADE,
} from "../regras";

describe("catálogo de regras", () => {
  it("não possui códigos duplicados", () => {
    const set = new Set(REGRAS.map((r) => r.codigo));
    expect(set.size).toBe(REGRAS.length);
  });

  it("cobre os quatro domínios", () => {
    const dominios = new Set(REGRAS.map((r) => r.dominio));
    expect(dominios).toEqual(
      new Set(["CENTRO_CUSTO", "FUNCIONARIO", "VEICULO_EQUIPAMENTO", "FUNCAO"]),
    );
  });

  it("define severidade em toda regra", () => {
    expect(REGRAS.every((r) => PENALIDADE[r.severidade] > 0)).toBe(true);
  });

  it("marca campos não aplicáveis com aplicabilidade explícita", () => {
    // Placa/RENAVAM só valem para veículos; nº de série só para não-veículos.
    expect(getRegra("VE005")?.aplicabilidade).toMatch(/veículo/i);
    expect(getRegra("VE007")?.aplicabilidade).toMatch(/veículo/i);
    expect(getRegra("VE020")?.aplicabilidade).toMatch(/não são veículos/i);
    expect(getRegra("VE008")?.aplicabilidade).toMatch(/locados/i);
  });

  it("não expõe valores sensíveis na mensagem de dados bancários", () => {
    const r = getRegra("FU010")!;
    expect(r.mensagem).toBe("Dados bancários incompletos");
    expect(r.mensagem).not.toMatch(/pix|conta|agência/i);
  });
});

describe("score", () => {
  it("registro sem pendência é 100", () => {
    expect(calcularScore([])).toBe(100);
  });

  it("penaliza fortemente crítica", () => {
    expect(calcularScore(["CRITICA"])).toBe(60);
    expect(calcularScore(["ALTA"])).toBe(80);
    expect(calcularScore(["MEDIA"])).toBe(92);
    expect(calcularScore(["BAIXA"])).toBe(97);
  });

  it("crítica + baixas não pode resultar em score alto", () => {
    const score = calcularScore(["CRITICA", "BAIXA", "BAIXA"]);
    expect(score).toBeLessThan(60);
  });

  it("nunca fica negativo", () => {
    expect(calcularScore(["CRITICA", "CRITICA", "CRITICA"])).toBe(0);
  });

  it("média de grupo", () => {
    expect(mediaScores([100, 80])).toBe(90);
    expect(mediaScores([])).toBe(100);
  });
});

describe("desatualização", () => {
  const agora = new Date("2026-08-25T12:00:00Z");

  it("calcula dias completos", () => {
    expect(diasSemAtualizacao("2026-08-20T12:00:00Z", agora)).toBe(5);
    expect(diasSemAtualizacao(null, agora)).toBeNull();
  });

  it("classifica faixas informativas", () => {
    expect(faixaAtualizacao(10)).toBe("ate_30");
    expect(faixaAtualizacao(45)).toBe("de_31_60");
    expect(faixaAtualizacao(75)).toBe("de_61_90");
    expect(faixaAtualizacao(120)).toBe("mais_90");
  });
});

describe("responsável", () => {
  it("prioriza ADM OBRA e escala para ADM SEDE", () => {
    const r = resolverResponsavel({ admObraNome: "João", admSedeNome: "Maria" });
    expect(r).toMatchObject({ nome: "João", papel: "ADM OBRA", secundario: "Maria", definido: true });
  });

  it("faz fallback para engenheiro e planejador", () => {
    expect(resolverResponsavel({ engenheiroNome: "Ana" }).papel).toBe("Engenheiro Responsável");
    expect(resolverResponsavel({ planejadorNome: "Léo" }).papel).toBe("Planejador Responsável");
  });

  it("retorna não definido quando não há vínculo real", () => {
    const r = resolverResponsavel({});
    expect(r.definido).toBe(false);
    expect(r.nome).toBeNull();
  });
});

describe("duplicidades", () => {
  it("duplicidade exata só com igualdade inequívoca", () => {
    expect(ehDuplicidadeExata("MOTORISTA", " motorista ")).toBe(true);
    expect(ehDuplicidadeExata("MOTORISTA I", "MOTORISTA")).toBe(false);
    expect(ehDuplicidadeExata("", "")).toBe(false);
  });

  it("possível duplicidade em variações de nível", () => {
    expect(ehPossivelDuplicidade("MOTORISTA I", "MOTORISTA 1")).toBe(true);
    expect(ehPossivelDuplicidade("MOTORISTA", "MOTORISTA")).toBe(false);
    expect(ehPossivelDuplicidade("MOTORISTA", "PEDREIRO")).toBe(false);
  });

  it("normaliza acentos na base do nome", () => {
    expect(baseNomeFuncao("Encarregado II")).toBe("ENCARREGADO");
    expect(baseNomeFuncao("Almoxarífe")).toBe("ALMOXARIFE");
  });
});
