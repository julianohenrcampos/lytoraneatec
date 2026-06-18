import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  atualizarRecursoPlanejado,
  type RecursoPlanejadoPatch,
  type RecursoPlanejadoRow,
} from "@/services/planejamentoMacro/recursosPlanejadosService";

interface Vars {
  id: string;
  patch: RecursoPlanejadoPatch;
}

export function useAtualizarRecursoPlanejado() {
  const qc = useQueryClient();

  return useMutation<RecursoPlanejadoRow, Error, Vars>({
    mutationFn: ({ id, patch }) => atualizarRecursoPlanejado(id, patch),
    onSuccess: (row) => {
      toast.success("Recurso atualizado.");
      qc.invalidateQueries({
        queryKey: ["planejamento-macro-recursos-atividade", row.atividade_id],
      });
      qc.invalidateQueries({
        queryKey: ["planejamento-macro-recursos-planejamento", row.planejamento_id],
      });
      qc.invalidateQueries({
        queryKey: ["planejamento-macro-recursos-contagem", row.planejamento_id],
      });
    },
    onError: (err) => {
      toast.error(err.message || "Falha ao atualizar recurso.");
    },
  });
}
