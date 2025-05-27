
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { RegistroCargaFormValues, RegistroCarga } from "@/types/registroCargas";
import { ListaProgramacaoEntrega } from "@/types/programacaoEntrega";
import { createRegistroCarga, updateRegistroCarga, fetchRegistroCargaByListaEntregaId } from "@/services/registroCargaService";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

// Zod schema for form validation
const registroCargaSchema = z.object({
  lista_entrega_id: z.string().uuid(),
  programacao_id: z.string().uuid(),
  data_saida: z.string().min(1, "Data de saída é obrigatória"),
  hora_saida: z.string().min(1, "Hora de saída é obrigatória"),
  temperatura_saida: z.number().nullable().optional(),
  tonelada_saida: z.number().min(0.1, "Valor deve ser maior que zero"),
  imagem_ticket_saida: z.any(), // Allow either string (URL) or File or null
  tonelada_retorno: z.number().nullable().optional(),
  imagem_ticket_retorno: z.any().optional(), // Allow either string (URL) or File or undefined
  status_registro: z.enum(["Ativo", "Cancelado", "Concluído"]).optional()
});

type RegistroCargaSchema = z.infer<typeof registroCargaSchema>;

export const useRegistroCargaForm = (
  onSuccess?: () => void,
  initialData?: RegistroCarga
) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [ticketSaidaPreview, setTicketSaidaPreview] = useState<string | null>(initialData?.imagem_ticket_saida || null);
  const [ticketRetornoPreview, setTicketRetornoPreview] = useState<string | null>(initialData?.imagem_ticket_retorno || null);
  
  // Initialize form with either initial data or defaults
  const form = useForm<RegistroCargaSchema>({
    resolver: zodResolver(registroCargaSchema),
    defaultValues: initialData
      ? {
          ...initialData,
          temperatura_saida: initialData.temperatura_saida || null,
          tonelada_retorno: initialData.tonelada_retorno || null,
        }
      : {
          lista_entrega_id: "",
          programacao_id: "",
          data_saida: format(new Date(), "yyyy-MM-dd"),
          hora_saida: format(new Date(), "HH:mm"),
          temperatura_saida: null,
          tonelada_saida: 0,
          imagem_ticket_saida: "",
          tonelada_retorno: null,
          imagem_ticket_retorno: "",
          status_registro: "Ativo"
        },
  });

  // Handle file input changes
  const handleTicketSaidaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Preview the image
      const reader = new FileReader();
      reader.onload = () => {
        setTicketSaidaPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      
      // Set the file in the form
      form.setValue("imagem_ticket_saida", file);
    }
  };

  const handleTicketRetornoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Preview the image
      const reader = new FileReader();
      reader.onload = () => {
        setTicketRetornoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      
      // Set the file in the form
      form.setValue("imagem_ticket_retorno", file);
    }
  };

  // Initialize form with data from a lista programacao entrega item
  const initializeFromListaEntrega = async (item: ListaProgramacaoEntrega) => {
    try {
      // Check if there's already a registro carga for this lista entrega
      const existingRegistro = await fetchRegistroCargaByListaEntregaId(item.id);
      
      if (existingRegistro) {
        // Populate form with existing registro data
        form.reset({
          lista_entrega_id: existingRegistro.lista_entrega_id,
          programacao_id: existingRegistro.programacao_id,
          data_saida: existingRegistro.data_saida,
          hora_saida: existingRegistro.hora_saida,
          temperatura_saida: existingRegistro.temperatura_saida || null,
          tonelada_saida: existingRegistro.tonelada_saida,
          imagem_ticket_saida: existingRegistro.imagem_ticket_saida,
          tonelada_retorno: existingRegistro.tonelada_retorno || null,
          imagem_ticket_retorno: existingRegistro.imagem_ticket_retorno || "",
          status_registro: existingRegistro.status_registro
        });
        
        // Set image previews if they exist
        setTicketSaidaPreview(existingRegistro.imagem_ticket_saida || null);
        setTicketRetornoPreview(existingRegistro.imagem_ticket_retorno || null);
        
        return existingRegistro;
      } else {
        // Initialize new form with lista entrega data
        form.reset({
          lista_entrega_id: item.id,
          programacao_id: item.programacao_entrega_id,
          data_saida: format(new Date(), "yyyy-MM-dd"),
          hora_saida: format(new Date(), "HH:mm"),
          temperatura_saida: null,
          tonelada_saida: 0,
          imagem_ticket_saida: "",
          tonelada_retorno: null,
          imagem_ticket_retorno: "",
          status_registro: "Ativo"
        });
        
        // Clear image previews
        setTicketSaidaPreview(null);
        setTicketRetornoPreview(null);
        
        return null;
      }
    } catch (error) {
      console.error("Error initializing form from lista entrega:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados do registro",
        variant: "destructive",
      });
      return null;
    }
  };

  // Form submission handler
  const onSubmit = async (data: RegistroCargaSchema) => {
    setIsLoading(true);
    try {
      if (initialData?.id) {
        // Update existing registro
        await updateRegistroCarga(initialData.id, data as RegistroCargaFormValues);
        toast({
          title: "Sucesso",
          description: "Registro de carga atualizado com sucesso",
        });
      } else {
        // Create new registro
        await createRegistroCarga(data as RegistroCargaFormValues);
        toast({
          title: "Sucesso",
          description: "Registro de carga criado com sucesso",
        });
      }
      onSuccess?.();
    } catch (error) {
      console.error("Error saving registro carga:", error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao salvar o registro de carga",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

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
