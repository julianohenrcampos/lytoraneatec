import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Params {
  id: string;
  lido: boolean;
}

/**
 * Marca / desmarca um atestado como lido via RPC SECURITY DEFINER.
 * A autoria (quem leu) é carimbada no servidor.
 */
export function useMarcarAtestadoLido() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, lido }: Params) => {
      const { data, error } = await (supabase.rpc as any)(
        "fn_atestado_marcar_lido",
        { p_atestado_id: id, p_lido: lido },
      );
      if (error) throw error;
      return Array.isArray(data) ? data[0] : data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["atestados-painel"] });
    },
    onError: (err: any) => {
      const msg = String(err?.message ?? "");
      toast({
        title: "Não foi possível atualizar a leitura",
        description: msg.includes("sem_permissao")
          ? "Você não tem permissão para marcar atestados como lidos."
          : msg || "Tente novamente.",
        variant: "destructive",
      });
    },
  });
}
