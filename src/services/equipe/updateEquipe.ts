
import { supabase } from "@/integrations/supabase/client";
import { Equipe, EquipeFormData } from "@/types/equipe";

// Function to update an existing equipe
export const updateEquipe = async (id: string, data: EquipeFormData): Promise<Equipe> => {
  try {
    console.log("Updating equipe with ID:", id, "with data:", data);
    
    // Update the equipe record
    const { data: updatedEquipe, error } = await supabase
      .from("bd_equipes")
      .update(data)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating equipe:", error);
      throw new Error(error.message);
    }
    
    // First, clear all existing team member associations by removing the equipe_id
    const { error: clearError } = await supabase
      .from("bd_funcionarios")
      .update({ equipe_id: null })
      .eq("equipe_id", id);
      
    if (clearError) {
      console.error("Error clearing team members:", clearError);
      throw new Error(clearError.message);
    }
    
    // Then update equipe_id for all new team members
    if (data.equipe && data.equipe.length > 0) {
      for (const funcionarioId of data.equipe) {
        const { error: updateError } = await supabase
          .from("bd_funcionarios")
          .update({ equipe_id: id })
          .eq("id", funcionarioId);
          
        if (updateError) {
          console.error(`Error updating funcionario ${funcionarioId}:`, updateError);
          // Continue trying to update other team members despite errors
        }
      }
    }
    
    console.log("Equipe updated successfully:", updatedEquipe);
    return updatedEquipe as unknown as Equipe;
  } catch (error) {
    console.error("Error updating equipe:", error);
    throw error;
  }
};
