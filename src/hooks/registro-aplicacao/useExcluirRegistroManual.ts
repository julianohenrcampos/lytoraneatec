import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useExcluirRegistroManual(opts?: { onSuccess?: (id: string) => void }) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Cinto de segurança: nunca tocar em registros logísticos.
      // O ON DELETE CASCADE em bd_registro_aplicacao_detalhes remove os itens.
      // A RLS raa_delete_v69 volta a validar autor + escopo de centro de custo.
      const { error } = await supabase
        .from("bd_registro_apontamento_aplicacao")
        .delete()
        .eq("id", id)
        .eq("origem_registro", "manual");
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      toast.success("Registro manual excluído.");
      qc.invalidateQueries({ queryKey: ["entregasStable"] });
      qc.invalidateQueries({ queryKey: ["registrosManuaisLista"] });
      qc.invalidateQueries({ queryKey: ["registrosManuaisRecentes"] });
      opts?.onSuccess?.(id);
    },
    onError: (error: any) => {
      console.error("[REGISTRO_APLICACAO_MANUAL][EXCLUIR_ERRO]", error);
      toast.error(error?.message || "Falha ao excluir registro manual.");
    },
  });
}
