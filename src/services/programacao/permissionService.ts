import { supabase } from "@/integrations/supabase/client";
import { checkUserAction } from "@/services/rbac/checkUserAction";

export interface CancellationPermission {
  canCancel: boolean;
  reason?: string;
  userRole?: string;
}

/**
 * Verifica se o usuário pode cancelar uma programação específica
 */
export const checkCancellationPermission = async (
  entregaId: string,
  userId: string
): Promise<CancellationPermission> => {
  try {
    console.log("🔐 Verificando permissão de cancelamento para:", { entregaId, userId });

    // 1. Verificar se a entrega existe e seu status atual
    const { data: entrega, error: entregaError } = await supabase
      .from('bd_lista_programacao_entrega')
      .select(`
        id,
        status,
        programacao_entrega_id,
        bd_programacao_entrega!inner(
          id,
          created_at,
          requisicao_id
        )
      `)
      .eq('id', entregaId)
      .single();

    if (entregaError || !entrega) {
      return {
        canCancel: false,
        reason: "Entrega não encontrada"
      };
    }

    // 2. Verificar se já foi enviada ou entregue
    if (entrega.status === 'Enviada' || entrega.status === 'Entregue') {
      return {
        canCancel: false,
        reason: "Não é possível cancelar uma entrega que já foi enviada ou entregue"
      };
    }

    // 3. Verificar se já tem registro de carga (massa apontada)
    const { data: registroCarga } = await supabase
      .from('bd_registro_cargas')
      .select('id')
      .eq('lista_entrega_id', entregaId)
      .maybeSingle();

    if (registroCarga) {
      return {
        canCancel: false,
        reason: "Não é possível cancelar: já existe registro de carga para esta entrega"
      };
    }

    // 4. Decisão pelo RBAC granular (Gestão de Permissões — fonte única)
    const canEdit = await checkUserAction(
      userId,
      "requisicoes_programacao_entrega_view",
      "editar"
    );

    if (canEdit) {
      return { canCancel: true };
    }

    return {
      canCancel: false,
      reason: "Usuário não possui permissão para cancelar programações",
    };

  } catch (error) {
    console.error("❌ Erro ao verificar permissão de cancelamento:", error);
    return {
      canCancel: false,
      reason: "Erro interno do sistema"
    };
  }
};

/**
 * Verifica se o usuário pode editar uma programação
 */
export const checkEditPermission = async (
  programacaoId: string,
  userId: string
): Promise<CancellationPermission> => {
  try {
    const canEdit = await checkUserAction(
      userId,
      "requisicoes_programacao_entrega_view",
      "editar"
    );

    return {
      canCancel: canEdit,
      reason: canEdit
        ? undefined
        : "Usuário não possui permissão para editar programações",
    };

  } catch (error) {
    console.error("❌ Erro ao verificar permissão de edição:", error);
    return {
      canCancel: false,
      reason: "Erro interno do sistema"
    };
  }
};

/**
 * Log de ações de cancelamento para auditoria
 */
export const logCancellationAction = async (
  entregaId: string,
  userId: string,
  action: 'cancelled' | 'restored',
  reason?: string
): Promise<void> => {
  try {
    console.log("📝 Registrando ação de cancelamento:", { entregaId, userId, action, reason });
    
    // Por enquanto, apenas log no console
    // Futuramente pode ser implementada uma tabela de auditoria
    
  } catch (error) {
    console.error("❌ Erro ao registrar log de cancelamento:", error);
  }
};