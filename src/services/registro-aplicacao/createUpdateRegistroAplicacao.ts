
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
 * Verificar se o usuário pode criar registros para esta entrega
 */
const verificarPermissaoEntrega = async (listaEntregaId: string, userId: string): Promise<boolean> => {
  try {
    console.log("🔒 Verificando permissão para entrega:", listaEntregaId, "usuário:", userId);
    
    // Buscar informações da entrega e do usuário
    const { data: entrega, error: entregaError } = await supabase
      .from("bd_lista_programacao_entrega")
      .select(`
        id,
        equipe_id,
        apontador_id
      `)
      .eq("id", listaEntregaId)
      .single();

    if (entregaError || !entrega) {
      console.error("Erro ao buscar entrega:", entregaError);
      return false;
    }

    // Buscar perfil do usuário
    // Decisão via RBAC granular — Gestão de Permissões é fonte única
    const { checkUserAction } = await import("@/services/rbac/checkUserAction");
    const podeRegistrar = await checkUserAction(
      userId,
      "requisicoes_apontamento_caminhoes_view",
      "criar"
    );
    if (podeRegistrar) {
      console.log("✅ Permissão concedida via RBAC granular");
      return true;
    }

    // Verificar se é apontador da equipe da entrega
    const { data: funcionario } = await supabase
      .from("bd_funcionarios")
      .select("id, equipe_id")
      .eq("email", (await supabase.from("profiles").select("email").eq("id", userId).single()).data?.email)
      .single();

    if (funcionario) {
      // Verificar se é apontador da entrega ou da equipe
      if (entrega.apontador_id === funcionario.id || entrega.equipe_id === funcionario.equipe_id) {
        console.log("✅ Usuário é apontador da entrega/equipe - permissão concedida");
        return true;
      }
    }

    console.log("❌ Usuário não tem permissão para esta entrega");
    return false;
  } catch (error) {
    console.error("Erro ao verificar permissão:", error);
    return false;
  }
};

/**
 * Criar novo registro de aplicação - GARANTINDO created_by
 */
export const createRegistroAplicacao = async (data: RegistroAplicacaoFormValues & {
  observacoes_gerais?: string | null;
  data_fim_aplicacao?: string | null;
  created_by?: string;
}) => {
  try {
    console.log("📋 [CREATE] Iniciando criação de registro de aplicação");
    console.log("📋 [CREATE] Dados recebidos:", data);
    
    // Obter o ID do usuário atual
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error("Usuário não autenticado");
    }
    
    console.log("🔐 [CREATE] Usuário autenticado:", user.id);
    
    // CRÍTICO: Garantir que created_by seja sempre definido
    const createdBy = data.created_by || user.id;
    console.log("🔐 [CREATE] created_by será definido como:", createdBy);
    
    // Verificar permissão para esta entrega
    const temPermissao = await verificarPermissaoEntrega(data.lista_entrega_id, user.id);
    if (!temPermissao) {
      throw new Error("Usuário não tem permissão para criar registros para esta entrega");
    }
    
    // Validar e formatar dados - APENAS CAMPOS QUE EXISTEM NA TABELA
    const registroData = {
      lista_entrega_id: data.lista_entrega_id,
      registro_carga_id: data.registro_carga_id,
      data_aplicacao: data.data_aplicacao,
      hora_chegada_local: validateAndFormatHora(data.hora_chegada_local) || "08:00:00",
      temperatura_chegada: typeof data.temperatura_chegada === 'number' ? data.temperatura_chegada : null,
      status_aplicacao: 'Em Andamento',
      carga_finalizada: false,
      percentual_aplicado: 0,
      tonelada_aplicada: 0,
      // CRÍTICO: Sempre definir created_by com ID do usuário atual
      created_by: createdBy,
    };

    console.log("💾 [CREATE] Dados formatados para inserção:");
    console.log("💾 [CREATE] created_by:", registroData.created_by);
    console.log("💾 [CREATE] lista_entrega_id:", registroData.lista_entrega_id);
    console.log("💾 [CREATE] registro_carga_id:", registroData.registro_carga_id);

    const { data: registro, error } = await supabase
      .from("bd_registro_apontamento_aplicacao")
      .insert(registroData)
      .select()
      .single();

    if (error) {
      console.error("❌ [CREATE] Erro do Supabase:", error);
      console.error("❌ [CREATE] Detalhes do erro:", error.details);
      console.error("❌ [CREATE] Hint do erro:", error.hint);
      console.error("❌ [CREATE] Código do erro:", error.code);
      throw new Error(`Erro ao criar registro: ${error.message}`);
    }

    console.log("✅ [CREATE] Registro criado com sucesso:", registro);
    console.log("✅ [CREATE] created_by no registro criado:", registro.created_by);
    return registro;
  } catch (error) {
    console.error("❌ [CREATE] Erro ao criar registro de aplicação:", error);
    throw error;
  }
};

/**
 * Update an existing registro aplicação entry
 */
export const updateRegistroAplicacao = async (
  id: string,
  values: Partial<RegistroAplicacaoFormValues>
): Promise<RegistroAplicacao> => {
  try {
    console.log("📋 [UPDATE] Iniciando atualização de registro:", id);
    console.log("📋 [UPDATE] Valores recebidos:", values);
    
    // Obter o ID do usuário atual para auditoria
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error("Usuário não autenticado");
    }
    
    console.log("🔐 [UPDATE] Usuário autenticado:", user.id);
    
    // Preparar dados para atualização
    const updateData = {
      ...values,
      hora_chegada_local: validateAndFormatHora(values.hora_chegada_local),
      hora_aplicacao: validateAndFormatHora(values.hora_aplicacao),
      hora_saida_caminhao: validateAndFormatHora(values.hora_saida_caminhao),
      updated_at: new Date().toISOString(),
    };
    
    console.log("💾 [UPDATE] Dados para atualização:", updateData);
    
    // Update the record
    const { data, error } = await supabase
      .from("bd_registro_apontamento_aplicacao")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();
    
    if (error) {
      console.error("❌ [UPDATE] Erro do Supabase:", error);
      throw error;
    }
    
    if (!data) {
      throw new Error("Nenhum dado retornado após atualização");
    }
    
    console.log("✅ [UPDATE] Registro atualizado com sucesso:", data);
    return data as RegistroAplicacao;
  } catch (error) {
    console.error("❌ [UPDATE] Erro inesperado:", error);
    throw error;
  }
};
