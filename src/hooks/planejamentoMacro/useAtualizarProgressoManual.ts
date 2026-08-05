// Fase C — Mutation hook para atualizar progresso manual.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { atualizarProgressoManualAtividade } from "@/services/planejamentoMacro/planejamentoMacroService";

export interface AtualizarProgressoManualInput {
  atividadeId: string;
  percentual: number | null;
  observacao: string | null;
}

export function useAtualizarProgressoManual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ atividadeId, percentual, observacao }: AtualizarProgressoManualInput) =>
      atualizarProgressoManualAtividade(atividadeId, percentual, observacao),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["planejamento-macro-atividades"] });
      qc.invalidateQueries({ queryKey: ["planejamento-macro-vigente"] });
      qc.invalidateQueries({ queryKey: ["plano-semanal-atividades"] });
      toast.success("Progresso atualizado com sucesso.");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Erro ao atualizar progresso.";
      toast.error(msg);
    },
  });
}
