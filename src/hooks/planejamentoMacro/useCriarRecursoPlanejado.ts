import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  criarRecursoPlanejado,
  type RecursoPlanejadoInsert,
  type RecursoPlanejadoRow,
} from "@/services/planejamentoMacro/recursosPlanejadosService";

export function useCriarRecursoPlanejado() {
  const qc = useQueryClient();

  return useMutation<RecursoPlanejadoRow, Error, RecursoPlanejadoInsert>({
    mutationFn: (input) => criarRecursoPlanejado(input),
    onSuccess: (row) => {
      toast.success("Recurso planejado adicionado.");
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
      toast.error(err.message || "Falha ao adicionar recurso.");
    },
  });
}
