import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCtMovDiretaEdicao } from "../useCtMovDireta";
import { rascunhoVazio } from "@/lib/central-transporte/movDiretaRascunho";
import { salvarRascunhoMovDireta } from "@/services/ctMovDiretaService";

vi.mock("@/services/ctMovDiretaService", () => ({
  cancelarMovDireta: vi.fn(),
  fetchAtivosMovimentacao: vi.fn(),
  fetchMovDiretaEstado: vi.fn(),
  fetchMovDiretas: vi.fn(),
  programarMovDireta: vi.fn(),
  salvarRascunhoMovDireta: vi.fn(),
}));

const salvarMock = vi.mocked(salvarRascunhoMovDireta);

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
  >
    {children}
  </QueryClientProvider>
);

describe("useCtMovDiretaEdicao — snapshot explícito", () => {
  beforeEach(() => vi.clearAllMocks());

  it("salva a rota do snapshot atual sem depender do próximo render React", async () => {
    salvarMock.mockResolvedValue({
      ok: true,
      replay: false,
      viagemId: "viagem-nova",
      viagem: null,
    });
    const { result } = renderHook(() => useCtMovDiretaEdicao({}), { wrapper });
    const snapshot = {
      ...rascunhoVazio(),
      rotaPlanejada: {
        distanciaKm: 3.8,
        duracaoMin: 9,
        resumo: "Estrada do Facao, Rua Sílvio Germiniano",
        geometria: {
          type: "LineString" as const,
          coordinates: [
            [-43.767851, -22.857036],
            [-43.76, -22.85],
            [-43.748005, -22.845221],
          ] as [number, number][],
        },
      },
    };

    await act(async () => {
      const out = await result.current.salvar(snapshot);
      expect(out.status).toBe("ok");
    });

    expect(salvarMock).toHaveBeenCalledTimes(1);
    expect(salvarMock.mock.calls[0]?.[0].rotaPlanejada).toEqual(snapshot.rotaPlanejada);
    expect(result.current.rascunho.viagemId).toBe("viagem-nova");
    expect(result.current.rascunho.rotaPlanejada).toEqual(snapshot.rotaPlanejada);
  });
});