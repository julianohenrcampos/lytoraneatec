
import { supabase } from "@/integrations/supabase/client";
import { RegistroAplicacao, RegistroAplicacaoFormValues } from "@/types/registroAplicacao";
import { fetchRegistroAplicacaoByListaEntregaId } from "./fetchRegistroAplicacao";

/**
 * Create new registro aplicação
 */
export const createRegistroAplicacao = async (values: RegistroAplicacaoFormValues): Promise<RegistroAplicacao> => {
  try {
    // First check if we already have a registro for this lista_entrega_id
    const existingRegistro = await fetchRegistroAplicacaoByListaEntregaId(values.lista_entrega_id);
    
    if (existingRegistro) {
      console.log("Registro aplicação already exists, updating instead");
      return await updateRegistroAplicacao(existingRegistro.id, values);
    }
    
    console.log("Creating new registro aplicação with values:", values);
    
    // Insert into bd_registro_apontamento_aplicacao table ONLY
    const { data, error } = await supabase
      .from("bd_registro_apontamento_aplicacao")
      .insert(values)
      .select()
      .single();
    
    if (error) {
      console.error("Error creating registro aplicação:", error);
      throw error;
    }
    
    return data as RegistroAplicacao;
  } catch (error) {
    console.error("Error in createRegistroAplicacao:", error);
    throw error;
  }
};

/**
 * Update existing registro aplicação
 */
export const updateRegistroAplicacao = async (id: string, values: RegistroAplicacaoFormValues): Promise<RegistroAplicacao> => {
  try {
    console.log("Updating registro aplicação with values:", values);
    
    // Update the bd_registro_apontamento_aplicacao table
    const { data, error } = await supabase
      .from("bd_registro_apontamento_aplicacao")
      .update(values)
      .eq("id", id)
      .select()
      .single();
    
    if (error) {
      console.error("Error updating registro aplicação:", error);
      throw error;
    }
    
    return data as RegistroAplicacao;
  } catch (error) {
    console.error("Error in updateRegistroAplicacao:", error);
    throw error;
  }
};
