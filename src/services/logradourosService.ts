
import { supabase } from "@/integrations/supabase/client";

interface LogradouroOption {
  id: string;
  logradouro: string;
  requisicao_id: string;
}

/**
 * Fetch logradouros by requisition ID
 * @param requisicaoId - The requisition ID to search for
 * @returns Array of logradouro options
 */
export const fetchLogradourosByRequisicao = async (requisicaoId: string): Promise<LogradouroOption[]> => {
  try {
    console.log("Fetching logradouros for requisicao:", requisicaoId);
    
    const { data: ruasData, error: ruasError } = await supabase
      .from('bd_ruas_requisicao')
      .select('id, logradouro, requisicao_id')
      .eq('requisicao_id', requisicaoId);
    
    if (ruasError) throw ruasError;
    
    const formattedLogradouros = ruasData?.map(rua => ({
      id: rua.id,
      logradouro: rua.logradouro,
      requisicao_id: rua.requisicao_id
    })) || [];
    
    console.log("Logradouros found:", formattedLogradouros.length);
    return formattedLogradouros;
  } catch (error) {
    console.error("Error fetching logradouros:", error);
    throw error;
  }
};
