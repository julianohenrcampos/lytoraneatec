/**
 * CT-2 / M4 — Contrato das 4 RPCs no frontend.
 * Verifica nomes exatos de parâmetros, parser e ausência de escrita direta.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const rpcMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

import {
  listarAtendimentos,
  atribuirAtendimento,
  encerrarAtendimento,
  substituirAtendimento,
} from "@/services/centralTransporteAtendimentoService";

const contadores = {
  reservado: 1,
  em_transporte: 0,
  entregue: 0,
  cancelado: 0,
  liberado: 0,
  comprometidos: 1,
  historico: 0,
  pendentes: 2,
};

beforeEach(() => {
  rpcMock.mockReset();
  fromMock.mockReset();
});

describe("centralTransporteAtendimentoService — contrato das RPCs", () => {
  it("fn_ct_atendimento_listar: parâmetro p_solicitacao_id e parser de itens", async () => {
    rpcMock.mockResolvedValue({
      data: {
        solicitacao_id: "sol-1",
        itens: [
          {
            solicitacao_item_id: "item-1",
            quantidade: 3,
            status_item: "PLANEJADO",
            contadores,
            atendimentos: [],
          },
        ],
      },
      error: null,
    });

    const out = await listarAtendimentos("sol-1");

    expect(rpcMock).toHaveBeenCalledWith("fn_ct_atendimento_listar", {
      p_solicitacao_id: "sol-1",
    });
    expect(out.solicitacao_id).toBe("sol-1");
    expect(out.itens[0].contadores).toEqual(contadores);
    // Oito contadores exatos vindos da RPC, nenhum calculado localmente.
    expect(Object.keys(out.itens[0].contadores)).toHaveLength(8);
    expect(out.itens[0].status_item).toBe("PLANEJADO");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("fn_ct_atendimento_atribuir: envia os 7 parâmetros do contrato", async () => {
    rpcMock.mockResolvedValue({ data: { ok: true, replay: false }, error: null });

    await atribuirAtendimento({
      solicitacaoItemId: "item-1",
      equipamentoId: "eq-1",
      modalidade: "INTERNO",
      requestId: "req-1",
    });

    expect(rpcMock).toHaveBeenCalledWith("fn_ct_atendimento_atribuir", {
      p_solicitacao_item_id: "item-1",
      p_equipamento_id: "eq-1",
      p_modalidade: "INTERNO",
      p_request_id: "req-1",
      p_periodo_inicio: null,
      p_periodo_fim: null,
      p_justificativa_override: null,
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("fn_ct_atendimento_encerrar: parâmetros exatos e replay preservado", async () => {
    rpcMock.mockResolvedValue({ data: { ok: true, replay: true }, error: null });

    const out = await encerrarAtendimento({
      atendimentoId: "at-1",
      novoStatus: "CANCELADO",
      motivo: "motivo com mais de vinte caracteres",
      requestId: "req-2",
    });

    expect(rpcMock).toHaveBeenCalledWith("fn_ct_atendimento_encerrar", {
      p_atendimento_id: "at-1",
      p_novo_status: "CANCELADO",
      p_motivo: "motivo com mais de vinte caracteres",
      p_request_id: "req-2",
    });
    expect(out.replay).toBe(true);
  });

  it("fn_ct_atendimento_substituir: parâmetros exatos", async () => {
    rpcMock.mockResolvedValue({ data: { ok: true, replay: false }, error: null });

    await substituirAtendimento({
      atendimentoId: "at-1",
      novoEquipamentoId: "eq-2",
      modalidade: "RESERVA_FUTURA",
      motivo: "motivo com mais de vinte caracteres",
      requestId: "req-3",
    });

    expect(rpcMock).toHaveBeenCalledWith("fn_ct_atendimento_substituir", {
      p_atendimento_id: "at-1",
      p_novo_equipamento_id: "eq-2",
      p_modalidade: "RESERVA_FUTURA",
      p_motivo: "motivo com mais de vinte caracteres",
      p_request_id: "req-3",
      p_justificativa_override: null,
    });
  });

  it("propaga o erro da RPC sem mascarar o código CT2", async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error("CT2_FORBIDDEN") });
    await expect(listarAtendimentos("sol-1")).rejects.toThrow("CT2_FORBIDDEN");
  });

  it("recusa resposta não-objeto (contrato inválido)", async () => {
    rpcMock.mockResolvedValue({ data: "texto", error: null });
    await expect(listarAtendimentos("sol-1")).rejects.toThrow("CT2_RESPOSTA_INVALIDA");
  });
});
