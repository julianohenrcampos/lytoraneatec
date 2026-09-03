import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

vi.mock("@/services/chamadosInternosService", () => ({
  listarChamados: vi.fn().mockResolvedValue([]),
  obterChamado: vi.fn().mockResolvedValue(null),
  listarEventos: vi.fn().mockResolvedValue([]),
  listarCategoriasAtivas: vi.fn().mockResolvedValue([]),
  listarCcsAbertura: vi.fn().mockResolvedValue([]),
  listarSolicitantesDoCc: vi.fn().mockResolvedValue([]),
  atendentesListar: vi.fn().mockResolvedValue([]),
  canOpenCc: vi.fn().mockResolvedValue(true),
  canAttend: vi.fn().mockResolvedValue(true),
  canRead: vi.fn().mockResolvedValue(true),
  abrir: vi.fn().mockResolvedValue({ chamado_id: "c1", numero: 1, protocolo: "CHI-2026-000001" }),
  assumir: vi.fn().mockResolvedValue(undefined),
  responder: vi.fn().mockResolvedValue(undefined),
  solicitarInformacao: vi.fn().mockResolvedValue(undefined),
  adicionarNotaInterna: vi.fn().mockResolvedValue(undefined),
  resolver: vi.fn().mockResolvedValue(undefined),
  responderSolicitante: vi.fn().mockResolvedValue(undefined),
  confirmarEncerramento: vi.fn().mockResolvedValue(undefined),
  reabrir: vi.fn().mockResolvedValue(undefined),
  cancelar: vi.fn().mockResolvedValue(undefined),
  atendenteVincular: vi.fn().mockResolvedValue("v1"),
  atendenteDesativar: vi.fn().mockResolvedValue(undefined),
}));

import {
  CHAMADOS_INTERNOS_KEYS,
  useChamadoInternoAbrir,
  useChamadoInternoAssumir,
  useChamadoInternoResponder,
  useChamadoInternoAtendenteVincular,
} from "@/hooks/useChamadosInternos";

function wrapperFactory() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(qc, "invalidateQueries");
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, invalidate, Wrapper };
}

beforeEach(() => vi.clearAllMocks());

describe("CHAMADOS_INTERNOS_KEYS — determinístico", () => {
  it("lista é estável para o mesmo filtro", () => {
    const a = CHAMADOS_INTERNOS_KEYS.lista({ status: ["aberto"] });
    const b = CHAMADOS_INTERNOS_KEYS.lista({ status: ["aberto"] });
    expect(a).toEqual(b);
    expect(CHAMADOS_INTERNOS_KEYS.item("x")).toEqual(["chamados-internos", "item", "x"]);
    expect(CHAMADOS_INTERNOS_KEYS.eventos("x")).toEqual(["chamados-internos", "eventos", "x"]);
    expect(CHAMADOS_INTERNOS_KEYS.atendentes("ti")).toEqual(["chamados-internos", "atendentes", "ti"]);
  });
});

describe("mutations — invalidação cirúrgica", () => {
  it("abrir invalida apenas a lista", async () => {
    const { Wrapper, invalidate } = wrapperFactory();
    const { result } = renderHook(() => useChamadoInternoAbrir(), { wrapper: Wrapper });
    await result.current.mutateAsync({
      p_centro_custo_id: "cc",
      p_categoria_id: "cat",
      p_solicitante_funcionario_id: "f",
      p_titulo: "t",
      p_descricao: "d",
    });
    await waitFor(() => expect(invalidate).toHaveBeenCalled());
    const keys = invalidate.mock.calls.map((c) => (c[0] as { queryKey: unknown }).queryKey);
    expect(keys).toEqual([["chamados-internos", "lista"]]);
  });

  it("assumir invalida item, eventos, capacidade(operar), lista e fila", async () => {
    const { Wrapper, invalidate } = wrapperFactory();
    const { result } = renderHook(() => useChamadoInternoAssumir(), { wrapper: Wrapper });
    await result.current.mutateAsync("c1");
    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(5));
    const keys = invalidate.mock.calls.map((c) => (c[0] as { queryKey: unknown }).queryKey);
    expect(keys).toEqual([
      CHAMADOS_INTERNOS_KEYS.item("c1"),
      CHAMADOS_INTERNOS_KEYS.eventos("c1"),
      CHAMADOS_INTERNOS_KEYS.capacidade("operar", "c1"),
      ["chamados-internos", "lista"],
      ["chamados-internos", "fila-atendimento"],
    ]);
  });

  it("responder invalida item, eventos, capacidade(operar), lista e fila", async () => {
    const { Wrapper, invalidate } = wrapperFactory();
    const { result } = renderHook(() => useChamadoInternoResponder(), { wrapper: Wrapper });
    await result.current.mutateAsync({ chamadoId: "c1", args: "msg" });
    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(5));
  });

  it("atendenteVincular invalida apenas atendentes(setor)", async () => {
    const { Wrapper, invalidate } = wrapperFactory();
    const { result } = renderHook(() => useChamadoInternoAtendenteVincular(), { wrapper: Wrapper });
    await result.current.mutateAsync({ profileId: "p", setor: "ti" });
    await waitFor(() => expect(invalidate).toHaveBeenCalled());
    const keys = invalidate.mock.calls.map((c) => (c[0] as { queryKey: unknown }).queryKey);
    expect(keys).toEqual([CHAMADOS_INTERNOS_KEYS.atendentes("ti")]);
  });
});

describe("mutations — erros propagam", () => {
  it("onError recebe erro sem converter em sucesso", async () => {
    const svcMod = await import("@/services/chamadosInternosService");
    (svcMod.assumir as unknown as { mockRejectedValueOnce: (e: unknown) => void }).mockRejectedValueOnce(
      { code: "42501", message: "denied" },
    );
    const { Wrapper } = wrapperFactory();
    const onError = vi.fn();
    const { result } = renderHook(() => useChamadoInternoAssumir(), { wrapper: Wrapper });
    await expect(result.current.mutateAsync("c1", { onError })).rejects.toMatchObject({ code: "42501" });
    expect(onError).toHaveBeenCalled();
  });
});
