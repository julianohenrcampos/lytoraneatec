import { supabase } from "@/integrations/supabase/client";

export interface CatalogoVariacao {
  id: string;
  subcategoria_id: string;
  capacidade_valor: number | null;
  capacidade_unidade: string | null;
  descricao_padrao: string | null;
  origem: string;
  created_at: string | null;
  updated_at: string | null;
  subcategoria_nome?: string;
}

export const getVariacoesDropdown = async (subcategoriaId?: string) => {
  let query = supabase
    .from("bd_catalogo_variacoes")
    .select(`
      id,
      subcategoria_id,
      capacidade_valor,
      capacidade_unidade,
      descricao_padrao,
      origem,
      subcategoria:bd_subcategorias_ativos(nome_subcategoria)
    `)
    .order("capacidade_valor", { ascending: true });

  if (subcategoriaId) {
    query = query.eq("subcategoria_id", subcategoriaId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((item: any) => ({
    id: item.id,
    subcategoria_id: item.subcategoria_id,
    capacidade_valor: item.capacidade_valor,
    capacidade_unidade: item.capacidade_unidade,
    descricao_padrao: item.descricao_padrao,
    origem: item.origem,
    subcategoria_nome: item.subcategoria?.nome_subcategoria || null,
    label: buildVariacaoLabel(item.subcategoria?.nome_subcategoria, item.capacidade_valor, item.capacidade_unidade, item.descricao_padrao),
  }));
};

export const findOrCreateVariacao = async (
  subcategoriaId: string,
  capacidadeValor: number | null,
  capacidadeUnidade: string | null
): Promise<string> => {
  // Try to find existing
  let query = supabase
    .from("bd_catalogo_variacoes")
    .select("id")
    .eq("subcategoria_id", subcategoriaId);

  if (capacidadeValor !== null) {
    query = query.eq("capacidade_valor", capacidadeValor);
  } else {
    query = query.is("capacidade_valor", null);
  }

  if (capacidadeUnidade) {
    query = query.eq("capacidade_unidade", capacidadeUnidade);
  } else {
    query = query.is("capacidade_unidade", null);
  }

  const { data: existing } = await query.maybeSingle();

  if (existing) return existing.id;

  // Create new
  const { data: created, error } = await supabase
    .from("bd_catalogo_variacoes")
    .insert({
      subcategoria_id: subcategoriaId,
      capacidade_valor: capacidadeValor,
      capacidade_unidade: capacidadeUnidade,
      origem: "FORNECEDOR",
    } as any)
    .select("id")
    .single();

  if (error) throw error;
  return created.id;
};

export const getSubcategoriasDropdown = async () => {
  const { data, error } = await supabase
    .from("bd_subcategorias_ativos")
    .select("id, nome_subcategoria, categoria_id")
    .eq("ativo", true)
    .order("nome_subcategoria");
  if (error) throw error;
  return data || [];
};

export const UNIDADES_CAPACIDADE = [
  { value: "ton", label: "Toneladas (ton)" },
  { value: "m³", label: "Metros cúbicos (m³)" },
  { value: "m3", label: "Metros cúbicos (m3)" },
  { value: "m", label: "Metros (m)" },
  { value: "HP", label: "Cavalos (HP)" },
  { value: "CV", label: "Cavalos (CV)" },
  { value: "L", label: "Litros (L)" },
  { value: "kg", label: "Quilogramas (kg)" },
  { value: "un", label: "Unidades (un)" },
];

export const buildVariacaoLabel = (
  subcategoriaNome?: string | null,
  capacidadeValor?: number | null,
  capacidadeUnidade?: string | null,
  descricaoPadrao?: string | null
): string => {
  const parts: string[] = [];
  if (subcategoriaNome) parts.push(subcategoriaNome);
  if (capacidadeValor != null) {
    parts.push(`${capacidadeValor}${capacidadeUnidade ? ` ${capacidadeUnidade}` : ""}`);
  } else if (descricaoPadrao) {
    parts.push(descricaoPadrao);
  }
  return parts.join(" — ") || "Sem descrição";
};
