
import { UseFormReturn } from "react-hook-form";
import { RegistroAplicacaoSchema } from "@/validations/registroAplicacaoSchema";
import { ListaProgramacaoEntrega } from "@/types/programacaoEntrega";
import { RegistroCarga } from "@/types/registroCargas";
import { Toast } from "@/types/toast";

/**
 * Get default values for the form from initial data or defaults
 */
export const getFormDefaultValues = (initialData?: any): RegistroAplicacaoSchema => {
  return {
    lista_entrega_id: initialData?.lista_entrega_id || "",
    registro_carga_id: initialData?.registro_carga_id || "",
    logradouro_id: initialData?.logradouro_id || "",
    logradouro_aplicado: initialData?.logradouro_aplicado || "",
    data_aplicacao: initialData?.data_aplicacao || new Date().toISOString().split('T')[0],
    hora_chegada_local: initialData?.hora_chegada_local || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    temperatura_chegada: initialData?.temperatura_chegada || null,
    hora_aplicacao: initialData?.hora_aplicacao || null,
    temperatura_aplicacao: initialData?.temperatura_aplicacao || null,
    bordo: initialData?.bordo || null,
    estaca_inicial: initialData?.estaca_inicial || null,
    comprimento: initialData?.comprimento || null,
    largura_media: initialData?.largura_media || null,
    area_calculada: initialData?.area_calculada || null,
    tonelada_aplicada: initialData?.tonelada_aplicada || null,
    espessura_calculada: initialData?.espessura_calculada || null,
    hora_saida_caminhao: initialData?.hora_saida_caminhao || null,
    estaca_final: initialData?.estaca_final || null,
    anotacoes_apontador: initialData?.anotacoes_apontador || null,
  };
};

/**
 * Initialize form with data from a lista programacao entrega and registro carga
 */
export const initializeFormFromEntrega = async (
  form: UseFormReturn<RegistroAplicacaoSchema>,
  entrega: ListaProgramacaoEntrega,
  regCarga: RegistroCarga,
  toast: (props: Toast) => void
) => {
  try {
    // Set values from entrega
    form.setValue("lista_entrega_id", entrega.id);
    form.setValue("registro_carga_id", regCarga.id);
    
    // Set default values for data and times - ensuring they're in the correct format
    const today = new Date().toISOString().split('T')[0];
    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    form.setValue("data_aplicacao", today);
    form.setValue("hora_chegada_local", currentTime);
    
    toast({
      title: "Sucesso",
      description: "Dados da entrega carregados com sucesso!",
    });
    
    return true;
  } catch (error) {
    console.error("Error initializing form:", error);
    toast({
      title: "Erro",
      description: "Ocorreu um erro ao carregar os dados da entrega.",
      variant: "destructive",
    });
    
    return false;
  }
};
