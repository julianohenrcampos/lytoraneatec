import { supabase } from "@/integrations/supabase/client";
import { ApontamentoEquipe, ApontamentoEquipeFilters, ApontamentoEquipeApiData } from "@/types/apontamentoEquipe";
import { format, differenceInCalendarDays } from "date-fns";

export const fetchApontamentosEquipe = async (
  filters: ApontamentoEquipeFilters = {},
  allowedTeamIds: string[] = []
): Promise<ApontamentoEquipe[]> => {
  try {
    console.log("🔍 Fetching apontamentos equipe (via view) with filters:", filters);

    let query = supabase
      .from("vw_apontamento_equipe")
      .select("*");

    // Aplicar filtro por equipes permitidas somente se tiver IDs (SuperAdm: array vazio = sem filtro)
    if (allowedTeamIds.length > 0) {
      query = query.in("equipe_id", allowedTeamIds);
    }

    // Aplicar filtros de data
    if (filters.data_inicio) {
      const formattedDate = format(filters.data_inicio, "yyyy-MM-dd");
      query = query.gte("data_registro", formattedDate);
    }

    if (filters.data_fim) {
      const formattedDate = format(filters.data_fim, "yyyy-MM-dd");
      query = query.lte("data_registro", formattedDate);
    }

    // Filtro por equipe específica (exceto 'all')
    if (filters.equipe_id && filters.equipe_id !== "all") {
      query = query.eq("equipe_id", filters.equipe_id);
    }

    const { data, error } = await query.order("data_registro", { ascending: false });

    if (error) {
      console.error("❌ Error fetching apontamentos equipe (view):", error);
      throw error;
    }

    console.log(`📊 Found ${data?.length || 0} apontamentos (view)`);
    return (data as any) || [];
  } catch (error) {
    console.error("💥 Unexpected error in fetchApontamentosEquipe (view):", error);
    throw error;
  }
};

// Alias para manter compatibilidade
export const fetchApontamentos = fetchApontamentosEquipe;

export const getApontamentoById = async (id: string): Promise<ApontamentoEquipe | null> => {
  try {
    const { data, error } = await supabase
      .from("vw_apontamento_equipe")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching apontamento by ID (view):", error);
      return null;
    }

    return (data as any) || null;
  } catch (error) {
    console.error("Unexpected error in getApontamentoById (view):", error);
    return null;
  }
};

export const createApontamentoEquipe = async (
  apontamento: ApontamentoEquipeApiData
): Promise<ApontamentoEquipe[]> => {
  try {
    // Transform API data to match database structure
    const colaboradores = apontamento.colaboradores || [];
    
    // Create individual records for each colaborador
    const records = colaboradores.map(colaborador => ({
      equipe_id: apontamento.equipe_id,
      data_registro: apontamento.data_registro,
      colaborador_id: colaborador.colaborador_id,
      nome_colaborador: colaborador.nome_colaborador,
      presente: colaborador.presente,
      hora_inicio: colaborador.hora_inicio || null,
      hora_fim: colaborador.hora_fim || null,
      registrado_por: apontamento.registrado_por || null,
      lista_entrega_id: apontamento.lista_entrega_id || null
    }));

    const { data, error } = await supabase
      .from("bd_apontamento_equipe")
      .insert(records)
      .select();

    if (error) {
      console.error("Error creating apontamento equipe:", error);
      throw error;
    }

    return (data as any) || [];
  } catch (error) {
    console.error("Unexpected error in createApontamentoEquipe:", error);
    throw error;
  }
};

export const updateApontamentoEquipe = async (
  equipeId: string,
  dataRegistro: string,
  updates: ApontamentoEquipeApiData
): Promise<ApontamentoEquipe[]> => {
  try {
    // Delete existing records for this team and date
    await supabase
      .from("bd_apontamento_equipe")
      .delete()
      .eq('equipe_id', equipeId)
      .eq('data_registro', dataRegistro);

    // Create new records
    const colaboradores = updates.colaboradores || [];
    const records = colaboradores.map(colaborador => ({
      equipe_id: updates.equipe_id,
      data_registro: updates.data_registro,
      colaborador_id: colaborador.colaborador_id,
      nome_colaborador: colaborador.nome_colaborador,
      presente: colaborador.presente,
      hora_inicio: colaborador.hora_inicio || null,
      hora_fim: colaborador.hora_fim || null,
      registrado_por: updates.registrado_por || null,
      lista_entrega_id: updates.lista_entrega_id || null
    }));

    const { data, error } = await supabase
      .from("bd_apontamento_equipe")
      .insert(records)
      .select();

    if (error) {
      console.error("Error updating apontamento equipe:", error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error("Unexpected error in updateApontamentoEquipe:", error);
    throw error;
  }
};

export const deleteApontamentoEquipe = async (id: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from("bd_apontamento_equipe")
      .delete()
      .eq('id', id);

    if (error) {
      console.error("Error deleting apontamento equipe:", error);
      throw error;
    }
  } catch (error) {
    console.error("Unexpected error in deleteApontamentoEquipe:", error);
    throw error;
  }
};

// Funções de avaliação
export const getLastAvaliacaoForColaborador = async (
  colaboradorId: string,
  equipeId?: string
) => {
  try {
    let query = supabase
      .from("bd_avaliacao_equipe")
      .select(
        "id, data_avaliacao, equipe_id, colaborador_id, competencia_tecnica, comunicacao, trabalho_em_equipe, proatividade, pontualidade, organizacao, observacoes"
      )
      .eq("colaborador_id", colaboradorId);

    if (equipeId) {
      query = query.eq("equipe_id", equipeId);
    }

    const { data, error } = await query
      .order("data_avaliacao", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error fetching last evaluation:", error);
      return null;
    }

    return data as any;
  } catch (error) {
    console.error("Unexpected error in getLastAvaliacaoForColaborador:", error);
    return null;
  }
};

export const createAvaliacaoEquipe = async (avaliacao: {
  colaborador_id: string;
  equipe_id: string;
  data_avaliacao: string; // yyyy-MM-dd
  competencia_tecnica?: number | null;
  comunicacao?: number | null;
  trabalho_em_equipe?: number | null;
  proatividade?: number | null;
  pontualidade?: number | null;
  organizacao?: number | null;
  observacoes?: string | null;
}) => {
  try {
    const payload = {
      colaborador_id: avaliacao.colaborador_id,
      equipe_id: avaliacao.equipe_id,
      data_avaliacao: avaliacao.data_avaliacao,
      competencia_tecnica: avaliacao.competencia_tecnica ?? null,
      comunicacao: avaliacao.comunicacao ?? null,
      trabalho_em_equipe: avaliacao.trabalho_em_equipe ?? null,
      proatividade: avaliacao.proatividade ?? null,
      pontualidade: avaliacao.pontualidade ?? null,
      organizacao: avaliacao.organizacao ?? null,
      observacoes: avaliacao.observacoes ?? null,
      // created_by será setado automaticamente pelo trigger se for null
    } as const;

    const { data, error } = await supabase
      .from("bd_avaliacao_equipe")
      .upsert(payload, { onConflict: "colaborador_id,equipe_id,data_avaliacao" })
      .select()
      .single();

    if (error) {
      console.error("Error creating/updating evaluation:", error);
      throw error;
    }

    return data as any;
  } catch (error) {
    console.error("Unexpected error in createAvaliacaoEquipe:", error);
    throw error;
  }
};

export const canCreateAvaliacaoForColaborador = async (
  colaboradorId: string,
  equipeId?: string,
  referenceDate?: string // yyyy-MM-dd (default: hoje)
): Promise<{ canCreate: boolean; daysRemaining: number; lastEvaluationDate?: string | null }> => {
  const todayStr = referenceDate || format(new Date(), "yyyy-MM-dd");

  const last = await getLastAvaliacaoForColaborador(colaboradorId, equipeId);
  if (!last?.data_avaliacao) {
    return { canCreate: true, daysRemaining: 0, lastEvaluationDate: null };
  }

  // diferença em dias entre hoje (ou referenceDate) e a última avaliação
  const diff = differenceInCalendarDays(
    new Date(todayStr + "T12:00:00"),
    new Date(last.data_avaliacao + "T12:00:00")
  );

  if (diff >= 15) {
    return { canCreate: true, daysRemaining: 0, lastEvaluationDate: last.data_avaliacao };
  }

  return {
    canCreate: false,
    daysRemaining: Math.max(15 - diff, 0),
    lastEvaluationDate: last.data_avaliacao,
  };
};

export const checkAvaliacaoObrigatoria = async () => {
  // Implementação simplificada - retorna false por padrão
  return false;
};

export const exportApontamentoAndAvaliacoes = (filters: ApontamentoEquipeFilters) => {
  // Implementação simplificada para exportação
  console.log("Exporting apontamentos with filters:", filters);
};
