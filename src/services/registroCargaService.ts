import { supabase } from "@/integrations/supabase/client";
import { ListaProgramacaoEntrega } from "@/types/programacaoEntrega";
import { RegistroCargaFilters, RegistroCargaFormValues, RegistroCarga } from "@/types/registroCargas";
import { format } from "date-fns";
import { uploadImage } from "./storageService";

// Helper function to normalize status values to the union type
const normalizeStatus = (status: string | null | undefined): 'Pendente' | 'Enviada' | 'Cancelada' | 'Entregue' => {
  if (status === 'Enviada') return 'Enviada';
  if (status === 'Cancelada') return 'Cancelada';
  if (status === 'Entregue') return 'Entregue';
  return 'Pendente';
};

// Get lista de programação entrega for the provided date - NOW INCLUDES BAIRRO
export const fetchListaProgramacaoEntregaByDate = async (date: Date): Promise<ListaProgramacaoEntrega[]> => {
  try {
    // Format the date to ISO format (YYYY-MM-DD) for exact matching
    const formattedDate = format(date, "yyyy-MM-dd");
    
    console.log(`[fetchListaProgramacaoEntregaByDate] Fetching entregas for exact date: ${formattedDate}`);
    
    const { data, error } = await supabase
      .from("bd_lista_programacao_entrega")
      .select(`
        *,
        caminhao:caminhao_id (id, placa, modelo),
        equipe:equipe_id (id, nome_equipe),
        usina:usina_id (id, nome_usina),
        requisicao:requisicao_id (
          id,
          centro_custo:centro_custo_id (id, nome_centro_custo, codigo_centro_custo)
        )
      `)
      .eq("data_entrega", formattedDate);
    
    if (error) {
      console.error("[fetchListaProgramacaoEntregaByDate] Error:", error);
      throw new Error(error.message);
    }
    
    console.log(`[fetchListaProgramacaoEntregaByDate] Found ${data?.length || 0} entregas`);
    
    // Add centro_custo_nome to each entry and ensure bairro is included
    const processedData = (data || []).map(item => {
      const centroCustoNome = item.requisicao?.centro_custo?.nome_centro_custo || null;
      return {
        ...item,
        centro_custo_nome: centroCustoNome,
        bairro: item.bairro || "", // Ensure bairro is always present
        status: normalizeStatus(item.status)
      };
    });
    
    return processedData as ListaProgramacaoEntrega[];
  } catch (error) {
    console.error("[fetchListaProgramacaoEntregaByDate] Error:", error);
    return [];
  }
};

// Get lista de programação entrega with filters - NOW INCLUDES BAIRRO
export const fetchListaProgramacaoEntregaFiltered = async (filters: RegistroCargaFilters): Promise<ListaProgramacaoEntrega[]> => {
  try {
    let query = supabase
      .from("bd_lista_programacao_entrega")
      .select(`
        *,
        caminhao:caminhao_id (id, placa, modelo),
        equipe:equipe_id (id, nome_equipe),
        usina:usina_id (id, nome_usina),
        requisicao:requisicao_id (
          id,
          centro_custo:centro_custo_id (id, nome_centro_custo, codigo_centro_custo)
        )
      `);
    
    // Apply filters
    if (filters.data_inicio) {
      // Format the date to ISO format (YYYY-MM-DD) for exact matching
      const formattedDate = format(filters.data_inicio, "yyyy-MM-dd");
      query = query.eq("data_entrega", formattedDate);
      console.log(`[fetchListaProgramacaoEntregaFiltered] Filtering by exact date: ${formattedDate}`);
    }
    
    if (filters.caminhao_id && filters.caminhao_id !== 'all') {
      query = query.eq("caminhao_id", filters.caminhao_id);
    }
    
    if (filters.logradouro) {
      query = query.ilike("logradouro", `%${filters.logradouro}%`);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error("[fetchListaProgramacaoEntregaFiltered] Error:", error);
      throw new Error(error.message);
    }
    
    console.log(`[fetchListaProgramacaoEntregaFiltered] Found ${data?.length || 0} entregas`);
    
    // Add centro_custo_nome to each entry and ensure bairro is included
    const processedData = (data || []).map(item => {
      const centroCustoNome = item.requisicao?.centro_custo?.nome_centro_custo || null;
      return {
        ...item,
        centro_custo_nome: centroCustoNome,
        bairro: item.bairro || "", // Ensure bairro is always present
        status: normalizeStatus(item.status)
      };
    });
    
    return processedData as ListaProgramacaoEntrega[];
  } catch (error) {
    console.error("[fetchListaProgramacaoEntregaFiltered] Error:", error);
    return [];
  }
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

// Create new registro carga - FIXED: Remove tonelada_real from INSERT
export const createRegistroCarga = async (values: RegistroCargaFormValues): Promise<RegistroCarga> => {
  try {
    console.log("[createRegistroCarga] Starting with values:", values);

    // Enhanced validation
    if (!values.lista_entrega_id) {
      throw new Error("ID da entrega é obrigatório");
    }
    
    if (!values.tonelada_saida || Number(values.tonelada_saida) <= 0) {
      throw new Error("Tonelada de saída deve ser maior que zero");
    }

    // Check if the entrega status allows registration
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
    
    // Handle image uploads with better error handling
    let imagemTicketSaidaUrl = "https://placeholder.com/registro-carga-sem-imagem.jpg";
    let imagemTicketRetornoUrl: string | null = null;
    
    console.log("[createRegistroCarga] Processing images...");
    
    if (values.imagem_ticket_saida && values.imagem_ticket_saida instanceof File) {
      try {
        console.log("[createRegistroCarga] Uploading ticket saida...");
        imagemTicketSaidaUrl = await uploadImage(values.imagem_ticket_saida, "tickets");
        console.log("[createRegistroCarga] Ticket saida uploaded:", imagemTicketSaidaUrl);
      } catch (error) {
        console.error("Error uploading ticket saida:", error);
        throw new Error("Erro ao fazer upload da imagem do ticket de saída");
      }
    }
    
    if (values.imagem_ticket_retorno && values.imagem_ticket_retorno instanceof File) {
      try {
        console.log("[createRegistroCarga] Uploading ticket retorno...");
        imagemTicketRetornoUrl = await uploadImage(values.imagem_ticket_retorno, "tickets");
        console.log("[createRegistroCarga] Ticket retorno uploaded:", imagemTicketRetornoUrl);
      } catch (error) {
        console.error("Error uploading ticket retorno:", error);
        throw new Error("Erro ao fazer upload da imagem do ticket de retorno");
      }
    }
    
    // Prepare data WITHOUT tonelada_real (let database calculate it)
    const newRegistro = {
      lista_entrega_id: values.lista_entrega_id,
      programacao_id: values.programacao_id,
      data_saida: values.data_saida,
      hora_saida: values.hora_saida,
      temperatura_saida: values.temperatura_saida || null,
      tonelada_saida: Number(values.tonelada_saida),
      tonelada_retorno: values.tonelada_retorno ? Number(values.tonelada_retorno) : null,
      // REMOVED: tonelada_real - let database calculate this automatically
      imagem_ticket_saida: imagemTicketSaidaUrl,
      imagem_ticket_retorno: imagemTicketRetornoUrl,
      status_registro: values.status_registro || "Ativo",
    };
    
    console.log("[createRegistroCarga] Final registro data (without tonelada_real):", newRegistro);
    
    // Check for existing registro first
    const existingRegistro = await fetchRegistroCargaByListaEntregaId(values.lista_entrega_id);
    
    if (existingRegistro) {
      console.log("[createRegistroCarga] Updating existing registro:", existingRegistro.id);
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
      throw new Error(`Erro ao criar registro: ${error.message}`);
    }
    
    console.log("[createRegistroCarga] Successfully created registro:", data.id);
    
    return data as RegistroCarga;
  } catch (error) {
    console.error("Error in createRegistroCarga:", error);
    throw error;
  }
};

// Update existing registro carga - FIXED: Remove tonelada_real from UPDATE
export const updateRegistroCarga = async (id: string, values: RegistroCargaFormValues): Promise<RegistroCarga> => {
  try {
    console.log("[updateRegistroCarga] Starting update for ID:", id, "with values:", values);

    // Handle image uploads if they are File objects
    let imagemTicketSaidaUrl = values.imagem_ticket_saida;
    let imagemTicketRetornoUrl = values.imagem_ticket_retorno;
    
    // If no imagem_ticket_saida is provided, use a placeholder
    if (!values.imagem_ticket_saida) {
      imagemTicketSaidaUrl = "https://placeholder.com/registro-carga-sem-imagem.jpg";
    } else if (values.imagem_ticket_saida instanceof File) {
      try {
        console.log("[updateRegistroCarga] Uploading new ticket saida...");
        imagemTicketSaidaUrl = await uploadImage(values.imagem_ticket_saida, "tickets");
        console.log("[updateRegistroCarga] New ticket saida uploaded:", imagemTicketSaidaUrl);
      } catch (error) {
        console.error("Error uploading ticket saida:", error);
        throw new Error("Erro ao fazer upload da imagem do ticket de saída");
      }
    }
    
    if (values.imagem_ticket_retorno instanceof File) {
      try {
        console.log("[updateRegistroCarga] Uploading new ticket retorno...");
        imagemTicketRetornoUrl = await uploadImage(values.imagem_ticket_retorno, "tickets");
        console.log("[updateRegistroCarga] New ticket retorno uploaded:", imagemTicketRetornoUrl);
      } catch (error) {
        console.error("Error uploading ticket retorno:", error);
        throw new Error("Erro ao fazer upload da imagem do ticket de retorno");
      }
    }
    
    // Prepare data WITHOUT tonelada_real (let database calculate it)
    const updatedRegistro = {
      lista_entrega_id: values.lista_entrega_id,
      programacao_id: values.programacao_id,
      data_saida: values.data_saida,
      hora_saida: values.hora_saida,
      temperatura_saida: values.temperatura_saida || null,
      tonelada_saida: Number(values.tonelada_saida),
      tonelada_retorno: values.tonelada_retorno ? Number(values.tonelada_retorno) : null,
      // REMOVED: tonelada_real - let database calculate this automatically
      imagem_ticket_saida: imagemTicketSaidaUrl as string,
      imagem_ticket_retorno: imagemTicketRetornoUrl as string | null,
      status_registro: values.status_registro || "Ativo",
    };
    
    console.log("[updateRegistroCarga] Final update data (without tonelada_real):", updatedRegistro);
    
    const { data, error } = await supabase
      .from("bd_registro_cargas")
      .update(updatedRegistro)
      .eq("id", id)
      .select()
      .single();
    
    if (error) {
      console.error("Error updating registro carga:", error);
      throw new Error(`Erro ao atualizar registro: ${error.message}`);
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
    
    console.log("[updateRegistroCarga] Successfully updated registro:", data.id);
    
    return data as RegistroCarga;
  } catch (error) {
    console.error("Error in updateRegistroCarga:", error);
    throw error;
  }
};

// Export the function with a different name for backward compatibility
export const uploadFile = uploadImage;
