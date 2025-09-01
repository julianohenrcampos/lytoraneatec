
import { RegistroAplicacaoSchema } from "@/validations/registroAplicacaoSchema";
import { supabase } from "@/integrations/supabase/client";

export const handleFormSubmission = async (
  data: RegistroAplicacaoSchema,
  toast: any,
  onSuccess?: () => void,
  existingId?: string
) => {
  try {
    console.log("🚀 [SUBMIT] Iniciando envio:", { data, existingId });

    // Verificar autenticação
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error("❌ [SUBMIT] Usuário não autenticado");
      throw new Error("Usuário não autenticado");
    }

    console.log("✅ [SUBMIT] Usuário autenticado:", user.id);

    // Validar campos obrigatórios
    if (!data.lista_entrega_id) {
      throw new Error("Lista de entrega é obrigatória");
    }
    
    if (!data.registro_carga_id) {
      throw new Error("Registro de carga é obrigatório");
    }
    
    if (!data.data_aplicacao) {
      throw new Error("Data de aplicação é obrigatória");
    }
    
    if (!data.hora_chegada_local) {
      throw new Error("Hora de chegada é obrigatória");
    }

    // Preparar dados com validação e formatação
    const submitData = {
      ...data,
      // Garantir que hora_saida_caminhao seja formatada corretamente
      hora_saida_caminhao: data.hora_saida_caminhao || null,
      hora_chegada_local: data.hora_chegada_local,
      hora_aplicacao: data.hora_aplicacao || null,
      // Garantir que created_by seja mapeado corretamente
      created_by: user.id,
      updated_at: new Date().toISOString(),
      // Garantir valores padrão para campos numéricos
      tonelada_aplicada: data.tonelada_aplicada || 0,
      percentual_aplicado: data.percentual_aplicado || 0,
      aplicacao_sequencia: data.aplicacao_sequencia || 1,
      carga_finalizada: data.carga_finalizada || false,
    };

    console.log("📦 [SUBMIT] Dados preparados:", submitData);
    console.log("🕐 [SUBMIT] Hora de saída sendo salva:", submitData.hora_saida_caminhao);

    let result;
    
    if (existingId) {
      // Atualizar registro existente
      console.log("🔄 [SUBMIT] Atualizando registro:", existingId);
      
      const { data: updated, error } = await supabase
        .from("bd_registro_apontamento_aplicacao")
        .update(submitData)
        .eq("id", existingId)
        .select()
        .single();

      if (error) {
        console.error("❌ [SUBMIT] Erro na atualização:", error);
        throw error;
      }
      
      result = updated;
    } else {
      // Criar novo registro
      console.log("✨ [SUBMIT] Criando novo registro");
      
      const { data: created, error } = await supabase
        .from("bd_registro_apontamento_aplicacao")
        .insert([submitData] as any)
        .select()
        .single();

      if (error) {
        console.error("❌ [SUBMIT] Erro na criação:", error);
        throw error;
      }
      
      result = created;
    }

    console.log("✅ [SUBMIT] Sucesso:", result);

    // Toast de sucesso
    toast({
      title: "Sucesso",
      description: existingId 
        ? "Registro atualizado com sucesso!" 
        : "Registro criado com sucesso!",
      variant: "default",
    });

    // Executar callback com delay para garantir execução
    if (onSuccess) {
      setTimeout(() => {
        console.log("🎯 [SUBMIT] Executando callback de sucesso");
        onSuccess();
      }, 100);
    }

    return result;
  } catch (error: any) {
    console.error("❌ [SUBMIT] Erro geral:", error);
    console.error("❌ [SUBMIT] Stack trace:", error.stack);
    console.error("❌ [SUBMIT] Dados que falharam:", data);
    
    let errorMessage = "Erro ao salvar registro";
    
    // Tratar erros específicos do Supabase
    if (error.code) {
      switch (error.code) {
        case '23505':
          errorMessage = "Registro duplicado encontrado";
          break;
        case '23503':
          errorMessage = "Referência inválida detectada";
          break;
        case '23502':
          errorMessage = "Campo obrigatório não preenchido";
          break;
        case 'PGRST116':
          errorMessage = "Nenhum registro encontrado para atualização";
          break;
        default:
          errorMessage = error.message || errorMessage;
      }
    } else {
      errorMessage = error.message || errorMessage;
    }
    
    toast({
      title: "Erro no Salvamento",
      description: errorMessage,
      variant: "destructive",
    });
    
    throw error;
  }
};
