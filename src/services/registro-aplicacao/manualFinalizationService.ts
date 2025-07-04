
import { supabase } from "@/integrations/supabase/client";

interface FinalizationResult {
  success: boolean;
  carga_id: string;
  total_aplicado: number;
  massa_total: number;
  espessura_media: number;
  num_aplicacoes: number;
}

export const finalizarCargaManual = async (cargaId: string): Promise<FinalizationResult> => {
  try {
    console.log('🔧 [MANUAL] Finalizando carga manualmente:', cargaId);
    
    const { data, error } = await supabase.rpc('finalizar_carga_manual', {
      carga_id: cargaId
    });
    
    if (error) {
      console.error('❌ [MANUAL] Erro ao finalizar carga:', error);
      throw error;
    }
    
    console.log('✅ [MANUAL] Carga finalizada com sucesso:', data);
    return data;
    
  } catch (error) {
    console.error('❌ [MANUAL] Erro crítico na finalização:', error);
    throw error;
  }
};

export const calcularMassaRemanescente = async (entregaId: string): Promise<number> => {
  try {
    const { data, error } = await supabase.rpc('calcular_massa_remanescente', {
      entrega_id: entregaId
    });
    
    if (error) {
      console.error('❌ [MANUAL] Erro ao calcular massa remanescente:', error);
      return 0;
    }
    
    return data || 0;
    
  } catch (error) {
    console.error('❌ [MANUAL] Erro crítico no cálculo:', error);
    return 0;
  }
};
