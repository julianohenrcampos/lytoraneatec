
import { supabase } from "@/integrations/supabase/client";
import { Equipe, EquipeFormData } from "@/types/equipe";

// Function to create new equipe
export const createEquipe = async (data: EquipeFormData): Promise<Equipe> => {
  try {
    const { data: newEquipe, error } = await supabase
      .from("bd_equipes")
      .insert(data)
      .select()
      .single();

    if (error) throw new Error(error.message);
    
    // Update equipe_id for all team members
    if (data.equipe && data.equipe.length > 0) {
      for (const funcionarioId of data.equipe) {
        const { error: updateError } = await supabase
          .from("bd_funcionarios")
          .update({ equipe_id: newEquipe.id })
          .eq("id", funcionarioId);
          
        if (updateError) {
          console.error(`Error updating funcionario ${funcionarioId}:`, updateError);
        }
      }
    }
    
    return newEquipe as unknown as Equipe;
  } catch (error) {
    console.error("Error creating equipe:", error);
    throw error;
  }
};
