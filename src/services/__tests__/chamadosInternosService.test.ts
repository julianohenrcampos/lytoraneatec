import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Testes do chamadosInternosService — F1.
 * Objetivo: garantir que TODA mutação passa por `supabase.rpc(nome, { p_* })`
 * e que NENHUMA passa por `.from().insert/update/delete`.
 */

const rpcCalls: Array<{ name: string; args: unknown }> = [];
const fromCalls: Array<{ table: string; op: string }> = [];
let rpcNextResult: { data: unknown; error: unknown } = { data: null, error: null };

vi.mock("@/integrations/supabase/client", () => {
  const forbidden = (op: string) => (table: string) => {
    fromCalls.push({ table, op });
    throw new Error(`DML direto proibido: ${op} em ${table}`);
  };
  const makeFromBuilder = (table: string) => {
    const b: Record<string, unknown> = {
      select: () => b,
      eq: () => b,
      in: () => b,
      or: () => b,
      order: () => b,
      maybeSingle: async () => ({ data: null, error: null }),
      insert: forbidden("insert").bind(null, table) as unknown,
      update: forbidden("update").bind(null, table) as unknown,
      delete: forbidden("delete").bind(null, table) as unknown,
      then: (resolve: (v: { data: unknown; error: unknown }) => unknown) =>
        resolve({ data: [], error: null }),
    };
    return b;
  };
  return {
    supabase: {
      from: (table: string) => makeFromBuilder(table),
      rpc: (name: string, args: unknown) => {
        rpcCalls.push({ name, args });
        const res = rpcNextResult;
        return Promise.resolve(res);
      },
    },
  };
});

import * as svc from "@/services/chamadosInternosService";

beforeEach(() => {
  rpcCalls.length = 0;
  fromCalls.length = 0;
  rpcNextResult = { data: null, error: null };
});

describe("chamadosInternosService — assinaturas RPC (p_* verbatim)", () => {
  it("abrir dispara fn_chamado_interno_abrir com todos os p_*", async () => {
    rpcNextResult = {
      data: [{ chamado_id: "c1", numero: 1, protocolo: "CHI-2026-000001" }],
      error: null,
    };
    const out = await svc.abrir({
      p_centro_custo_id: "cc",
      p_categoria_id: "cat",
      p_solicitante_funcionario_id: "f",
      p_titulo: "t",
      p_descricao: "d",
    });
    expect(rpcCalls).toEqual([
      {
        name: "fn_chamado_interno_abrir",
        args: {
          p_centro_custo_id: "cc",
          p_categoria_id: "cat",
          p_solicitante_funcionario_id: "f",
          p_titulo: "t",
          p_descricao: "d",
        },
      },
    ]);
    expect(out.protocolo).toBe("CHI-2026-000001");
  });

  it.each([
    ["assumir",                 (s: typeof svc) => s.assumir("id"),                                       "fn_chamado_interno_assumir",                 { p_chamado_id: "id" }],
    ["responder",               (s: typeof svc) => s.responder("id", "m"),                                "fn_chamado_interno_responder",               { p_chamado_id: "id", p_mensagem: "m" }],
    ["solicitarInformacao",     (s: typeof svc) => s.solicitarInformacao("id", "m"),                      "fn_chamado_interno_solicitar_informacao",    { p_chamado_id: "id", p_mensagem: "m" }],
    ["adicionarNotaInterna",    (s: typeof svc) => s.adicionarNotaInterna("id", "m"),                     "fn_chamado_interno_adicionar_nota_interna",  { p_chamado_id: "id", p_mensagem: "m" }],
    ["resolver",                (s: typeof svc) => s.resolver("id", "m"),                                 "fn_chamado_interno_resolver",                { p_chamado_id: "id", p_mensagem: "m" }],
    ["responderSolicitante",    (s: typeof svc) => s.responderSolicitante("id", "m"),                     "fn_chamado_interno_responder_solicitante",   { p_chamado_id: "id", p_mensagem: "m" }],
    ["confirmarEncerramento",   (s: typeof svc) => s.confirmarEncerramento("id"),                         "fn_chamado_interno_confirmar_encerramento",  { p_chamado_id: "id" }],
    ["reabrir",                 (s: typeof svc) => s.reabrir("id", "m"),                                  "fn_chamado_interno_reabrir",                 { p_chamado_id: "id", p_mensagem: "m" }],
    ["cancelar",                (s: typeof svc) => s.cancelar("id", "motivo"),                            "fn_chamado_interno_cancelar",                { p_chamado_id: "id", p_motivo: "motivo" }],
    ["atendenteDesativar",      (s: typeof svc) => s.atendenteDesativar("v"),                             "fn_chamado_interno_atendente_desativar",     { p_vinculo_id: "v" }],
  ])("%s → RPC correta com p_* exatos", async (_label, run, name, args) => {
    await run(svc);
    expect(rpcCalls).toEqual([{ name, args }]);
    expect(fromCalls).toEqual([]);
  });

  it("atendenteVincular usa p_profile_id e p_setor", async () => {
    rpcNextResult = { data: "novo-vinculo", error: null };
    const out = await svc.atendenteVincular("p", "ti");
    expect(rpcCalls).toEqual([
      { name: "fn_chamado_interno_atendente_vincular", args: { p_profile_id: "p", p_setor: "ti" } },
    ]);
    expect(out).toBe("novo-vinculo");
  });

  it("lookups canOpenCc / canAttend / canRead usam RPCs corretas", async () => {
    rpcNextResult = { data: true, error: null };
    await svc.canOpenCc("cc");
    await svc.canAttend("financeiro");
    await svc.canRead("ch");
    expect(rpcCalls.map((c) => c.name)).toEqual([
      "fn_chamado_interno_can_open_cc",
      "fn_chamado_interno_can_attend",
      "fn_chamado_interno_can_read",
    ]);
    expect(rpcCalls[0].args).toEqual({ p_cc_id: "cc" });
    expect(rpcCalls[1].args).toEqual({ p_setor: "financeiro" });
    expect(rpcCalls[2].args).toEqual({ p_chamado_id: "ch" });
  });
});

describe("chamadosInternosService — erros preservados", () => {
  it("preserva code/message/details/hint (ex.: 42501)", async () => {
    rpcNextResult = {
      data: null,
      error: {
        message: "permission denied for function fn_chamado_interno_abrir",
        code: "42501",
        details: "role apontador",
        hint: "grant execute",
      },
    };
    await expect(
      svc.abrir({
        p_centro_custo_id: "cc",
        p_categoria_id: "cat",
        p_solicitante_funcionario_id: "f",
        p_titulo: "t",
        p_descricao: "d",
      }),
    ).rejects.toMatchObject({
      code: "42501",
      message: "permission denied for function fn_chamado_interno_abrir",
      details: "role apontador",
      hint: "grant execute",
    });
  });
});
