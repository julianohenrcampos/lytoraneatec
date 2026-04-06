import { supabase } from "@/integrations/supabase/client";

export interface CatalogoEquipamento {
  id: string;
  tipo_equipamento_id: string | null;
  categoria_id: string | null;
  subcategoria_id: string | null;
  fabricante_id: string | null;
  modelo_id: string | null;
  ano_fabricacao_padrao: number | null;
  capacidade: string | null;
  potencia: string | null;
  combustivel: string | null;
  cor_padrao: string | null;
  motor_padrao: string | null;
  descricao_padrao: string | null;
  imagem_url: string | null;
  ativo: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  // Joins
  tipo_equipamento_descricao?: string;
  categoria_nome?: string;
  subcategoria_nome?: string;
  fabricante_nome?: string;
  modelo_nome?: string;
}

export interface CatalogoFilters {
  tipo_equipamento_id?: string;
  categoria_id?: string;
  fabricante_id?: string;
  ativo?: string;
}

export const fetchCatalogos = async (filters?: CatalogoFilters): Promise<CatalogoEquipamento[]> => {
  let query = supabase
    .from("bd_catalogo_equipamentos")
    .select(`
      *,
      tipo_equipamento:bd_tipos_equipamento(descricao_padronizada),
      categoria:bd_categorias_ativos(nome_categoria),
      subcategoria:bd_subcategorias_ativos(nome),
      fabricante:bd_fabricantes(nome),
      modelo:bd_modelos(nome_modelo)
    `)
    .order("created_at", { ascending: false });

  if (filters?.tipo_equipamento_id) {
    query = query.eq("tipo_equipamento_id", filters.tipo_equipamento_id);
  }
  if (filters?.categoria_id) {
    query = query.eq("categoria_id", filters.categoria_id);
  }
  if (filters?.fabricante_id) {
    query = query.eq("fabricante_id", filters.fabricante_id);
  }
  if (filters?.ativo === "true") {
    query = query.eq("ativo", true);
  } else if (filters?.ativo === "false") {
    query = query.eq("ativo", false);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((item: any) => ({
    ...item,
    tipo_equipamento_descricao: item.tipo_equipamento?.descricao_padronizada || null,
    categoria_nome: item.categoria?.nome_categoria || null,
    subcategoria_nome: item.subcategoria?.nome || null,
    fabricante_nome: item.fabricante?.nome || null,
    modelo_nome: item.modelo?.nome_modelo || null,
  }));
};

export const upsertCatalogo = async (data: {
  id?: string;
  tipo_equipamento_id?: string | null;
  categoria_id?: string | null;
  subcategoria_id?: string | null;
  fabricante_id?: string | null;
  modelo_id?: string | null;
  ano_fabricacao_padrao?: number | null;
  capacidade?: string | null;
  potencia?: string | null;
  combustivel?: string | null;
  cor_padrao?: string | null;
  motor_padrao?: string | null;
  descricao_padrao?: string | null;
  ativo?: boolean;
}) => {
  if (data.id) {
    const { id, ...updateData } = data;
    const { error } = await supabase.from("bd_catalogo_equipamentos").update(updateData).eq("id", id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("bd_catalogo_equipamentos").insert(data);
    if (error) throw error;
  }
};

export const getCatalogosDropdown = async () => {
  const { data, error } = await supabase
    .from("bd_catalogo_equipamentos")
    .select(`
      id,
      descricao_padrao,
      tipo_equipamento:bd_tipos_equipamento(descricao_padronizada),
      fabricante:bd_fabricantes(nome),
      modelo:bd_modelos(nome_modelo)
    `)
    .eq("ativo", true)
    .order("descricao_padrao");
  if (error) throw error;
  return (data || []).map((item: any) => ({
    id: item.id,
    label: item.descricao_padrao || 
      [item.tipo_equipamento?.descricao_padronizada, item.fabricante?.nome, item.modelo?.nome_modelo]
        .filter(Boolean).join(" - ") || "Sem descrição",
  }));
};

export const getCategoriasDropdown = async () => {
  const { data, error } = await supabase
    .from("bd_categorias_ativos")
    .select("id, nome_categoria")
    .eq("ativo", true)
    .order("nome_categoria");
  if (error) throw error;
  return data || [];
};

export const getSubcategoriasDropdown = async (categoriaId?: string) => {
  let query = supabase
    .from("bd_subcategorias_ativos")
    .select("id, nome, categoria_id")
    .eq("ativo", true)
    .order("nome");
  if (categoriaId) {
    query = query.eq("categoria_id", categoriaId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};
