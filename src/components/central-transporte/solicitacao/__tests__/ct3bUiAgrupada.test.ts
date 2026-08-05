/**
 * CT-3B / UI agrupada — testes de apresentação e navegação.
 *
 * Cobre: segmentos de progresso derivados apenas da RPC, sanitização do state
 * de retorno com filtros e coerência dos rótulos de progresso.
 */
import { describe, expect, it } from "vitest";
import {
  progressoDoItem,
  segmentosProgresso,
  PROGRESSO_LABELS,
} from "@/components/central-transporte/solicitacao/itemDisplay";
import {
  criarStateDeRetorno,
  lerFiltrosDoState,
} from "@/utils/central-transporte/centralReturnState";
import type { CtContadores } from "@/types/centralTransporteCT2";

const contadores = (p: Partial<CtContadores>): CtContadores => ({
  pendentes: 0,
  comprometidos: 0,
  reservado: 0,
  em_transporte: 0,
  entregue: 0,
  cancelado: 0,
  liberado: 0,
  historico: 0,
  ...(p as CtContadores),
});

describe("segmentosProgresso", () => {
  it("retorna vazio quando os contadores não foram consultados", () => {
    expect(segmentosProgresso(3, null)).toEqual([]);
  });

  it("calcula percentuais sobre a quantidade solicitada", () => {
    const segs = segmentosProgresso(4, contadores({ entregue: 1, reservado: 1, pendentes: 2 }));
    const mapa = Object.fromEntries(segs.map((s) => [s.key, s.percentual]));
    expect(mapa.entregue).toBe(25);
    expect(mapa.reservado).toBe(25);
    expect(mapa.pendentes).toBe(50);
    expect(mapa.em_transporte).toBe(0);
  });

  it("nunca excede 100% por segmento", () => {
    const segs = segmentosProgresso(1, contadores({ entregue: 5 }));
    expect(segs.find((s) => s.key === "entregue")?.percentual).toBe(100);
  });

  it("não divide por zero quando a quantidade é zero", () => {
    const segs = segmentosProgresso(0, contadores({ reservado: 2 }));
    expect(segs.every((s) => s.percentual === 0)).toBe(true);
  });

  it("mantém os valores exatamente como vieram da RPC", () => {
    const segs = segmentosProgresso(4, contadores({ em_transporte: 3 }));
    expect(segs.find((s) => s.key === "em_transporte")?.value).toBe(3);
  });
});

describe("progressoDoItem — coerência com a barra", () => {
  it("SEM_DADOS quando não há contadores", () => {
    expect(PROGRESSO_LABELS[progressoDoItem(2, null)]).toBe("—");
  });

  it("ATENDIDO quando entregues cobrem a quantidade", () => {
    expect(progressoDoItem(2, contadores({ entregue: 2 }))).toBe("ATENDIDO");
  });

  it("EM_TRANSPORTE tem precedência sobre parcial", () => {
    expect(progressoDoItem(3, contadores({ em_transporte: 1, comprometidos: 1, pendentes: 2 }))).toBe(
      "EM_TRANSPORTE",
    );
  });

  it("PLANEJADO quando não há pendentes e há comprometidos", () => {
    expect(progressoDoItem(2, contadores({ comprometidos: 2, reservado: 2 }))).toBe("PLANEJADO");
  });

  it("PENDENTE quando nada foi comprometido", () => {
    expect(progressoDoItem(2, contadores({ pendentes: 2 }))).toBe("PENDENTE");
  });
});

describe("state de retorno à Central", () => {
  it("ida e volta preserva os filtros", () => {
    const filtros = { centro_custo_id: "cc-1", prioridade: "ALTA" };
    expect(lerFiltrosDoState(criarStateDeRetorno(filtros))).toEqual(filtros);
  });

  it("state ausente resulta em filtros vazios", () => {
    expect(lerFiltrosDoState(null)).toEqual({});
    expect(lerFiltrosDoState(undefined)).toEqual({});
  });

  it("ignora chaves desconhecidas e valores não string", () => {
    const sujo = { ctFilters: { centro_custo_id: "cc-9", hack: "x", prioridade: 42 } };
    expect(lerFiltrosDoState(sujo)).toEqual({ centro_custo_id: "cc-9" });
  });

  it("descarta strings vazias (filtro não aplicado)", () => {
    expect(lerFiltrosDoState({ ctFilters: { departamento_id: "" } })).toEqual({});
  });

  it("clona os filtros, sem manter referência mutável", () => {
    const filtros = { status_fluxo: "APROVADO" };
    const state = criarStateDeRetorno(filtros);
    filtros.status_fluxo = "EM_TRANSPORTE";
    expect(lerFiltrosDoState(state)).toEqual({ status_fluxo: "APROVADO" });
  });
});
