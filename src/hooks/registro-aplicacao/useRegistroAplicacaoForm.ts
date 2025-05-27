
import { useState, useEffect } from "react";
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
  const [selectedLogradouroId, setSelectedLogradouroId] = useState<string | null>(null);
  const [logradouroAplicado, setLogradouroAplicado] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Initialize form with either initial data or defaults
  const form = useForm<RegistroAplicacaoSchema>({
    resolver: zodResolver(registroAplicacaoSchema),
    defaultValues: getFormDefaultValues(initialData),
  });

  // Watch form values for calculations
  const comprimento = form.watch("comprimento");
  const largura = form.watch("largura_media");

  // Use specialized hooks for different aspects of the form
  const { 
    calculatedArea, 
    calculatedToneladaAplicada,
    calculatedEspessura, 
    calculatedEspessuraCalculada,
    massaRemanescente,
    espessuraStatus,
    espessuraCalculadaStatus,
    exceededAvailableMass
  } = useCalculations(
    comprimento, 
    largura, 
    registroCarga
  );
  
  // Update form values when calculations change
  useEffect(() => {
    if (calculatedArea !== null) {
      form.setValue("area_calculada", calculatedArea);
    }
    
    if (calculatedToneladaAplicada !== null) {
      form.setValue("tonelada_aplicada", calculatedToneladaAplicada);
    }
    
    if (calculatedEspessura !== null) {
      form.setValue("espessura", calculatedEspessura);
    }
    
    if (calculatedEspessuraCalculada !== null) {
      form.setValue("espessura_calculada", calculatedEspessuraCalculada);
    }
    
    if (logradouroAplicado) {
      form.setValue("logradouro_aplicado", logradouroAplicado);
    }
  }, [calculatedArea, calculatedToneladaAplicada, calculatedEspessura, calculatedEspessuraCalculada, logradouroAplicado, form]);

  // Initialize form with existing data when editing
  useEffect(() => {
    if (initialData) {
      console.log("Initializing form with existing data:", initialData);
      
      // Set the registro carga for calculations if available
      if (initialData.registro_carga) {
        setRegistroCarga(initialData.registro_carga);
      }
      
      // Set logradouro information
      if (initialData.logradouro_id) {
        setSelectedLogradouroId(initialData.logradouro_id);
      }
      
      if (initialData.logradouro_aplicado) {
        setLogradouroAplicado(initialData.logradouro_aplicado);
      }
      
      // Reset form with existing data
      form.reset(getFormDefaultValues(initialData));
    }
  }, [initialData, form]);
  
  const { initializeFromEntrega } = useFormInitialization();
  const { isLoading, onSubmit } = useFormSubmission(onSuccess, initialData?.id);

  // Initialize form with data from a lista programacao entrega and registro carga
  const initializeFromEntregaHandler = async (
    entrega: ListaProgramacaoEntrega,
    regCarga: RegistroCarga,
    logradouroId?: string,
    logradouroName?: string
  ) => {
    // Set the registro carga for calculations
    setRegistroCarga(regCarga);
    
    // Store the selected logradouro ID and name if provided
    if (logradouroId) {
      setSelectedLogradouroId(logradouroId);
      form.setValue("logradouro_id", logradouroId);
    }
    
    if (logradouroName) {
      setLogradouroAplicado(logradouroName);
      form.setValue("logradouro_aplicado", logradouroName);
    }
    
    // Ensure the IDs are explicitly set
    form.setValue("lista_entrega_id", entrega.id);
    form.setValue("registro_carga_id", regCarga.id);
    
    // Initialize the form passing the toast function
    return await initializeFromEntrega(form, entrega, regCarga, toast);
  };

  return {
    form,
    isLoading,
    calculatedArea,
    calculatedToneladaAplicada,
    calculatedEspessura,
    calculatedEspessuraCalculada,
    massaRemanescente,
    espessuraStatus,
    espessuraCalculadaStatus,
    exceededAvailableMass,
    onSubmit,
    initializeFromEntrega: initializeFromEntregaHandler,
    selectedLogradouroId,
    logradouroAplicado
  };
};
