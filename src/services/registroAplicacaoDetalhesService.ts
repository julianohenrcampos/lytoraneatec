
import { supabase } from "@/integrations/supabase/client";
import { RegistroAplicacaoDetalhes, RegistroAplicacaoDetalhesFormValues, RegistroAplicacaoCompleto } from "@/types/registroAplicacaoDetalhes";

/**
 * Validar dados antes de enviar para o banco
 */
const validateFormData = (valores: RegistroAplicacaoDetalhesFormValues) => {
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
};

/**
 * Buscar detalhes de aplicação por registro_aplicacao_id
 */
export const fetchAplicacaoDetalhes = async (registroAplicacaoId: string): Promise<RegistroAplicacaoDetalhes[]> => {
  try {
    const { data, error } = await supabase
      .from("bd_registro_aplicacao_detalhes")
      .select("*")
      .eq("registro_aplicacao_id", registroAplicacaoId)
      .order("sequencia_aplicacao", { ascending: true });

    if (error) {
      throw error;
    }
    
    return (data as any) || [];
  } catch (error) {
    console.error("Erro ao buscar detalhes de aplicação:", error);
    throw error;
  }
};

/**
 * Criar novo detalhe de aplicação usando RPC corrigida
 */
export const createAplicacaoDetalhe = async (
  registroAplicacaoId: string,
  cargaId: string,
  listaEntregaId: string,
  valores: RegistroAplicacaoDetalhesFormValues
): Promise<RegistroAplicacaoDetalhes> => {
  try {
    // Validações básicas antes da RPC
    validateFormData(valores);
    
    // Buscar a data da entrega para usar como data de aplicação
    const { data: entregaData, error: entregaError } = await supabase
      .from('bd_lista_programacao_entrega')
      .select('data_entrega')
      .eq('id', listaEntregaId)
      .single();
    
    if (entregaError) {
      throw new Error("Erro ao obter data da entrega");
    }
    
    const dataAplicacao = entregaData.data_entrega;
    
    // Usar a RPC corrigida com todos os parâmetros
    const { data, error } = await supabase.rpc('criar_aplicacao_por_rua', {
      p_lista_entrega_id: listaEntregaId,
      p_registro_carga_id: cargaId,
      p_logradouro_nome: valores.logradouro_nome.trim(),
      p_area_aplicada: valores.area_aplicada,
      p_tonelada_aplicada: valores.tonelada_aplicada,
      p_espessura_aplicada: valores.espessura_aplicada || null,
      p_comprimento: valores.comprimento || null,
      p_largura_media: valores.largura_media || null,
      p_bordo: valores.bordo || null,
      p_temperatura_aplicacao: valores.temperatura_aplicacao || null,
      p_observacoes_aplicacao: valores.observacoes_aplicacao?.trim() || null,
      p_hora_inicio_aplicacao: valores.hora_inicio_aplicacao || null,
      p_hora_fim_aplicacao: valores.hora_fim_aplicacao || null,
      p_data_aplicacao: dataAplicacao,
      p_hora_chegada_local: '08:00:00'
    });

    if (error) {
      // Melhorar mensagem de erro baseada no tipo
      let errorMessage = "Erro ao salvar aplicação por rua";
      
      if (error.message) {
        if (error.message.includes("Massa aplicada") && error.message.includes("excede massa remanescente")) {
          errorMessage = `Massa insuficiente: ${error.message}`;
        } else if (error.message.includes("obrigatório")) {
          errorMessage = `Campo obrigatório: ${error.message}`;
        } else if (error.message.includes("autenticação") || error.message.includes("permissão")) {
          errorMessage = "Erro de autenticação. Faça login novamente.";
        } else {
          errorMessage = error.message;
        }
      }
      
      throw new Error(errorMessage);
    }

    // Cast do resultado da RPC primeiro
    const resultado = data as {
      success: boolean;
      registro_principal_id: string;
      detalhe_id: string;
      sequencia_aplicacao: number;
      massa_remanescente_nova: number;
    };

    // Validar resposta da RPC
    if (!resultado || !resultado.success) {
      throw new Error("Falha na operação de criação da aplicação");
    }

    // Buscar o detalhe recém-criado do banco para retornar dados reais
    const { data: detalheCompleto, error: fetchError } = await supabase
      .from("bd_registro_aplicacao_detalhes")
      .select("*")
      .eq("id", resultado.detalhe_id)
      .single();

    if (fetchError || !detalheCompleto) {
      // Fallback com dados simulados se não conseguir buscar
      return {
        id: resultado.detalhe_id,
        registro_aplicacao_id: resultado.registro_principal_id,
        lista_entrega_id: listaEntregaId,
        registro_carga_id: cargaId,
        logradouro_nome: valores.logradouro_nome,
        sequencia_aplicacao: resultado.sequencia_aplicacao,
        area_aplicada: valores.area_aplicada,
        tonelada_aplicada: valores.tonelada_aplicada,
        espessura_aplicada: valores.espessura_aplicada,
        comprimento: valores.comprimento,
        largura_media: valores.largura_media,
        bordo: valores.bordo as any,
        temperatura_aplicacao: valores.temperatura_aplicacao,
        observacoes_aplicacao: valores.observacoes_aplicacao,
        hora_inicio_aplicacao: valores.hora_inicio_aplicacao,
        hora_fim_aplicacao: valores.hora_fim_aplicacao,
        data_aplicacao: dataAplicacao,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as RegistroAplicacaoDetalhes;
    }

    return detalheCompleto as RegistroAplicacaoDetalhes;

  } catch (error) {
    console.error("Erro ao criar aplicação por rua:", error);
    
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Erro desconhecido ao criar aplicação por rua");
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
    return data as any;
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
    const { data, error } = await (supabase as any)
      .from("vw_registro_aplicacao_completo")
      .select("*")
      .eq("id", registroAplicacaoId)
      .single();

    if (error) throw error;
    return data as any;
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
    const { data, error } = await (supabase as any).rpc('finalizar_carga_aplicacao', {
      carga_id: cargaId
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Erro ao finalizar carga:", error);
    throw error;
  }
};
