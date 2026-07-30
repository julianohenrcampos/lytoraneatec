/**
 * CT-2.2 — Testes do estado efetivo: badges, gate do adapter e chunking do service.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  badgeDoEstadoEfetivo,
  ESTADOS_BLOQUEANTES,
} from "@/utils/central-transporte/estadoEfetivoBadges";
import { toCandidateSelection } from "@/utils/central-transporte/ctCandidateAdapter";
import type { CtEstadoEfetivoAtivo } from "@/types/centralTransporteEstadoEfetivo";
import { CT_ESTADO_EFETIVO_MAX_IDS } from "@/types/centralTransporteEstadoEfetivo";

const rpcMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}));

const estado = (over: Partial<CtEstadoEfetivoAtivo> = {}): CtEstadoEfetivoAtivo => ({
  equipamentoId: "e1",
  centroCustoId: null,
  condicaoOperacional: "DISPONIVEL",
  possuiRegistroOperacional: true,
  previsaoLiberacao: null,
  compromissoAtivo: "LIVRE",
  compromissoAtual: null,
  proximoCompromisso: null,
  quantidadeCompromissosFuturos: 0,
  compromissosNaJanela: [],
  quantidadeCompromissosNaJanela: 0,
  possuiAnomaliaSobreposicao: false,
  periodoComprometido: null,
  atendimentoId: null,
  solicitacaoId: null,
  solicitacaoItemId: null,
  estadoLogistico: "SEM_MOVIMENTACAO",
  estadoExibicao: "DISPONIVEL",
  alertas: [],
  bloqueios: [],
  origemDecisao: "CT2_2",
  ...over,
});

const ativo = (over: Record<string, unknown> = {}) =>
  ({
    equipamento_id: "e1",
    frota: "LY",
    numero_frota: "C001",
    placa: "ABC1D23",
    empresa: null,
    propriedade: "PROPRIO",
    capacidade_valor: 10,
    capacidade_unidade: "TON",
    centro_custo_codigo: null,
    centro_custo_nome: null,
    status_operacional: "DISPONIVEL",
    previsao_liberacao: null,
    compatibilidade: "EXATA",
    possui_registro_disponibilidade: true,
    possui_centro_custo_atual: true,
    ja_no_centro_custo_destino: false,
    situacao_cadastral: "Ativo",
    conflito_cadastral: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fixture parcial
    ...over,
  }) as any;

describe("CT-2.2 — badges de estado efetivo", () => {
  it("ativo livre e disponível aparece como Disponível e não bloqueia", () => {
    const b = badgeDoEstadoEfetivo(estado());
    expect(b.label).toBe("Disponível");
    expect(b.bloqueiaOperacao).toBe(false);
  });

  it("reservado nunca é exibido como livre", () => {
    const b = badgeDoEstadoEfetivo(
      estado({ compromissoAtivo: "RESERVADO", estadoExibicao: "COMPROMETIDO" }),
    );
    expect(b.label).toBe("Reservado");
    expect(b.bloqueiaOperacao).toBe(true);
  });

  it("em transporte e entregue também bloqueiam", () => {
    expect(badgeDoEstadoEfetivo(estado({ compromissoAtivo: "EM_TRANSPORTE" })).bloqueiaOperacao).toBe(true);
    expect(badgeDoEstadoEfetivo(estado({ compromissoAtivo: "ENTREGUE" })).bloqueiaOperacao).toBe(true);
  });

  it("sobreposição entre compromissos gera conflito operacional bloqueante", () => {
    const b = badgeDoEstadoEfetivo(estado({ possuiAnomaliaSobreposicao: true }));
    expect(b.tom).toBe("conflito");
    expect(b.bloqueiaOperacao).toBe(true);
  });

  it("ausência de registro operacional é fail-closed", () => {
    const b = badgeDoEstadoEfetivo(estado({ possuiRegistroOperacional: false }));
    expect(b.label).toContain("Sem status");
    expect(b.bloqueiaOperacao).toBe(true);
  });

  it("janela solicitada comprometida bloqueia mesmo sem compromisso corrente", () => {
    const b = badgeDoEstadoEfetivo(estado({ quantidadeCompromissosNaJanela: 2 }));
    expect(b.bloqueiaOperacao).toBe(true);
  });

  it("compromisso futuro fora da janela apenas informa", () => {
    const b = badgeDoEstadoEfetivo(estado({ quantidadeCompromissosFuturos: 1 }));
    expect(b.bloqueiaOperacao).toBe(false);
    expect(b.detalhe).toContain("futuro");
  });

  it("estado ausente é neutro", () => {
    expect(badgeDoEstadoEfetivo(null).tom).toBe("neutro");
  });

  it("estados bloqueantes cobrem indisponível e conflito", () => {
    expect(ESTADOS_BLOQUEANTES.has("INDISPONIVEL_PARA_ATENDIMENTO")).toBe(true);
    expect(ESTADOS_BLOQUEANTES.has("CONFLITO_OPERACIONAL")).toBe(true);
    expect(ESTADOS_BLOQUEANTES.has("DISPONIVEL")).toBe(false);
  });
});

describe("CT-2.2 — adapter de candidato", () => {
  it("sem estado efetivo o comportamento anterior é preservado", () => {
    const c = toCandidateSelection(ativo(), "PROPRIA");
    expect(c?.permiteInterno).toBe(true);
    expect(c?.compromissoBloqueia).toBe(false);
  });

  it("ativo reservado perde permiteInterno e permiteReservaFutura", () => {
    const c = toCandidateSelection(
      ativo({ previsao_liberacao: "2026-08-01" }),
      "PROPRIA",
      estado({ compromissoAtivo: "RESERVADO" }),
    );
    expect(c?.permiteInterno).toBe(false);
    expect(c?.permiteReservaFutura).toBe(false);
    expect(c?.compromissoBloqueia).toBe(true);
    expect(c?.compromissoAtivo).toBe("RESERVADO");
  });

  it("conflito múltiplo bloqueia e propaga anomalia", () => {
    const c = toCandidateSelection(
      ativo(),
      "GRUPO",
      estado({ compromissoAtivo: "CONFLITO_MULTIPLO", possuiAnomaliaSobreposicao: true }),
    );
    expect(c?.compromissoBloqueia).toBe(true);
    expect(c?.possuiAnomaliaSobreposicao).toBe(true);
  });

  it("ativo livre com estado efetivo mantém operação liberada", () => {
    const c = toCandidateSelection(ativo(), "PROPRIA", estado());
    expect(c?.permiteInterno).toBe(true);
    expect(c?.compromissoBloqueia).toBe(false);
  });

  it("sem equipamento_id retorna null", () => {
    expect(toCandidateSelection(ativo({ equipamento_id: null }), "PROPRIA")).toBeNull();
  });
});

describe("CT-2.2 — service em lote", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: { itens: [] }, error: null });
  });

  const carregar = async () =>
    (await import("@/services/centralTransporteEstadoEfetivoService")).fetchEstadoEfetivoAtivos;

  it("lista vazia não chama a RPC", async () => {
    const fn = await carregar();
    const r = await fn({ equipamentoIds: [] });
    expect(r.size).toBe(0);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("deduplica IDs antes de enviar", async () => {
    const fn = await carregar();
    await fn({ equipamentoIds: ["a", "a", "b"] });
    expect(rpcMock.mock.calls[0][1].p_equipamento_ids).toEqual(["a", "b"]);
  });

  it("respeita o limite de 500 IDs por chamada", async () => {
    const fn = await carregar();
    const ids = Array.from({ length: CT_ESTADO_EFETIVO_MAX_IDS + 10 }, (_, i) => `id-${i}`);
    await fn({ equipamentoIds: ids });
    expect(rpcMock).toHaveBeenCalledTimes(2);
    expect(rpcMock.mock.calls[0][1].p_equipamento_ids).toHaveLength(CT_ESTADO_EFETIVO_MAX_IDS);
    expect(rpcMock.mock.calls[1][1].p_equipamento_ids).toHaveLength(10);
  });

  it("mapeia o retorno da RPC para o contrato da UI", async () => {
    rpcMock.mockResolvedValue({
      data: {
        itens: [
          {
            equipamento_id: "e1",
            condicao_operacional: "DISPONIVEL",
            possui_registro_operacional: true,
            compromisso_ativo: "RESERVADO",
            compromisso_atual: { atendimento_id: "at1", status: "RESERVADO" },
            periodo_comprometido: { inicio: "2026-08-01", fim: "2026-08-05" },
            estado_exibicao: "COMPROMETIDO",
            quantidade_compromissos_na_janela: 1,
          },
        ],
      },
      error: null,
    });
    const fn = await carregar();
    const mapa = await fn({ equipamentoIds: ["e1"] });
    const item = mapa.get("e1");
    expect(item?.compromissoAtivo).toBe("RESERVADO");
    expect(item?.compromissoAtual?.atendimentoId).toBe("at1");
    expect(item?.periodoComprometido?.fim).toBe("2026-08-05");
    expect(item?.estadoLogistico).toBe("SEM_MOVIMENTACAO");
  });

  it("propaga erro da RPC", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "denied" } });
    const fn = await carregar();
    await expect(fn({ equipamentoIds: ["e1"] })).rejects.toBeTruthy();
  });
});
