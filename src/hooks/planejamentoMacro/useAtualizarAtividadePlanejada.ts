// Fase 6G — Hook de UPDATE individual de atividade planejada (SuperAdm).
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  atualizarAtividadePlanejada,
  type PlanejamentoAtividadePatch,
  type PlanejamentoAtividadeRow,
} from "@/services/planejamentoMacro/planejamentoMacroService";

interface MutateInput {
  id: string;
  planejamento_id: string;
  patch: PlanejamentoAtividadePatch;
}

export function useAtualizarAtividadePlanejada() {
  const qc = useQueryClient();

  return useMutation<PlanejamentoAtividadeRow, Error, MutateInput>({
    mutationFn: ({ id, patch }) => atualizarAtividadePlanejada(id, patch),
    onSuccess: (row, vars) => {
      toast.success("Atividade atualizada com sucesso.");
      if (row.status === "cancelada") {
        toast.info(
          "Atividade marcada como cancelada e ocultada da listagem."
        );
      }
      qc.invalidateQueries({
        queryKey: ["planejamento-macro-atividades", vars.planejamento_id],
      });
      qc.invalidateQueries({
        queryKey: ["planejamento-macro-vigente"],
      });
    },
    onError: (err) => {
      toast.error(err.message || "Falha ao atualizar atividade.");
    },
  });
}
