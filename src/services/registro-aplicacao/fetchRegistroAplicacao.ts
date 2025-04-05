
import { supabase } from "@/integrations/supabase/client";
import { RegistroAplicacao } from "@/types/registroAplicacao";
import { registroAplicacaoSelectQuery } from "./baseService";

/**
 * Get registro aplicação by id
 */
export const fetchRegistroAplicacaoById = async (id: string): Promise<RegistroAplicacao | null> => {
  const { data, error } = await supabase
    .from("bd_registro_apontamento_aplicacao")
    .select(registroAplicacaoSelectQuery)
    .eq("id", id)
    .single();
  
  if (error) {
    console.error("Error fetching registro aplicação:", error);
    throw error;
  }
  
  return data as RegistroAplicacao;
};

/**
 * Get registro aplicação by lista_entrega_id
 */
export const fetchRegistroAplicacaoByListaEntregaId = async (listaEntregaId: string): Promise<RegistroAplicacao | null> => {
  const { data, error } = await supabase
    .from("bd_registro_apontamento_aplicacao")
    .select(registroAplicacaoSelectQuery)
    .eq("lista_entrega_id", listaEntregaId)
    .maybeSingle();
  
  if (error) {
    console.error("Error fetching registro aplicação by lista entrega id:", error);
    throw error;
  }
  
  return data as RegistroAplicacao;
};
