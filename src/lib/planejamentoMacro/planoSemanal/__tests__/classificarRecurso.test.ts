import { describe, it, expect } from "vitest";
import {
  classificarRecurso,
  isAtividadeOperacional,
  isEquipamentoOperacional,
  isMaoDeObraOperacional,
  isMaterialOperacional,
  isClasseForaDoEscopoOperacional,
} from "../classificarRecurso";
import type { AtividadeBruta, RecursoBruto } from "../tipos";
import { calcularDemandaEquipamentos } from "../calcularDemandaEquipamentos";
import { calcularSemanaDaData } from "../calcularSemana";

function rec(over: Partial<RecursoBruto>): RecursoBruto {
  return {
    id: "r1",
    planejamento_id: "p",
    atividade_id: "a1",
    tipo_recurso: "equipamento",
    funcao_id: null,
    descricao: "ESCAVADEIRA",
    unidade: "h",
    quantidade_prevista: 1,
    horas_previstas: null,
    data_necessaria_inicio: null,
    data_necessaria_fim: null,
    grupo: null,
    familia: "EQ",
    ...over,
  };
}

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

describe("classificarRecurso", () => {
  it("identifica EQ por familia normalizada", () => {
    expect(classificarRecurso(rec({ familia: " eq " }))).toBe("EQ");
  });
  it("ADM_CONTRATUAL é fora do escopo", () => {
    expect(isClasseForaDoEscopoOperacional("ADM_CONTRATUAL")).toBe(true);
    expect(isClasseForaDoEscopoOperacional("SUB")).toBe(true);
    expect(isClasseForaDoEscopoOperacional("FATURAMENTO")).toBe(true);
    expect(isClasseForaDoEscopoOperacional("ADM")).toBe(true);
  });
  it("isEquipamentoOperacional exige tipo + familia", () => {
    expect(isEquipamentoOperacional(rec({ tipo_recurso: "administrativo", familia: "EQ" }))).toBe(false);
    expect(isEquipamentoOperacional(rec({ tipo_recurso: "equipamento", familia: "FATURAMENTO" }))).toBe(false);
    expect(isEquipamentoOperacional(rec({ tipo_recurso: "equipamento", familia: "EQ" }))).toBe(true);
  });
  it("isMaoDeObraOperacional aceita MOD/MOI", () => {
    expect(isMaoDeObraOperacional(rec({ tipo_recurso: "mao_obra", familia: "MOD" }))).toBe(true);
    expect(isMaoDeObraOperacional(rec({ tipo_recurso: "mao_obra", familia: "MOI" }))).toBe(true);
    expect(isMaoDeObraOperacional(rec({ tipo_recurso: "mao_obra", familia: "ADM" }))).toBe(false);
  });
  it("isMaterialOperacional", () => {
    expect(isMaterialOperacional(rec({ tipo_recurso: "material", familia: "MAT" }))).toBe(true);
    expect(isMaterialOperacional(rec({ tipo_recurso: "equipamento", familia: "MAT" }))).toBe(false);
  });
  it("isAtividadeOperacional exclui resumo/marco/cancelada", () => {
    expect(isAtividadeOperacional(ativ({}))).toBe(true);
    expect(isAtividadeOperacional(ativ({ is_marco: true }))).toBe(false);
    expect(isAtividadeOperacional(ativ({ is_resumo: true }))).toBe(false);
    expect(isAtividadeOperacional(ativ({ status: "cancelada" }))).toBe(false);
  });
});

describe("calcularDemandaEquipamentos — Fase 7B", () => {
  it("exclui ADM_CONTRATUAL (PEDRO BARBOSA - ENG.) da aba Equipamentos", () => {
    const semana = calcularSemanaDaData("2026-07-15");
    const a = ativ({});
    const recursos = [
      rec({
        id: "r1",
        tipo_recurso: "administrativo",
        familia: "ADM_CONTRATUAL",
        descricao: "PEDRO BARBOSA - ENG.",
      }),
      rec({
        id: "r2",
        tipo_recurso: "equipamento",
        familia: "EQ",
        descricao: "ESCAVADEIRA",
      }),
    ];
    const linhas = calcularDemandaEquipamentos(recursos, new Map([[a.id, a]]), semana);
    expect(linhas.length).toBe(1);
    expect(linhas[0].descricao).toBe("ESCAVADEIRA");
    expect(linhas[0].tipo).toBe("equipamento");
  });

  it("ignora resumo e marco como base de cálculo", () => {
    const semana = calcularSemanaDaData("2026-07-15");
    const aResumo = ativ({ id: "ar", is_resumo: true });
    const aMarco = ativ({ id: "am", is_marco: true });
    const aOk = ativ({ id: "ao" });
    const recursos = [
      rec({ id: "r1", atividade_id: "ar" }),
      rec({ id: "r2", atividade_id: "am" }),
      rec({ id: "r3", atividade_id: "ao" }),
    ];
    const linhas = calcularDemandaEquipamentos(
      recursos,
      new Map([
        ["ar", aResumo],
        ["am", aMarco],
        ["ao", aOk],
      ]),
      semana
    );
    expect(linhas.length).toBe(1);
  });
});
