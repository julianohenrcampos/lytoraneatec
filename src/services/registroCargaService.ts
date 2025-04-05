import { supabase } from "@/integrations/supabase/client";
import { ListaProgramacaoEntrega } from "@/types/programacaoEntrega";
import { RegistroCargaFilters, RegistroCargaFormValues, RegistroCarga } from "@/types/registroCargas";
import { format } from "date-fns";
import { uploadImage } from "./storageService";

// Helper function to normalize status values to the union type
const normalizeStatus = (status: string | null | undefined): 'Pendente' | 'Enviada' | 'Cancelada' => {
  if (status === 'Enviada') return 'Enviada';
  if (status === 'Cancelada') return 'Cancelada';
  return 'Pendente'; // Default to 'Pendente' for null, undefined, or any other value
};

// Get lista de programação entrega for the provided date
export const fetchListaProgramacaoEntregaByDate = async (date: Date): Promise<ListaProgramacaoEntrega[]> => {
  const formattedDate = format(date, "yyyy-MM-dd");
  
  const { data, error } = await supabase
    .from("bd_lista_programacao_entrega")
    .select(`
      *,
      caminhao:caminhao_id (id, placa, modelo),
      equipe:equipe_id (id, nome_equipe),
      usina:usina_id (id, nome_usina)
    `)
    .eq("data_entrega", formattedDate);
  
  if (error) {
    console.error("Error fetching lista programação entrega:", error);
    throw new Error(error.message);
  }
  
  // Normalize status values to our union type
  return (data || []).map(item => ({
    ...item,
    status: normalizeStatus(item.status)
  })) as ListaProgramacaoEntrega[];
};

// Get lista de programação entrega with filters
export const fetchListaProgramacaoEntregaFiltered = async (filters: RegistroCargaFilters): Promise<ListaProgramacaoEntrega[]> => {
  let query = supabase
    .from("bd_lista_programacao_entrega")
    .select(`
      *,
      caminhao:caminhao_id (id, placa, modelo),
      equipe:equipe_id (id, nome_equipe),
      usina:usina_id (id, nome_usina)
    `);
  
  // Apply filters
  if (filters.data_inicio) {
    query = query.gte("data_entrega", format(filters.data_inicio, "yyyy-MM-dd"));
  }
  
  if (filters.caminhao_id && filters.caminhao_id !== 'all') {
    query = query.eq("caminhao_id", filters.caminhao_id);
  }
  
  if (filters.logradouro) {
    query = query.ilike("logradouro", `%${filters.logradouro}%`);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error("Error fetching lista programação entrega filtered:", error);
    throw new Error(error.message);
  }
  
  // Normalize status values to our union type
  return (data || []).map(item => ({
    ...item,
    status: normalizeStatus(item.status)
  })) as ListaProgramacaoEntrega[];
};

// Get registro carga by lista_entrega_id
export const fetchRegistroCargaByListaEntregaId = async (listaEntregaId: string): Promise<RegistroCarga | null> => {
  const { data, error } = await supabase
    .from("bd_registro_cargas")
    .select("*")
    .eq("lista_entrega_id", listaEntregaId)
    .maybeSingle();
  
  if (error) {
    console.error("Error fetching registro carga:", error);
    throw new Error(error.message);
  }
  
  return data as RegistroCarga;
};

// Create new registro carga
export const createRegistroCarga = async (values: RegistroCargaFormValues): Promise<RegistroCarga> => {
  try {
    // Check if the entrega status allows registration (only Pendente status can be registered)
    const { data: entregaData, error: entregaError } = await supabase
      .from("bd_lista_programacao_entrega")
      .select("status")
      .eq("id", values.lista_entrega_id)
      .single();
    
    if (entregaError) {
      console.error("Error checking entrega status:", entregaError);
      throw new Error("Não foi possível verificar o status da entrega");
    }
    
    if (entregaData.status === 'Cancelada') {
      throw new Error("Não é possível registrar uma entrega cancelada");
    }
    
    if (entregaData.status === 'Enviada') {
      console.log("Esta entrega já foi registrada. Atualizando o registro existente.");
      const existingRegistro = await fetchRegistroCargaByListaEntregaId(values.lista_entrega_id);
      if (existingRegistro) {
        return await updateRegistroCarga(existingRegistro.id, values);
      }
    }
    
    // Handle image uploads if they are File objects
    let imagemTicketSaidaUrl = values.imagem_ticket_saida;
    let imagemTicketRetornoUrl = values.imagem_ticket_retorno;
    
    // If no imagem_ticket_saida has been provided, create a placeholder URL
    // This is necessary because the database column is NOT NULL
    if (!values.imagem_ticket_saida) {
      imagemTicketSaidaUrl = "https://placeholder.com/registro-carga-sem-imagem.jpg";
    } else if (values.imagem_ticket_saida instanceof File) {
      try {
        imagemTicketSaidaUrl = await uploadImage(values.imagem_ticket_saida, "registros-carga");
      } catch (error) {
        console.error("Error uploading ticket saida:", error);
        // Use placeholder if upload fails
        imagemTicketSaidaUrl = "https://placeholder.com/registro-carga-sem-imagem.jpg";
      }
    }
    
    if (values.imagem_ticket_retorno instanceof File) {
      try {
        imagemTicketRetornoUrl = await uploadImage(values.imagem_ticket_retorno, "registros-carga");
      } catch (error) {
        console.error("Error uploading ticket retorno:", error);
        imagemTicketRetornoUrl = null; // Set to null if upload fails
      }
    }
    
    const newRegistro = {
      lista_entrega_id: values.lista_entrega_id,
      programacao_id: values.programacao_id,
      data_saida: values.data_saida,
      hora_saida: values.hora_saida,
      temperatura_saida: values.temperatura_saida || null,
      tonelada_saida: Number(values.tonelada_saida),
      imagem_ticket_saida: imagemTicketSaidaUrl as string, // Type assertion to string
      tonelada_retorno: values.tonelada_retorno ? Number(values.tonelada_retorno) : null,
      imagem_ticket_retorno: imagemTicketRetornoUrl as string | null, // Type assertion to string | null
      status_registro: values.status_registro || "Ativo",
    };
    
    // First check if the database already has a registro for this lista_entrega_id
    const existingRegistro = await fetchRegistroCargaByListaEntregaId(values.lista_entrega_id);
    
    if (existingRegistro) {
      // If there's already a registro, update it instead of creating a new one
      return await updateRegistroCarga(existingRegistro.id, values);
    }
    
    // Create the registro_cargas
    const { data, error } = await supabase
      .from("bd_registro_cargas")
      .insert(newRegistro)
      .select()
      .single();
    
    if (error) {
      console.error("Error creating registro carga:", error);
      throw new Error(error.message);
    }
    
    // The status update is now handled by the database trigger
    // We don't need to manually update the status here
    console.log("Registro created successfully. Status update will be handled by the database trigger.");
    
    return data as RegistroCarga;
  } catch (error) {
    console.error("Error in createRegistroCarga:", error);
    throw error;
  }
};

// Update existing registro carga
export const updateRegistroCarga = async (id: string, values: RegistroCargaFormValues): Promise<RegistroCarga> => {
  try {
    // Handle image uploads if they are File objects
    let imagemTicketSaidaUrl = values.imagem_ticket_saida;
    let imagemTicketRetornoUrl = values.imagem_ticket_retorno;
    
    // If no imagem_ticket_saida is provided, use a placeholder
    if (!values.imagem_ticket_saida) {
      imagemTicketSaidaUrl = "https://placeholder.com/registro-carga-sem-imagem.jpg";
    } else if (values.imagem_ticket_saida instanceof File) {
      try {
        imagemTicketSaidaUrl = await uploadImage(values.imagem_ticket_saida, "registros-carga");
      } catch (error) {
        console.error("Error uploading ticket saida:", error);
        // Use placeholder if upload fails and no existing URL
        if (typeof values.imagem_ticket_saida !== 'string') {
          imagemTicketSaidaUrl = "https://placeholder.com/registro-carga-sem-imagem.jpg";
        }
      }
    }
    
    if (values.imagem_ticket_retorno instanceof File) {
      try {
        imagemTicketRetornoUrl = await uploadImage(values.imagem_ticket_retorno, "registros-carga");
      } catch (error) {
        console.error("Error uploading ticket retorno:", error);
        // Keep the existing URL if upload fails and it's a string
        if (typeof values.imagem_ticket_retorno !== 'string') {
          imagemTicketRetornoUrl = null;
        }
      }
    }
    
    const updatedRegistro = {
      lista_entrega_id: values.lista_entrega_id,
      programacao_id: values.programacao_id,
      data_saida: values.data_saida,
      hora_saida: values.hora_saida,
      temperatura_saida: values.temperatura_saida || null,
      tonelada_saida: Number(values.tonelada_saida),
      imagem_ticket_saida: imagemTicketSaidaUrl as string,
      tonelada_retorno: values.tonelada_retorno ? Number(values.tonelada_retorno) : null,
      imagem_ticket_retorno: imagemTicketRetornoUrl as string | null,
      status_registro: values.status_registro || "Ativo",
    };
    
    const { data, error } = await supabase
      .from("bd_registro_cargas")
      .update(updatedRegistro)
      .eq("id", id)
      .select()
      .single();
    
    if (error) {
      console.error("Error updating registro carga:", error);
      throw new Error(error.message);
    }
    
    // Ensure the status is 'Enviada' in the bd_lista_programacao_entrega table
    try {
      const { error: updateError } = await supabase
        .from("bd_lista_programacao_entrega")
        .update({ status: 'Enviada' })
        .eq("id", values.lista_entrega_id);
      
      if (updateError) {
        console.error("Error updating lista programação entrega status:", updateError);
      } else {
        console.log("Status updated successfully to 'Enviada'");
      }
    } catch (error) {
      console.error("Error handling status update:", error);
    }
    
    return data as RegistroCarga;
  } catch (error) {
    console.error("Error in updateRegistroCarga:", error);
    throw error;
  }
};

// Export the function with a different name for backward compatibility
export const uploadFile = uploadImage;
