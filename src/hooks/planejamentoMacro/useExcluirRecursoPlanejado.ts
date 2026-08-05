import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { excluirRecursoPlanejado } from "@/services/planejamentoMacro/recursosPlanejadosService";

interface Vars {
  id: string;
  atividade_id: string;
  planejamento_id: string;
}

export function useExcluirRecursoPlanejado() {
  const qc = useQueryClient();

  return useMutation<void, Error, Vars>({
    mutationFn: ({ id }) => excluirRecursoPlanejado(id),
    onSuccess: (_void, vars) => {
      toast.success("Recurso removido.");
      qc.invalidateQueries({
        queryKey: ["planejamento-macro-recursos-atividade", vars.atividade_id],
      });
      qc.invalidateQueries({
        queryKey: ["planejamento-macro-recursos-planejamento", vars.planejamento_id],
      });
      qc.invalidateQueries({
        queryKey: ["planejamento-macro-recursos-contagem", vars.planejamento_id],
      });
    },
    onError: (err) => {
      toast.error(err.message || "Falha ao remover recurso.");
    },
  });
}
