
import { supabase } from "@/integrations/supabase/client";
import { Equipe, EquipeFilter } from "@/types/equipe";

// Function to fetch equipes with filters
export const fetchEquipes = async (filters: EquipeFilter = {}): Promise<Equipe[]> => {
  try {
    let query = supabase
      .from("bd_equipes")
      .select(`
        *
      `);

    // Apply filters
    if (filters.nome_equipe) {
      query = query.ilike("nome_equipe", `%${filters.nome_equipe}%`);
    }
    
    if (filters.encarregado_id) {
      query = query.eq("encarregado_id", filters.encarregado_id);
    }
    
    if (filters.apontador_id) {
      query = query.eq("apontador_id", filters.apontador_id);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);
    
    // Resolver encarregado/apontador sem embeds para evitar ambiguidade de relacionamento
    const equipesBase = (data || []) as Array<any>;

    const idsParaBuscar = Array.from(new Set(
      equipesBase.flatMap((e) => [e.encarregado_id, e.apontador_id]).filter(Boolean)
    ));

    let mapaFuncionarios = new Map<string, { id: string; nome_completo: string }>();
    if (idsParaBuscar.length > 0) {
      const { data: funcs } = await supabase
        .from("bd_funcionarios")
        .select("id, nome_completo")
        .in("id", idsParaBuscar as string[]);
      (funcs || []).forEach((f) => mapaFuncionarios.set(f.id, { id: f.id, nome_completo: f.nome_completo }));
    }

    const enriquecidas: Equipe[] = equipesBase.map((e) => ({
      ...e,
      encarregado: e.encarregado_id ? mapaFuncionarios.get(e.encarregado_id) || undefined : undefined,
      apontador: e.apontador_id ? mapaFuncionarios.get(e.apontador_id) || undefined : undefined,
    }));
    
    return enriquecidas as Equipe[];
  } catch (error) {
    console.error("Error fetching equipes:", error);
    throw error;
  }
};
