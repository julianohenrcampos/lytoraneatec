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

const saveRegistroCarga = async (data: any) => {
  const { data: existingData, error: selectError } = await supabase
    .from('bd_registro_cargas')
    .select('*')
    .eq('lista_entrega_id', data.lista_entrega_id);

  if (selectError) {
    throw selectError;
  }

  if (existingData && existingData.length > 0) {
    // Update existing record
    const { error: updateError } = await supabase
      .from('bd_registro_cargas')
      .update(data)
      .eq('lista_entrega_id', data.lista_entrega_id);

    if (updateError) {
      throw updateError;
    }
  } else {
    // Insert new record
    const { error: insertError } = await supabase
      .from('bd_registro_cargas')
      .insert(data);

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
      // Check if there's an existing registro for this entrega
      const existingRegistro = await fetchRegistroCargaByListaEntregaId(entrega.id);
      
      let defaultValues: any = {
        lista_entrega_id: entrega.id,
        programacao_id: entrega.programacao_id || "",
        data_saida: getCurrentBrazilianDate(),
        hora_saida: "",
        tonelada_saida: entrega.quantidade_massa || 0,
        tonelada_retorno: 0,
        temperatura_saida: 0,
        status_registro: "Ativo" as const
      };

      if (existingRegistro) {
        defaultValues = {
          ...existingRegistro,
          data_saida: existingRegistro.data_saida || getCurrentBrazilianDate(),
          temperatura_saida: existingRegistro.temperatura_saida || 0,
          tonelada_retorno: existingRegistro.tonelada_retorno || 0,
          hora_saida: existingRegistro.hora_saida || "",
          status_registro: (existingRegistro.status_registro as "Ativo" | "Concluído" | "Cancelado") || "Ativo"
        };
      }

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

    try {
      setIsLoading(true);

      const registroData = {
        ...data,
        lista_entrega_id: currentListaEntregaId,
        status_registro: data.status_registro || "Ativo" as const
      };

      await saveRegistroCarga(registroData);
      
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
