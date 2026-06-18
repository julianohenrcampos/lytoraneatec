import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  arquivarPlanejamentoObra,
  type PlanejamentoObraRow,
} from "@/services/planejamentoMacro/planejamentoMacroService";

export function useArquivarPlanejamentoObra() {
  const qc = useQueryClient();
  return useMutation<PlanejamentoObraRow, Error, { id: string }>({
    mutationFn: ({ id }) => arquivarPlanejamentoObra(id),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["planejamento-macro-vigente", row.centro_custo_id] });
      qc.invalidateQueries({ queryKey: ["planejamento-macro-atividades"] });
      qc.invalidateQueries({ queryKey: ["planejamentos-obra-cc", row.centro_custo_id] });
      toast.success("Planejamento arquivado.");
    },
    onError: (err) => toast.error(err.message || "Erro ao arquivar planejamento."),
  });
}
