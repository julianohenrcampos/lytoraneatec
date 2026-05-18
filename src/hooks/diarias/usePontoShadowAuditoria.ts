import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getShadowKpis,
  listarShadowEventos,
  executarSimulacao,
  type ShadowFiltros,
} from "@/services/diarias/pontoShadowAuditService";

export function usePontoShadowKpis(filtros: ShadowFiltros) {
  return useQuery({
    queryKey: ["ponto-shadow-kpis", filtros],
    queryFn: () => getShadowKpis(filtros),
    staleTime: 30_000,
  });
}

export function usePontoShadowEventos(filtros: ShadowFiltros, page: number, pageSize = 50) {
  return useQuery({
    queryKey: ["ponto-shadow-eventos", filtros, page, pageSize],
    queryFn: () => listarShadowEventos(filtros, page, pageSize),
    staleTime: 30_000,
  });
}

export function useExecutarSimulacaoShadow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { desde: string; ate: string; limit?: number; reprocessar?: boolean }) =>
      executarSimulacao(params.desde, params.ate, {
        limit: params.limit,
        reprocessar: params.reprocessar,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ponto-shadow-kpis"] });
      qc.invalidateQueries({ queryKey: ["ponto-shadow-eventos"] });
    },
  });
}
