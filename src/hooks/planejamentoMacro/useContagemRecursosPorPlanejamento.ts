import { useQuery } from "@tanstack/react-query";
import { contarRecursosPorPlanejamento } from "@/services/planejamentoMacro/recursosPlanejadosService";

export function useContagemRecursosPorPlanejamento(
  planejamentoId: string | null | undefined
) {
  return useQuery({
    queryKey: ["planejamento-macro-recursos-contagem", planejamentoId],
    queryFn: () => contarRecursosPorPlanejamento(planejamentoId as string),
    enabled: !!planejamentoId,
    staleTime: 30_000,
  });
}
