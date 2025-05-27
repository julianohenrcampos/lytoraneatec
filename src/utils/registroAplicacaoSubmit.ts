
import { RegistroAplicacaoSchema } from "@/validations/registroAplicacaoSchema";
import { createRegistroAplicacao, updateRegistroAplicacao, fetchRegistroAplicacaoByListaEntregaId } from "@/services/registro-aplicacao";
import { Toast } from "@/types/toast";
import { RegistroAplicacaoFormValues } from "@/types/registroAplicacao";

export const handleFormSubmission = async (
  data: RegistroAplicacaoSchema,
  toast: (props: Toast) => void,
  onSuccess?: () => void
) => {
  try {
    console.log("Form data to submit:", data);
    
    // Ensure required fields are present
    if (!data.lista_entrega_id) {
      toast({
        title: "Erro",
        description: "ID da lista de entrega é obrigatório",
        variant: "destructive",
      });
      return;
    }
    
    if (!data.registro_carga_id) {
      toast({
        title: "Erro",
        description: "ID do registro de carga é obrigatório",
        variant: "destructive",
      });
      return;
    }
    
    // Create a properly typed submission data object that explicitly includes required fields
    const submissionData: RegistroAplicacaoFormValues = {
      lista_entrega_id: data.lista_entrega_id,
      registro_carga_id: data.registro_carga_id,
      data_aplicacao: data.data_aplicacao,
      hora_chegada_local: data.hora_chegada_local,
      logradouro_id: data.logradouro_id,
      logradouro_aplicado: data.logradouro_aplicado,
      temperatura_chegada: data.temperatura_chegada !== null ? Number(data.temperatura_chegada) : null,
      hora_aplicacao: data.hora_aplicacao,
      temperatura_aplicacao: data.temperatura_aplicacao !== null ? Number(data.temperatura_aplicacao) : null,
      bordo: data.bordo,
      estaca_inicial: data.estaca_inicial !== null ? Number(data.estaca_inicial) : null,
      comprimento: data.comprimento !== null ? Number(data.comprimento) : null,
      largura_media: data.largura_media !== null ? Number(data.largura_media) : null,
      area_calculada: data.area_calculada !== null ? Number(data.area_calculada) : null,
      tonelada_aplicada: data.tonelada_aplicada !== null ? Number(data.tonelada_aplicada) : null,
      espessura: data.espessura !== null ? Number(data.espessura) : null,
      espessura_calculada: data.espessura_calculada !== null ? Number(data.espessura_calculada) : null,
      hora_saida_caminhao: data.hora_saida_caminhao,
      estaca_final: data.estaca_final !== null ? Number(data.estaca_final) : null,
      anotacoes_apontador: data.anotacoes_apontador
    };
    
    try {
      // Check if there's an existing record
      const existingRecord = await fetchRegistroAplicacaoByListaEntregaId(data.lista_entrega_id);
      
      // Create or update the record
      if (existingRecord) {
        console.log("Updating existing record:", existingRecord.id);
        await updateRegistroAplicacao(existingRecord.id, submissionData);
        
        toast({
          title: "Sucesso",
          description: "Registro de aplicação atualizado com sucesso!",
        });
      } else {
        console.log("Creating new record");
        await createRegistroAplicacao(submissionData);
        
        toast({
          title: "Sucesso",
          description: "Registro de aplicação criado com sucesso!",
        });
      }
      
      // Execute success callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Error checking for existing record:", error);
      // Se houve erro ao verificar registro existente, tenta criar um novo
      try {
        console.log("Attempting to create new record despite error");
        await createRegistroAplicacao(submissionData);
        
        toast({
          title: "Sucesso",
          description: "Registro de aplicação criado com sucesso!",
        });
        
        if (onSuccess) {
          onSuccess();
        }
      } catch (createError) {
        console.error("Error creating record:", createError);
        toast({
          title: "Erro",
          description: "Ocorreu um erro ao criar o registro. Tente novamente.",
          variant: "destructive",
        });
      }
    }
  } catch (error) {
    console.error("Error submitting the form:", error);
    toast({
      title: "Erro",
      description: "Ocorreu um erro ao salvar os dados. Tente novamente.",
      variant: "destructive",
    });
    throw error; // Re-throw to allow caller to handle
  }
};
