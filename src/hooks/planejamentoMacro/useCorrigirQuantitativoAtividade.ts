// Fase 1C-2B — Correção Assistida do Saneamento.
// Chama a RPC transacional fn_corrigir_quantitativo_atividade que:
// - resolve auth.uid() server-side;
// - valida planejamento não arquivado;
// - atualiza quantidade_prevista/unidade/quantidade_origem='manual' apenas se houve mudança real;
// - registra auditoria em bd_auditoria_log na mesma transação.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface CorrigirQuantitativoInput {
  atividadeId: string;
  planejamentoId: string;
  quantidadePrevista: number | null;
  unidade: string | null;
  observacao?: string | null;
}

export function useCorrigirQuantitativoAtividade() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CorrigirQuantitativoInput) => {
      const { data, error } = await (supabase as any).rpc(
        "fn_corrigir_quantitativo_atividade",
        {
          p_atividade_id: input.atividadeId,
          p_quantidade_prevista: input.quantidadePrevista,
          p_unidade: input.unidade,
          p_observacao: input.observacao ?? null,
        }
      );
      if (error) throw new Error(error.message ?? "Falha ao corrigir quantitativo.");
      return data as unknown;
    },
    onSuccess: (_data, vars) => {
      toast.success("Quantidade/unidade atualizadas com origem manual.");
      qc.invalidateQueries({
        queryKey: ["planejamento-macro-atividades", vars.planejamentoId],
      });
      qc.invalidateQueries({ queryKey: ["planejamento-macro-vigente"] });
      qc.invalidateQueries({ queryKey: ["plano-semanal-atividades"] });
      qc.invalidateQueries({ queryKey: ["plano-semanal-recursos"] });
      qc.invalidateQueries({ queryKey: ["pendencias-op-atividades"] });
      qc.invalidateQueries({ queryKey: ["contagens-atividades"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Falha ao corrigir quantitativo.");
    },
  });
}
