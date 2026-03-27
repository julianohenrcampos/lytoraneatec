import { supabase } from "@/integrations/supabase/client";

export interface Frota {
  id: string;
  codigo: string;
  descricao: string | null;
  tipo_propriedade_padrao: string | null;
  empresa_id: string | null;
  ativo: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  empresa?: { id: string; nome_empresa: string } | null;
}

export interface FrotaFormData {
  codigo: string;
  descricao: string | null;
  tipo_propriedade_padrao: string | null;
  empresa_id: string | null;
  ativo: boolean;
}

export async function getFrotas(filters: { codigo?: string; tipo?: string; ativo?: string } = {}) {
  let query = supabase
    .from('bd_frotas')
    .select('*, empresa:bd_empresas(id, nome_empresa)');

  if (filters.codigo) {
    query = query.ilike('codigo', `%${filters.codigo}%`);
  }
  if (filters.tipo && filters.tipo !== 'all') {
    query = query.eq('tipo_propriedade_padrao', filters.tipo);
  }
  if (filters.ativo && filters.ativo !== 'all') {
    query = query.eq('ativo', filters.ativo === 'true');
  }

  const { data, error } = await query.order('codigo');
  if (error) throw error;
  return data as unknown as Frota[];
}

export async function createFrota(data: FrotaFormData) {
  const { data: result, error } = await supabase
    .from('bd_frotas')
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function updateFrota(id: string, data: FrotaFormData) {
  const { data: result, error } = await supabase
    .from('bd_frotas')
    .update(data)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function checkCodigoExists(codigo: string, excludeId?: string) {
  let query = supabase
    .from('bd_frotas')
    .select('id')
    .eq('codigo', codigo.toUpperCase());
  if (excludeId) query = query.neq('id', excludeId);
  const { data, error } = await query;
  if (error) throw error;
  return (data?.length || 0) > 0;
}
