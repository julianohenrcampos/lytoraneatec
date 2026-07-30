/**
 * CT-2 / M4 — Concorrência e idempotência do motor de operações.
 * Complementa useCtOperation.test.ts com os cenários de bloqueio.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import useCtOperation from "@/hooks/central-transporte/useCtOperation";

const ok = { ok: true, replay: false };

const deferred = <T,>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("useCtOperation — concorrência CT-2", () => {
  it("duplo clique produz uma única chamada à RPC", async () => {
    const { result } = renderHook(() => useCtOperation());
    const d = deferred<typeof ok>();
    const exec = vi.fn(() => d.promise);

    let first!: Promise<unknown>;
    let second!: Promise<unknown>;
    await act(async () => {
      first = result.current.run({
        operation: "ATRIBUIR",
        materialKey: "dup",
        resourceIds: ["item-1"],
        exec,
      });
      second = result.current.run({
        operation: "ATRIBUIR",
        materialKey: "dup",
        resourceIds: ["item-1"],
        exec,
      });
      d.resolve(ok);
      await Promise.all([first, second]);
    });

    expect(exec).toHaveBeenCalledTimes(1);
    const secondOutcome = (await second) as { status: string };
    expect(secondOutcome.status).toBe("error");
  });

  it("bloqueia operação conflitante sobre o mesmo item enquanto há tentativa incerta", async () => {
    const { result } = renderHook(() => useCtOperation());

    await act(async () => {
      await result.current.run({
        operation: "ATRIBUIR",
        materialKey: "k-a",
        resourceIds: ["item-1", "eq-1"],
        exec: async () => {
          throw new Error("Failed to fetch");
        },
      });
    });
    expect(result.current.getAttempt("k-a")?.state).toBe("UNCERTAIN");

    const exec = vi.fn(async () => ok);
    await act(async () => {
      const out = await result.current.run({
        operation: "SUBSTITUIR",
        materialKey: "k-b",
        resourceIds: ["item-1"],
        exec,
      });
      expect(out.status).toBe("error");
    });
    expect(exec).not.toHaveBeenCalled();
  });

  it("mudança de parâmetros durante UNCERTAIN gera nova chave e é bloqueada", async () => {
    const { result } = renderHook(() => useCtOperation());

    await act(async () => {
      await result.current.run({
        operation: "ENCERRAR",
        materialKey: JSON.stringify(["ENCERRAR", "at-1", "CANCELADO", "motivo original longo o suficiente"]),
        resourceIds: ["at-1"],
        exec: async () => {
          throw new Error("timeout");
        },
      });
    });

    const exec = vi.fn(async () => ok);
    await act(async () => {
      const out = await result.current.run({
        operation: "ENCERRAR",
        materialKey: JSON.stringify(["ENCERRAR", "at-1", "LIBERADO", "motivo diferente longo o suficiente"]),
        resourceIds: ["at-1"],
        exec,
      });
      expect(out.status).toBe("error");
    });
    expect(exec).not.toHaveBeenCalled();
  });

  it("operação sobre recurso distinto não é bloqueada por tentativa incerta alheia", async () => {
    const { result } = renderHook(() => useCtOperation());

    await act(async () => {
      await result.current.run({
        operation: "ATRIBUIR",
        materialKey: "x1",
        resourceIds: ["item-1"],
        exec: async () => {
          throw new Error("Failed to fetch");
        },
      });
    });

    const exec = vi.fn(async () => ok);
    await act(async () => {
      const out = await result.current.run({
        operation: "ATRIBUIR",
        materialKey: "x2",
        resourceIds: ["item-2"],
        exec,
      });
      expect(out.status).toBe("ok");
    });
    expect(exec).toHaveBeenCalledTimes(1);
  });

  it("timeout mantém o UUID e o retry o reaproveita", async () => {
    const { result } = renderHook(() => useCtOperation());
    const ids: string[] = [];

    await act(async () => {
      await result.current.run({
        operation: "SUBSTITUIR",
        materialKey: "t1",
        resourceIds: ["at-9"],
        exec: async (rid) => {
          ids.push(rid);
          throw new Error("The operation was aborted due to timeout");
        },
      });
    });
    const preservado = result.current.getAttempt("t1")?.requestId;
    expect(preservado).toBeTruthy();

    await act(async () => {
      await result.current.run({
        operation: "SUBSTITUIR",
        materialKey: "t1",
        resourceIds: ["at-9"],
        exec: async (rid) => {
          ids.push(rid);
          return { ok: true, replay: true };
        },
      });
    });

    expect(ids[0]).toBe(preservado);
    expect(ids[1]).toBe(preservado);
  });

  it("replay=true é tratado como sucesso e libera a tentativa", async () => {
    const { result } = renderHook(() => useCtOperation());

    await act(async () => {
      const out = await result.current.run({
        operation: "ATRIBUIR",
        materialKey: "r1",
        resourceIds: ["item-1"],
        exec: async () => ({ ok: true, replay: true }),
      });
      expect(out.status).toBe("ok");
      expect(out.status === "ok" && out.replay).toBe(true);
    });
    expect(result.current.getAttempt("r1")).toBeNull();
  });

  it("a tentativa incerta sobrevive a novas montagens de modal (estado fora do modal)", async () => {
    const { result } = renderHook(() => useCtOperation());

    await act(async () => {
      await result.current.run({
        operation: "ATRIBUIR",
        materialKey: "persist",
        resourceIds: ["item-7"],
        exec: async () => {
          throw new Error("Failed to fetch");
        },
      });
    });

    // Simula fechar o modal e reabrir a análise: apenas o consumidor remonta,
    // o hook permanece montado no CentralTransportePage.
    expect(result.current.getAttempt("persist")?.state).toBe("UNCERTAIN");
    expect(result.current.isBlocked(["item-7"])).toBe(true);
  });

  it("não persiste nada em localStorage/sessionStorage", async () => {
    const { result } = renderHook(() => useCtOperation());
    await act(async () => {
      await result.current.run({
        operation: "ATRIBUIR",
        materialKey: "s1",
        resourceIds: ["item-1"],
        exec: async () => {
          throw new Error("Failed to fetch");
        },
      });
    });
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it("cancelAttempt não descarta tentativa incerta", async () => {
    const { result } = renderHook(() => useCtOperation());
    await act(async () => {
      await result.current.run({
        operation: "ATRIBUIR",
        materialKey: "c1",
        resourceIds: ["item-1"],
        exec: async () => {
          throw new Error("Failed to fetch");
        },
      });
    });
    act(() => result.current.cancelAttempt("c1"));
    expect(result.current.getAttempt("c1")?.state).toBe("UNCERTAIN");
  });
});
