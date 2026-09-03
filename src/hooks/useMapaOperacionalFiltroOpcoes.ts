import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  getCategoriasDropdown,
  getSubcategoriasDropdown,
} from "@/services/veiculo/dropdowns";
import { fetchFuncionariosOperacionais } from "@/services/apontamentoCaminhoesService";
import type { MultiComboboxOption } from "@/components/ui/multi-combobox";

async function fetchCentrosCustoLookup(): Promise<MultiComboboxOption[]> {
  const { data, error } = await supabase
    .from("bd_centros_custo")
    .select("id, codigo_centro_custo, nome_centro_custo")
    .order("nome_centro_custo");
  if (error) throw error;
  return (data || []).map((r) => ({
    value: r.id as string,
    label: `${r.codigo_centro_custo ? r.codigo_centro_custo + " · " : ""}${r.nome_centro_custo}`,
  }));
}

/**
 * Reusa serviços já autorizados por RBAC das telas de Caminhões/Equipamentos e Apontamentos.
 * Erros individuais não derrubam a página — cada dropdown falha em modo silencioso.
 */
export function useMapaOperacionalFiltroOpcoes(categoriaIds: string[]) {
  const centros = useQuery({
    queryKey: ["mapa-operacional", "opcoes", "cc"],
    queryFn: fetchCentrosCustoLookup,
    staleTime: 5 * 60_000,
  });

  const categorias = useQuery({
    queryKey: ["mapa-operacional", "opcoes", "categorias"],
    queryFn: async (): Promise<MultiComboboxOption[]> => {
      const rows = await getCategoriasDropdown();
      return rows.map((r) => ({ value: r.id, label: r.nome_categoria }));
    },
    staleTime: 5 * 60_000,
  });

  const subcategorias = useQuery({
    queryKey: ["mapa-operacional", "opcoes", "subcategorias", categoriaIds],
    queryFn: async (): Promise<MultiComboboxOption[]> => {
      const rows = await getSubcategoriasDropdown();
      const filtered = categoriaIds.length
        ? rows.filter((r) => categoriaIds.includes(r.categoria_id))
        : rows;
      return filtered.map((r) => ({ value: r.id, label: r.nome_subcategoria }));
    },
    staleTime: 5 * 60_000,
  });

  const operadores = useQuery({
    queryKey: ["mapa-operacional", "opcoes", "operadores"],
    queryFn: async (): Promise<MultiComboboxOption[]> => {
      const rows = await fetchFuncionariosOperacionais();
      return rows.map((r) => ({ value: r.id, label: r.label }));
    },
    staleTime: 5 * 60_000,
  });

  return {
    centros: centros.data ?? [],
    categorias: categorias.data ?? [],
    subcategorias: subcategorias.data ?? [],
    operadores: operadores.data ?? [],
    loading:
      centros.isLoading ||
      categorias.isLoading ||
      subcategorias.isLoading ||
      operadores.isLoading,
  };
}
