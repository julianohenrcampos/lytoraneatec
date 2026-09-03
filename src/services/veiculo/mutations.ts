
import { supabase } from "@/integrations/supabase/client";
import { Veiculo } from "@/types/veiculo";
import { VeiculoFormData } from "./types";

export const createVeiculo = async (veiculo: Omit<Veiculo, "id" | "created_at" | "updated_at">) => {
  const { data, error } = await supabase
    .from("bd_caminhoes_equipamentos")
    .insert([veiculo])
    .select();

  if (error) {
    console.error("Error creating veiculo:", error);
    throw error;
  }

  return data[0] as Veiculo;
};

// Colunas de projeção e joins que NUNCA devem ser enviadas no UPDATE.
// A projeção (centro_custo_atual_*) é mantida exclusivamente por triggers.
const READONLY_UPDATE_FIELDS = [
  "centro_custo_atual_id",
  "centro_custo_atual_origem",
  "centro_custo_atualizado_em",
  "centro_custo_atualizado_por",
  "centro_custo_atual_codigo",
  "centro_custo_atual_nome",
  "centro_custo_origem",
  "ultimo_apontamento_id",
  "nome_centro_custo",
  "centro_custo_id",
  "nome_departamento",
  "nome_empresa",
  "nome_categoria",
  "nome_subcategoria",
  "nome_empresa_locadora",
] as const;

export const updateVeiculo = async (id: string, veiculo: Partial<Veiculo>) => {
  const payload: Record<string, unknown> = { ...(veiculo as Record<string, unknown>) };
  for (const key of READONLY_UPDATE_FIELDS) {
    if (key in payload) delete payload[key];
  }

  const { data, error } = await supabase
    .from("bd_caminhoes_equipamentos")
    .update(payload)
    .eq("id", id)
    .select();

  if (error) {
    console.error("Error updating veiculo:", error);
    throw error;
  }

  return data[0] as Veiculo;
};

export const deleteVeiculo = async (id: string) => {
  const { error } = await supabase
    .from("bd_caminhoes_equipamentos")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting veiculo:", error);
    throw error;
  }

  return true;
};
