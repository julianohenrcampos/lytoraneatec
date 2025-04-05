
import { supabase } from "@/integrations/supabase/client";
import { Equipe } from "@/types/equipe";

// Function to get equipe by ID
export const getEquipeById = async (id: string): Promise<Equipe> => {
  try {
    console.log(`Buscando equipe com ID: ${id}`);
    
    // Get the base equipe data
    const { data: equipeData, error: equipeError } = await supabase
      .from("bd_equipes")
      .select(`
        *,
        encarregado:encarregado_id(id, nome_completo),
        apontador:apontador_id(id, nome_completo)
      `)
      .eq("id", id)
      .single();

    if (equipeError) {
      console.error(`Erro ao buscar equipe com id ${id}:`, equipeError);
      throw new Error(`Erro ao buscar equipe: ${equipeError.message}`);
    }
    
    if (!equipeData) {
      console.error(`Equipe com id ${id} não encontrada`);
      throw new Error(`Equipe não encontrada`);
    }
    
    // Create a base equipe object
    const equipe = equipeData as unknown as Equipe;
    
    // Fetch all funcionarios who are members of this team
    if (equipe.equipe && equipe.equipe.length > 0) {
      console.log(`Buscando ${equipe.equipe.length} membros da equipe ${id}`);
      
      const { data: membrosData, error: membrosError } = await supabase
        .from("bd_funcionarios")
        .select("id, nome_completo")
        .in("id", equipe.equipe);
        
      if (membrosError) {
        console.error(`Erro ao buscar membros da equipe ${id}:`, membrosError);
        throw new Error(`Erro ao buscar membros da equipe: ${membrosError.message}`);
      }
      
      // Add membros to the equipe object
      equipe.membros = membrosData || [];
      console.log(`Encontrados ${equipe.membros.length} membros para a equipe ${id}`);
    } else {
      console.log(`Equipe ${id} não possui membros definidos`);
      equipe.membros = [];
    }
    
    return equipe;
  } catch (error: any) {
    console.error(`Erro ao buscar equipe com id ${id}:`, error);
    throw new Error(`Não foi possível carregar os membros da equipe: ${error.message || 'Erro desconhecido'}`);
  }
};
