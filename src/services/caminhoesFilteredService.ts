
import { supabase } from "@/integrations/supabase/client";
import { debugLog } from "@/lib/debug";
import { CATEGORIA_IDS } from "@/constants/categorias";

/**
 * Fetch caminhões with available capacity
 */
export const fetchCaminhoesWithCapacity = async (): Promise<{ id: string; placa: string; nome_subcategoria: string }[]> => {
  try {
    console.log("🚚 fetchCaminhoesWithCapacity - Fetching caminhões...");
    
    const { data, error } = await supabase
      .from('bd_caminhoes_equipamentos')
      .select(`id, placa, capacidade, situacao, categoria_ativo_id,
        subcategoria:bd_subcategorias_ativos(nome_subcategoria)
      `)
      .eq('categoria_ativo_id', CATEGORIA_IDS.CAMINHAO)
      .not('capacidade', 'is', null)
      .neq('capacidade', '')
      .in('situacao', ['Disponível', 'Operando'])
      .order('placa');

    if (error) {
      console.error("❌ Error fetching caminhões with capacity:", error);
      debugLog("Supabase Error", error);
      throw error;
    }

    console.log(`✅ Fetched ${data?.length || 0} caminhões with capacity`);
    
    return (data || []).map((caminhao: any) => ({
      id: caminhao.id,
      placa: caminhao.placa || '',
      nome_subcategoria: caminhao.subcategoria?.nome_subcategoria || ''
    }));
  } catch (error) {
    console.error("❗ Error in fetchCaminhoesWithCapacity:", error);
    debugLog("Error Details", error);
    return [];
  }
};
