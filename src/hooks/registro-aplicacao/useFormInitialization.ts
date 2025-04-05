
import { UseFormReturn } from "react-hook-form";
import { RegistroAplicacaoSchema } from "@/validations/registroAplicacaoSchema";
import { ListaProgramacaoEntrega } from "@/types/programacaoEntrega";
import { RegistroCarga } from "@/types/registroCargas";
import { initializeFormFromEntrega } from "@/utils/registroAplicacaoFormUtils";
import { ToastApi } from "@/types/toast";

/**
 * Get default values for the form from initial data or defaults
 */
export const useFormInitialization = () => {
  /**
   * Initialize form with data from a lista programacao entrega and registro carga
   */
  const initializeFromEntrega = async (
    form: UseFormReturn<RegistroAplicacaoSchema>,
    entrega: ListaProgramacaoEntrega,
    regCarga: RegistroCarga,
    toast: ToastApi
  ) => {
    return await initializeFormFromEntrega(form, entrega, regCarga, toast);
  };

  return {
    initializeFromEntrega
  };
};
