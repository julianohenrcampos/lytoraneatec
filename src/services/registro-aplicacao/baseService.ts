
import { supabase } from "@/integrations/supabase/client";

/**
 * Common select query for registro aplicacao with related entities
 */
export const registroAplicacaoSelectQuery = `
  *,
  lista_entrega:lista_entrega_id (
    *,
    caminhao:caminhao_id (id, placa, modelo),
    equipe:equipe_id (id, nome_equipe),
    usina:usina_id (id, nome_usina)
  ),
  registro_carga:registro_carga_id (*)
`;

