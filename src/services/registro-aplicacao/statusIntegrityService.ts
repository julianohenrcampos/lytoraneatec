
import { supabase } from "@/integrations/supabase/client";

/**
 * Service for maintaining status integrity in deliveries
 */

export interface StatusIntegrityReport {
  totalEntregas: number;
  corrigidasParaEnviada: number;
  corrigidasParaEntregue: number;
  inconsistenciasEncontradas: number;
}

/**
 * Check and fix status inconsistencies in deliveries
 */
export const checkAndFixStatusIntegrity = async (): Promise<StatusIntegrityReport> => {
  try {
    console.log("🔧 Starting status integrity check...");
    
    // Get all deliveries with their massa remanescente
    const { data: entregas, error: entregasError } = await supabase
      .from("bd_lista_programacao_entrega")
      .select(`
        id,
        status,
        quantidade_massa,
        logradouro
      `)
      .gte("quantidade_massa", 0.01);
    
    if (entregasError) {
      console.error("❌ Error fetching deliveries:", entregasError);
      throw entregasError;
    }
    
    let corrigidasParaEnviada = 0;
    let corrigidasParaEntregue = 0;
    let inconsistenciasEncontradas = 0;
    
    // Check each delivery individually
    for (const entrega of entregas || []) {
      try {
        // Calculate massa remanescente for this delivery
        const { data: massaResult, error: massaError } = await supabase
          .rpc('calcular_massa_remanescente', { entrega_id: entrega.id });
        
        if (massaError) {
          console.error(`Error calculating massa for ${entrega.id}:`, massaError);
          continue;
        }
        
        const massaRemanescente = massaResult || 0;
        
        // Check for inconsistencies and fix them
        let novoStatus = entrega.status;
        
        if (entrega.status === 'Entregue' && massaRemanescente > 0.001) {
          // Marked as delivered but has remaining mass
          novoStatus = 'Enviada';
          inconsistenciasEncontradas++;
        } else if (entrega.status === 'Enviada' && massaRemanescente <= 0.001) {
          // Marked as sent but has no remaining mass
          novoStatus = 'Entregue';
          inconsistenciasEncontradas++;
        }
        
        // Update status if needed
        if (novoStatus !== entrega.status) {
          const { error: updateError } = await supabase
            .from("bd_lista_programacao_entrega")
            .update({ status: novoStatus })
            .eq("id", entrega.id);
          
          if (updateError) {
            console.error(`Error updating status for ${entrega.id}:`, updateError);
            continue;
          }
          
          if (novoStatus === 'Enviada') {
            corrigidasParaEnviada++;
          } else if (novoStatus === 'Entregue') {
            corrigidasParaEntregue++;
          }
          
          console.log(`✅ Updated ${entrega.logradouro} from ${entrega.status} to ${novoStatus} (massa: ${massaRemanescente.toFixed(2)})`);
        }
      } catch (error) {
        console.error(`Error processing delivery ${entrega.id}:`, error);
        continue;
      }
    }
    
    const report: StatusIntegrityReport = {
      totalEntregas: entregas?.length || 0,
      corrigidasParaEnviada,
      corrigidasParaEntregue,
      inconsistenciasEncontradas
    };
    
    console.log("📊 Status integrity report:", report);
    
    return report;
  } catch (error) {
    console.error("💥 Error in status integrity check:", error);
    throw error;
  }
};

/**
 * Force update delivery status based on massa remanescente
 */
export const forceUpdateDeliveryStatus = async (entregaId: string): Promise<boolean> => {
  try {
    console.log(`🔄 Force updating status for delivery: ${entregaId}`);
    
    // Calculate massa remanescente
    const { data: massaResult, error: massaError } = await supabase
      .rpc('calcular_massa_remanescente', { entrega_id: entregaId });
    
    if (massaError) {
      console.error("❌ Error calculating massa remanescente:", massaError);
      return false;
    }
    
    const massaRemanescente = massaResult || 0;
    const novoStatus = massaRemanescente <= 0.001 ? 'Entregue' : 'Enviada';
    
    // Update status
    const { error: updateError } = await supabase
      .from("bd_lista_programacao_entrega")
      .update({ status: novoStatus })
      .eq("id", entregaId);
    
    if (updateError) {
      console.error("❌ Error updating delivery status:", updateError);
      return false;
    }
    
    console.log(`✅ Delivery status updated to: ${novoStatus} (massa remanescente: ${massaRemanescente.toFixed(2)})`);
    return true;
  } catch (error) {
    console.error("💥 Error in force update delivery status:", error);
    return false;
  }
};

/**
 * Get deliveries with potential status issues
 */
export const getDeliveriesWithStatusIssues = async () => {
  try {
    const { data, error } = await supabase
      .from("bd_lista_programacao_entrega")
      .select(`
        id,
        logradouro,
        status,
        quantidade_massa,
        caminhao:caminhao_id (placa, modelo)
      `)
      .order("data_entrega", { ascending: false });
    
    if (error) {
      console.error("❌ Error fetching deliveries for status check:", error);
      throw error;
    }
    
    if (!data) return [];
    
    // Check each delivery's massa remanescente
    const deliveriesWithMassa = await Promise.all(
      data.map(async (delivery) => {
        try {
          const { data: massaResult, error: massaError } = await supabase
            .rpc('calcular_massa_remanescente', { entrega_id: delivery.id });
          
          if (massaError) {
            console.error(`Error calculating massa for ${delivery.id}:`, massaError);
            return null;
          }
          
          const massaRemanescente = massaResult || 0;
          
          // Check for inconsistencies
          const hasInconsistency = 
            (delivery.status === 'Entregue' && massaRemanescente > 0.001) ||
            (delivery.status === 'Enviada' && massaRemanescente <= 0.001);
          
          return {
            ...delivery,
            massa_remanescente: massaRemanescente,
            hasInconsistency
          };
        } catch (error) {
          console.error(`Error processing delivery ${delivery.id}:`, error);
          return null;
        }
      })
    );
    
    return deliveriesWithMassa.filter(d => d && d.hasInconsistency);
  } catch (error) {
    console.error("💥 Error getting deliveries with status issues:", error);
    throw error;
  }
};
