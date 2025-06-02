
import { supabase } from "@/integrations/supabase/client";
import { RegistroAplicacaoFormValues, RegistroAplicacao } from "@/types/registroAplicacao";

/**
 * Validar e formatar hora
 */
const validateAndFormatHora = (hora: string | null | undefined): string | null => {
  if (!hora || hora.trim() === "") {
    return null;
  }
  
  const horaStr = hora.trim();
  const horaRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
  
  if (!horaRegex.test(horaStr)) {
    console.warn(`Formato de hora inválido: ${horaStr}, usando valor padrão`);
    return null;
  }
  
  // Adicionar segundos se não fornecidos
  if (horaStr.length === 5) {
    return `${horaStr}:00`;
  }
  
  return horaStr;
};

/**
 * Criar novo registro de aplicação
 */
export const createRegistroAplicacao = async (data: RegistroAplicacaoFormValues & {
  observacoes_gerais?: string | null;
  data_fim_aplicacao?: string | null;
}) => {
  try {
    console.log("Criando registro de aplicação com dados:", data);
    
    // Validar e formatar dados
    const registroData = {
      lista_entrega_id: data.lista_entrega_id,
      registro_carga_id: data.registro_carga_id,
      data_aplicacao: data.data_aplicacao,
      hora_chegada_local: validateAndFormatHora(data.hora_chegada_local) || "08:00:00",
      temperatura_chegada: typeof data.temperatura_chegada === 'number' ? data.temperatura_chegada : null,
      hora_aplicacao: validateAndFormatHora(data.hora_aplicacao),
      temperatura_aplicacao: data.temperatura_aplicacao || null,
      bordo: data.bordo || null,
      estaca_inicial: data.estaca_inicial || null,
      comprimento: data.comprimento || null,
      largura_media: data.largura_media || null,
      area_calculada: data.area_calculada || null,
      tonelada_aplicada: data.tonelada_aplicada || null,
      espessura: data.espessura || null,
      espessura_calculada: data.espessura_calculada || null,
      hora_saida_caminhao: validateAndFormatHora(data.hora_saida_caminhao),
      estaca_final: data.estaca_final || null,
      anotacoes_apontador: data.anotacoes_apontador || null,
      observacoes_gerais: data.observacoes_gerais || null,
      data_fim_aplicacao: data.data_fim_aplicacao || null,
      usar_massa_total_para_espessura: data.usar_massa_total_para_espessura || false,
      aplicacao_sequencia: data.aplicacao_sequencia || 1,
      media_espessura_cm: data.media_espessura_cm || null,
      carga_finalizada: data.carga_finalizada || false,
      massa_remanescente_antes_aplicacao: data.massa_remanescente_antes_aplicacao || null,
      carga_origem_id: data.carga_origem_id || null,
      logradouro_aplicado: data.logradouro_aplicado || null,
      logradouro_id: data.logradouro_id || null,
    };

    console.log("Dados formatados para inserção:", registroData);

    const { data: registro, error } = await supabase
      .from("bd_registro_apontamento_aplicacao")
      .insert(registroData)
      .select()
      .single();

    if (error) {
      console.error("Erro do Supabase ao criar registro:", error);
      throw new Error(`Erro ao criar registro: ${error.message}`);
    }

    console.log("Registro criado com sucesso:", registro);
    return registro;
  } catch (error) {
    console.error("Erro ao criar registro de aplicação:", error);
    throw error;
  }
};

/**
 * Update an existing registro aplicação entry
 * @param id Record ID to update
 * @param values Form values to update
 * @returns Updated registro aplicação
 */
export const updateRegistroAplicacao = async (
  id: string,
  values: Partial<RegistroAplicacaoFormValues>
): Promise<RegistroAplicacao> => {
  try {
    console.log("Updating registro aplicação with ID:", id, "Values:", values);
    
    // Update the record
    const { data, error } = await supabase
      .from("bd_registro_apontamento_aplicacao")
      .update(values)
      .eq("id", id)
      .select()
      .single();
    
    if (error) {
      console.error("Error updating registro aplicação:", error);
      throw error;
    }
    
    console.log("Updated registro aplicação:", data);
    return data as RegistroAplicacao;
  } catch (error) {
    console.error("Unexpected error updating registro aplicação:", error);
    throw error;
  }
};
