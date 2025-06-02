
import { supabase } from "@/integrations/supabase/client";
import { RegistroAplicacao } from "@/types/registroAplicacao";

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
 * Update an existing registro aplicação entry
 * @param id Record ID to update
 * @param values Form values to update
 * @returns Updated registro aplicação
 */
export const updateRegistroAplicacao = async (
  id: string,
  values: any
): Promise<RegistroAplicacao> => {
  try {
    console.log("=== INÍCIO updateRegistroAplicacao ===");
    console.log("ID do registro:", id);
    console.log("Valores recebidos:", values);
    
    // Validar e formatar dados antes da atualização
    const formattedValues = {
      ...values,
      hora_chegada_local: validateAndFormatHora(values.hora_chegada_local),
      hora_saida_caminhao: validateAndFormatHora(values.hora_saida_caminhao),
      temperatura_chegada: typeof values.temperatura_chegada === 'number' ? values.temperatura_chegada : null,
      anotacoes_apontador: values.anotacoes_apontador || null,
      updated_at: new Date().toISOString()
    };

    console.log("Valores formatados para atualização:", formattedValues);
    
    // Update the record
    const { data, error } = await supabase
      .from("bd_registro_apontamento_aplicacao")
      .update(formattedValues)
      .eq("id", id)
      .select()
      .single();
    
    if (error) {
      console.error("Erro do Supabase ao atualizar registro:", error);
      console.error("Código do erro:", error.code);
      console.error("Detalhes do erro:", error.details);
      console.error("Hint do erro:", error.hint);
      throw new Error(`Erro ao atualizar registro: ${error.message}`);
    }
    
    if (!data) {
      console.error("Nenhum dado retornado após atualização");
      throw new Error("Nenhum dado retornado após atualização do registro");
    }
    
    console.log("Registro atualizado com sucesso:", data);
    console.log("=== FIM updateRegistroAplicacao ===");
    return data as RegistroAplicacao;
  } catch (error) {
    console.error("=== ERRO em updateRegistroAplicacao ===");
    console.error("Erro inesperado:", error);
    throw error;
  }
};
