// Fase 6E.1 — Listagem de planejamentos por Centro de Custo (SuperAdm).
import { useQuery } from "@tanstack/react-query";
import {
  listarPlanejamentosObraPorCentroCusto,
  type PlanejamentoObraRow,
} from "@/services/planejamentoMacro/planejamentoMacroService";

export function usePlanejamentosObraPorCentroCusto(
  centroCustoId: string | null,
  isSuperAdmin: boolean
) {
  return useQuery<PlanejamentoObraRow[]>({
    queryKey: ["planejamentos-obra-cc", centroCustoId],
    queryFn: () => listarPlanejamentosObraPorCentroCusto(centroCustoId as string),
    enabled: !!centroCustoId && isSuperAdmin,
    staleTime: 60_000,
  });
}
