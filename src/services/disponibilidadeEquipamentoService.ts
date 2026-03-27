import { supabase } from "@/integrations/supabase/client";

export interface DisponibilidadeEquipamento {
  id: string;
  equipamento_id: string;
  status_operacional: string;
  centro_custo_id: string | null;
  data_inicio: string | null;
  previsao_liberacao: string | null;
  confiabilidade_previsao: string | null;
  motivo_risco: string | null;
  observacao: string | null;
  created_at: string | null;
  updated_at: string | null;
  // Joins
  equipamento_codigo_frota?: string;
  equipamento_numero_frota?: string;
  tipo_equipamento_descricao?: string;
  empresa_nome?: string;
  centro_custo_nome?: string;
  centro_custo_codigo?: string;
}

export interface DisponibilidadeFilters {
  status_operacional?: string;
  tipo_equipamento_id?: string;
  centro_custo_id?: string;
  empresa_id?: string;
}

export const fetchDisponibilidades = async (filters?: DisponibilidadeFilters): Promise<DisponibilidadeEquipamento[]> => {
  let query = supabase
    .from("bd_disponibilidade_equipamentos")
    .select(`
      *,
      equipamento:bd_caminhoes_equipamentos(
        id, frota, numero_frota,
        tipo_equipamento:bd_tipos_equipamento(descricao_padronizada),
        empresa:bd_empresas(nome_empresa)
      ),
      centro_custo:bd_centros_custo(nome_centro_custo, codigo_centro_custo)
    `)
    .order("updated_at", { ascending: false });

  if (filters?.status_operacional) {
    query = query.eq("status_operacional", filters.status_operacional as any);
  }
  if (filters?.centro_custo_id) {
    query = query.eq("centro_custo_id", filters.centro_custo_id);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching disponibilidades:", error);
    throw error;
  }

  let results = (data || []).map((item: any) => ({
    ...item,
    equipamento_codigo_frota: item.equipamento?.frota || null,
    equipamento_numero_frota: item.equipamento?.numero_frota || null,
    tipo_equipamento_descricao: item.equipamento?.tipo_equipamento?.descricao_padronizada || null,
    empresa_nome: item.equipamento?.empresa?.nome_empresa || null,
    centro_custo_nome: item.centro_custo?.nome_centro_custo || null,
    centro_custo_codigo: item.centro_custo?.codigo_centro_custo || null,
  }));

  // Client-side filters for joined fields
  if (filters?.tipo_equipamento_id) {
    results = results.filter((r: any) => r.equipamento?.tipo_equipamento_id === filters.tipo_equipamento_id);
  }
  if (filters?.empresa_id) {
    results = results.filter((r: any) => r.equipamento?.empresa_id === filters.empresa_id);
  }

  return results;
};

export const upsertDisponibilidade = async (data: {
  id?: string;
  equipamento_id: string;
  status_operacional: "DISPONIVEL" | "ALOCADO" | "MANUTENCAO" | "INDISPONIVEL";
  centro_custo_id?: string | null;
  data_inicio?: string | null;
  previsao_liberacao?: string | null;
  confiabilidade_previsao?: "ALTA" | "MEDIA" | "BAIXA" | null;
  motivo_risco?: string | null;
  observacao?: string | null;
}) => {
  if (data.id) {
    const { id, ...updateData } = data;
    const { error } = await supabase
      .from("bd_disponibilidade_equipamentos")
      .update(updateData)
      .eq("id", id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("bd_disponibilidade_equipamentos")
      .insert([data]);
    if (error) throw error;
  }
};

export const getEquipamentosDropdown = async () => {
  const { data, error } = await supabase
    .from("bd_caminhoes_equipamentos")
    .select("id, frota, numero_frota")
    .order("frota");
  if (error) throw error;
  return data || [];
};
