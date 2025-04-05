
import { supabase } from "@/integrations/supabase/client";
import { ListaProgramacaoEntrega } from "@/types/programacaoEntrega";

/**
 * Fetch both enviadas and entregue entregas (status = 'Enviada' OR status = 'Entregue')
 */
export const fetchEntregasEnviadas = async (): Promise<ListaProgramacaoEntrega[]> => {
  const { data, error } = await supabase
    .from("bd_lista_programacao_entrega")
    .select(`
      *,
      caminhao:caminhao_id (id, placa, modelo),
      equipe:equipe_id (id, nome_equipe),
      usina:usina_id (id, nome_usina)
    `)
    .in("status", ["Enviada", "Entregue"]);
  
  if (error) {
    console.error("Error fetching entregas enviadas:", error);
    throw error;
  }
  
  return data as ListaProgramacaoEntrega[];
};
