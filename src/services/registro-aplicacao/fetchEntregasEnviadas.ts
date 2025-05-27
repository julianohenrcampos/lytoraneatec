
import { supabase } from "@/integrations/supabase/client";
import { ListaProgramacaoEntrega } from "@/types/programacaoEntrega";
import { format } from "date-fns";

/**
 * Fetch all entregas with massa_remanescente > 0 (prioritizing 'Enviada' status but including others)
 * @param date Optional date filter
 * @param equipeId Optional team filter - if provided, only shows deliveries for this team
 */
export const fetchEntregasEnviadas = async (
  date?: Date, 
  equipeId?: string
): Promise<ListaProgramacaoEntrega[]> => {
  try {
    console.log("🔍 Fetching entregas with massa remanescente > 0:", { date, equipeId });
    
    let query = supabase
      .from("bd_lista_programacao_entrega")
      .select(`
        *,
        caminhao:caminhao_id (id, placa, modelo),
        equipe:equipe_id (id, nome_equipe),
        usina:usina_id (id, nome_usina),
        requisicao:requisicao_id (
          id,
          numero,
          centro_custo:centro_custo_id (id, nome_centro_custo)
        )
      `)
      .in("status", ["Enviada", "Pendente"]); // Include both Enviada and Pendente statuses
    
    // Apply date filter if provided
    if (date) {
      const formattedDate = format(date, "yyyy-MM-dd");
      console.log("📅 Applying date filter:", formattedDate);
      query = query.eq("data_entrega", formattedDate);
    }
    
    // Apply team filter if provided (for non-SuperAdmin users)
    if (equipeId) {
      console.log("👥 Applying team filter for equipe:", equipeId);
      query = query.eq("equipe_id", equipeId);
    }
    
    const { data, error } = await query.order("data_entrega", { ascending: false });
    
    if (error) {
      console.error("❌ Error fetching entregas:", error);
      throw error;
    }
    
    if (!data || data.length === 0) {
      console.log("📭 No entregas found with current filters");
      return [];
    }
    
    console.log(`📊 Found ${data.length} entregas before massa calculation`);
    
    // Para cada entrega, calcular a massa remanescente usando a função do banco
    const entregasComMassaRemanescente = await Promise.all(
      data.map(async (entrega) => {
        try {
          // Chamar a função do banco para calcular massa remanescente
          const { data: massaResult, error: massaError } = await supabase
            .rpc('calcular_massa_remanescente', { entrega_id: entrega.id });
          
          if (massaError) {
            console.error(`⚠️ Error calculating massa remanescente for entrega ${entrega.id}:`, massaError);
            return { ...entrega, massa_remanescente: 0 };
          }
          
          const massaRemanescente = massaResult || 0;
          
          console.log(`📋 Entrega ${entrega.logradouro} (${entrega.id.slice(0, 8)}...):`, {
            status: entrega.status,
            massa_remanescente: massaRemanescente,
            caminhao: entrega.caminhao?.placa || 'N/A'
          });
          
          return {
            ...entrega,
            massa_remanescente: massaRemanescente
          };
        } catch (error) {
          console.error(`💥 Error processing entrega ${entrega.id}:`, error);
          return { ...entrega, massa_remanescente: 0 };
        }
      })
    );
    
    // Filtrar apenas entregas com massa remanescente > 0
    const entregasDisponiveis = entregasComMassaRemanescente.filter(
      entrega => entrega.massa_remanescente > 0
    );
    
    // Priorizar entregas com status 'Enviada', mas incluir todas com massa > 0
    const entregasOrdenadas = entregasDisponiveis.sort((a, b) => {
      // Primeiro critério: status 'Enviada' tem prioridade
      if (a.status === 'Enviada' && b.status !== 'Enviada') return -1;
      if (a.status !== 'Enviada' && b.status === 'Enviada') return 1;
      
      // Segundo critério: maior massa remanescente
      return (b.massa_remanescente || 0) - (a.massa_remanescente || 0);
    });
    
    console.log(`✅ Final result: ${entregasDisponiveis.length} entregas with massa > 0`);
    console.log("📈 Status breakdown:", {
      enviada: entregasDisponiveis.filter(e => e.status === 'Enviada').length,
      pendente: entregasDisponiveis.filter(e => e.status === 'Pendente').length,
      outros: entregasDisponiveis.filter(e => !['Enviada', 'Pendente'].includes(e.status)).length
    });
    
    if (entregasOrdenadas.length > 0) {
      console.log("🎯 Top 3 entregas disponíveis:", 
        entregasOrdenadas.slice(0, 3).map(e => ({
          logradouro: e.logradouro,
          status: e.status,
          massa: e.massa_remanescente,
          caminhao: e.caminhao?.placa
        }))
      );
    }
    
    return entregasOrdenadas as ListaProgramacaoEntrega[];
  } catch (error) {
    console.error("💥 Unexpected error fetching entregas:", error);
    throw error;
  }
};
