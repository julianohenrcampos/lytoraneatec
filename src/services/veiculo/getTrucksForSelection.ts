
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIA_IDS } from "@/constants/categorias";

export interface TruckForSelection {
  id: string;
  nome_caminhao: string;
  placa?: string | null;
}

/**
 * Fetches trucks from the database that are available for selection
 * Filters by categoria_ativo_id = CAMINHAO and situacao in ['Disponível', 'Operando']
 */
export const getTrucksForSelection = async (): Promise<TruckForSelection[]> => {
  try {
    const { data, error } = await supabase
      .from("bd_caminhoes_equipamentos")
      .select("id, placa, fabricante, frota, numero_frota, subcategoria:bd_subcategorias_ativos(nome_subcategoria)")
      .eq("categoria_ativo_id", CATEGORIA_IDS.CAMINHAO)
      .in("situacao", ["Disponível", "Operando"])
      .order("placa", { ascending: true });

    if (error) {
      console.error("Error fetching trucks for selection:", error);
      throw error;
    }

    return (data || []).map((truck: any) => {
      let nome_caminhao = "Sem identificação";
      const subcatNome = truck.subcategoria?.nome_subcategoria;
      if (truck.placa && subcatNome) {
        nome_caminhao = `${truck.placa} - ${subcatNome}`;
      } else if (truck.placa) {
        nome_caminhao = truck.placa;
      } else if (truck.frota && truck.numero_frota) {
        nome_caminhao = `${truck.frota} ${truck.numero_frota}`;
      } else if (subcatNome && truck.fabricante) {
        nome_caminhao = `${truck.fabricante} ${subcatNome}`;
      } else if (subcatNome) {
        nome_caminhao = subcatNome;
      }

      return {
        id: truck.id,
        nome_caminhao,
        placa: truck.placa,
      };
    });
  } catch (error) {
    console.error("Error in getTrucksForSelection:", error);
    throw error;
  }
};
