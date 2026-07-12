
import { supabase } from "@/integrations/supabase/client";
import { Veiculo } from "@/types/veiculo";
import { VeiculoFilter } from "./types";

export const getVeiculos = async (filters: VeiculoFilter = {}) => {
  let query = supabase
    .from("bd_caminhoes_equipamentos")
    .select(`
      *,
      departamento:departamento_id(id, nome_departamento),
      empresa:bd_empresas(id, nome_empresa),
      categoria:bd_categorias_ativos(id, nome_categoria),
      subcategoria:bd_subcategorias_ativos(id, nome_subcategoria),
      empresa_locadora:bd_empresas_locadoras(id, nome_empresa),
      disponibilidade:bd_disponibilidade_equipamentos(centro_custo_id, status_operacional, centro_custo:bd_centros_custo(nome_centro_custo))
    `);

  if (filters.placa) {
    query = query.ilike("placa", `%${filters.placa}%`);
  }

  if (filters.fabricante) {
    query = query.ilike("fabricante", `%${filters.fabricante}%`);
  }

  if (filters.situacao && filters.situacao !== "_all") {
    query = query.eq("situacao", filters.situacao);
  }

  if (filters.departamento_id && filters.departamento_id !== "_all") {
    query = query.eq("departamento_id", filters.departamento_id);
  }

  if (filters.empresa_id && filters.empresa_id !== "_all") {
    query = query.eq("empresa_id", filters.empresa_id);
  }

  if (filters.frota && filters.frota !== "_all") {
    query = query.or(`frota.ilike.%${filters.frota}%,numero_frota.ilike.%${filters.frota}%`);
  }

  if (filters.categoria_ativo_id && filters.categoria_ativo_id !== "_all") {
    query = query.eq("categoria_ativo_id", filters.categoria_ativo_id);
  }

  if (filters.subcategoria_ativo_id && filters.subcategoria_ativo_id !== "_all") {
    query = query.eq("subcategoria_ativo_id", filters.subcategoria_ativo_id);
  }

  if (filters.capacidade) {
    query = query.ilike("capacidade", `%${filters.capacidade}%`);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching veiculos:", error);
    throw error;
  }

  return data.map(item => {
    // Get the most recent availability record's centro de custo
    const disponibilidades = Array.isArray(item.disponibilidade) ? item.disponibilidade : [];
    const alocado = disponibilidades.find((d: any) => d.status_operacional === 'ALOCADO');
    const dispAtiva = alocado || disponibilidades[0];

    return {
      ...item,
      nome_departamento: item.departamento?.nome_departamento,
      nome_empresa: item.empresa?.nome_empresa,
      nome_categoria: item.categoria?.nome_categoria,
      nome_subcategoria: item.subcategoria?.nome_subcategoria,
      nome_empresa_locadora: item.empresa_locadora?.nome_empresa,
      nome_centro_custo: dispAtiva?.centro_custo?.nome_centro_custo || null,
      centro_custo_id: dispAtiva?.centro_custo_id ?? null,
    };
  }) as Veiculo[];
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
      empresa_locadora:bd_empresas_locadoras(id, nome_empresa),
      disponibilidade:bd_disponibilidade_equipamentos(centro_custo_id, status_operacional, centro_custo:bd_centros_custo(nome_centro_custo))
    `)
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching veiculo:", error);
    throw error;
  }

  const disponibilidades = Array.isArray((data as any).disponibilidade) ? (data as any).disponibilidade : [];
  const alocado = disponibilidades.find((d: any) => d.status_operacional === 'ALOCADO');
  const dispAtiva = alocado || disponibilidades[0];

  return {
    ...data,
    nome_departamento: data.departamento?.nome_departamento,
    nome_empresa: data.empresa?.nome_empresa,
    nome_categoria: data.categoria?.nome_categoria,
    nome_subcategoria: data.subcategoria?.nome_subcategoria,
    nome_empresa_locadora: data.empresa_locadora?.nome_empresa,
    nome_centro_custo: dispAtiva?.centro_custo?.nome_centro_custo || null,
    centro_custo_id: dispAtiva?.centro_custo_id ?? null,
  } as Veiculo;
};
