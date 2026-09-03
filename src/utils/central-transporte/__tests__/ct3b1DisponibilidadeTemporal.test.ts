/**
 * CT-3B.1 — Contrato temporal de disponibilidade e filtros de estado.
 *
 * Regras verificadas:
 *  - `data_inicio` e `previsao_liberacao` permanecem campos distintos;
 *  - rótulos são apenas apresentação (não autorizam nem bloqueiam);
 *  - ELEGIVEL é fail-closed e deriva do estado efetivo (servidor);
 *  - o universo filtrado é o conjunto compatível carregado.
 */
import { describe, it, expect } from "vitest";
import {
  AVISO_VIGENCIA_FUTURA,
  LABEL_DISPONIVEL_A_PARTIR,
  LABEL_DISPONIVEL_DESDE,
  LABEL_PREVISAO_LIBERACAO,
  LABEL_VIGENTE_DESDE,
  disponivelFuturamente,
  liberacaoPrevista,
  rotuloDataInicio,
} from "../disponibilidadeTemporal";
import {
  FILTROS_ESTADO_ORDEM,
  FILTRO_ESTADO_LABELS,
  filtrarPorEstado,
  type FiltroEstadoAtivo,
} from "../filtrosEstadoAtivo";
import type { AtivoAnalise } from "@/services/centralTransporteService";
import type { CtEstadoEfetivoAtivo, CtEstadoEfetivoMap } from "@/types/centralTransporteEstadoEfetivo";

const REF = "2026-07-20";

const ativo = (over: Partial<AtivoAnalise> & { equipamento_id: string }): AtivoAnalise =>
  ({
    equipamento_id: over.equipamento_id,
    status_operacional: "DISPONIVEL",
    previsao_liberacao: null,
    data_inicio_disponibilidade: null,
    possui_registro_disponibilidade: true,
    possui_centro_custo_atual: true,
    ja_no_centro_custo_destino: false,
    conflito_cadastral: false,
    compatibilidade: "EXATA",
    ...over,
  }) as unknown as AtivoAnalise;

const estado = (over: Partial<CtEstadoEfetivoAtivo>): CtEstadoEfetivoAtivo =>
  ({
    equipamentoId: "x",
    compromissoAtual: null,
    compromissoAtivo: null,
    estadoExibicao: "DISPONIVEL",
    possuiRegistroOperacional: true,
    quantidadeCompromissosFuturos: 0,
    possuiAnomaliaSobreposicao: false,
    possuiCompromissoVencidoAtivo: false,
    compromissosNaJanela: [],
    ...over,
  }) as unknown as CtEstadoEfetivoAtivo;

const mapa = (pares: [string, CtEstadoEfetivoAtivo][]): CtEstadoEfetivoMap =>
  new Map(pares) as CtEstadoEfetivoMap;

describe("CT-3B.1 — rótulos temporais", () => {
  it("usa 'Disponível desde' quando a vigência já começou", () => {
    expect(rotuloDataInicio("DISPONIVEL", "2026-07-01", REF)).toEqual({
      label: LABEL_DISPONIVEL_DESDE,
      vigenciaFutura: false,
    });
  });

  it("usa 'Disponível a partir de' quando a vigência é futura", () => {
    expect(rotuloDataInicio("DISPONIVEL", "2026-08-01", REF)).toEqual({
      label: LABEL_DISPONIVEL_A_PARTIR,
      vigenciaFutura: true,
    });
  });

  it("usa rótulo de vigência genérico para status não disponíveis", () => {
    for (const s of ["ALOCADO", "MANUTENCAO", "INDISPONIVEL", "SEM_STATUS"]) {
      expect(rotuloDataInicio(s, "2026-08-01", REF).label).toBe(LABEL_VIGENTE_DESDE);
      expect(rotuloDataInicio(s, "2026-08-01", REF).vigenciaFutura).toBe(false);
    }
  });

  it("não trata data_inicio ausente como vigência futura", () => {
    expect(disponivelFuturamente("DISPONIVEL", null, REF)).toBe(false);
  });

  it("mantém previsão de liberação como campo separado e só para status não disponíveis", () => {
    expect(LABEL_PREVISAO_LIBERACAO).not.toBe(LABEL_DISPONIVEL_DESDE);
    expect(liberacaoPrevista("ALOCADO", "2026-08-10")).toBe(true);
    expect(liberacaoPrevista("MANUTENCAO", "2026-08-10")).toBe(true);
    expect(liberacaoPrevista("DISPONIVEL", "2026-08-10")).toBe(false);
    expect(liberacaoPrevista("ALOCADO", null)).toBe(false);
  });

  it("mantém o aviso de vigência futura como texto apenas informativo", () => {
    expect(AVISO_VIGENCIA_FUTURA).toMatch(/servidor/i);
  });
});

describe("CT-3B.1 — filtros de estado do universo compatível", () => {
  const rows = [
    ativo({ equipamento_id: "a", data_inicio_disponibilidade: "2026-08-01" }),
    ativo({ equipamento_id: "b", data_inicio_disponibilidade: "2026-01-01" }),
    ativo({ equipamento_id: "c", status_operacional: "ALOCADO", previsao_liberacao: "2026-08-05" }),
    ativo({ equipamento_id: "d", status_operacional: "MANUTENCAO" }),
    ativo({ equipamento_id: "e", status_operacional: "INDISPONIVEL" }),
    ativo({
      equipamento_id: "f",
      status_operacional: "SEM_STATUS",
      possui_registro_disponibilidade: false,
    }),
  ];

  it("TODOS não filtra e é rotulado como universo compatível", () => {
    expect(filtrarPorEstado(rows, "TODOS", undefined, REF)).toHaveLength(rows.length);
    expect(FILTRO_ESTADO_LABELS.TODOS).toBe("Todos os compatíveis");
  });

  it("expõe todos os filtros declarados na ordem definida", () => {
    expect(FILTROS_ESTADO_ORDEM).toHaveLength(9);
    for (const f of FILTROS_ESTADO_ORDEM) {
      expect(FILTRO_ESTADO_LABELS[f as FiltroEstadoAtivo]).toBeTruthy();
    }
  });

  it("ELEGIVEL é fail-closed sem estado consultado", () => {
    expect(filtrarPorEstado(rows, "ELEGIVEL", undefined, REF)).toHaveLength(0);
    expect(filtrarPorEstado(rows, "ELEGIVEL", mapa([]), REF)).toHaveLength(0);
  });

  it("ELEGIVEL considera apenas o que o servidor não bloqueia", () => {
    const estados = mapa([
      ["b", estado({ equipamentoId: "b", estadoExibicao: "DISPONIVEL" })],
      [
        "c",
        estado({
          equipamentoId: "c",
          estadoExibicao: "RESERVADO",
          compromissoAtual: { tipo: "RESERVADO" } as never,
          compromissoAtivo: "RESERVADO",
        }),
      ],
    ]);
    const ids = filtrarPorEstado(rows, "ELEGIVEL", estados, REF).map((r) => r.equipamento_id);
    expect(ids).toContain("b");
    expect(ids).not.toContain("c");
    expect(ids).not.toContain("a");
  });

  it("COMPROMETIDO usa o compromisso atual retornado pelo servidor", () => {
    const estados = mapa([
      [
        "c",
        estado({
          equipamentoId: "c",
          compromissoAtual: { tipo: "EM_TRANSPORTE" } as never,
        }),
      ],
      ["b", estado({ equipamentoId: "b" })],
    ]);
    expect(filtrarPorEstado(rows, "COMPROMETIDO", estados, REF).map((r) => r.equipamento_id)).toEqual(
      ["c"],
    );
  });

  it("separa disponíveis futuramente de previsão de liberação", () => {
    expect(
      filtrarPorEstado(rows, "DISPONIVEL_FUTURAMENTE", undefined, REF).map((r) => r.equipamento_id),
    ).toEqual(["a"]);
    expect(
      filtrarPorEstado(rows, "LIBERACAO_PREVISTA", undefined, REF).map((r) => r.equipamento_id),
    ).toEqual(["c"]);
  });

  it("filtra por status cadastral operacional", () => {
    expect(filtrarPorEstado(rows, "ALOCADO", undefined, REF).map((r) => r.equipamento_id)).toEqual(["c"]);
    expect(filtrarPorEstado(rows, "MANUTENCAO", undefined, REF).map((r) => r.equipamento_id)).toEqual(["d"]);
    expect(filtrarPorEstado(rows, "INDISPONIVEL", undefined, REF).map((r) => r.equipamento_id)).toEqual(["e"]);
    expect(filtrarPorEstado(rows, "SEM_STATUS", undefined, REF).map((r) => r.equipamento_id)).toEqual(["f"]);
  });
});
