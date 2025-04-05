
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { RegistroAplicacao } from "@/types/registroAplicacao";
import { ListaProgramacaoEntrega } from "@/types/programacaoEntrega";
import { RegistroCarga } from "@/types/registroCargas";
import { 
  registroAplicacaoSchema, 
  RegistroAplicacaoSchema 
} from "@/validations/registroAplicacaoSchema";
import { getFormDefaultValues } from "@/utils/registroAplicacaoFormUtils";
import { useCalculations } from "./useCalculations";
import { useFormInitialization } from "./useFormInitialization";
import { useFormSubmission } from "./useFormSubmission";
import { useToast } from "@/hooks/use-toast";

/**
 * Main hook for the registro aplicacao form
 */
export const useRegistroAplicacaoForm = (
  onSuccess?: () => void,
  initialData?: RegistroAplicacao
) => {
  const [registroCarga, setRegistroCarga] = useState<RegistroCarga | null>(null);
  const { toast, dismiss } = useToast();
  
  // Initialize form with either initial data or defaults
  const form = useForm<RegistroAplicacaoSchema>({
    resolver: zodResolver(registroAplicacaoSchema),
    defaultValues: getFormDefaultValues(initialData),
  });

  // Watch form values for calculations
  const comprimento = form.watch("comprimento");
  const largura = form.watch("largura_media");

  // Use specialized hooks for different aspects of the form
  const { calculatedArea, calculatedEspessura, espessuraStatus } = useCalculations(
    comprimento, 
    largura, 
    registroCarga
  );
  
  const { initializeFromEntrega } = useFormInitialization();
  const { isLoading, onSubmit } = useFormSubmission(onSuccess);

  // Initialize form with data from a lista programacao entrega and registro carga
  const initializeFromEntregaHandler = async (
    entrega: ListaProgramacaoEntrega,
    regCarga: RegistroCarga
  ) => {
    // Set the registro carga for calculations
    setRegistroCarga(regCarga);
    
    // Initialize the form
    return await initializeFromEntrega(form, entrega, regCarga, { toast, dismiss });
  };

  return {
    form,
    isLoading,
    calculatedArea,
    calculatedEspessura,
    espessuraStatus,
    onSubmit,
    initializeFromEntrega: initializeFromEntregaHandler,
    toast
  };
};
