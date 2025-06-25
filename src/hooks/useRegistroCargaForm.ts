
import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ListaProgramacaoEntrega } from "@/types/programacaoEntrega";
import { RegistroCargaFormValues } from "@/types/registroCargas";
import { 
  getCurrentBrazilianDate,
} from "@/utils/timezoneUtils";

interface UseRegistroCargaFormProps {
  onSuccess?: () => void;
}

// Função para validar e normalizar valores numéricos
const safeNumber = (value: any, defaultValue: number = 0): number => {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }
  const num = Number(value);
  return isNaN(num) ? defaultValue : Math.max(0, num);
};

// Função para validar dados antes do submit
const validateFormData = (data: RegistroCargaFormValues): string | null => {
  if (!data.lista_entrega_id) {
    return "ID da entrega é obrigatório";
  }
  
  if (!data.data_saida) {
    return "Data de saída é obrigatória";
  }
  
  if (!data.hora_saida) {
    return "Hora de saída é obrigatória";
  }
  
  const toneladaSaida = safeNumber(data.tonelada_saida);
  if (toneladaSaida <= 0) {
    return "Tonelada de saída deve ser maior que zero";
  }
  
  return null;
};

const saveRegistroCarga = async (data: any) => {
  // Normalizar dados numéricos antes de salvar
  const normalizedData = {
    ...data,
    tonelada_saida: safeNumber(data.tonelada_saida),
    tonelada_retorno: safeNumber(data.tonelada_retorno, 0),
    temperatura_saida: safeNumber(data.temperatura_saida, 0),
  };

  console.log("saveRegistroCarga - Dados normalizados:", normalizedData);

  const { data: existingData, error: selectError } = await supabase
    .from('bd_registro_cargas')
    .select('*')
    .eq('lista_entrega_id', normalizedData.lista_entrega_id);

  if (selectError) {
    throw selectError;
  }

  if (existingData && existingData.length > 0) {
    // Update existing record
    const { error: updateError } = await supabase
      .from('bd_registro_cargas')
      .update(normalizedData)
      .eq('lista_entrega_id', normalizedData.lista_entrega_id);

    if (updateError) {
      throw updateError;
    }
  } else {
    // Insert new record
    const { error: insertError } = await supabase
      .from('bd_registro_cargas')
      .insert(normalizedData);

    if (insertError) {
      throw insertError;
    }
  }
};

const fetchRegistroCargaByListaEntregaId = async (listaEntregaId: string) => {
  const { data, error } = await supabase
    .from('bd_registro_cargas')
    .select('*')
    .eq('lista_entrega_id', listaEntregaId)
    .single();

  if (error) {
    console.error("Error fetching registro carga:", error);
    return null;
  }

  return data;
};

export const useRegistroCargaForm = (onSuccess?: () => void) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [ticketSaidaPreview, setTicketSaidaPreview] = useState<string | null>(null);
  const [ticketRetornoPreview, setTicketRetornoPreview] = useState<string | null>(null);
  const [currentListaEntregaId, setCurrentListaEntregaId] = useState<string | null>(null);

  const form = useForm<RegistroCargaFormValues>({
    defaultValues: {
      data_saida: getCurrentBrazilianDate(),
      temperatura_saida: 0,
      tonelada_saida: 0,
      tonelada_retorno: 0,
      hora_saida: "",
      lista_entrega_id: "",
      programacao_id: "",
      imagem_ticket_saida: null,
      imagem_ticket_retorno: null,
      status_registro: "Ativo",
    },
  });

  const handleTicketSaidaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setTicketSaidaPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      form.setValue("imagem_ticket_saida", file);
    }
  };

  const handleTicketRetornoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setTicketRetornoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      form.setValue("imagem_ticket_retorno", file);
    }
  };

  const initializeFromListaEntrega = useCallback(async (entrega: ListaProgramacaoEntrega) => {
    try {
      console.log("initializeFromListaEntrega - Iniciando com entrega:", entrega);
      
      // Check if there's an existing registro for this entrega
      const existingRegistro = await fetchRegistroCargaByListaEntregaId(entrega.id);
      
      let defaultValues: any = {
        lista_entrega_id: entrega.id,
        programacao_id: entrega.programacao_id || "",
        data_saida: getCurrentBrazilianDate(),
        hora_saida: "",
        tonelada_saida: safeNumber(entrega.quantidade_massa),
        tonelada_retorno: 0,
        temperatura_saida: 0,
        status_registro: "Ativo" as const
      };

      if (existingRegistro) {
        console.log("initializeFromListaEntrega - Registro existente encontrado:", existingRegistro);
        
        defaultValues = {
          ...existingRegistro,
          data_saida: existingRegistro.data_saida || getCurrentBrazilianDate(),
          temperatura_saida: safeNumber(existingRegistro.temperatura_saida),
          tonelada_saida: safeNumber(existingRegistro.tonelada_saida),
          tonelada_retorno: safeNumber(existingRegistro.tonelada_retorno),
          hora_saida: existingRegistro.hora_saida || "",
          status_registro: (existingRegistro.status_registro as "Ativo" | "Concluído" | "Cancelado") || "Ativo"
        };
      }

      console.log("initializeFromListaEntrega - Valores padrão definidos:", defaultValues);
      form.reset(defaultValues);
      setCurrentListaEntregaId(entrega.id);
      
      if (existingRegistro?.imagem_ticket_saida) {
        setTicketSaidaPreview(existingRegistro.imagem_ticket_saida);
      }
      
      if (existingRegistro?.imagem_ticket_retorno) {
        setTicketRetornoPreview(existingRegistro.imagem_ticket_retorno);
      }
      
    } catch (error) {
      console.error("Error initializing form from lista entrega:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados da entrega",
        variant: "destructive",
      });
    }
  }, [form, toast]);

  const onSubmit = useCallback(async (data: RegistroCargaFormValues) => {
    if (!currentListaEntregaId) {
      toast({
        title: "Erro",
        description: "ID da entrega não encontrado",
        variant: "destructive",
      });
      return;
    }

    // Validar dados antes do submit
    const validationError = validateFormData(data);
    if (validationError) {
      toast({
        title: "Erro de Validação",
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      console.log("onSubmit - Dados recebidos:", data);

      const registroData = {
        ...data,
        lista_entrega_id: currentListaEntregaId,
        status_registro: data.status_registro || "Ativo" as const,
        // Garantir que valores numéricos sejam normalizados
        tonelada_saida: safeNumber(data.tonelada_saida),
        tonelada_retorno: safeNumber(data.tonelada_retorno),
        temperatura_saida: safeNumber(data.temperatura_saida),
      };

      console.log("onSubmit - Dados para salvar:", registroData);

      await saveRegistroCarga(registroData);
      
      toast({
        title: "Sucesso",
        description: "Registro salvo com sucesso",
      });
      
      onSuccess?.();
    } catch (error) {
      console.error("Error saving registro:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar registro",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentListaEntregaId, toast, onSuccess]);

  return {
    form,
    isLoading,
    ticketSaidaPreview,
    ticketRetornoPreview,
    handleTicketSaidaChange,
    handleTicketRetornoChange,
    onSubmit: form.handleSubmit(onSubmit),
    initializeFromListaEntrega,
  };
};
