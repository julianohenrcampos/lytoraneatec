import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  criarPlanejamentoObra,
  PlanejamentoVigenteDuplicadoError,
  type CriarPlanejamentoInput,
  type PlanejamentoObraRow,
} from "@/services/planejamentoMacro/planejamentoMacroService";

export function useCriarPlanejamentoObra() {
  const qc = useQueryClient();
  return useMutation<PlanejamentoObraRow, Error, CriarPlanejamentoInput>({
    mutationFn: (input) => criarPlanejamentoObra(input),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["planejamento-macro-vigente", row.centro_custo_id] });
      qc.invalidateQueries({ queryKey: ["planejamento-macro-atividades"] });
      qc.invalidateQueries({ queryKey: ["planejamentos-obra-cc", row.centro_custo_id] });
      toast.success(
        row.status === "rascunho"
          ? "Planejamento manual de teste criado como rascunho."
          : "Planejamento manual de teste criado e ativado como vigente."
      );
    },
    onError: (err) => {
      if (err instanceof PlanejamentoVigenteDuplicadoError) toast.error(err.message);
      else toast.error(err.message || "Erro ao criar planejamento.");
    },
  });
}
