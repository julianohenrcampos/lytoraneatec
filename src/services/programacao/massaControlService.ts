import { supabase } from "@/integrations/supabase/client";
import { calculateMassaPercentual, kgToToneladas } from "@/utils/massaConversionUtils";

export interface MassaProgressInfo {
  totalRequisicao: number;
  massaAplicada: number;
  massaProgramada: number;
  massaDisponivel: number;
  percentualAplicado: number;
  percentualProgramado: number;
  isCompleto: boolean;
  podeSerProgramada: boolean;
}

/**
 * Calcula o progresso inteligente da massa para uma requisição
 */
export const calcularProgressoMassa = async (requisicaoId: string): Promise<MassaProgressInfo> => {
  try {
    console.log("🔍 Calculando progresso da massa para requisição:", requisicaoId);

    // 1. Buscar o peso total da requisição
    const { data: ruas, error: ruasError } = await supabase
      .from('bd_ruas_requisicao')
      .select('volume')
      .eq('requisicao_id', requisicaoId);

    if (ruasError) throw ruasError;

    // Converter volumes de kg (bd_ruas_requisicao sempre em kg) para toneladas
    const totalRequisicao = ruas?.reduce((acc, rua) => {
      const volumeInToneladas = kgToToneladas(rua.volume || 0);
      console.log(`🔄 Convertendo volume: ${rua.volume}kg → ${volumeInToneladas}t`);
      return acc + volumeInToneladas;
    }, 0) || 0;

    // 2. Calcular massa já aplicada (registro de aplicação)
    const { data: aplicacoes, error: aplicacoesError } = await supabase
      .from('bd_registro_apontamento_aplicacao')
      .select(`
        tonelada_aplicada,
        lista_entrega_id,
        bd_lista_programacao_entrega!inner(requisicao_id)
      `)
      .eq('bd_lista_programacao_entrega.requisicao_id', requisicaoId);

    if (aplicacoesError) throw aplicacoesError;

    const massaAplicada = aplicacoes?.reduce((acc, app) => acc + (app.tonelada_aplicada || 0), 0) || 0;

    // 3. Calcular massa programada (não aplicada ainda) - EXCLUIR entregas já aplicadas
    const { data: programadas, error: programadasError } = await supabase
      .from('bd_lista_programacao_entrega')
      .select('quantidade_massa, status')
      .eq('requisicao_id', requisicaoId)
      .in('status', ['Pendente']); // CORREÇÃO: Apenas 'Pendente', não incluir 'Enviada' nem 'Entregue'

    if (programadasError) throw programadasError;

    const massaProgramada = programadas?.reduce((acc, prog) => acc + (prog.quantidade_massa || 0), 0) || 0;

    // 4. Calcular disponível
    const massaDisponivel = Math.max(0, totalRequisicao - massaAplicada - massaProgramada);

    // 5. Calcular percentuais usando função padronizada - CORRIGIR para não exceder 100%
    const percentualAplicado = calculateMassaPercentual(massaAplicada, totalRequisicao);
    const percentualProgramado = calculateMassaPercentual(massaProgramada, totalRequisicao);
    
    // 📊 GARANTIR que o percentual total não exceda 100%
    const percentualTotal = percentualAplicado + percentualProgramado;
    const percentualProgramadoAjustado = percentualTotal > 100 
      ? Math.max(0, 100 - percentualAplicado)
      : percentualProgramado;

    // 6. Determinar status
    const isCompleto = massaAplicada >= totalRequisicao;
    const podeSerProgramada = massaDisponivel > 0.1; // Tolerância de 0.1 toneladas

    const resultado = {
      totalRequisicao,
      massaAplicada,
      massaProgramada,
      massaDisponivel,
      percentualAplicado,
      percentualProgramado: percentualProgramadoAjustado,
      isCompleto,
      podeSerProgramada
    };

    console.log("📊 Progresso calculado:", resultado);
    return resultado;

  } catch (error) {
    console.error("❌ Erro ao calcular progresso da massa:", error);
    throw error;
  }
};

/**
 * Devolve massa de uma programação cancelada
 */
export const devolverMassaCancelada = async (entregaId: string): Promise<void> => {
  try {
    console.log("🔄 Devolvendo massa cancelada para entrega:", entregaId);

    // Verificar se pode ser cancelada antes de devolver massa
    const { data: entrega, error: consultaError } = await supabase
      .from('bd_lista_programacao_entrega')
      .select('status')
      .eq('id', entregaId)
      .single();

    if (consultaError) throw consultaError;

    // 🚫 IMPEDIR cancelamento de entregas já enviadas ou entregues
    if (entrega.status === 'Enviada' || entrega.status === 'Entregue') {
      console.log("❌ Não é possível cancelar entrega já enviada/entregue");
      throw new Error("Não é possível cancelar uma entrega que já foi enviada ou entregue");
    }

    // Atualizar status para Cancelada
    const { error } = await supabase
      .from('bd_lista_programacao_entrega')
      .update({ status: 'Cancelada' })
      .eq('id', entregaId);

    if (error) throw error;

    console.log("✅ Massa devolvida com sucesso");
  } catch (error) {
    console.error("❌ Erro ao devolver massa cancelada:", error);
    throw error;
  }
};

/**
 * Verifica se usuário pode cancelar uma programação
 */
export const podeSerCancelada = async (entregaId: string, userId: string): Promise<{
  podeCancel: boolean;
  motivo?: string;
}> => {
  try {
    // 1. Verificar se já foi enviada para aplicação
    const { data: entrega, error: entregaError } = await supabase
      .from('bd_lista_programacao_entrega')
      .select('status, programacao_entrega_id')
      .eq('id', entregaId)
      .single();

    if (entregaError) throw entregaError;

    if (entrega.status === 'Enviada' || entrega.status === 'Entregue') {
      return { 
        podeCancel: false, 
        motivo: "Não é possível cancelar uma entrega que já foi enviada ou entregue" 
      };
    }

    // 2. Verificar se tem registro de carga
    const { data: registroCarga } = await supabase
      .from('bd_registro_cargas')
      .select('id')
      .eq('lista_entrega_id', entregaId)
      .maybeSingle();

    if (registroCarga) {
      return { 
        podeCancel: false, 
        motivo: "Não é possível cancelar: já existe registro de carga para esta entrega" 
      };
    }

    // 3. Verificar se usuário é o criador da programação
    const { data: programacao, error: programacaoError } = await supabase
      .from('bd_programacao_entrega')
      .select('created_at')
      .eq('id', entrega.programacao_entrega_id)
      .single();

    if (programacaoError) throw programacaoError;

    // Decisão via RBAC granular — Gestão de Permissões é fonte única
    const { checkUserAction } = await import("@/services/rbac/checkUserAction");
    const podeCancel = await checkUserAction(
      userId,
      "requisicoes_programacao_entrega_view",
      "excluir"
    );

    return { podeCancel };

  } catch (error) {
    console.error("❌ Erro ao verificar permissão de cancelamento:", error);
    return { podeCancel: false, motivo: "Erro interno do sistema" };
  }
};

/**
 * Lista requisições que ainda podem receber programação
 * EXCLUSÃO AUTOMÁTICA: Remove requisições 100% aplicadas
 */
export const buscarRequisicoesDisponiveis = async (): Promise<any[]> => {
  try {
    const { data: requisicoes, error } = await supabase
      .from('bd_requisicoes')
      .select(`
        id,
        numero,
        centro_custo_id,
        centro_custo:bd_centros_custo(id, nome_centro_custo, codigo_centro_custo),
        bd_ruas_requisicao(volume)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Filtrar apenas requisições que ainda têm massa disponível
    const requisicoesComProgresso = await Promise.all(
      (requisicoes || []).map(async (req) => {
        const progresso = await calcularProgressoMassa(req.id);
        return {
          ...req,
          progresso,
          podeSerProgramada: progresso.podeSerProgramada
        };
      })
    );

    // AUTOMAÇÃO: Excluir automaticamente requisições 100% concluídas
    const disponiveis = requisicoesComProgresso.filter(req => req.podeSerProgramada);
    
    console.log(`🎯 Inteligência aplicada: ${requisicoesComProgresso.length - disponiveis.length} requisições completas excluídas automaticamente`);

    return disponiveis;

  } catch (error) {
    console.error("❌ Erro ao buscar requisições disponíveis:", error);
    throw error;
  }
};