
import { supabase } from "@/integrations/supabase/client";

// Get centro de custo information for programacao
export const fetchCentroCustoForProgramacao = async (programacaoId: string) => {
  try {
    const { data: programacao, error: programacaoError } = await supabase
      .from("bd_programacao_entrega")
      .select("centro_custo_id")
      .eq("id", programacaoId)
      .single();
    
    if (programacaoError) {
      console.error("Error fetching programacao:", programacaoError);
      return null;
    }
    
    if (!programacao || !programacao.centro_custo_id) {
      return null;
    }
    
    const { data: centroCusto, error: centroCustoError } = await supabase
      .from("bd_centros_custo")
      .select("codigo_centro_custo, nome_centro_custo")
      .eq("id", programacao.centro_custo_id)
      .single();
    
    if (centroCustoError) {
      console.error("Error fetching centro de custo:", centroCustoError);
      return null;
    }
    
    return centroCusto;
  } catch (error) {
    console.error("Error in fetchCentroCustoForProgramacao:", error);
    return null;
  }
};
