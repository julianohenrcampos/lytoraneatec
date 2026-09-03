import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  tornarVigentePlanejamentoObra,
  type PlanejamentoObraRow,
} from "@/services/planejamentoMacro/planejamentoMacroService";

export function useTornarVigentePlanejamentoObra() {
  const qc = useQueryClient();
  return useMutation<PlanejamentoObraRow, Error, { id: string }>({
    mutationFn: ({ id }) => tornarVigentePlanejamentoObra(id),
    onSuccess: (row) => {
      qc.invalidateQueries({
        queryKey: ["planejamento-macro-vigente", row.centro_custo_id],
      });
      qc.invalidateQueries({
        queryKey: ["planejamentos-obra-cc", row.centro_custo_id],
      });
      qc.invalidateQueries({ queryKey: ["planejamento-macro-atividades"] });
      toast.success("Versão tornada vigente.");
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao tornar vigente o planejamento.");
    },
  });
}
