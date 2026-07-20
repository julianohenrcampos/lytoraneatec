import { supabase } from "@/integrations/supabase/client";

export const getFrotasDropdown = async () => {
  const { data, error } = await supabase
    .from("bd_frotas")
    .select("id, codigo, descricao, empresa_id, empresa:bd_empresas(id, nome_empresa)")
    .eq("ativo", true)
    .order("codigo");

  if (error) {
    console.error("Error fetching frotas dropdown:", error);
    throw error;
  }

  return data as unknown as { id: string; codigo: string; descricao: string | null; empresa_id: string | null; empresa: { id: string; nome_empresa: string } | null }[];
};

export const getFabricantesRelacionalDropdown = async () => {
  const { data, error } = await supabase
    .from("bd_fabricantes")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome");

  if (error) {
    console.error("Error fetching fabricantes relacional dropdown:", error);
    throw error;
  }

  return data as { id: string; nome: string }[];
};

export const getModelosDropdown = async (fabricanteId?: string) => {
  let query = supabase
    .from("bd_modelos")
    .select("id, nome_modelo, fabricante_id")
    .eq("ativo", true)
    .order("nome_modelo");

  if (fabricanteId) {
    query = query.eq("fabricante_id", fabricanteId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching modelos dropdown:", error);
    throw error;
  }

  return data as { id: string; nome_modelo: string; fabricante_id: string }[];
};

export const getTiposEquipamentoDropdown = async () => {
  const { data, error } = await supabase
    .from("bd_tipos_equipamento")
    .select("id, descricao_padronizada, categoria_id, subcategoria_id, capacidade_m3, capacidade_ton, exige_operador")
    .eq("ativo", true)
    .order("descricao_padronizada");

  if (error) {
    console.error("Error fetching tipos equipamento dropdown:", error);
    throw error;
  }

  return data;
};

export const getLinhasOperacionaisDropdown = async () => {
  const { data, error } = await supabase
    .from("bd_linhas_operacionais")
    .select("id, codigo, nome, descricao, cor_hex")
    .eq("ativo", true)
    .order("codigo");

  if (error) {
    console.error("Error fetching linhas operacionais dropdown:", error);
    throw error;
  }

  return data as { id: string; codigo: string; nome: string; descricao: string | null; cor_hex: string | null }[];
};

export const getCentrosCustoDropdown = async () => {
  const { data, error } = await supabase
    .from("bd_centros_custo")
    .select("id, nome_centro_custo, codigo_centro_custo")
    .order("nome_centro_custo");

  if (error) {
    console.error("Error fetching centros custo dropdown:", error);
    throw error;
  }

  return data;
};

/**
 * Centros de Custo ativos e no escopo do usuário — usado no cadastro de veículo
 * para permitir informar opcionalmente o CC inicial (origem CADASTRO).
 */
export const getCentrosCustoAtivosDropdown = async () => {
  const { data, error } = await supabase
    .from("bd_centros_custo")
    .select("id, nome_centro_custo, codigo_centro_custo, situacao")
    .eq("situacao", "Ativo")
    .order("codigo_centro_custo")
    .order("nome_centro_custo");

  if (error) {
    console.error("Error fetching centros custo ativos dropdown:", error);
    throw error;
  }

  return (data ?? []) as {
    id: string;
    nome_centro_custo: string;
    codigo_centro_custo: string;
    situacao: string | null;
  }[];
};
