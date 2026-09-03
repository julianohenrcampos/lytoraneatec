import { describe, it, expect } from "vitest";
import { criarCabecalhoDefault } from "@/types/relatorioAps";
import {
  aplicarCarimboNoCabecalho,
  extrairCarimboDoCabecalho,
  extrairCarimboDoRow,
  isCarimboDirty,
  limparCarimboDoCabecalho,
} from "@/lib/relatorio-aps/montarCabecalhoRelatorioAps";
import type { RelatorioApsCarimboRow } from "@/types/relatorioApsCarimbo";

const carimbo = {
  obra: "Obra A",
  empresa: "LYT",
  cliente: "Prefeitura X",
  bairro: "Centro",
  revisao: "02",
  observacoes: "Aplicação padrão da obra A",
};

const cabInicial = () => ({
  ...criarCabecalhoDefault(),
  rua: "Rua das Palmeiras",
  observacoes: "Aplicação a noite",
  pesoEspecificoPadrao: 2.5,
});

describe("montarCabecalhoRelatorioAps", () => {
  it("aplicar carimbo substitui os 6 campos administrativos", () => {
    const r = aplicarCarimboNoCabecalho(cabInicial(), carimbo);
    expect({
      obra: r.obra,
      empresa: r.empresa,
      cliente: r.cliente,
      bairro: r.bairro,
      revisao: r.revisao,
      observacoes: r.observacoes,
    }).toEqual(carimbo);
  });

  it("aplicar carimbo NÃO altera Rua (Rua é dinâmica, vem do filtro)", () => {
    const cab = cabInicial();
    const r = aplicarCarimboNoCabecalho(cab, carimbo);
    expect(r.rua).toBe("Rua das Palmeiras");
  });

  it("aplicar carimbo preserva peso e demais campos não administrativos", () => {
    const r = aplicarCarimboNoCabecalho(cabInicial(), carimbo);
    expect(r.pesoEspecificoPadrao).toBe(2.5);
  });

  it("limpar carimbo limpa os 6 campos, preserva Rua e peso", () => {
    const cab = aplicarCarimboNoCabecalho(cabInicial(), carimbo);
    const r = limparCarimboDoCabecalho(cab);
    expect(r.obra).toBe("");
    expect(r.observacoes).toBe("");
    expect(r.revisao).toBe("00");
    expect(r.rua).toBe("Rua das Palmeiras");
    expect(r.pesoEspecificoPadrao).toBe(2.5);
  });

  it("isCarimboDirty falso quando snapshot bate com cabeçalho", () => {
    const cab = aplicarCarimboNoCabecalho(cabInicial(), carimbo);
    expect(isCarimboDirty(cab, carimbo)).toBe(false);
  });

  it("isCarimboDirty verdadeiro ao editar qualquer um dos 6 campos administrativos", () => {
    const cab = aplicarCarimboNoCabecalho(cabInicial(), carimbo);
    expect(isCarimboDirty({ ...cab, cliente: "Outro" }, carimbo)).toBe(true);
    expect(isCarimboDirty({ ...cab, observacoes: "x" }, carimbo)).toBe(true);
  });

  it("isCarimboDirty NÃO reage a mudanças em Rua (Rua não faz parte do carimbo)", () => {
    const cab = aplicarCarimboNoCabecalho(cabInicial(), carimbo);
    expect(isCarimboDirty({ ...cab, rua: "Outra rua" }, carimbo)).toBe(false);
  });

  it("extrairCarimboDoRow trata null como string vazia (6 campos)", () => {
    const row: RelatorioApsCarimboRow = {
      id: "x",
      nome: "n",
      centro_custo_id: null as unknown as string,
      padrao_centro_custo: false,
      obra: null as unknown as string,
      empresa: null as unknown as string,
      cliente: null as unknown as string,
      bairro: null as unknown as string,
      revisao: "00",
      observacoes: null as unknown as string,
      ativo: true,
      created_by: "u",
      updated_by: null as unknown as string,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    expect(extrairCarimboDoRow(row)).toEqual({
      obra: "",
      empresa: "",
      cliente: "",
      bairro: "",
      revisao: "00",
      observacoes: "",
    });
  });

  it("extrairCarimboDoCabecalho devolve os 6 campos", () => {
    const cab = aplicarCarimboNoCabecalho(cabInicial(), carimbo);
    expect(extrairCarimboDoCabecalho(cab)).toEqual(carimbo);
  });
});

