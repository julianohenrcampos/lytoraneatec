
import { RegistroAplicacaoSchema } from "@/validations/registroAplicacaoSchema";
import { createRegistroAplicacao, updateRegistroAplicacao, fetchRegistroAplicacaoByListaEntregaId } from "@/services/registro-aplicacao";
import { ToastApi } from "@/types/toast";

export const handleFormSubmission = async (
  data: RegistroAplicacaoSchema,
  { toast }: { toast: ToastApi },
  onSuccess?: () => void
) => {
  try {
    console.log("Form data to submit:", data);
    
    // Check if there's an existing record
    const existingRecord = await fetchRegistroAplicacaoByListaEntregaId(data.lista_entrega_id);
    
    // Process the data before submission
    const submissionData = {
      ...data,
      area: data.comprimento && data.largura_media 
        ? Number(data.comprimento) * Number(data.largura_media) 
        : null,
      espessura: null // Will be calculated on the server
    };
    
    // Create or update the record
    if (existingRecord) {
      await updateRegistroAplicacao(existingRecord.id, submissionData as any);
      
      toast.toast({
        title: "Sucesso",
        description: "Registro de aplicação atualizado com sucesso!",
      });
    } else {
      await createRegistroAplicacao(submissionData as any);
      
      toast.toast({
        title: "Sucesso",
        description: "Registro de aplicação criado com sucesso!",
      });
    }
    
    // Execute success callback if provided
    if (onSuccess) {
      onSuccess();
    }
  } catch (error) {
    console.error("Error submitting the form:", error);
    toast.toast({
      title: "Erro",
      description: "Ocorreu um erro ao salvar os dados. Tente novamente.",
      variant: "destructive",
    });
  }
};
