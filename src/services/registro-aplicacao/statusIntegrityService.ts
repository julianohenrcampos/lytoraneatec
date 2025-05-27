
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
    
    // Call the database function to fix inconsistencies
    const { data: corrigidos, error } = await supabase
      .rpc('corrigir_status_entregas_inconsistentes');
    
    if (error) {
      console.error("❌ Error running status correction:", error);
      throw error;
    }
    
    const registrosCorrigidos = corrigidos || 0;
    
    // Get count of total deliveries with massa > 0
    const { data: entregasComMassa, error: countError } = await supabase
      .from("bd_lista_programacao_entrega")
      .select("id")
      .gte("quantidade_massa", 0.01);
    
    if (countError) {
      console.error("❌ Error counting deliveries:", countError);
      throw countError;
    }
    
    const totalEntregas = entregasComMassa?.length || 0;
    
    const report: StatusIntegrityReport = {
      totalEntregas,
      corrigidasParaEnviada: Math.floor(registrosCorrigidos / 2), // Estimate
      corrigidasParaEntregue: Math.ceil(registrosCorrigidos / 2), // Estimate
      inconsistenciasEncontradas: registrosCorrigidos
    };
    
    console.log("📊 Status integrity report:", report);
    
    return report;
  } catch (error) {
    console.error("💥 Error in status integrity check:", error);
    throw error;
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
