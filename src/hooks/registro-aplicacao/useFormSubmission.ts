
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { RegistroAplicacaoSchema } from "@/validations/registroAplicacaoSchema";
import { handleFormSubmission } from "@/utils/registroAplicacaoSubmit";
import { updateRegistroAplicacao } from "@/services/registro-aplicacao";

/**
 * Custom hook for handling form submission
 */
export const useFormSubmission = (onSuccess?: () => void, existingRegistroId?: string) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const onSubmitHandler = async (data: RegistroAplicacaoSchema) => {
    setIsLoading(true);
    try {
      console.log("Form data before submission:", data);
      
      // Ensure all required fields are present
      if (!data.data_aplicacao) {
        toast({
          title: "Erro",
          description: "Data de aplicação é obrigatória",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
      
      if (!data.hora_chegada_local) {
        toast({
          title: "Erro",
          description: "Hora de chegada é obrigatória",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
      
      if (!data.lista_entrega_id) {
        toast({
          title: "Erro",
          description: "ID da lista de entrega é obrigatório",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
      
      if (!data.registro_carga_id) {
        toast({
          title: "Erro",
          description: "ID do registro de carga é obrigatório",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
      
      // If editing existing registro, use update instead of create
      if (existingRegistroId) {
        console.log("Updating existing registro with ID:", existingRegistroId);
        await updateRegistroAplicacao(existingRegistroId, data);
        
        toast({
          title: "Sucesso",
          description: "Registro de aplicação atualizado com sucesso!",
        });
      } else {
        // Pass the toast function directly for new records
        await handleFormSubmission(data, toast, onSuccess);
      }
      
      // Call onSuccess callback
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Error in form submission:", error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao salvar os dados. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    onSubmit: onSubmitHandler
  };
};
