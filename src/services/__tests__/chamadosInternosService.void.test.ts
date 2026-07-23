/**
 * Guarda: RPCs void devem tratar { data: null, error: null } como SUCESSO.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

let rpcResult: { data: unknown; error: unknown } = { data: null, error: null };
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (_name: string, _args: unknown) => Promise.resolve(rpcResult),
    from: () => ({ select: () => ({}) }),
  },
}));

import * as svc from "@/services/chamadosInternosService";

beforeEach(() => {
  rpcResult = { data: null, error: null };
});

describe("RPC void — { data: null, error: null } é sucesso", () => {
  it("assumir resolve sem lançar", async () => {
    await expect(svc.assumir("id")).resolves.toBeUndefined();
  });
  it("responder resolve sem lançar", async () => {
    await expect(svc.responder("id", "m")).resolves.toBeUndefined();
  });
  it("solicitarInformacao resolve sem lançar", async () => {
    await expect(svc.solicitarInformacao("id", "m")).resolves.toBeUndefined();
  });
  it("adicionarNotaInterna resolve sem lançar", async () => {
    await expect(svc.adicionarNotaInterna("id", "m")).resolves.toBeUndefined();
  });
  it("resolver resolve sem lançar", async () => {
    await expect(svc.resolver("id", "m")).resolves.toBeUndefined();
  });
  it("cancelar resolve sem lançar", async () => {
    await expect(svc.cancelar("id", "motivo")).resolves.toBeUndefined();
  });
});

describe("RPC void — erro do PostgREST é propagado", () => {
  it("assumir lança quando error !== null (mesmo com data null)", async () => {
    rpcResult = { data: null, error: { code: "42501", message: "forbidden" } };
    await expect(svc.assumir("id")).rejects.toMatchObject({ code: "42501" });
  });
});
