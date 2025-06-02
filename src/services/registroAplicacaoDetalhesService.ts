
import { supabase } from "@/integrations/supabase/client";
import { RegistroAplicacaoDetalhes, RegistroAplicacaoDetalhesFormValues, RegistroAplicacaoCompleto } from "@/types/registroAplicacaoDetalhes";

/**
 * Validar dados antes de enviar para o banco
 */
const validateFormData = (valores: RegistroAplicacaoDetalhesFormValues) => {
  console.log("Validando dados:", valores);
  
  // Validações básicas
  if (!valores.logradouro_nome?.trim()) {
    throw new Error("Nome do logradouro é obrigatório");
  }
  
  if (!valores.area_aplicada || valores.area_aplicada <= 0) {
    throw new Error("Área aplicada deve ser maior que zero");
  }
  
  if (!valores.tonelada_aplicada || valores.tonelada_aplicada <= 0) {
    throw new Error("Tonelada aplicada deve ser maior que zero");
  }
  
  // Validar formato de horas se fornecidas
  const validateHora = (hora: string | undefined, fieldName: string) => {
    if (hora && hora.trim()) {
      const horaRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
      if (!horaRegex.test(hora)) {
        throw new Error(`${fieldName} deve estar no formato HH:MM ou HH:MM:SS`);
      }
    }
  };
  
  validateHora(valores.hora_inicio_aplicacao, "Hora de início");
  validateHora(valores.hora_fim_aplicacao, "Hora de fim");
  
  console.log("Dados validados com sucesso");
};

/**
 * Buscar detalhes de aplicação por registro_aplicacao_id
 */
export const fetchAplicacaoDetalhes = async (registroAplicacaoId: string): Promise<RegistroAplicacaoDetalhes[]> => {
  try {
    console.log("🔍 [fetchAplicacaoDetalhes] Iniciando busca para registro:", registroAplicacaoId);
    console.log("🔍 [fetchAplicacaoDetalhes] Timestamp:", new Date().toISOString());
    
    // Log da consulta SQL que será executada
    console.log("🔍 [fetchAplicacaoDetalhes] Query SQL será:", {
      table: "bd_registro_aplicacao_detalhes",
      filter: `registro_aplicacao_id = ${registroAplicacaoId}`,
      orderBy: "sequencia_aplicacao ASC"
    });

    const { data, error } = await supabase
      .from("bd_registro_aplicacao_detalhes")
      .select("*")
      .eq("registro_aplicacao_id", registroAplicacaoId)
      .order("sequencia_aplicacao", { ascending: true });

    console.log("📊 [fetchAplicacaoDetalhes] Resultado da consulta Supabase:", {
      registroId: registroAplicacaoId,
      data: data,
      error: error,
      count: data?.length || 0,
      hasData: !!data && data.length > 0,
      rawResponse: { data, error }
    });

    if (error) {
      console.error("❌ [fetchAplicacaoDetalhes] Erro na consulta Supabase:", {
        error,
        registroId: registroAplicacaoId,
        errorCode: error.code,
        errorMessage: error.message,
        errorDetails: error.details
      });
      throw error;
    }
    
    // Log detalhado dos dados encontrados
    if (data && data.length > 0) {
      console.log("✅ [fetchAplicacaoDetalhes] Aplicações encontradas:", {
        quantidade: data.length,
        primeirAplicacao: data[0],
        todasAplicacoes: data.map(app => ({
          id: app.id,
          sequencia: app.sequencia_aplicacao,
          logradouro: app.logradouro_nome,
          tonelada: app.tonelada_aplicada,
          area: app.area_aplicada
        }))
      });
    } else {
      console.log("⚠️ [fetchAplicacaoDetalhes] Nenhuma aplicação encontrada:", {
        registroId: registroAplicacaoId,
        dataNull: data === null,
        dataEmpty: data?.length === 0,
        data: data
      });
    }
    
    console.log("✅ [fetchAplicacaoDetalhes] Retornando dados:", data?.length || 0, "aplicações");
    return data || [];
  } catch (error) {
    console.error("❌ [fetchAplicacaoDetalhes] Erro geral ao buscar detalhes:", {
      error,
      registroId: registroAplicacaoId,
      errorType: typeof error,
      errorName: error instanceof Error ? error.name : 'Unknown',
      errorMessage: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
};

/**
 * Criar novo detalhe de aplicação
 */
export const createAplicacaoDetalhe = async (
  registroAplicacaoId: string,
  cargaId: string,
  listaEntregaId: string,
  valores: RegistroAplicacaoDetalhesFormValues
): Promise<RegistroAplicacaoDetalhes> => {
  try {
    console.log("Criando detalhe de aplicação:", {
      registroAplicacaoId,
      cargaId,
      listaEntregaId,
      valores
    });
    
    // Validar dados antes de criar
    validateFormData(valores);
    
    // Buscar próxima sequência
    const { data: existingDetails } = await supabase
      .from("bd_registro_aplicacao_detalhes")
      .select("sequencia_aplicacao")
      .eq("registro_aplicacao_id", registroAplicacaoId)
      .order("sequencia_aplicacao", { ascending: false })
      .limit(1);

    const proximaSequencia = (existingDetails?.[0]?.sequencia_aplicacao || 0) + 1;

    // Preparar dados para inserção
    const novoDetalhe = {
      registro_aplicacao_id: registroAplicacaoId,
      lista_entrega_id: listaEntregaId,
      registro_carga_id: cargaId,
      sequencia_aplicacao: proximaSequencia,
      logradouro_nome: valores.logradouro_nome.trim(),
      area_aplicada: valores.area_aplicada,
      tonelada_aplicada: valores.tonelada_aplicada,
      espessura_aplicada: valores.espessura_aplicada,
      comprimento: valores.comprimento || null,
      largura_media: valores.largura_media || null,
      bordo: valores.bordo || null,
      temperatura_aplicacao: valores.temperatura_aplicacao || null,
      condicoes_climaticas: valores.condicoes_climaticas?.trim() || null,
      densidade_compactacao: valores.densidade_compactacao || null,
      numero_passadas: valores.numero_passadas || null,
      equipamento_compactacao: valores.equipamento_compactacao?.trim() || null,
      observacoes_aplicacao: valores.observacoes_aplicacao?.trim() || null,
      hora_inicio_aplicacao: valores.hora_inicio_aplicacao?.trim() || null,
      hora_fim_aplicacao: valores.hora_fim_aplicacao?.trim() || null,
      estaca_inicial: valores.estaca_inicial || null,
      estaca_final: valores.estaca_final || null,
      data_aplicacao: new Date().toISOString().split('T')[0], // Data atual
    };

    console.log("Dados preparados para inserção:", novoDetalhe);

    const { data, error } = await supabase
      .from("bd_registro_aplicacao_detalhes")
      .insert(novoDetalhe)
      .select()
      .single();

    if (error) {
      console.error("Erro do Supabase ao criar detalhe:", error);
      throw new Error(`Erro ao salvar aplicação: ${error.message}`);
    }
    
    console.log("Detalhe criado com sucesso:", data);
    return data;
  } catch (error) {
    console.error("Erro ao criar detalhe de aplicação:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Erro desconhecido ao criar aplicação");
  }
};

/**
 * Atualizar detalhe de aplicação
 */
export const updateAplicacaoDetalhe = async (
  detalheId: string,
  valores: Partial<RegistroAplicacaoDetalhesFormValues>
): Promise<RegistroAplicacaoDetalhes> => {
  try {
    const { data, error } = await supabase
      .from("bd_registro_aplicacao_detalhes")
      .update(valores)
      .eq("id", detalheId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Erro ao atualizar detalhe de aplicação:", error);
    throw error;
  }
};

/**
 * Deletar detalhe de aplicação
 */
export const deleteAplicacaoDetalhe = async (detalheId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from("bd_registro_aplicacao_detalhes")
      .delete()
      .eq("id", detalheId);

    if (error) throw error;
  } catch (error) {
    console.error("Erro ao deletar detalhe de aplicação:", error);
    throw error;
  }
};

/**
 * Buscar registro de aplicação completo com cálculos
 */
export const fetchRegistroAplicacaoCompleto = async (registroAplicacaoId: string): Promise<RegistroAplicacaoCompleto | null> => {
  try {
    const { data, error } = await supabase
      .from("vw_registro_aplicacao_completo")
      .select("*")
      .eq("id", registroAplicacaoId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Erro ao buscar registro completo:", error);
    throw error;
  }
};

/**
 * Finalizar carga manualmente
 */
export const finalizarCargaAplicacao = async (cargaId: string): Promise<any> => {
  try {
    const { data, error } = await supabase.rpc('finalizar_carga_aplicacao', {
      carga_id: cargaId
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Erro ao finalizar carga:", error);
    throw error;
  }
};
