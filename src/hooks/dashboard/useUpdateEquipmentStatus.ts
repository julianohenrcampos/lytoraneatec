
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useUpdateEquipmentStatus = () => {
  return useMutation({
    mutationFn: async () => {
      console.log("🔄 Executando função de atualização de status dos equipamentos...");
      
      const { data, error } = await supabase.rpc('atualizar_status_equipamentos_nao_apontados');
      
      if (error) {
        console.error("❌ Erro ao executar função:", error);
        throw new Error(`Erro na execução: ${error.message}`);
      }
      
      console.log("✅ Função executada com sucesso. Equipamentos atualizados:", data);
      return data;
    },
    onSuccess: (equipamentosAtualizados) => {
      console.log("📊 Resultado da atualização:", equipamentosAtualizados);
      
      if (equipamentosAtualizados === 0) {
        toast.success("Todos os equipamentos já estão com status correto!", {
          description: "Nenhuma atualização foi necessária."
        });
      } else {
        toast.success(`Status atualizado com sucesso!`, {
          description: `${equipamentosAtualizados} equipamento(s) foram marcados como "Disponível".`
        });
      }
    },
    onError: (error: any) => {
      console.error("❌ Erro na atualização:", error);
      toast.error("Erro ao atualizar status dos equipamentos", {
        description: error.message || "Tente novamente em alguns instantes."
      });
    }
  });
};
