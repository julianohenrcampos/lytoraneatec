/**
 * React Query wrappers para o Carimbo do Relatório AP's.
 * Chaves específicas por CC para isolar cache e evitar corridas assíncronas.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import {
  atualizarCarimbo,
  buscarCarimboPadrao,
  criarCarimbo,
  definirPadrao,
  desvincularPadrao,
  inativarCarimbo,
  listarCarimbos,
  type AtualizarCarimboInput,
  type CriarCarimboInput,
} from "@/services/relatorio-aps/relatorioApsCarimbosService";
import type { RelatorioApsCarimboRow } from "@/types/relatorioApsCarimbo";

export const carimboKeys = {
  lista: (centroCustoId: string | null) =>
    ["relatorio-aps-carimbos", centroCustoId ?? "gerais"] as const,
  padrao: (centroCustoId: string) =>
    ["relatorio-aps-carimbo-padrao", centroCustoId] as const,
};

export function useCarimbosLista(centroCustoId: string | null) {
  return useQuery<RelatorioApsCarimboRow[]>({
    queryKey: carimboKeys.lista(centroCustoId),
    queryFn: () => listarCarimbos({ centroCustoId, incluirGerais: true }),
    staleTime: 30_000,
  });
}

export function useCarimboPadrao(centroCustoId: string | null) {
  return useQuery<RelatorioApsCarimboRow | null>({
    queryKey: centroCustoId
      ? carimboKeys.padrao(centroCustoId)
      : ["carimbo-padrao-noop"],
    queryFn: () => buscarCarimboPadrao(centroCustoId as string),
    enabled: !!centroCustoId,
    staleTime: 30_000,
  });
}

function invalidarCarimbos(qc: QueryClient, ccId: string | null) {
  qc.invalidateQueries({ queryKey: carimboKeys.lista(ccId) });
  qc.invalidateQueries({ queryKey: ["relatorio-aps-carimbos"] });
  if (ccId) qc.invalidateQueries({ queryKey: carimboKeys.padrao(ccId) });
}

export function useCriarCarimbo(centroCustoIdContexto: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CriarCarimboInput) => criarCarimbo(input),
    onSuccess: (row) => {
      invalidarCarimbos(qc, row.centro_custo_id ?? centroCustoIdContexto);
    },
  });
}

export function useAtualizarCarimbo(centroCustoIdContexto: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AtualizarCarimboInput) => atualizarCarimbo(input),
    onSuccess: (row) => {
      invalidarCarimbos(qc, row.centro_custo_id ?? centroCustoIdContexto);
    },
  });
}

export function useDefinirPadrao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { carimboId: string; centroCustoId: string }) =>
      definirPadrao(v.carimboId, v.centroCustoId),
    onSuccess: (row, vars) => {
      invalidarCarimbos(qc, vars.centroCustoId);
      if (row.centro_custo_id && row.centro_custo_id !== vars.centroCustoId) {
        invalidarCarimbos(qc, row.centro_custo_id);
      }
    },
  });
}

export function useDesvincularPadrao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (centroCustoId: string) => desvincularPadrao(centroCustoId),
    onSuccess: (_row, ccId) => invalidarCarimbos(qc, ccId),
  });
}

export function useInativarCarimbo(centroCustoIdContexto: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { carimboId: string; updatedAtEsperado: string }) =>
      inativarCarimbo(v.carimboId, v.updatedAtEsperado),
    onSuccess: (row) => {
      invalidarCarimbos(qc, row.centro_custo_id ?? centroCustoIdContexto);
    },
  });
}
