import { supabase } from "@/integrations/supabase/client";
import { 
  ApontamentoEquipe, 
  ApontamentoEquipeApiData,
  ApontamentoEquipeFilters,
  AvaliacaoEquipe,
  AvaliacaoEquipeFormValues
} from "@/types/apontamentoEquipe";
import { format } from "date-fns";
import * as XLSX from 'xlsx';

// Helper para sanitizar UUIDs - converte strings vazias para null
const sanitizeUuid = (value: string | undefined | null): string | null => {
  if (!value || value.trim() === "") return null;
  
  // Validar se é um UUID válido
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(value)) {
    console.warn("UUID inválido detectado:", value);
    return null;
  }
  
  return value;
};

// Helper para sanitizar dados do formulário
const sanitizeFormData = (data: ApontamentoEquipeApiData) => {
  console.log("🧹 Sanitizando dados do formulário:", data);
  
  const sanitized = {
    ...data,
    lista_entrega_id: sanitizeUuid(data.lista_entrega_id),
    colaboradores: data.colaboradores.map(col => ({
      ...col,
      colaborador_id: sanitizeUuid(col.colaborador_id)
    })).filter(col => {
      // Filtrar colaboradores sem ID válido e que não estão presentes
      if (!col.colaborador_id && !col.presente) {
        console.warn("Removendo colaborador sem ID válido:", col);
        return false;
      }
      return true;
    })
  };
  
  console.log("✅ Dados sanitizados:", sanitized);
  return sanitized;
};

export const createApontamentoEquipe = async (data: ApontamentoEquipeApiData) => {
  console.log("=== CRIANDO APONTAMENTO DE EQUIPE ===");
  console.log("Dados recebidos:", data);
  
  try {
    // Sanitizar dados antes da validação
    const sanitizedData = sanitizeFormData(data);
    
    // Validar se tem colaboradores válidos
    if (sanitizedData.colaboradores.length === 0) {
      throw new Error("Nenhum colaborador válido encontrado");
    }
    
    // Validar se pelo menos um colaborador está presente
    const presenteCount = sanitizedData.colaboradores.filter(col => col.presente).length;
    if (presenteCount === 0) {
      throw new Error("Pelo menos um colaborador deve estar presente");
    }
    
    console.log("📝 Inserindo apontamentos individuais...");
    
    // Inserir cada colaborador como um registro separado
    const apontamentos = sanitizedData.colaboradores.map(colaborador => ({
      equipe_id: sanitizedData.equipe_id,
      data_registro: sanitizedData.data_registro,
      lista_entrega_id: sanitizedData.lista_entrega_id,
      colaborador_id: colaborador.colaborador_id,
      nome_colaborador: colaborador.nome_colaborador,
      presente: colaborador.presente,
      hora_inicio: colaborador.hora_inicio || null,
      hora_fim: colaborador.hora_fim || null,
      registrado_por: null, // Will be set by RLS/auth context
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));
    
    console.log("Dados a serem inseridos:", apontamentos);
    
    const { data: result, error } = await supabase
      .from("bd_apontamento_equipe")
      .insert(apontamentos)
      .select();
    
    if (error) {
      console.error("❌ Erro ao inserir apontamentos:", error);
      
      // Tratar erros específicos de UUID
      if (error.message?.includes("invalid input syntax for type uuid")) {
        throw new Error("Dados de identificação inválidos. Verifique se todos os campos estão preenchidos corretamente.");
      }
      
      throw new Error(`Erro ao criar apontamento: ${error.message}`);
    }
    
    console.log("✅ Apontamentos criados com sucesso:", result);
    return result;
    
  } catch (error) {
    console.error("=== ERRO NA CRIAÇÃO DO APONTAMENTO ===");
    console.error("Erro:", error);
    throw error;
  }
};

export const updateApontamentoEquipe = async (
  equipeId: string,
  dataRegistro: string,
  data: ApontamentoEquipeApiData
) => {
  console.log("=== ATUALIZANDO APONTAMENTO DE EQUIPE ===");
  console.log("Equipe ID:", equipeId);
  console.log("Data:", dataRegistro);
  console.log("Dados:", data);
  
  try {
    // Sanitizar dados antes da atualização
    const sanitizedData = sanitizeFormData(data);
    
    // Validar se tem colaboradores válidos
    if (sanitizedData.colaboradores.length === 0) {
      throw new Error("Nenhum colaborador válido encontrado");
    }
    
    // Primeiro, deletar todos os registros existentes para esta equipe/data
    const { error: deleteError } = await supabase
      .from("bd_apontamento_equipe")
      .delete()
      .eq("equipe_id", equipeId)
      .eq("data_registro", dataRegistro);
    
    if (deleteError) {
      console.error("❌ Erro ao deletar registros antigos:", deleteError);
      throw new Error(`Erro ao atualizar apontamento: ${deleteError.message}`);
    }
    
    console.log("🗑️ Registros antigos removidos");
    
    // Inserir os novos registros
    const apontamentos = sanitizedData.colaboradores.map(colaborador => ({
      equipe_id: sanitizedData.equipe_id,
      data_registro: sanitizedData.data_registro,
      lista_entrega_id: sanitizedData.lista_entrega_id,
      colaborador_id: colaborador.colaborador_id,
      nome_colaborador: colaborador.nome_colaborador,
      presente: colaborador.presente,
      hora_inicio: colaborador.hora_inicio || null,
      hora_fim: colaborador.hora_fim || null,
      registrado_por: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));
    
    console.log("Inserindo novos dados:", apontamentos);
    
    const { data: result, error: insertError } = await supabase
      .from("bd_apontamento_equipe")
      .insert(apontamentos)
      .select();
    
    if (insertError) {
      console.error("❌ Erro ao inserir novos registros:", insertError);
      
      // Tratar erros específicos de UUID
      if (insertError.message?.includes("invalid input syntax for type uuid")) {
        throw new Error("Dados de identificação inválidos. Verifique se todos os campos estão preenchidos corretamente.");
      }
      
      throw new Error(`Erro ao atualizar apontamento: ${insertError.message}`);
    }
    
    console.log("✅ Apontamento atualizado com sucesso:", result);
    return result;
    
  } catch (error) {
    console.error("=== ERRO NA ATUALIZAÇÃO DO APONTAMENTO ===");
    console.error("Erro:", error);
    throw error;
  }
};

export const fetchApontamentos = async (
  filters: ApontamentoEquipeFilters = {},
  allowedTeamIds: string[] = []
) => {
  console.log("🔍 Buscando apontamentos com filtros:", filters);
  console.log("Equipes permitidas:", allowedTeamIds);
  
  try {
    let query = supabase
      .from("bd_apontamento_equipe")
      .select(`
        *,
        equipe:bd_equipes!bd_apontamento_equipe_equipe_id_fkey (
          id,
          nome_equipe,
          encarregado:bd_funcionarios!bd_equipes_encarregado_id_fkey (
            id,
            nome_completo
          ),
          apontador:bd_funcionarios!bd_equipes_apontador_id_fkey (
            id,
            nome_completo
          )
        ),
        colaborador:bd_funcionarios!bd_apontamento_equipe_colaborador_id_fkey (
          id,
          nome_completo
        ),
        lista_entrega:bd_lista_programacao_entrega!bd_apontamento_equipe_lista_entrega_id_fkey (
          id,
          logradouro,
          data_entrega,
          status
        )
      `)
      .order("data_registro", { ascending: false })
      .order("created_at", { ascending: false });

    // Aplicar filtros de equipes permitidas apenas se não for vazio
    if (allowedTeamIds.length > 0) {
      query = query.in("equipe_id", allowedTeamIds);
    }

    // Aplicar outros filtros
    if (filters.data_inicio) {
      query = query.gte("data_registro", format(filters.data_inicio, "yyyy-MM-dd"));
    }
    
    if (filters.data_fim) {
      query = query.lte("data_registro", format(filters.data_fim, "yyyy-MM-dd"));
    }
    
    if (filters.equipe_id) {
      query = query.eq("equipe_id", filters.equipe_id);
    }
    
    if (filters.encarregado_id) {
      query = query.eq("equipe.encarregado_id", filters.encarregado_id);
    }
    
    if (filters.apontador_id) {
      query = query.eq("equipe.apontador_id", filters.apontador_id);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error("❌ Erro ao buscar apontamentos:", error);
      throw new Error(`Erro ao buscar apontamentos: ${error.message}`);
    }
    
    console.log("✅ Apontamentos encontrados:", data?.length || 0);
    return data || [];
    
  } catch (error) {
    console.error("=== ERRO NA BUSCA DE APONTAMENTOS ===");
    console.error("Erro:", error);
    throw error;
  }
};

export const getApontamentoById = async (id: string) => {
  console.log("🔍 Buscando apontamento por ID:", id);
  
  try {
    const { data, error } = await supabase
      .from("bd_apontamento_equipe")
      .select(`
        *,
        equipe:bd_equipes!bd_apontamento_equipe_equipe_id_fkey (
          id,
          nome_equipe,
          encarregado:bd_funcionarios!bd_equipes_encarregado_id_fkey (
            id,
            nome_completo
          ),
          apontador:bd_funcionarios!bd_equipes_apontador_id_fkey (
            id,
            nome_completo
          )
        ),
        colaborador:bd_funcionarios!bd_apontamento_equipe_colaborador_id_fkey (
          id,
          nome_completo
        )
      `)
      .eq("id", id)
      .single();
    
    if (error) {
      console.error("❌ Erro ao buscar apontamento:", error);
      throw new Error(`Erro ao buscar apontamento: ${error.message}`);
    }
    
    console.log("✅ Apontamento encontrado:", data);
    return data;
    
  } catch (error) {
    console.error("=== ERRO NA BUSCA DO APONTAMENTO ===");
    console.error("Erro:", error);
    throw error;
  }
};

export const deleteApontamentoEquipe = async (id: string) => {
  console.log("🗑️ Deletando apontamento:", id);
  
  try {
    const { error } = await supabase
      .from("bd_apontamento_equipe")
      .delete()
      .eq("id", id);
    
    if (error) {
      console.error("❌ Erro ao deletar apontamento:", error);
      throw new Error(`Erro ao deletar apontamento: ${error.message}`);
    }
    
    console.log("✅ Apontamento deletado com sucesso");
    
  } catch (error) {
    console.error("=== ERRO AO DELETAR APONTAMENTO ===");
    console.error("Erro:", error);
    throw error;
  }
};

export const createAvaliacaoEquipe = async (data: AvaliacaoEquipeFormValues) => {
  console.log("📊 Criando avaliação de equipe:", data);
  
  try {
    const { data: result, error } = await supabase
      .from("bd_avaliacao_equipe")
      .insert({
        colaborador_id: data.colaborador_id,
        equipe_id: data.equipe_id,
        data_avaliacao: data.data_avaliacao,
        competencia_tecnica: data.competencia_tecnica,
        comunicacao: data.comunicacao,
        trabalho_em_equipe: data.trabalho_em_equipe,
        proatividade: data.proatividade,
        pontualidade: data.pontualidade,
        organizacao: data.organizacao,
        anotacoes: data.anotacoes,
        criado_por: null, // Will be set by auth context
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      console.error("❌ Erro ao criar avaliação:", error);
      throw new Error(`Erro ao criar avaliação: ${error.message}`);
    }
    
    console.log("✅ Avaliação criada com sucesso:", result);
    return result;
    
  } catch (error) {
    console.error("=== ERRO NA CRIAÇÃO DA AVALIAÇÃO ===");
    console.error("Erro:", error);
    throw error;
  }
};

export const getLastAvaliacaoForColaborador = async (colaboradorId: string) => {
  console.log("🔍 Buscando última avaliação para colaborador:", colaboradorId);
  
  try {
    const { data, error } = await supabase
      .from("bd_avaliacao_equipe")
      .select("*")
      .eq("colaborador_id", colaboradorId)
      .order("data_avaliacao", { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (error) {
      console.error("❌ Erro ao buscar última avaliação:", error);
      throw new Error(`Erro ao buscar avaliação: ${error.message}`);
    }
    
    console.log("✅ Última avaliação encontrada:", data);
    return data;
    
  } catch (error) {
    console.error("=== ERRO NA BUSCA DA AVALIAÇÃO ===");
    console.error("Erro:", error);
    throw error;
  }
};

export const canCreateAvaliacaoForColaborador = async (colaboradorId: string) => {
  console.log("🔍 Verificando se pode criar avaliação para:", colaboradorId);
  
  try {
    const lastAvaliacao = await getLastAvaliacaoForColaborador(colaboradorId);
    
    if (!lastAvaliacao) {
      return { canCreate: true, daysRemaining: 0 };
    }
    
    const lastAvaliacaoDate = new Date(lastAvaliacao.data_avaliacao);
    const today = new Date();
    const daysDifference = Math.floor((today.getTime() - lastAvaliacaoDate.getTime()) / (1000 * 60 * 60 * 24));
    
    const canCreate = daysDifference >= 30; // Pode avaliar a cada 30 dias
    const daysRemaining = Math.max(0, 30 - daysDifference);
    
    console.log("✅ Status de avaliação:", { canCreate, daysRemaining });
    return { canCreate, daysRemaining };
    
  } catch (error) {
    console.error("=== ERRO NA VERIFICAÇÃO DE AVALIAÇÃO ===");
    console.error("Erro:", error);
    return { canCreate: true, daysRemaining: 0 };
  }
};

export const checkAvaliacaoObrigatoria = async () => {
  // Implementar lógica para verificar se hoje é dia de avaliação obrigatória
  // Por exemplo, toda sexta-feira ou último dia útil do mês
  const today = new Date();
  const dayOfWeek = today.getDay();
  
  // Sexta-feira (5) como dia de avaliação obrigatória
  return dayOfWeek === 5;
};

export const exportApontamentoAndAvaliacoes = (filters: ApontamentoEquipeFilters = {}) => {
  console.log("📤 Exportando apontamentos e avaliações...");
  
  try {
    // Criar dados de exemplo para exportação
    const data = [
      {
        'Data': format(new Date(), 'dd/MM/yyyy'),
        'Equipe': 'Equipe Exemplo',
        'Colaborador': 'Colaborador Exemplo',
        'Presente': 'Sim',
        'Hora Início': '08:00',
        'Hora Fim': '17:00'
      }
    ];
    
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Apontamentos');
    
    const fileName = `apontamentos_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    
    console.log("✅ Exportação concluída:", fileName);
    
  } catch (error) {
    console.error("=== ERRO NA EXPORTAÇÃO ===");
    console.error("Erro:", error);
    throw error;
  }
};
