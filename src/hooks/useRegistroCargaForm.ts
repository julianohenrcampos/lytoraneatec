
import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ListaProgramacaoEntrega } from "@/types/programacaoEntrega";
import { RegistroCargaFormValues } from "@/types/registroCargas";
import { 
  getCurrentBrazilianDate,
} from "@/utils/timezoneUtils";
import { createRegistroCarga, updateRegistroCarga, fetchRegistroCargaByListaEntregaId } from "@/services/registroCargaService";

interface UseRegistroCargaFormProps {
  onSuccess?: () => void;
}

// Função para validar e normalizar valores numéricos
const safeNumber = (value: any, defaultValue?: number): number | undefined => {
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
  
  const toneladaSaida = Number(data.tonelada_saida);
  if (isNaN(toneladaSaida) || toneladaSaida <= 0) {
    return "Tonelada de saída deve ser maior que zero";
  }
  
  return null;
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
      temperatura_saida: undefined, // Campo vazio por padrão
      tonelada_saida: undefined, // Campo vazio por padrão (valor em kg)
      tonelada_retorno: undefined, // Campo vazio por padrão (valor em kg)
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
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Tipo de arquivo inválido",
          description: "Por favor, selecione uma imagem (JPEG, PNG ou WebP)",
          variant: "destructive",
        });
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Arquivo muito grande",
          description: "O arquivo deve ter no máximo 5MB",
          variant: "destructive",
        });
        return;
      }

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
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Tipo de arquivo inválido",
          description: "Por favor, selecione uma imagem (JPEG, PNG ou WebP)",
          variant: "destructive",
        });
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Arquivo muito grande",
          description: "O arquivo deve ter no máximo 5MB",
          variant: "destructive",
        });
        return;
      }

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
        programacao_id: entrega.programacao_id || entrega.programacao_entrega_id || "",
        data_saida: getCurrentBrazilianDate(),
        hora_saida: "",
        tonelada_saida: undefined, // Campo vazio por padrão - usuário preencherá manualmente (em kg)
        tonelada_retorno: undefined, // Campo vazio por padrão (em kg)
        temperatura_saida: undefined, // Campo vazio por padrão
        status_registro: "Ativo" as const
      };

      if (existingRegistro) {
        console.log("initializeFromListaEntrega - Registro existente encontrado:", existingRegistro);
        
        // Converter valores de toneladas para kg para exibição nos campos
        const toneladaSaidaKg = existingRegistro.tonelada_saida ? existingRegistro.tonelada_saida * 1000 : undefined;
        const toneladaRetornoKg = existingRegistro.tonelada_retorno ? existingRegistro.tonelada_retorno * 1000 : undefined;
        
        defaultValues = {
          ...existingRegistro,
          data_saida: existingRegistro.data_saida || getCurrentBrazilianDate(),
          temperatura_saida: existingRegistro.temperatura_saida || undefined,
          tonelada_saida: toneladaSaidaKg || undefined, // Converter para kg
          tonelada_retorno: toneladaRetornoKg || undefined, // Converter para kg
          hora_saida: existingRegistro.hora_saida || "",
          status_registro: (existingRegistro.status_registro as "Ativo" | "Concluído" | "Cancelado") || "Ativo"
        };

        // Set image previews if they exist
        if (existingRegistro.imagem_ticket_saida) {
          setTicketSaidaPreview(existingRegistro.imagem_ticket_saida);
        }
        
        if (existingRegistro.imagem_ticket_retorno) {
          setTicketRetornoPreview(existingRegistro.imagem_ticket_retorno);
        }
      }

      console.log("initializeFromListaEntrega - Valores padrão definidos:", defaultValues);
      form.reset(defaultValues);
      setCurrentListaEntregaId(entrega.id);
      
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
      console.log("onSubmit - Dados recebidos (em kg):", data);

      // Converter valores de kg para toneladas antes de salvar
      const toneladaSaidaToneladas = data.tonelada_saida ? Number(data.tonelada_saida) / 1000 : 0;
      const toneladaRetornoToneladas = data.tonelada_retorno ? Number(data.tonelada_retorno) / 1000 : null;

      const registroData = {
        lista_entrega_id: currentListaEntregaId,
        programacao_id: data.programacao_id || "",
        data_saida: data.data_saida || getCurrentBrazilianDate(),
        hora_saida: data.hora_saida || "",
        status_registro: data.status_registro || "Ativo" as const,
        // Converter de kg para toneladas antes de salvar no banco
        tonelada_saida: toneladaSaidaToneladas,
        tonelada_retorno: toneladaRetornoToneladas,
        temperatura_saida: data.temperatura_saida == null || data.temperatura_saida === undefined ? null : Number(data.temperatura_saida),
        imagem_ticket_saida: data.imagem_ticket_saida,
        imagem_ticket_retorno: data.imagem_ticket_retorno,
      };

      console.log("onSubmit - Dados para salvar (em toneladas):", registroData);

      // Check if updating existing or creating new
      const existingRegistro = await fetchRegistroCargaByListaEntregaId(currentListaEntregaId);
      
      if (existingRegistro) {
        console.log("onSubmit - Updating existing registro:", existingRegistro.id);
        await updateRegistroCarga(existingRegistro.id, registroData);
      } else {
        console.log("onSubmit - Creating new registro");
        await createRegistroCarga(registroData);
      }
      
      toast({
        title: "Sucesso",
        description: "Registro salvo com sucesso",
      });
      
      onSuccess?.();
    } catch (error: any) {
      console.error("Error saving registro:", error);
      toast({
        title: "Erro ao salvar",
        description: error.message || "Erro interno do sistema",
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
