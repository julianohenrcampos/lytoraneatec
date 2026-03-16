import { supabase } from "@/integrations/supabase/client";

export const getFabricantesDropdown = async () => {
  const { data, error } = await supabase
    .from("bd_caminhoes_equipamentos")
    .select("fabricante")
    .order("fabricante");

  if (error) {
    console.error("Error fetching fabricantes dropdown:", error);
    throw error;
  }

  const fabricantes = data.map(item => item.fabricante).filter(Boolean);
  const uniqueFabricantes = [...new Set(fabricantes)];

  return uniqueFabricantes as string[];
};

// Keep backward compat alias
export const getMarcasDropdown = getFabricantesDropdown;

export const getDepartamentosDropdown = async () => {
  const { data, error } = await supabase
    .from("bd_departamentos")
    .select("id, nome_departamento")
    .order("nome_departamento");

  if (error) {
    console.error("Error fetching departamentos dropdown:", error);
    throw error;
  }

  return data as { id: string; nome_departamento: string }[];
};

export const getEmpresasDropdown = async () => {
  const { data, error } = await supabase
    .from("bd_empresas")
    .select("id, nome_empresa")
    .eq("situacao", "Ativa")
    .order("nome_empresa");

  if (error) {
    console.error("Error fetching empresas dropdown:", error);
    throw error;
  }

  return data as { id: string; nome_empresa: string }[];
};

export const getCategoriasDropdown = async () => {
  const { data, error } = await supabase
    .from("bd_categorias_ativos")
    .select("id, nome_categoria")
    .eq("ativo", true)
    .order("nome_categoria");

  if (error) {
    console.error("Error fetching categorias dropdown:", error);
    throw error;
  }

  return data as { id: string; nome_categoria: string }[];
};

export const getSubcategoriasDropdown = async (categoriaId?: string) => {
  let query = supabase
    .from("bd_subcategorias_ativos")
    .select("id, nome_subcategoria, categoria_id")
    .eq("ativo", true)
    .order("nome_subcategoria");

  if (categoriaId) {
    query = query.eq("categoria_id", categoriaId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching subcategorias dropdown:", error);
    throw error;
  }

  return data as { id: string; nome_subcategoria: string; categoria_id: string }[];
};
