import { useQuery } from "@tanstack/react-query";
import {
  listarRecursosPorPlanejamento,
  type TipoRecursoPlanejado,
} from "@/services/planejamentoMacro/recursosPlanejadosService";

export function useRecursosPorPlanejamento(
  planejamentoId: string | null | undefined,
  tipo?: TipoRecursoPlanejado
) {
  return useQuery({
    queryKey: [
      "planejamento-macro-recursos-planejamento",
      planejamentoId,
      tipo ?? "todos",
    ],
    queryFn: () => listarRecursosPorPlanejamento(planejamentoId as string, tipo),
    enabled: !!planejamentoId,
    staleTime: 30_000,
  });
}
