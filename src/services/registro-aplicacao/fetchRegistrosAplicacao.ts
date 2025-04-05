
import { supabase } from "@/integrations/supabase/client";
import { RegistroAplicacao, RegistroAplicacaoFilters } from "@/types/registroAplicacao";
import { format } from "date-fns";
import { registroAplicacaoSelectQuery } from "./baseService";

/**
 * Fetch all aplicações with filters
 */
export const fetchRegistrosAplicacao = async (filters: RegistroAplicacaoFilters = {}): Promise<RegistroAplicacao[]> => {
  let query = supabase
    .from("bd_registro_apontamento_aplicacao")
    .select(registroAplicacaoSelectQuery);
  
  // Apply filters
  if (filters.data_inicio) {
    query = query.gte("data_aplicacao", format(filters.data_inicio, "yyyy-MM-dd"));
  }
  
  if (filters.caminhao_id && filters.caminhao_id !== 'all') {
    query = query.eq("lista_entrega.caminhao_id", filters.caminhao_id);
  }
  
  if (filters.centro_custo_id && filters.centro_custo_id !== 'all') {
    query = query.eq("lista_entrega.centro_custo_id", filters.centro_custo_id);
  }
  
  const { data, error } = await query.order("created_at", { ascending: false });
  
  if (error) {
    console.error("Error fetching registros aplicação:", error);
    throw error;
  }
  
  return data as RegistroAplicacao[];
};
