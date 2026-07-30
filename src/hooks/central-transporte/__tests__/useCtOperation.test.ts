import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import useCtOperation from "@/hooks/central-transporte/useCtOperation";

const ok = { ok: true, replay: false };

describe("useCtOperation — idempotência CT-2", () => {
  it("gera um request_id e o libera após sucesso", async () => {
    const { result } = renderHook(() => useCtOperation());
    const exec = vi.fn(async () => ok);

    await act(async () => {
      const out = await result.current.run({
        operation: "ATRIBUIR",
        materialKey: "k1",
        resourceIds: ["item-1"],
        exec,
      });
      expect(out.status).toBe("ok");
    });

    expect(exec).toHaveBeenCalledTimes(1);
    expect(result.current.getAttempt("k1")).toBeNull();
  });

  it("preserva o mesmo request_id no retry após resultado incerto", async () => {
    const { result } = renderHook(() => useCtOperation());
    const ids: string[] = [];
    const falha = vi.fn(async (rid: string) => {
      ids.push(rid);
      throw new Error("Failed to fetch");
    });

    await act(async () => {
      const out = await result.current.run({
        operation: "ENCERRAR",
        materialKey: "k2",
        resourceIds: ["at-1"],
        exec: falha,
      });
      expect(out.status).toBe("uncertain");
    });

    expect(result.current.getAttempt("k2")?.state).toBe("UNCERTAIN");

    await act(async () => {
      await result.current.run({
        operation: "ENCERRAR",
        materialKey: "k2",
        resourceIds: ["at-1"],
        exec: async (rid: string) => {
          ids.push(rid);
          return { ok: true, replay: true };
        },
      });
    });

    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
    expect(result.current.getAttempt("k2")).toBeNull();
  });

  it("libera a tentativa em erro determinístico CT2_*", async () => {
    const { result } = renderHook(() => useCtOperation());

    await act(async () => {
      const out = await result.current.run({
        operation: "ATRIBUIR",
        materialKey: "k3",
        resourceIds: ["item-3"],
        exec: async () => {
          throw new Error("CT2_MATCH_PARCIAL_BLOQUEADO");
        },
      });
      expect(out.status).toBe("error");
      if (out.status === "error") expect(out.error.code).toBe("CT2_MATCH_PARCIAL_BLOQUEADO");
    });

    expect(result.current.getAttempt("k3")).toBeNull();
    expect(result.current.isBlocked(["item-3"])).toBe(false);
  });

  it("bloqueia outra operação sobre recurso com tentativa incerta", async () => {
    const { result } = renderHook(() => useCtOperation());

    await act(async () => {
      await result.current.run({
        operation: "ATRIBUIR",
        materialKey: "k4",
        resourceIds: ["item-4", "eq-4"],
        exec: async () => {
          throw new Error("timeout");
        },
      });
    });

    expect(result.current.isBlocked(["eq-4"])).toBe(true);

    await act(async () => {
      const out = await result.current.run({
        operation: "SUBSTITUIR",
        materialKey: "k5",
        resourceIds: ["item-4"],
        exec: async () => ok,
      });
      expect(out.status).toBe("error");
    });
  });
});
