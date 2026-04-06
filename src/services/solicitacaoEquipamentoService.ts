import { supabase } from "@/integrations/supabase/client";

export type StatusFluxo = "RASCUNHO" | "PENDENTE_APROVACAO" | "APROVADO" | "EM_TRANSPORTE" | "EM_EXECUCAO" | "CONCLUIDO" | "NEGADO";

export const STATUS_FLUXO_LABELS: Record<StatusFluxo, string> = {
  RASCUNHO: "Rascunho",
  PENDENTE_APROVACAO: "Pendente Aprovação",
  APROVADO: "Aprovado",
  EM_TRANSPORTE: "Em Transporte",
  EM_EXECUCAO: "Em Execução",
  CONCLUIDO: "Concluído",
  NEGADO: "Negado",
};

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
  status_fluxo: StatusFluxo;
  resultado_matching: string | null;
  possui_disponibilidade_interna: boolean | null;
  quantidade_disponivel_encontrada: number | null;
  sugestao_acao: string | null;
  engenheiro_solicitante_id: string | null;
  apontador_responsavel_id: string | null;
  aprovador_centro_custo_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  // Joins
  nome_centro_custo?: string;
  codigo_centro_custo?: string;
  descricao_tipo_equipamento?: string;
  engenheiro_nome?: string;
  apontador_nome?: string;
  aprovador_nome?: string;
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
  engenheiro_solicitante_id?: string | null;
  apontador_responsavel_id?: string | null;
}

export const fetchSolicitacoesEquipamento = async (filters?: {
  status?: string;
  prioridade?: string;
  tipo_equipamento_id?: string;
  status_fluxo?: string;
}): Promise<SolicitacaoEquipamento[]> => {
  let query = supabase
    .from("bd_solicitacoes_equipamento")
    .select(`
      *,
      centro_custo:bd_centros_custo(nome_centro_custo, codigo_centro_custo),
      tipo_equipamento:bd_tipos_equipamento(descricao_padronizada),
      engenheiro:profiles!bd_solicitacoes_equipamento_engenheiro_solicitante_id_fkey(nome_completo),
      apontador:profiles!bd_solicitacoes_equipamento_apontador_responsavel_id_fkey(nome_completo),
      aprovador:profiles!bd_solicitacoes_equipamento_aprovador_centro_custo_id_fkey(nome_completo)
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
  if (filters?.status_fluxo) {
    query = query.eq("status_fluxo", filters.status_fluxo as any);
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
    engenheiro_nome: item.engenheiro?.nome_completo || null,
    apontador_nome: item.apontador?.nome_completo || null,
    aprovador_nome: item.aprovador?.nome_completo || null,
  }));
};

export const getAprovadorByCentroCusto = async (centroCustoId: string): Promise<{ id: string; nome: string } | null> => {
  const { data, error } = await supabase
    .from("bd_centros_custo")
    .select("aprovador_diarias_id")
    .eq("id", centroCustoId)
    .single();

  if (error || !data?.aprovador_diarias_id) return null;

  const { data: funcionario } = await supabase
    .from("bd_funcionarios")
    .select("id, nome_completo")
    .eq("id", data.aprovador_diarias_id)
    .single();

  if (!funcionario) return null;
  return { id: funcionario.id, nome: funcionario.nome_completo || "Sem nome" };
};

export const createSolicitacaoEquipamento = async (
  data: SolicitacaoEquipamentoInsert
): Promise<SolicitacaoEquipamento> => {
  // Fetch approver from centro de custo
  const aprovador = await getAprovadorByCentroCusto(data.centro_custo_id);

  const insertData: any = {
    ...data,
    aprovador_centro_custo_id: aprovador?.id || null,
    status_fluxo: "PENDENTE_APROVACAO",
  };

  const { data: result, error } = await supabase
    .from("bd_solicitacoes_equipamento")
    .insert(insertData)
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

  // Create approval record
  if (aprovador?.id) {
    await supabase.from("bd_solicitacoes_equip_aprovacoes").insert({
      solicitacao_id: result.id,
      etapa_aprovacao: "CENTRO_CUSTO",
      aprovador_id: aprovador.id,
      status: "PENDENTE",
    });
  }

  return {
    ...result,
    nome_centro_custo: (result as any).centro_custo?.nome_centro_custo || null,
    codigo_centro_custo: (result as any).centro_custo?.codigo_centro_custo || null,
    descricao_tipo_equipamento: (result as any).tipo_equipamento?.descricao_padronizada || null,
  } as SolicitacaoEquipamento;
};

export const aprovarSolicitacaoEquipamento = async (solicitacaoId: string, comentario?: string) => {
  // Update approval record
  const { error: errAprov } = await supabase
    .from("bd_solicitacoes_equip_aprovacoes")
    .update({
      status: "APROVADO",
      comentario: comentario || null,
      data_decisao: new Date().toISOString(),
    })
    .eq("solicitacao_id", solicitacaoId)
    .eq("status", "PENDENTE");

  if (errAprov) throw errAprov;

  // Update solicitacao status_fluxo
  const { error } = await supabase
    .from("bd_solicitacoes_equipamento")
    .update({ status_fluxo: "APROVADO" } as any)
    .eq("id", solicitacaoId);

  if (error) throw error;
};

export const negarSolicitacaoEquipamento = async (solicitacaoId: string, comentario?: string) => {
  const { error: errAprov } = await supabase
    .from("bd_solicitacoes_equip_aprovacoes")
    .update({
      status: "NEGADO",
      comentario: comentario || null,
      data_decisao: new Date().toISOString(),
    })
    .eq("solicitacao_id", solicitacaoId)
    .eq("status", "PENDENTE");

  if (errAprov) throw errAprov;

  const { error } = await supabase
    .from("bd_solicitacoes_equipamento")
    .update({ status_fluxo: "NEGADO" } as any)
    .eq("id", solicitacaoId);

  if (error) throw error;
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
