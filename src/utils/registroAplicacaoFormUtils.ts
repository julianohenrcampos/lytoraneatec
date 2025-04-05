
import { format } from "date-fns";
import { RegistroAplicacao, BordoType } from "@/types/registroAplicacao";
import { ListaProgramacaoEntrega } from "@/types/programacaoEntrega";
import { RegistroCarga } from "@/types/registroCargas";
import { UseFormReturn } from "react-hook-form";
import { RegistroAplicacaoSchema } from "@/validations/registroAplicacaoSchema";
import { fetchRegistroAplicacaoByListaEntregaId } from "@/services/registro-aplicacao";
import { ToastApi } from "@/types/toast";

/**
 * Initialize form with data from existing registro or with default values
 */
export const getFormDefaultValues = (initialData?: RegistroAplicacao) => {
  if (initialData) {
    return {
      ...initialData,
      temperatura_chegada: initialData.temperatura_chegada || null,
      temperatura_aplicacao: initialData.temperatura_aplicacao || null,
      estaca_inicial: initialData.estaca_inicial || null,
      comprimento: initialData.comprimento || null,
      largura_media: initialData.largura_media || null,
      estaca_final: initialData.estaca_final || null,
      bordo: initialData.bordo as BordoType | undefined,
      anotacoes_apontador: initialData.anotacoes_apontador || null
    };
  }
  
  return {
    lista_entrega_id: "",
    registro_carga_id: "",
    data_aplicacao: format(new Date(), "yyyy-MM-dd"),
    hora_chegada_local: format(new Date(), "HH:mm"),
    temperatura_chegada: null,
    hora_aplicacao: "",
    temperatura_aplicacao: null,
    bordo: undefined,
    estaca_inicial: null,
    comprimento: null,
    largura_media: null,
    hora_saida_caminhao: "",
    estaca_final: null,
    anotacoes_apontador: null,
  };
};

/**
 * Initialize form values from a lista entrega and registro carga
 */
export const initializeFormFromEntrega = async (
  form: UseFormReturn<RegistroAplicacaoSchema>,
  entrega: ListaProgramacaoEntrega,
  regCarga: RegistroCarga,
  toast: ToastApi
) => {
  try {
    // Check if there's already a registro aplicacao for this lista entrega
    const existingRegistro = await fetchRegistroAplicacaoByListaEntregaId(entrega.id);
    
    if (existingRegistro) {
      // Populate form with existing registro data
      form.reset({
        ...existingRegistro,
        temperatura_chegada: existingRegistro.temperatura_chegada || null,
        temperatura_aplicacao: existingRegistro.temperatura_aplicacao || null,
        estaca_inicial: existingRegistro.estaca_inicial || null,
        comprimento: existingRegistro.comprimento || null,
        largura_media: existingRegistro.largura_media || null,
        estaca_final: existingRegistro.estaca_final || null,
        bordo: existingRegistro.bordo as BordoType | undefined,
        anotacoes_apontador: existingRegistro.anotacoes_apontador || null
      });
      
      return existingRegistro;
    } else {
      // Initialize new form with entrega and registro carga data
      form.reset({
        lista_entrega_id: entrega.id,
        registro_carga_id: regCarga.id,
        data_aplicacao: format(new Date(), "yyyy-MM-dd"),
        hora_chegada_local: format(new Date(), "HH:mm"),
        temperatura_chegada: null,
        hora_aplicacao: "",
        temperatura_aplicacao: null,
        bordo: undefined,
        estaca_inicial: null,
        comprimento: null,
        largura_media: null,
        hora_saida_caminhao: "",
        estaca_final: null,
        anotacoes_apontador: null,
      });
      
      return null;
    }
  } catch (error) {
    console.error("Error initializing form from entrega:", error);
    toast.toast({
      title: "Erro",
      description: "Não foi possível carregar os dados do registro",
      variant: "destructive",
    });
    return false;
  }
};
