
import { supabase } from "@/integrations/supabase/client";
import { Veiculo, VeiculoAlocacaoAtual } from "@/types/veiculo";
import { VeiculoFilter } from "./types";

async function fetchAlocacaoAtual(ids: string[]): Promise<Map<string, VeiculoAlocacaoAtual>> {
  const map = new Map<string, VeiculoAlocacaoAtual>();
  if (ids.length === 0) return map;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("fn_veiculos_alocacao_atual", {
    p_equipamento_ids: ids,
  });
  if (error) {
    console.warn("fn_veiculos_alocacao_atual falhou:", error.message);
    return map;
  }
  (data as VeiculoAlocacaoAtual[] | null)?.forEach((row) => {
    if (row?.equipamento_id) map.set(row.equipamento_id, row);
  });
  return map;
}

function mergeAlocacao(item: any, aloc?: VeiculoAlocacaoAtual): Veiculo {
  const base: Veiculo = {
    ...item,
    nome_departamento: item.departamento?.nome_departamento,
    nome_empresa: item.empresa?.nome_empresa,
    nome_categoria: item.categoria?.nome_categoria,
    nome_subcategoria: item.subcategoria?.nome_subcategoria,
    nome_empresa_locadora: item.empresa_locadora?.nome_empresa,
    nome_centro_custo: aloc?.centro_custo_atual_nome ?? null,
    centro_custo_id: aloc?.centro_custo_atual_id ?? null,
    centro_custo_atual_id: aloc?.centro_custo_atual_id ?? null,
    centro_custo_atual_codigo: aloc?.centro_custo_atual_codigo ?? null,
    centro_custo_atual_nome: aloc?.centro_custo_atual_nome ?? null,
    centro_custo_origem: aloc?.centro_custo_origem ?? 'SEM_ALOCACAO',
    ultimo_apontamento_id: aloc?.ultimo_apontamento_id ?? null,
    centro_custo_atualizado_em: aloc?.centro_custo_atualizado_em ?? null,
  };
  return base;
}

export const getVeiculos = async (filters: VeiculoFilter = {}) => {
  let query = supabase
    .from("bd_caminhoes_equipamentos")
    .select(`
      *,
      departamento:departamento_id(id, nome_departamento),
      empresa:bd_empresas(id, nome_empresa),
      categoria:bd_categorias_ativos(id, nome_categoria),
      subcategoria:bd_subcategorias_ativos(id, nome_subcategoria),
      empresa_locadora:bd_empresas_locadoras(id, nome_empresa)
    `);

  if (filters.placa) query = query.ilike("placa", `%${filters.placa}%`);
  if (filters.fabricante) query = query.ilike("fabricante", `%${filters.fabricante}%`);
  if (filters.situacao && filters.situacao !== "_all") query = query.eq("situacao", filters.situacao);
  if (filters.departamento_id && filters.departamento_id !== "_all") query = query.eq("departamento_id", filters.departamento_id);
  if (filters.empresa_id && filters.empresa_id !== "_all") query = query.eq("empresa_id", filters.empresa_id);
  if (filters.frota && filters.frota !== "_all") {
    query = query.or(`frota.ilike.%${filters.frota}%,numero_frota.ilike.%${filters.frota}%`);
  }
  if (filters.categoria_ativo_id && filters.categoria_ativo_id !== "_all") query = query.eq("categoria_ativo_id", filters.categoria_ativo_id);
  if (filters.subcategoria_ativo_id && filters.subcategoria_ativo_id !== "_all") query = query.eq("subcategoria_ativo_id", filters.subcategoria_ativo_id);
  if (filters.capacidade) query = query.ilike("capacidade", `%${filters.capacidade}%`);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) {
    console.error("Error fetching veiculos:", error);
    throw error;
  }

  const ids = (data ?? []).map((r: any) => r.id).filter(Boolean);
  const alocMap = await fetchAlocacaoAtual(ids);

  return (data ?? []).map((item: any) => mergeAlocacao(item, alocMap.get(item.id))) as Veiculo[];
};

export const fetchVeiculos = getVeiculos;

export const getVeiculoById = async (id: string) => {
  const { data, error } = await supabase
    .from("bd_caminhoes_equipamentos")
    .select(`
      *,
      departamento:departamento_id(id, nome_departamento),
      empresa:bd_empresas(id, nome_empresa),
      categoria:bd_categorias_ativos(id, nome_categoria),
      subcategoria:bd_subcategorias_ativos(id, nome_subcategoria),
      empresa_locadora:bd_empresas_locadoras(id, nome_empresa)
    `)
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching veiculo:", error);
    throw error;
  }

  const alocMap = await fetchAlocacaoAtual([id]);
  return mergeAlocacao(data, alocMap.get(id));
};
