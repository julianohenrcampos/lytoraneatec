import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { excluirPlanejamentoObra } from "@/services/planejamentoMacro/planejamentoMacroService";

export function useExcluirPlanejamentoObra() {
  const qc = useQueryClient();
  return useMutation<void, Error, { id: string; centro_custo_id: string }>({
    mutationFn: ({ id }) => excluirPlanejamentoObra(id),
    onSuccess: (_v, vars) => {
      qc.invalidateQueries({ queryKey: ["planejamento-macro-vigente", vars.centro_custo_id] });
      qc.invalidateQueries({ queryKey: ["planejamento-macro-atividades"] });
      qc.invalidateQueries({ queryKey: ["planejamentos-obra-cc", vars.centro_custo_id] });
      toast.success("Planejamento excluído.");
    },
    onError: (err) => toast.error(err.message || "Erro ao excluir planejamento."),
  });
}
