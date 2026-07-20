import { describe, it, expect, beforeEach, vi } from "vitest";

const rpcMock = vi.fn();
const fromMock = vi.fn();
const insertSpy = vi.fn();
const updateSpy = vi.fn();
const deleteSpy = vi.fn();

vi.mock("@/integrations/supabase/client", () => {
  const makeBuilder = () => {
    const b: Record<string, unknown> = {
      select: () => b,
      eq: () => b,
      is: () => b,
      or: () => b,
      order: () => b,
      maybeSingle: async () => ({ data: null, error: null }),
      then: (r: (v: { data: unknown[]; error: null }) => unknown) =>
        r({ data: [], error: null }),
      insert: (...args: unknown[]) => {
        insertSpy(...args);
        return b;
      },
      update: (...args: unknown[]) => {
        updateSpy(...args);
        return b;
      },
      delete: (...args: unknown[]) => {
        deleteSpy(...args);
        return b;
      },
    };
    return b;
  };
  return {
    supabase: {
      from: (t: string) => {
        fromMock(t);
        return makeBuilder();
      },
      rpc: (name: string, params: unknown) => rpcMock(name, params),
    },
  };
});

import {
  atualizarCarimbo,
  criarCarimbo,
  definirPadrao,
  desvincularPadrao,
  inativarCarimbo,
  listarCarimbos,
} from "@/services/relatorio-aps/relatorioApsCarimbosService";
import type { RelatorioApsCarimboError } from "@/types/relatorioApsCarimbo";

beforeEach(() => {
  rpcMock.mockReset();
  fromMock.mockClear();
  insertSpy.mockClear();
  updateSpy.mockClear();
  deleteSpy.mockClear();
});

describe("relatorioApsCarimbosService", () => {
  it("listarCarimbos usa SELECT e não faz insert/update/delete", async () => {
    await listarCarimbos({ centroCustoId: "cc-1" });
    expect(fromMock).toHaveBeenCalledWith("bd_relatorio_aps_carimbos");
    expect(insertSpy).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  const input = {
    nome: "N",
    centroCustoId: "cc",
    obra: "o",
    empresa: "e",
    cliente: "c",
    bairro: "b",
    revisao: "00",
    observacoes: "obs",
  };

  it("criarCarimbo chama RPC fn_relatorio_aps_criar_carimbo", async () => {
    rpcMock.mockResolvedValueOnce({ data: { id: "x" }, error: null });
    await criarCarimbo(input);
    expect(rpcMock).toHaveBeenCalledWith(
      "fn_relatorio_aps_criar_carimbo",
      expect.objectContaining({ p_nome: "N", p_centro_custo_id: "cc" }),
    );
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("atualizarCarimbo chama RPC de update, sem update direto", async () => {
    rpcMock.mockResolvedValueOnce({ data: { id: "x" }, error: null });
    await atualizarCarimbo({
      carimboId: "id",
      updatedAtEsperado: "ts",
      ...input,
    });
    expect(rpcMock).toHaveBeenCalledWith(
      "fn_relatorio_aps_atualizar_carimbo",
      expect.objectContaining({ p_carimbo_id: "id", p_updated_at_esperado: "ts" }),
    );
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("definirPadrao/desvincular/inativar usam RPCs correspondentes", async () => {
    rpcMock.mockResolvedValue({ data: { id: "x" }, error: null });
    await definirPadrao("id", "cc");
    await desvincularPadrao("cc");
    await inativarCarimbo("id", "ts");
    const chamadas = rpcMock.mock.calls.map((c) => c[0]);
    expect(chamadas).toEqual([
      "fn_relatorio_aps_definir_carimbo_padrao",
      "fn_relatorio_aps_desvincular_padrao",
      "fn_relatorio_aps_inativar_carimbo",
    ]);
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it("mapeia 40001 → CARIMBO_CONFLITO_CONCORRENCIA", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: "40001", message: "x" } });
    await expect(
      atualizarCarimbo({ carimboId: "id", updatedAtEsperado: "ts", ...input }),
    ).rejects.toMatchObject({ code: "CARIMBO_CONFLITO_CONCORRENCIA" } as Partial<RelatorioApsCarimboError>);
  });

  it("mapeia 42501 → CARIMBO_ACAO_NEGADA", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "permission denied" } });
    await expect(criarCarimbo(input)).rejects.toMatchObject({ code: "CARIMBO_ACAO_NEGADA" });
  });

  it("mapeia CARIMBO_ASSOCIADO_OUTRO_CC pela message", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: "P0001", message: "CARIMBO_ASSOCIADO_OUTRO_CC" } });
    await expect(definirPadrao("id", "cc")).rejects.toMatchObject({
      code: "CARIMBO_ASSOCIADO_OUTRO_CC",
    });
  });

  it("mapeia CARIMBO_GERAL_RESTRITO pela message", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: "P0001", message: "CARIMBO_GERAL_RESTRITO" } });
    await expect(definirPadrao("id", "cc")).rejects.toMatchObject({
      code: "CARIMBO_GERAL_RESTRITO",
    });
  });

  it("mapeia P0002 → CARIMBO_NAO_ENCONTRADO", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: "P0002", message: "not found" } });
    await expect(inativarCarimbo("id", "ts")).rejects.toMatchObject({
      code: "CARIMBO_NAO_ENCONTRADO",
    });
  });
});
