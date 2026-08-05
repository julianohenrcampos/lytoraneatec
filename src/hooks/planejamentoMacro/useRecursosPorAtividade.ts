import { useQuery } from "@tanstack/react-query";
import { listarRecursosPorAtividade } from "@/services/planejamentoMacro/recursosPlanejadosService";

export function useRecursosPorAtividade(atividadeId: string | null | undefined) {
  return useQuery({
    queryKey: ["planejamento-macro-recursos-atividade", atividadeId],
    queryFn: () => listarRecursosPorAtividade(atividadeId as string),
    enabled: !!atividadeId,
    staleTime: 30_000,
  });
}
