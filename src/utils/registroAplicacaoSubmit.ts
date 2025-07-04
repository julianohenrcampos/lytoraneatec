
import { RegistroAplicacaoSchema } from "@/validations/registroAplicacaoSchema";
import { createRegistroAplicacao, updateRegistroAplicacao, fetchRegistroAplicacaoByListaEntregaId } from "@/services/registro-aplicacao";
import { finalizarCargaManual, calcularMassaRemanescente } from "@/services/registro-aplicacao/manualFinalizationService";
import { Toast } from "@/types/toast";
import { RegistroAplicacaoFormValues } from "@/types/registroAplicacao";

export const handleFormSubmission = async (
  data: RegistroAplicacaoSchema,
  toast: (props: Toast) => void,
  onSuccess?: () => void
) => {
  try {
    console.log("📋 [SUBMIT] Form data to submit:", data);
    
    // Validações de segurança
    if (!data.lista_entrega_id) {
      toast({
        title: "Erro",
        description: "ID da lista de entrega é obrigatório",
        variant: "destructive",
      });
      return;
    }
    
    if (!data.registro_carga_id) {
      toast({
        title: "Erro",
        description: "ID do registro de carga é obrigatório",
        variant: "destructive",
      });
      return;
    }
    
    const ensureTimeFormat = (hora?: string | null): string | null => {
      if (!hora) return null;
      const trimmed = hora.trim();
      return trimmed.length === 5 ? `${trimmed}:00` : trimmed;
    };

    const normalizeDate = (dateStr?: string | null): string | null => {
      if (!dateStr) return null;
      const parsed = new Date(dateStr);
      return isNaN(parsed.getTime()) ? dateStr : parsed.toISOString().split('T')[0];
    };

    // Preparar dados para submissão com validações robustas
    const submissionData: RegistroAplicacaoFormValues = {
      lista_entrega_id: data.lista_entrega_id,
      registro_carga_id: data.registro_carga_id,
      data_aplicacao: normalizeDate(data.data_aplicacao) || '',
      hora_chegada_local: ensureTimeFormat(data.hora_chegada_local) || '',
      logradouro_id: data.logradouro_id,
      logradouro_aplicado: data.logradouro_aplicado,
      temperatura_chegada: data.temperatura_chegada !== null ? Number(data.temperatura_chegada) : null,
      hora_aplicacao: ensureTimeFormat(data.hora_aplicacao),
      temperatura_aplicacao: data.temperatura_aplicacao !== null ? Number(data.temperatura_aplicacao) : null,
      bordo: data.bordo,
      estaca_inicial: data.estaca_inicial !== null ? Number(data.estaca_inicial) : null,
      comprimento: data.comprimento !== null ? Number(data.comprimento) : null,
      largura_media: data.largura_media !== null ? Number(data.largura_media) : null,
      area_calculada: data.area_calculada !== null ? Number(data.area_calculada) : null,
      tonelada_aplicada: data.tonelada_aplicada !== null ? Number(data.tonelada_aplicada) : null,
      espessura: data.espessura !== null ? Number(data.espessura) : null,
      hora_saida_caminhao: ensureTimeFormat(data.hora_saida_caminhao),
      estaca_final: data.estaca_final !== null ? Number(data.estaca_final) : null,
      anotacoes_apontador: data.anotacoes_apontador,
      usar_massa_total_para_espessura: data.usar_massa_total_para_espessura
    };
    
    let registroSalvo = null;
    
    try {
      // Verificar se existe registro
      const existingRecord = await fetchRegistroAplicacaoByListaEntregaId(data.lista_entrega_id);
      
      if (existingRecord) {
        console.log("🔄 [SUBMIT] Atualizando registro existente:", existingRecord.id);
        registroSalvo = await updateRegistroAplicacao(existingRecord.id, submissionData);
        
        toast({
          title: "Sucesso",
          description: "Registro de aplicação atualizado com sucesso!",
        });
      } else {
        console.log("✨ [SUBMIT] Criando novo registro");
        registroSalvo = await createRegistroAplicacao(submissionData);
        
        toast({
          title: "Sucesso",
          description: "Registro de aplicação criado com sucesso!",
        });
      }
      
      // NOVA LÓGICA: Verificar se deve finalizar carga automaticamente
      if (data.hora_saida_caminhao && data.registro_carga_id) {
        console.log("🚛 [SUBMIT] Hora de saída preenchida, verificando finalização...");
        
        // Calcular massa remanescente
        const massaRemanescente = await calcularMassaRemanescente(data.lista_entrega_id);
        console.log("📊 [SUBMIT] Massa remanescente:", massaRemanescente);
        
        // Se massa remanescente for muito baixa (< 0.1 ton), finalizar carga
        if (massaRemanescente <= 0.1) {
          console.log("🏁 [SUBMIT] Finalizando carga automaticamente...");
          
          try {
            const resultado = await finalizarCargaManual(data.registro_carga_id);
            console.log("✅ [SUBMIT] Carga finalizada:", resultado);
            
            toast({
              title: "Carga Finalizada",
              description: `Aplicação concluída! Total: ${resultado.total_aplicado.toFixed(2)}t`,
            });
          } catch (finalizationError) {
            console.warn("⚠️ [SUBMIT] Erro na finalização automática:", finalizationError);
            // Não bloquear o salvamento se finalização falhar
          }
        }
      }
      
      // Executar callback de sucesso
      if (onSuccess) {
        onSuccess();
      }
      
    } catch (error) {
      console.error("❌ [SUBMIT] Erro na operação principal:", error);
      
      // Tentar fallback: criar novo registro
      try {
        console.log("🔄 [SUBMIT] Tentativa de fallback - criando novo registro");
        await createRegistroAplicacao(submissionData);
        
        toast({
          title: "Sucesso",
          description: "Registro de aplicação criado com sucesso!",
        });
        
        if (onSuccess) {
          onSuccess();
        }
      } catch (createError) {
        console.error("❌ [SUBMIT] Erro no fallback:", createError);
        throw createError;
      }
    }
    
  } catch (error) {
    console.error("❌ [SUBMIT] Erro crítico no envio:", error);
    toast({
      title: "Erro",
      description: "Ocorreu um erro ao salvar os dados. Tente novamente.",
      variant: "destructive",
    });
    throw error;
  }
};
