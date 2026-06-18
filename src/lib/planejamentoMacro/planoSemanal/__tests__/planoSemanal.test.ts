import { describe, it, expect } from "vitest";
import { calcularSemanaDaData } from "../calcularSemana";
import { filtrarAtividadesDaSemana } from "../filtrarAtividadesDaSemana";
import { calcularDemandaMO } from "../calcularDemandaMO";
import { consolidarMateriais } from "../consolidarMateriais";
import type { AtividadeBruta, RecursoBruto } from "../tipos";

function ativ(over: Partial<AtividadeBruta>): AtividadeBruta {
  return {
    id: "a1",
    planejamento_id: "p",
    codigo_wbs: null,
    outline_number: null,
    outline_level: null,
    nome: "Atividade",
    frente_servico: null,
    data_inicio: "2026-07-13",
    data_fim: "2026-07-17",
    status: "planejada",
    is_marco: false,
    is_resumo: false,
    duracao_horas: 40,
    quantidade_prevista: null,
    unidade: null,
    ...over,
  };
}

function rec(over: Partial<RecursoBruto>): RecursoBruto {
  return {
    id: "r1",
    planejamento_id: "p",
    atividade_id: "a1",
    tipo_recurso: "mao_obra",
    funcao_id: null,
    descricao: "OPERADOR DE ESCAVADEIRA",
    unidade: null,
    quantidade_prevista: 0,
    horas_previstas: null,
    data_necessaria_inicio: null,
    data_necessaria_fim: null,
    grupo: null,
    familia: null,
    ...over,
  };
}

describe("calcularSemanaDaData", () => {
  it("retorna segunda a domingo", () => {
    const s = calcularSemanaDaData("2026-07-15"); // quarta
    expect(s.inicio).toBe("2026-07-13");
    expect(s.fim).toBe("2026-07-19");
    expect(s.diasUteis.length).toBe(5);
  });
});

describe("filtrarAtividadesDaSemana", () => {
  it("exclui resumos e canceladas; mantém marcos (7A)", () => {
    const semana = calcularSemanaDaData("2026-07-15");
    const atividades = [
      ativ({ id: "a1" }),
      ativ({ id: "a2", is_marco: true, duracao_horas: 0 }),
      ativ({ id: "a3", is_resumo: true }),
      ativ({ id: "a4", status: "cancelada" }),
      ativ({ id: "a5", data_inicio: "2026-08-01", data_fim: "2026-08-10" }),
    ];
    const r = filtrarAtividadesDaSemana(atividades, semana);
    expect(r.map((x) => x.atividade.id).sort()).toEqual(["a1", "a2"]);
  });

  it("recorta atividade longa para janela da semana", () => {
    const semana = calcularSemanaDaData("2026-07-20");
    const a = ativ({ data_inicio: "2026-07-14", data_fim: "2027-03-18" });
    const r = filtrarAtividadesDaSemana([a], semana);
    expect(r[0].inicioNaSemana).toBe("2026-07-20");
    expect(r[0].fimNaSemana).toBe("2026-07-26");
    expect(r[0].diasUteisNaSemana).toBe(5);
  });
});

describe("calcularDemandaMO", () => {
  it("160h na semana ⇒ qtdEquivalente=4 e qtdSugerida=4", () => {
    const semana = calcularSemanaDaData("2026-07-15");
    const a = ativ({}); // 13-17/07, 5 dias úteis
    const recursos = [
      rec({ id: "r1", horas_previstas: 40 }),
      rec({ id: "r2", horas_previstas: 40 }),
      rec({ id: "r3", horas_previstas: 40 }),
      rec({ id: "r4", horas_previstas: 40 }),
    ];
    const res = calcularDemandaMO(recursos, new Map([[a.id, a]]), semana);
    expect(res.linhas.length).toBe(1);
    const linha = res.linhas[0];
    expect(linha.horasSemana).toBeCloseTo(160, 1);
    expect(linha.qtdEquivalente).toBeCloseTo(4, 2);
    expect(linha.qtdSugerida).toBe(4);
  });

  it("recurso sem horas e sem quantidade gera pendência", () => {
    const semana = calcularSemanaDaData("2026-07-15");
    const a = ativ({});
    const recursos = [rec({ horas_previstas: null, quantidade_prevista: 0 })];
    const res = calcularDemandaMO(recursos, new Map([[a.id, a]]), semana);
    expect(res.linhas.length).toBe(0);
    expect(res.pendencias.some((p) => p.tipo === "recurso_sem_horas")).toBe(true);
  });
});

describe("consolidarMateriais", () => {
  it("não soma unidades diferentes e gera pendência de unidade", () => {
    const semana = calcularSemanaDaData("2026-07-15");
    const a = ativ({});
    const recursos = [
      rec({
        id: "m1",
        tipo_recurso: "material",
        descricao: "CIMENTO",
        unidade: "kg",
        quantidade_prevista: 100,
      }),
      rec({
        id: "m2",
        tipo_recurso: "material",
        descricao: "CIMENTO",
        unidade: "t",
        quantidade_prevista: 1,
      }),
    ];
    const res = consolidarMateriais(recursos, new Map([[a.id, a]]), semana);
    expect(res.linhas.length).toBe(2);
    expect(res.linhas.every((l) => l.unidadesDivergentes)).toBe(true);
    expect(res.pendencias.some((p) => p.tipo === "unidade_divergente")).toBe(true);
  });
});
