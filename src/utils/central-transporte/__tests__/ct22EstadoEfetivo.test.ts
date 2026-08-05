/**
 * CT-2.2 — Testes do estado efetivo: dimensões independentes, badges,
 * gate fail-closed do adapter, janela de reserva e chunking do service.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  badgeDoEstadoEfetivo,
  badgeDoCompromissoAtual,
  janelaComprometida,
  textoProximaReserva,
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
  dataInicioDisponibilidade: null,
  agenda: null,
  compromissoAtivo: "LIVRE",
  possuiCompromissoAtualOuFuturo: false,
  compromissoPrincipal: null,
  compromissoPrincipalStatus: null,
  compromissoPrincipalInicio: null,
  compromissoPrincipalFim: null,
  compromissoPrincipalVigencia: "SEM_COMPROMISSO",
  reservadoPelaCentral: false,
  compromissoAtual: null,
  proximoCompromisso: null,
  quantidadeCompromissosFuturos: 0,
  compromissosNaJanela: [],
  quantidadeCompromissosNaJanela: 0,
  possuiAnomaliaSobreposicao: false,
  possuiSobreposicaoNaJanela: false,
  possuiCompromissoVencidoAtivo: false,
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

  it("estado não consultado é fail-closed", () => {
    const b = badgeDoEstadoEfetivo(null);
    expect(b.bloqueiaOperacao).toBe(true);
  });

  it("reservado nunca é exibido como livre", () => {
    const b = badgeDoEstadoEfetivo(
      estado({ compromissoAtivo: "RESERVADO", estadoExibicao: "RESERVADO" }),
    );
    expect(b.label).toBe("Reservado");
    expect(b.bloqueiaOperacao).toBe(true);
  });

  it("em transporte bloqueia", () => {
    expect(
      badgeDoEstadoEfetivo(
        estado({ compromissoAtivo: "EM_TRANSPORTE", estadoExibicao: "EM_TRANSPORTE" }),
      ).bloqueiaOperacao,
    ).toBe(true);
  });

  it("sobreposição entre compromissos gera conflito operacional bloqueante", () => {
    const b = badgeDoEstadoEfetivo(estado({ possuiAnomaliaSobreposicao: true }));
    expect(b.tom).toBe("conflito");
    expect(b.bloqueiaOperacao).toBe(true);
  });

  it("compromisso vencido ainda ativo gera conflito operacional bloqueante", () => {
    const b = badgeDoEstadoEfetivo(estado({ possuiCompromissoVencidoAtivo: true }));
    expect(b.tom).toBe("conflito");
    expect(b.bloqueiaOperacao).toBe(true);
    expect(b.detalhe).toContain("vencido");
  });

  it("ausência de registro operacional é fail-closed", () => {
    const b = badgeDoEstadoEfetivo(
      estado({ possuiRegistroOperacional: false, estadoExibicao: "INDISPONIVEL_PARA_ATENDIMENTO" }),
    );
    expect(b.bloqueiaOperacao).toBe(true);
  });

  it("estados bloqueantes cobrem indisponível e conflito", () => {
    expect(ESTADOS_BLOQUEANTES.has("INDISPONIVEL_PARA_ATENDIMENTO")).toBe(true);
    expect(ESTADOS_BLOQUEANTES.has("CONFLITO_OPERACIONAL")).toBe(true);
    expect(ESTADOS_BLOQUEANTES.has("DISPONIVEL")).toBe(false);
  });
});

describe("CT-2.2 — dimensões independentes", () => {
  it("LYC001: operacional DISPONIVEL e compromisso RESERVADO coexistem", () => {
    const e = estado({
      condicaoOperacional: "DISPONIVEL",
      compromissoAtivo: "RESERVADO",
      estadoExibicao: "RESERVADO",
      compromissoAtual: {
        atendimentoId: "at1",
        status: "RESERVADO",
        periodoInicio: "2026-08-01",
        periodoFim: "2026-08-05",
        detalhesRestritos: false,
      } as CtEstadoEfetivoAtivo["compromissoAtual"],
    });
    expect(e.condicaoOperacional).toBe("DISPONIVEL");
    expect(badgeDoCompromissoAtual(e).label).toContain("Reservado");
    expect(badgeDoEstadoEfetivo(e).bloqueiaOperacao).toBe(true);
  });

  it("compromisso restrito não expõe identificadores", () => {
    const e = estado({
      compromissoAtivo: "RESERVADO",
      estadoExibicao: "RESERVADO",
      compromissoAtual: {
        atendimentoId: null,
        status: "RESERVADO",
        periodoInicio: null,
        periodoFim: null,
        detalhesRestritos: true,
      } as CtEstadoEfetivoAtivo["compromissoAtual"],
    });
    const b = badgeDoCompromissoAtual(e);
    expect(b.detalhe ?? "").not.toContain("at1");
  });

  it("próximo compromisso é apenas informativo", () => {
    const e = estado({
      proximoCompromisso: {
        atendimentoId: "at9",
        status: "RESERVADO",
        periodoInicio: "2026-09-01",
        periodoFim: "2026-09-03",
        detalhesRestritos: false,
      } as CtEstadoEfetivoAtivo["proximoCompromisso"],
      quantidadeCompromissosFuturos: 1,
    });
    expect(textoProximaReserva(e)).toContain("2026-09-01");
    expect(badgeDoEstadoEfetivo(e).bloqueiaOperacao).toBe(false);
  });
});

describe("CT-2.2 — janela de reserva futura", () => {
  it("sem estado consultado a janela é fail-closed", () => {
    expect(janelaComprometida(null)).toBe(true);
  });

  it("janela livre autoriza", () => {
    expect(janelaComprometida(estado())).toBe(false);
  });

  it("compromisso dentro da janela bloqueia", () => {
    expect(janelaComprometida(estado({ quantidadeCompromissosNaJanela: 1 }))).toBe(true);
  });

  it("sobreposição na janela bloqueia", () => {
    expect(janelaComprometida(estado({ possuiSobreposicaoNaJanela: true }))).toBe(true);
  });

  it("compromisso vencido ativo bloqueia a janela", () => {
    expect(janelaComprometida(estado({ possuiCompromissoVencidoAtivo: true }))).toBe(true);
  });

  it("fronteira de meia-noite: fim em D e início em D não colidem quando fora da janela", () => {
    const e = estado({ quantidadeCompromissosNaJanela: 0, possuiSobreposicaoNaJanela: false });
    expect(janelaComprometida(e)).toBe(false);
  });
});

describe("CT-2.2 — adapter de candidato", () => {
  it("sem estado efetivo consultado nada é operável (fail-closed)", () => {
    const c = toCandidateSelection(ativo(), "PROPRIA");
    expect(c?.estadoConsultado).toBe(false);
    expect(c?.permiteInterno).toBe(false);
    expect(c?.permiteReservaFutura).toBe(false);
  });

  it("ativo reservado perde permiteInterno e permiteReservaFutura", () => {
    const c = toCandidateSelection(
      ativo({ previsao_liberacao: "2026-08-01" }),
      "PROPRIA",
      estado({ compromissoAtivo: "RESERVADO", estadoExibicao: "RESERVADO" }),
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
      estado({
        compromissoAtivo: "CONFLITO_MULTIPLO",
        estadoExibicao: "CONFLITO_OPERACIONAL",
        possuiAnomaliaSobreposicao: true,
      }),
    );
    expect(c?.compromissoBloqueia).toBe(true);
    expect(c?.possuiAnomaliaSobreposicao).toBe(true);
  });

  it("compromisso vencido ativo é propagado e bloqueia", () => {
    const c = toCandidateSelection(
      ativo(),
      "PROPRIA",
      estado({ possuiCompromissoVencidoAtivo: true }),
    );
    expect(c?.possuiCompromissoVencidoAtivo).toBe(true);
    expect(c?.permiteInterno).toBe(false);
  });

  it("ativo livre com estado efetivo consultado mantém operação liberada", () => {
    const c = toCandidateSelection(ativo(), "PROPRIA", estado());
    expect(c?.estadoConsultado).toBe(true);
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

  it("lista de candidatos consulta sem janela (null/null)", async () => {
    const fn = await carregar();
    await fn({ equipamentoIds: ["a"] });
    expect(rpcMock.mock.calls[0][1].p_periodo_inicio ?? null).toBeNull();
    expect(rpcMock.mock.calls[0][1].p_periodo_fim ?? null).toBeNull();
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
            estado_exibicao: "RESERVADO",
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
