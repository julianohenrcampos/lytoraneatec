import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  atualizarPlanejamentoObra,
  PlanejamentoVigenteDuplicadoError,
  type AtualizarPlanejamentoInput,
  type PlanejamentoObraRow,
} from "@/services/planejamentoMacro/planejamentoMacroService";

export function useAtualizarPlanejamentoObra() {
  const qc = useQueryClient();
  return useMutation<
    PlanejamentoObraRow,
    Error,
    { id: string; patch: AtualizarPlanejamentoInput; silent?: boolean }
  >({
    mutationFn: ({ id, patch }) => atualizarPlanejamentoObra(id, patch),
    onSuccess: (row, vars) => {
      qc.invalidateQueries({ queryKey: ["planejamento-macro-vigente", row.centro_custo_id] });
      qc.invalidateQueries({ queryKey: ["planejamento-macro-atividades"] });
      qc.invalidateQueries({ queryKey: ["planejamentos-obra-cc", row.centro_custo_id] });
      if (!vars.silent) toast.success("Planejamento atualizado.");
    },
    onError: (err) => {
      if (err instanceof PlanejamentoVigenteDuplicadoError) toast.error(err.message);
      else toast.error(err.message || "Erro ao atualizar planejamento.");
    },
  });
}
