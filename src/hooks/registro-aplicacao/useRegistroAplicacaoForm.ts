
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
import { useMultipleApplications } from "./useMultipleApplications";
import { useToast } from "@/hooks/use-toast";

/**
 * Main hook for the registro aplicacao form - now supports multiple applications
 */
export const useRegistroAplicacaoForm = (
  onSuccess?: () => void,
  initialData?: RegistroAplicacao,
  preSelectedData?: {
    entrega: ListaProgramacaoEntrega;
    registroCarga: RegistroCarga;
    logradouroId?: string;
    logradouroName?: string;
    aplicacaoSequencia?: number;
    massaRemanescenteAnterior?: number;
  }
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
  const usarMassaTotal = form.watch("usar_massa_total_para_espessura");
  const aplicacaoSequencia = form.watch("aplicacao_sequencia") || 1;

  // Use multiple applications hook for carga management
  const { cargaInfo } = useMultipleApplications(
    preSelectedData?.registroCarga?.id || initialData?.registro_carga_id
  );

  // Use specialized hooks for different aspects of the form
  const { 
    calculatedArea, 
    calculatedToneladaAplicada,
    calculatedEspessura, 
    massaRemanescente,
    espessuraStatus,
    exceededAvailableMass
  } = useCalculations(
    comprimento, 
    largura, 
    registroCarga,
    undefined,
    usarMassaTotal,
    cargaInfo?.massaRemanescente // Usar massa remanescente da carga
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
    
    if (logradouroAplicado) {
      form.setValue("logradouro_aplicado", logradouroAplicado);
    }
  }, [calculatedArea, calculatedToneladaAplicada, calculatedEspessura, logradouroAplicado, form]);

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

  // Initialize form with pre-selected data from the modal
  useEffect(() => {
    if (preSelectedData && !initialData) {
      console.log("Initializing form with pre-selected data:", preSelectedData);
      
      // Set the registro carga for calculations
      setRegistroCarga(preSelectedData.registroCarga);
      
      // Set logradouro information if provided
      if (preSelectedData.logradouroId) {
        setSelectedLogradouroId(preSelectedData.logradouroId);
        form.setValue("logradouro_id", preSelectedData.logradouroId);
      }
      
      if (preSelectedData.logradouroName) {
        setLogradouroAplicado(preSelectedData.logradouroName);
        form.setValue("logradouro_aplicado", preSelectedData.logradouroName);
      }
      
      // Set the required IDs
      form.setValue("lista_entrega_id", preSelectedData.entrega.id);
      form.setValue("registro_carga_id", preSelectedData.registroCarga.id);
      
      // Set sequencing information for multiple applications
      const sequencia = preSelectedData.aplicacaoSequencia || 1;
      form.setValue("aplicacao_sequencia", sequencia);
      form.setValue("carga_origem_id", preSelectedData.registroCarga.id);
      
      if (preSelectedData.massaRemanescenteAnterior !== undefined) {
        form.setValue("massa_remanescente_antes_aplicacao", preSelectedData.massaRemanescenteAnterior);
      }
      
      // Initialize the form with entrega data
      initializeFromEntregaHandler(
        preSelectedData.entrega,
        preSelectedData.registroCarga,
        preSelectedData.logradouroId,
        preSelectedData.logradouroName
      );
    }
  }, [preSelectedData, initialData, form]);
  
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
    form.setValue("aplicacao_sequencia", 1);
    form.setValue("carga_origem_id", regCarga.id);
    
    // Initialize the form using the standard initializeFromEntrega function
    return await initializeFromEntrega(form, entrega, regCarga, toast);
  };

  return {
    form,
    isLoading,
    calculatedArea,
    calculatedToneladaAplicada,
    calculatedEspessura,
    massaRemanescente,
    espessuraStatus,
    exceededAvailableMass,
    onSubmit,
    initializeFromEntrega: initializeFromEntregaHandler,
    selectedLogradouroId,
    logradouroAplicado,
    // New properties for multiple applications
    cargaInfo,
    aplicacaoSequencia,
    massaRemanescenteCarga: cargaInfo?.massaRemanescente,
    cargaFinalizada: cargaInfo?.cargaFinalizada || false
  };
};
