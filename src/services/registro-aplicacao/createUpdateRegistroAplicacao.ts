
import { supabase } from "@/integrations/supabase/client";
import { RegistroAplicacao, RegistroAplicacaoFormValues } from "@/types/registroAplicacao";
import { registroAplicacaoSelectQuery } from "./baseService";

/**
 * Create a new registro aplicação entry
 * @param values Form values to insert
 * @returns Created registro aplicação
 */
export const createRegistroAplicacao = async (values: RegistroAplicacaoFormValues): Promise<RegistroAplicacao> => {
  try {
    console.log("Creating registro aplicação with values:", values);
    
    // Insert the new record
    const { data, error } = await supabase
      .from("bd_registro_apontamento_aplicacao")
      .insert(values)
      .select(registroAplicacaoSelectQuery)
      .single();
    
    if (error) {
      console.error("Error creating registro aplicação:", error);
      throw error;
    }
    
    console.log("Created registro aplicação:", data);
    return data as RegistroAplicacao;
  } catch (error) {
    console.error("Unexpected error creating registro aplicação:", error);
    throw error;
  }
};

/**
 * Update an existing registro aplicação entry
 * @param id Record ID to update
 * @param values Form values to update
 * @returns Updated registro aplicação
 */
export const updateRegistroAplicacao = async (
  id: string,
  values: Partial<RegistroAplicacaoFormValues>
): Promise<RegistroAplicacao> => {
  try {
    console.log("Updating registro aplicação with ID:", id, "Values:", values);
    
    // Update the record
    const { data, error } = await supabase
      .from("bd_registro_apontamento_aplicacao")
      .update(values)
      .eq("id", id)
      .select(registroAplicacaoSelectQuery)
      .single();
    
    if (error) {
      console.error("Error updating registro aplicação:", error);
      throw error;
    }
    
    console.log("Updated registro aplicação:", data);
    return data as RegistroAplicacao;
  } catch (error) {
    console.error("Unexpected error updating registro aplicação:", error);
    throw error;
  }
};
