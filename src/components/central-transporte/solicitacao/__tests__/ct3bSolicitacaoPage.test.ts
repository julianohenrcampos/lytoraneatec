/**
 * CT-3B — Testes do fluxo da página dedicada da solicitação.
 *
 * Cobrem: progresso derivado EXCLUSIVAMENTE dos contadores da RPC, rótulos de
 * item, etapas bloqueadas e permissões de rota.
 */
import { describe, it, expect } from "vitest";
import {
  capacidadeLabelItem,
  descricaoItem,
  progressoDoItem,
  PROGRESSO_LABELS,
} from "@/components/central-transporte/solicitacao/itemDisplay";
import { ETAPAS_BLOQUEADAS } from "@/components/central-transporte/solicitacao/CentralTransporteSolicitacaoProvider";
import { ROUTE_PERMISSIONS } from "@/constants/routePermissions";
import type { SolicitacaoItem } from "@/services/solicitacaoItensService";
import type { CtContadores } from "@/types/centralTransporteCT2";

const item = (over: Partial<SolicitacaoItem> = {}): SolicitacaoItem =>
  ({
    id: "item-1",
    solicitacao_id: "sol-1",
    tipo_item: "CATALOGO",
    catalogo_equipamento_id: null,
    item_nao_catalogado: false,
    descricao_livre: null,
    capacidade_descricao: null,
    quantidade: 2,
    com_operador: false,
    regime_trabalho: null,
    regime_personalizado: null,
    tempo_previsto_dias: null,
    observacoes: null,
    status_item: "PENDENTE",
    created_at: null,
    updated_at: null,
    subcategoria_id: null,
    capacidade_valor: null,
    capacidade_unidade: null,
    catalogo_variacao_id: null,
    ...over,
  }) as SolicitacaoItem;

const contadores = (over: Partial<CtContadores> = {}): CtContadores =>
  ({
    reservado: 0,
    em_transporte: 0,
    entregue: 0,
    comprometidos: 0,
    pendentes: 2,
    ...over,
  }) as CtContadores;

describe("CT-3B — rótulos do item", () => {
  it("usa capacidade estruturada quando disponível", () => {
    expect(capacidadeLabelItem(item({ capacidade_valor: 20, capacidade_unidade: "T" }))).toBe("20 T");
  });

  it("cai para descrição livre em item não catalogado", () => {
    expect(descricaoItem(item({ item_nao_catalogado: true, descricao_livre: "Prancha" }))).toBe(
      "Prancha",
    );
  });

  it("compõe subcategoria + capacidade", () => {
    expect(
      descricaoItem(item({ subcategoria_nome: "Escavadeira", capacidade_valor: 20, capacidade_unidade: "T" })),
    ).toBe("Escavadeira — 20 T");
  });
});

describe("CT-3B — progresso vem apenas dos contadores da RPC", () => {
  it("sem contadores não inventa progresso", () => {
    expect(progressoDoItem(2, null)).toBe("SEM_DADOS");
    expect(PROGRESSO_LABELS.SEM_DADOS).toBe("—");
  });

  it("pendente quando nada comprometido", () => {
    expect(progressoDoItem(2, contadores())).toBe("PENDENTE");
  });

  it("parcial quando há comprometidos e ainda pendentes", () => {
    expect(progressoDoItem(2, contadores({ comprometidos: 1, reservado: 1, pendentes: 1 }))).toBe(
      "PARCIAL",
    );
  });

  it("planejado quando não há pendentes e há comprometidos", () => {
    expect(progressoDoItem(2, contadores({ comprometidos: 2, reservado: 2, pendentes: 0 }))).toBe(
      "PLANEJADO",
    );
  });

  it("em transporte tem precedência sobre planejado", () => {
    expect(
      progressoDoItem(2, contadores({ comprometidos: 2, em_transporte: 1, pendentes: 0 })),
    ).toBe("EM_TRANSPORTE");
  });

  it("atendido apenas quando entregue cobre a quantidade", () => {
    expect(progressoDoItem(2, contadores({ entregue: 2, comprometidos: 2, pendentes: 0 }))).toBe(
      "ATENDIDO",
    );
    expect(progressoDoItem(2, contadores({ entregue: 1, comprometidos: 1, pendentes: 1 }))).toBe(
      "PARCIAL",
    );
  });
});

describe("CT-3B/CT-3C — etapas e rota", () => {
  it("nenhuma etapa permanece bloqueada após o CT-3C", () => {
    expect(ETAPAS_BLOQUEADAS).toEqual([]);
  });


  it("a página dedicada exige a mesma permissão da Central", () => {
    expect(ROUTE_PERMISSIONS["/gestao-maquinas/central-transporte/solicitacao"]).toEqual([
      "gestao_maquinas_central_transporte_view",
    ]);
  });
});
