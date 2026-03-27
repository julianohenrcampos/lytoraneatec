import { supabase } from "@/integrations/supabase/client";

export interface SolicitacaoEquipamento {
  id: string;
  centro_custo_id: string;
  solicitante_id: string | null;
  tipo_equipamento_id: string | null;
  quantidade: number;
  data_inicio: string;
  tempo_previsto_dias: number | null;
  regime_trabalho: string | null;
  com_operador: boolean | null;
  prioridade: "NORMAL" | "ALTA" | "URGENTE";
  justificativa: string;
  status: "ABERTO" | "EM_ANALISE" | "ATENDIDO" | "NEGADO";
  resultado_matching: string | null;
  possui_disponibilidade_interna: boolean | null;
  quantidade_disponivel_encontrada: number | null;
  sugestao_acao: string | null;
  created_at: string | null;
  updated_at: string | null;
  // Joins
  nome_centro_custo?: string;
  codigo_centro_custo?: string;
  descricao_tipo_equipamento?: string;
}

export interface SolicitacaoEquipamentoInsert {
  centro_custo_id: string;
  solicitante_id?: string | null;
  tipo_equipamento_id?: string | null;
  quantidade: number;
  data_inicio: string;
  tempo_previsto_dias?: number | null;
  regime_trabalho?: string | null;
  com_operador?: boolean | null;
  prioridade?: "NORMAL" | "ALTA" | "URGENTE";
  justificativa: string;
}

export const fetchSolicitacoesEquipamento = async (filters?: {
  status?: string;
  prioridade?: string;
  tipo_equipamento_id?: string;
}): Promise<SolicitacaoEquipamento[]> => {
  let query = supabase
    .from("bd_solicitacoes_equipamento")
    .select(`
      *,
      centro_custo:bd_centros_custo(nome_centro_custo, codigo_centro_custo),
      tipo_equipamento:bd_tipos_equipamento(descricao_padronizada)
    `)
    .order("created_at", { ascending: false });

  if (filters?.status) {
    query = query.eq("status", filters.status as any);
  }
  if (filters?.prioridade) {
    query = query.eq("prioridade", filters.prioridade as any);
  }
  if (filters?.tipo_equipamento_id) {
    query = query.eq("tipo_equipamento_id", filters.tipo_equipamento_id);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching solicitacoes equipamento:", error);
    throw error;
  }

  return (data || []).map((item: any) => ({
    ...item,
    nome_centro_custo: item.centro_custo?.nome_centro_custo || null,
    codigo_centro_custo: item.centro_custo?.codigo_centro_custo || null,
    descricao_tipo_equipamento: item.tipo_equipamento?.descricao_padronizada || null,
  }));
};

export const createSolicitacaoEquipamento = async (
  data: SolicitacaoEquipamentoInsert
): Promise<SolicitacaoEquipamento> => {
  const { data: result, error } = await supabase
    .from("bd_solicitacoes_equipamento")
    .insert(data)
    .select(`
      *,
      centro_custo:bd_centros_custo(nome_centro_custo, codigo_centro_custo),
      tipo_equipamento:bd_tipos_equipamento(descricao_padronizada)
    `)
    .single();

  if (error) {
    console.error("Error creating solicitacao equipamento:", error);
    throw error;
  }

  return {
    ...result,
    nome_centro_custo: (result as any).centro_custo?.nome_centro_custo || null,
    codigo_centro_custo: (result as any).centro_custo?.codigo_centro_custo || null,
    descricao_tipo_equipamento: (result as any).tipo_equipamento?.descricao_padronizada || null,
  } as SolicitacaoEquipamento;
};

export const runMatching = async (solicitacaoId: string) => {
  try {
    const { data, error } = await supabase.rpc("buscar_equipamentos_disponiveis", {
      p_tipo_equipamento_id: null,
    });
    
    if (error) {
      console.warn("Matching function not available yet:", error.message);
      return null;
    }
    return data;
  } catch (e) {
    console.warn("Matching not available:", e);
    return null;
  }
};
