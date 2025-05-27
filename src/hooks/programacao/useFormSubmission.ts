
import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { createProgramacao, updateProgramacao } from "@/services/programacaoEntregaService";
import { ProgramacaoEntregaWithItems } from "@/types/programacaoEntrega";
import { ProgramacaoFormValues, ItemFormValues } from "@/validations/programacaoSchema";

export const useFormSubmission = (
  programacao: ProgramacaoEntregaWithItems | null,
  onSuccess: () => void
) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = useCallback(async (data: ProgramacaoFormValues) => {
    console.log("Submitting form with data:", data);
    setIsSubmitting(true);
    
    try {
      if (!data.itens || data.itens.length === 0) {
        throw new Error("Adicione pelo menos uma entrega programada");
      }
      
      if (!data.data_entrega || data.data_entrega.trim() === '') {
        throw new Error("Data de entrega é obrigatória");
      }
      
      const programacaoData = {
        requisicao_id: data.requisicao_id || "",
        centro_custo_id: data.centro_custo_id || "",
        data_entrega: data.data_entrega
      };
      
      // Create proper ItemFormValues objects with all required fields
      const itensWithRequiredFields = data.itens.map(item => ({
        id: item.id,
        requisicao_id: item.requisicao_id || data.requisicao_id || "",
        centro_custo_nome: item.centro_custo_nome || "",
        // Use centro_custo_nome for the logradouro field in the database
        logradouro: item.centro_custo_nome || "",
        quantidade_massa: Number(item.quantidade_massa || 0),
        caminhao_id: item.caminhao_id || "",
        // IMPORTANT: Keep the tipo_lancamento exactly as selected by the user
        tipo_lancamento: item.tipo_lancamento || "",
        equipe_id: item.equipe_id || "",
        apontador_id: item.apontador_id || "",
        usina_id: item.usina_id || "",
        data_entrega: item.data_entrega || data.data_entrega,
        status: item.status || (item.cancelled ? 'Cancelada' : 'Pendente'),
        cancelled: item.cancelled || false
      }));
      
      if (programacao?.id) {
        await updateProgramacao(programacao.id, programacaoData, itensWithRequiredFields);
        toast({
          title: "Programação atualizada",
          description: "A programação foi atualizada com sucesso",
        });
      } else {
        await createProgramacao(programacaoData, itensWithRequiredFields);
        toast({
          title: "Programação criada",
          description: "A programação foi criada com sucesso",
        });
      }
      
      onSuccess();
    } catch (error) {
      console.error('Error submitting programação:', error);
      toast({
        title: "Erro ao salvar programação",
        description: error instanceof Error ? error.message : "Ocorreu um erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [programacao, toast, onSuccess]);

  return {
    isSubmitting,
    onSubmit
  };
};
