import { supabase } from "@/integrations/supabase/client";
import { 
  ApontamentoEquipe, 
  ApontamentoEquipeFilters, 
  ApontamentoEquipeFormValues,
  AvaliacaoEquipe,
  AvaliacaoEquipeFormValues
} from "@/types/apontamentoEquipe";
import { format, differenceInDays, isMonday, isFriday } from "date-fns";

// Helper function to normalize date to prevent timezone issues
const normalizeDate = (date: Date | string): string => {
  if (typeof date === 'string') {
    // For string dates, extract the date part only to avoid timezone issues
    if (date.includes('T')) {
      const dateObj = new Date(date);
      return format(dateObj, "yyyy-MM-dd");
    }
    return date; // Already in yyyy-MM-dd format
  }
  
  // For Date objects, ensure we format as yyyy-MM-dd
  const normalizedDate = new Date(date);
  // Set to noon to avoid timezone issues
  normalizedDate.setHours(12, 0, 0, 0);
  return format(normalizedDate, "yyyy-MM-dd");
};

// Fetch apontamentos with filters
export const fetchApontamentos = async (filters: ApontamentoEquipeFilters = {}): Promise<ApontamentoEquipe[]> => {
  let query = supabase
    .from("bd_apontamento_equipe")
    .select(`
      *,
      equipe:equipe_id (
        *,
        encarregado:encarregado_id (id, nome_completo),
        apontador:apontador_id (id, nome_completo)
      ),
      colaborador:colaborador_id (
        id, nome_completo
      ),
      lista_entrega:lista_entrega_id (*)
    `)
    .order('data_registro', { ascending: false });
  
  // Apply filters
  if (filters.data_inicio) {
    const formattedDate = normalizeDate(filters.data_inicio);
    query = query.gte("data_registro", formattedDate);
  }
  
  if (filters.data_fim) {
    const formattedDate = normalizeDate(filters.data_fim);
    query = query.lte("data_registro", formattedDate);
  }
  
  if (filters.equipe_id && filters.equipe_id !== 'all') {
    query = query.eq("equipe_id", filters.equipe_id);
  }
  
  if (filters.encarregado_id && filters.encarregado_id !== 'all') {
    query = query.eq("equipe.encarregado_id", filters.encarregado_id);
  }
  
  if (filters.apontador_id && filters.apontador_id !== 'all') {
    query = query.eq("equipe.apontador_id", filters.apontador_id);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error("Error fetching apontamentos:", error);
    throw error;
  }
  
  return data as unknown as ApontamentoEquipe[];
};

// Get apontamento by equipe id and date
export const getApontamentoByEquipeAndDate = async (equipeId: string, date: string): Promise<ApontamentoEquipe[]> => {
  const { data, error } = await supabase
    .from("bd_apontamento_equipe")
    .select(`
      *,
      colaborador:colaborador_id (
        id, nome_completo
      )
    `)
    .eq("equipe_id", equipeId)
    .eq("data_registro", date);
  
  if (error) {
    console.error("Error fetching apontamento by equipe and date:", error);
    throw error;
  }
  
  console.log(`Apontamentos encontrados para equipe ${equipeId} na data ${date}:`, data?.length);
  
  return data as unknown as ApontamentoEquipe[];
};

// Check if apontamento already exists for the equipe and date
export const checkApontamentoExistente = async (equipeId: string, date: string): Promise<boolean> => {
  const { count, error } = await supabase
    .from("bd_apontamento_equipe")
    .select("id", { count: 'exact', head: true })
    .eq("equipe_id", equipeId)
    .eq("data_registro", date);
  
  if (error) {
    console.error("Error checking apontamento existence:", error);
    throw error;
  }
  
  return count !== null && count > 0;
};

// Get apontamento by id
export const getApontamentoById = async (id: string): Promise<ApontamentoEquipe> => {
  const { data, error } = await supabase
    .from("bd_apontamento_equipe")
    .select(`
      *,
      equipe:equipe_id (
        *,
        encarregado:encarregado_id (id, nome_completo),
        apontador:apontador_id (id, nome_completo)
      ),
      colaborador:colaborador_id (
        id, nome_completo
      ),
      lista_entrega:lista_entrega_id (*)
    `)
    .eq("id", id)
    .single();
  
  if (error) {
    console.error("Error fetching apontamento by id:", error);
    throw error;
  }
  
  return data as unknown as ApontamentoEquipe;
};

// Create apontamento for multiple colaboradores in a single equipe
export const createApontamentoEquipe = async (data: ApontamentoEquipeFormValues): Promise<void> => {
  try {
    // Ensure we have a properly formatted date
    let formattedDate: string;
    if (data.data_registro) {
      formattedDate = typeof data.data_registro === 'string' 
        ? normalizeDate(data.data_registro) 
        : normalizeDate(data.data_registro);
    } else {
      throw new Error("Data de registro não fornecida");
    }
    
    // Check if apontamento already exists for this equipe and date
    const apontamentoExistente = await checkApontamentoExistente(data.equipe_id, formattedDate);
    
    if (apontamentoExistente) {
      throw new Error("Já existe um apontamento registrado para esta equipe e data.");
    }
    
    // Get current user
    const userResponse = await supabase.auth.getUser();
    const userId = userResponse.data.user?.id;

    // Create an array of apontamento records to insert
    const apontamentosToInsert = data.colaboradores.map(colaborador => ({
      equipe_id: data.equipe_id,
      data_registro: formattedDate,
      lista_entrega_id: data.lista_entrega_id,
      colaborador_id: colaborador.colaborador_id,
      nome_colaborador: colaborador.nome_colaborador,
      hora_inicio: colaborador.hora_inicio || null,
      hora_fim: colaborador.hora_fim || null,
      presente: colaborador.presente,
      registrado_por: userId
    }));
    
    const { error } = await supabase
      .from("bd_apontamento_equipe")
      .insert(apontamentosToInsert);
    
    if (error) throw error;
    
  } catch (error) {
    console.error("Error creating apontamento equipe:", error);
    throw error;
  }
};

// Update apontamento - Support both old and new formats
export const updateApontamentoEquipe = async (
  idOrEquipeId: string, 
  dataOrDate: string | Partial<ApontamentoEquipe>, 
  formData?: ApontamentoEquipeFormValues
): Promise<void> => {
  try {
    // Check if we're using the new format (equipeId, date, formData)
    if (formData) {
      // New format: equipeId, date, formData
      const equipeId = idOrEquipeId;
      
      // Ensure we have a properly formatted date
      let formattedDate: string;
      if (typeof dataOrDate === 'string') {
        formattedDate = normalizeDate(dataOrDate);
      } else {
        throw new Error("Invalid date format in updateApontamentoEquipe");
      }
      
      console.log(`Updating apontamento for team ${equipeId} on date ${formattedDate}`);
      
      // First, check if records exist for this team and date
      const { data: existingRecords, error: fetchError } = await supabase
        .from("bd_apontamento_equipe")
        .select("id")
        .eq("equipe_id", equipeId)
        .eq("data_registro", formattedDate);
        
      if (fetchError) throw fetchError;
      
      // If records exist, delete them before inserting new ones
      if (existingRecords && existingRecords.length > 0) {
        console.log(`Deleting ${existingRecords.length} existing records before update`);
        const ids = existingRecords.map(record => record.id);
        
        const { error: deleteError } = await supabase
          .from("bd_apontamento_equipe")
          .delete()
          .in("id", ids);
        
        if (deleteError) throw deleteError;
      }
      
      // Get current user
      const userResponse = await supabase.auth.getUser();
      const userId = userResponse.data.user?.id;

      // Create the new records
      const apontamentosToInsert = formData.colaboradores.map(colaborador => ({
        equipe_id: formData.equipe_id,
        data_registro: formattedDate,
        lista_entrega_id: formData.lista_entrega_id,
        colaborador_id: colaborador.colaborador_id,
        nome_colaborador: colaborador.nome_colaborador,
        hora_inicio: colaborador.hora_inicio || null,
        hora_fim: colaborador.hora_fim || null,
        presente: colaborador.presente,
        registrado_por: userId
      }));
      
      const { error } = await supabase
        .from("bd_apontamento_equipe")
        .insert(apontamentosToInsert);
      
      if (error) throw error;
    } else {
      // Old format: id, data
      const id = idOrEquipeId;
      const data = dataOrDate as Partial<ApontamentoEquipe>;
      
      // Handle empty time strings
      const updateData = { ...data };
      if (updateData.hora_inicio === "") {
        updateData.hora_inicio = null;
      }
      
      if (updateData.hora_fim === "") {
        updateData.hora_fim = null;
      }
      
      const { error } = await supabase
        .from("bd_apontamento_equipe")
        .update(updateData)
        .eq("id", id);
      
      if (error) throw error;
    }
  } catch (error) {
    console.error("Error updating apontamento:", error);
    throw error;
  }
};

// Delete apontamento
export const deleteApontamentoEquipe = async (id: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from("bd_apontamento_equipe")
      .delete()
      .eq("id", id);
    
    if (error) throw error;
    
  } catch (error) {
    console.error("Error deleting apontamento equipe:", error);
    throw error;
  }
};

// Get last avaliacao for colaborador
export const getLastAvaliacaoForColaborador = async (colaboradorId: string): Promise<AvaliacaoEquipe | null> => {
  try {
    const { data, error } = await supabase
      .from("bd_avaliacao_equipe")
      .select("*")
      .eq("colaborador_id", colaboradorId)
      .order("data_avaliacao", { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (error) {
      console.error("Error fetching last avaliacao for colaborador:", error);
      throw error;
    }
    
    return data as AvaliacaoEquipe;
  } catch (error) {
    console.error("Error in getLastAvaliacaoForColaborador:", error);
    throw error;
  }
};

// Check if today is a mandatory evaluation day
export const checkAvaliacaoObrigatoria = async (): Promise<boolean> => {
  const today = new Date();
  
  // Check if today is Monday or Friday (common days for mandatory evaluations)
  if (isMonday(today) || isFriday(today)) {
    return true;
  }
  
  // Check if it's the 15th or 30th of the month (other common evaluation times)
  const dayOfMonth = today.getDate();
  if (dayOfMonth === 15 || dayOfMonth === 30 || (dayOfMonth === 28 && today.getMonth() === 1)) {
    return true;
  }
  
  // Default to false - not mandatory today
  return false;
};

// Check if can create avaliacao (15 days after last one)
export const canCreateAvaliacaoForColaborador = async (colaboradorId: string): Promise<{
  canCreate: boolean;
  daysRemaining: number;
  lastAvaliacaoDate: Date | null;
}> => {
  try {
    if (!colaboradorId) {
      console.warn("No colaborador_id provided to canCreateAvaliacaoForColaborador");
      return { canCreate: false, daysRemaining: 15, lastAvaliacaoDate: null };
    }
    
    const lastAvaliacao = await getLastAvaliacaoForColaborador(colaboradorId);
    
    // If collaborator has never been evaluated, they can be evaluated now
    if (!lastAvaliacao) {
      return { canCreate: true, daysRemaining: 0, lastAvaliacaoDate: null };
    }
    
    const lastAvaliacaoDate = new Date(lastAvaliacao.data_avaliacao);
    const today = new Date();
    const daysSinceLastAvaliacao = differenceInDays(today, lastAvaliacaoDate);
    const daysRemaining = Math.max(0, 15 - daysSinceLastAvaliacao);
    
    return {
      canCreate: daysSinceLastAvaliacao >= 15,
      daysRemaining,
      lastAvaliacaoDate
    };
  } catch (error) {
    console.error("Error checking if can create avaliacao:", error);
    throw error;
  }
};

// Check if evaluation exists for collaborator on specific date - MODIFIED to remove equipe_id constraint
export const checkAvaliacaoExistenteParaColaborador = async (
  colaboradorId: string, 
  dataAvaliacao: string
): Promise<boolean> => {
  try {
    const { count, error } = await supabase
      .from("bd_avaliacao_equipe")
      .select("id", { count: 'exact', head: true })
      .eq("colaborador_id", colaboradorId)
      .eq("data_avaliacao", dataAvaliacao);
    
    if (error) {
      console.error("Error checking avaliacao existence:", error);
      throw error;
    }
    
    return count !== null && count > 0;
  } catch (error) {
    console.error("Error checking if evaluation exists:", error);
    throw error;
  }
};

// Get all evaluations for a date and team
export const getAvaliacoesForEquipeAndDate = async (
  equipeId: string,
  dataAvaliacao: string | Date
): Promise<AvaliacaoEquipe[]> => {
  try {
    // Ensure date is properly formatted
    const formattedDate = typeof dataAvaliacao === 'string'
      ? normalizeDate(dataAvaliacao)
      : normalizeDate(dataAvaliacao);
    
    const { data, error } = await supabase
      .from("bd_avaliacao_equipe")
      .select("*")
      .eq("equipe_id", equipeId)
      .eq("data_avaliacao", formattedDate);
    
    if (error) {
      console.error("Error fetching avaliacoes for equipe and date:", error);
      throw error;
    }
    
    return data as AvaliacaoEquipe[];
  } catch (error) {
    console.error("Error getting evaluations for team and date:", error);
    throw error;
  }
};

// Create avaliacao - MODIFIED to properly handle updates
export const createAvaliacaoEquipe = async (data: AvaliacaoEquipeFormValues): Promise<void> => {
  try {
    // Check if evaluation already exists for this collaborator on this date
    const avaliacaoExistente = await checkAvaliacaoExistenteParaColaborador(
      data.colaborador_id,
      data.data_avaliacao
    );
    
    if (avaliacaoExistente) {
      console.log("Updating existing evaluation for collaborator:", data.colaborador_id, "on date:", data.data_avaliacao);
      
      // Find the existing evaluation
      const { data: existingData, error: findError } = await supabase
        .from("bd_avaliacao_equipe")
        .select("id")
        .eq("colaborador_id", data.colaborador_id)
        .eq("data_avaliacao", data.data_avaliacao)
        .single();
      
      if (findError) {
        throw new Error("Erro ao encontrar avaliação existente: " + findError.message);
      }
      
      if (!existingData) {
        throw new Error("Avaliação existente não encontrada");
      }
      
      // Ensure all numeric values are within the allowed range (0-5)
      const validatedData = {
        competencia_tecnica: Math.min(5, Math.max(0, data.competencia_tecnica)),
        comunicacao: Math.min(5, Math.max(0, data.comunicacao)),
        trabalho_em_equipe: Math.min(5, Math.max(0, data.trabalho_em_equipe)),
        proatividade: Math.min(5, Math.max(0, data.proatividade)),
        pontualidade: Math.min(5, Math.max(0, data.pontualidade)),
        organizacao: Math.min(5, Math.max(0, data.organizacao)),
        anotacoes: data.anotacoes
      };
      
      // Update the existing evaluation
      const { error: updateError } = await supabase
        .from("bd_avaliacao_equipe")
        .update(validatedData)
        .eq("id", existingData.id);
      
      if (updateError) {
        throw new Error("Erro ao atualizar avaliação: " + updateError.message);
      }
      
      return;
    }
    
    // Check if can create evaluation (15-day rule)
    const canCreateStatus = await canCreateAvaliacaoForColaborador(data.colaborador_id);
    if (!canCreateStatus.canCreate) {
      throw new Error(`Deve aguardar ${canCreateStatus.daysRemaining} dias para nova avaliação.`);
    }
    
    // Get current user
    const userResponse = await supabase.auth.getUser();
    const userId = userResponse.data.user?.id;

    // Ensure all numeric values are within the allowed range (0-5)
    const validatedData = {
      ...data,
      competencia_tecnica: Math.min(5, Math.max(0, data.competencia_tecnica)),
      comunicacao: Math.min(5, Math.max(0, data.comunicacao)),
      trabalho_em_equipe: Math.min(5, Math.max(0, data.trabalho_em_equipe)),
      proatividade: Math.min(5, Math.max(0, data.proatividade)),
      pontualidade: Math.min(5, Math.max(0, data.pontualidade)),
      organizacao: Math.min(5, Math.max(0, data.organizacao)),
      criado_por: userId
    };

    // Insert the evaluation
    const { error } = await supabase
      .from("bd_avaliacao_equipe")
      .insert(validatedData);
    
    if (error) throw error;
  } catch (error) {
    console.error("Error creating avaliacao equipe:", error);
    throw error;
  }
};

// Fetch avaliações with the same filters as apontamentos
export const fetchAvaliacoes = async (filters: ApontamentoEquipeFilters = {}): Promise<AvaliacaoEquipe[]> => {
  let query = supabase
    .from("bd_avaliacao_equipe")
    .select(`
      *,
      equipe:equipe_id (
        *,
        encarregado:encarregado_id (id, nome_completo),
        apontador:apontador_id (id, nome_completo)
      ),
      colaborador:colaborador_id (
        id, nome_completo
      )
    `)
    .order('data_avaliacao', { ascending: false });
  
  // Apply filters
  if (filters.data_inicio) {
    const formattedDate = normalizeDate(filters.data_inicio);
    query = query.gte("data_avaliacao", formattedDate);
  }
  
  if (filters.data_fim) {
    const formattedDate = normalizeDate(filters.data_fim);
    query = query.lte("data_avaliacao", formattedDate);
  }
  
  if (filters.equipe_id && filters.equipe_id !== 'all') {
    query = query.eq("equipe_id", filters.equipe_id);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error("Error fetching avaliações:", error);
    throw error;
  }
  
  return data as unknown as AvaliacaoEquipe[];
};

// Export to Excel function for both apontamentos and avaliações
export const exportApontamentoAndAvaliacoes = async (filters: ApontamentoEquipeFilters = {}): Promise<void> => {
  try {
    // Fetch all apontamentos and avaliações based on the current filters
    const [apontamentos, avaliacoes] = await Promise.all([
      fetchApontamentos(filters),
      fetchAvaliacoes(filters)
    ]);
    
    // Dynamically import XLSX to avoid bundling issues
    const XLSX = await import('xlsx');
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Process apontamentos data for export
    const groupedApontamentos: Record<string, ApontamentoEquipe[]> = {};
    
    apontamentos.forEach(apontamento => {
      const key = `${apontamento.equipe_id}-${apontamento.data_registro}`;
      if (!groupedApontamentos[key]) {
        groupedApontamentos[key] = [];
      }
      groupedApontamentos[key].push(apontamento);
    });
    
    // Create export data for apontamentos
    const apontamentosExportData = Object.entries(groupedApontamentos).map(([_, entries]) => {
      const equipe = entries[0].equipe?.nome_equipe || 'N/A';
      const date = format(new Date(entries[0].data_registro), 'dd/MM/yyyy');
      const encarregado = entries[0].equipe?.encarregado?.nome_completo || 'N/A';
      const apontador = entries[0].equipe?.apontador?.nome_completo || 'N/A';
      const presencaPercentage = Math.round((entries.filter(e => e.presente).length / entries.length) * 100);
      
      return {
        'Data': date,
        'Equipe': equipe,
        'Encarregado': encarregado,
        'Apontador': apontador,
        'Presença (%)': `${presencaPercentage}%`,
        'Total Colaboradores': entries.length,
        'Presentes': entries.filter(e => e.presente).length,
        'Ausentes': entries.filter(e => !e.presente).length
      };
    });
    
    // Create export data for avaliações
    const avaliacoesExportData = avaliacoes.map(avaliacao => {
      const date = format(new Date(avaliacao.data_avaliacao), 'dd/MM/yyyy');
      const equipe = avaliacao.equipe?.nome_equipe || 'N/A';
      const colaborador = avaliacao.colaborador?.nome_completo || 'N/A';
      
      // Calculate average score
      const scores = [
        avaliacao.competencia_tecnica || 0,
        avaliacao.comunicacao || 0,
        avaliacao.trabalho_em_equipe || 0,
        avaliacao.proatividade || 0,
        avaliacao.pontualidade || 0,
        avaliacao.organizacao || 0
      ];
      
      const mediaAvaliacao = scores.reduce((a, b) => a + b, 0) / scores.length;
      
      return {
        'Data Avaliação': date,
        'Equipe': equipe,
        'Colaborador': colaborador,
        'Competência Técnica': avaliacao.competencia_tecnica || 0,
        'Comunicação': avaliacao.comunicacao || 0,
        'Trabalho em Equipe': avaliacao.trabalho_em_equipe || 0,
        'Proatividade': avaliacao.proatividade || 0,
        'Pontualidade': avaliacao.pontualidade || 0,
        'Organização': avaliacao.organizacao || 0,
        'Média': mediaAvaliacao.toFixed(1),
        'Anotações': avaliacao.anotacoes || '',
      };
    });
    
    // Create worksheets and add to workbook
    if (apontamentosExportData.length > 0) {
      const apontamentosWS = XLSX.utils.json_to_sheet(apontamentosExportData);
      XLSX.utils.book_append_sheet(wb, apontamentosWS, 'Resumo Apontamentos');
    } else {
      // Add empty worksheet if no data
      const emptyWS = XLSX.utils.aoa_to_sheet([['Nenhum apontamento encontrado no período selecionado']]);
      XLSX.utils.book_append_sheet(wb, emptyWS, 'Resumo Apontamentos');
    }
    
    // Create detailed apontamentos worksheet with the specific fields requested
    const detailedApontamentosData = apontamentos.map(a => {
      return {
        'Data': format(new Date(a.data_registro), 'dd/MM/yyyy'),
        'Equipe': a.equipe?.nome_equipe || 'N/A',
        'Nome do Colaborador': a.nome_colaborador,
        'Hora de Início': a.hora_inicio || '-',
        'Hora de Fim': a.hora_fim || '-',
        'Presente': a.presente ? 'Sim' : 'Não',
        'Encarregado': a.equipe?.encarregado?.nome_completo || 'N/A',
        'Apontador': a.equipe?.apontador?.nome_completo || 'N/A',
      };
    });
    
    if (detailedApontamentosData.length > 0) {
      const detailedWS = XLSX.utils.json_to_sheet(detailedApontamentosData);
      XLSX.utils.book_append_sheet(wb, detailedWS, 'Apontamentos Detalhados');
    } else {
      const emptyWS = XLSX.utils.aoa_to_sheet([['Nenhum apontamento detalhado encontrado no período']]);
      XLSX.utils.book_append_sheet(wb, emptyWS, 'Apontamentos Detalhados');
    }
    
    // Create a combined worksheet that joins apontamentos with avaliacoes
    // We'll create a lookup of avaliacoes by colaborador_id and data
    const avaliacoesMap = new Map();
    avaliacoes.forEach(avaliacao => {
      const key = `${avaliacao.colaborador_id}-${avaliacao.data_avaliacao}`;
      avaliacoesMap.set(key, avaliacao);
    });
    
    // Now create the combined data
    const combinedData = apontamentos.map(a => {
      const data_registro = a.data_registro;
      const key = `${a.colaborador_id}-${data_registro}`;
      const avaliacao = avaliacoesMap.get(key);
      
      // Get user info who created the evaluation
      const avaliadoPor = avaliacao?.criado_por 
        ? 'Usuário do sistema'  // We should ideally fetch the user name here
        : 'Não avaliado';
      
      return {
        'Data': format(new Date(data_registro), 'dd/MM/yyyy'),
        'Equipe': a.equipe?.nome_equipe || 'N/A',
        'Nome do Colaborador': a.nome_colaborador,
        'Hora de Início': a.hora_inicio || '-',
        'Hora de Fim': a.hora_fim || '-',
        'Presente': a.presente ? 'Sim' : 'Não',
        'Competência Técnica': avaliacao?.competencia_tecnica || '-',
        'Comunicação': avaliacao?.comunicacao || '-',
        'Trabalho em Equipe': avaliacao?.trabalho_em_equipe || '-',
        'Proatividade': avaliacao?.proatividade || '-',
        'Pontualidade': avaliacao?.pontualidade || '-',
        'Organização': avaliacao?.organizacao || '-',
        'Avaliado Por': avaliadoPor,
        'Anotações': avaliacao?.anotacoes || '-'
      };
    });
    
    if (combinedData.length > 0) {
      const combinedWS = XLSX.utils.json_to_sheet(combinedData);
      XLSX.utils.book_append_sheet(wb, combinedWS, 'Apontamentos e Avaliações');
    } else {
      const emptyWS = XLSX.utils.aoa_to_sheet([['Nenhum dado encontrado no período selecionado']]);
      XLSX.utils.book_append_sheet(wb, emptyWS, 'Apontamentos e Avaliações');
    }
    
    if (avaliacoesExportData.length > 0) {
      const avaliacoesWS = XLSX.utils.json_to_sheet(avaliacoesExportData);
      XLSX.utils.book_append_sheet(wb, avaliacoesWS, 'Resumo Avaliações');
    } else {
      // Add empty worksheet if no data
      const emptyWS = XLSX.utils.aoa_to_sheet([['Nenhuma avaliação encontrada no período selecionado']]);
      XLSX.utils.book_append_sheet(wb, emptyWS, 'Resumo Avaliações');
    }
    
    // Generate filename with period information
    let fileName = 'apontamentos-avaliacoes';
    if (filters.data_inicio) {
      fileName += `-de-${format(new Date(filters.data_inicio), 'dd-MM-yyyy')}`;
    }
    if (filters.data_fim) {
      fileName += `-ate-${format(new Date(filters.data_fim), 'dd-MM-yyyy')}`;
    }
    if (!filters.data_inicio && !filters.data_fim) {
      fileName += `-${format(new Date(), 'dd-MM-yyyy')}`;
    }
    
    // Export the file
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  } catch (error) {
    console.error("Error exporting data:", error);
    throw error;
  }
};

// Legacy export function (keep for backward compatibility)
export const exportApontamentosToExcel = (apontamentos: ApontamentoEquipe[]): void => {
  // Forward to the new export function with empty filters
  exportApontamentoAndAvaliacoes({});
};
