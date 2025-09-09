import { supabase } from "@/integrations/supabase/client";
import { OrdemServico } from "@/types/ordemServico";
import { getChamadoById } from "@/services/ordemServicoService";

const generateOsNumber = async (): Promise<string> => {
  const year = new Date().getFullYear();
  
  const { count, error } = await supabase
    .from('bd_ordens_servico')
    .select('*', { count: 'exact', head: true })
    .like('numero_os', `OS${year}%`);
    
  if (error) throw error;
  
  const sequentialNumber = (count || 0) + 1;
  return `OS${year}${sequentialNumber.toString().padStart(3, '0')}`;
};

export const convertChamadoToOs = async (
  chamadoId: string, 
  userId: string,
  additionalData?: any
): Promise<OrdemServico> => {
  try {
    console.log(`🔄 Iniciando conversão do chamado ${chamadoId} para OS via RPC...`, { userId, additionalData });
    
    // Utilizar função RPC transacional que verifica permissões
    const { data: result, error: rpcError } = await supabase.rpc(
      'convert_chamado_para_os',
      {
        p_chamado_id: chamadoId,
        p_tipo_falha: additionalData?.tipo_falha
      }
    );

    if (rpcError) {
      console.error('❌ Erro RPC:', rpcError);
      throw new Error(rpcError.message || 'Erro ao converter chamado para OS');
    }

    // Type assertion para o resultado JSON
    const convertResult = result as { success: boolean; message?: string; os_id?: string; numero_os?: string };

    if (!convertResult?.success) {
      console.error('❌ Conversão falhou:', convertResult);
      throw new Error(convertResult?.message || 'Falha na conversão do chamado');
    }

    console.log('✅ Conversão RPC bem-sucedida:', convertResult);

    // Buscar a OS criada para retornar
    const { data: ordemServico, error: osError } = await supabase
      .from('bd_ordens_servico')
      .select('*')
      .eq('id', convertResult.os_id)
      .single();

    if (osError || !ordemServico) {
      console.error('❌ Erro ao recuperar OS criada:', osError);
      throw new Error('Erro ao recuperar ordem de serviço criada');
    }

    console.log(`🎉 Conversão concluída! OS #${convertResult.numero_os} criada com ID: ${convertResult.os_id}`);
    
    return ordemServico as any;
  } catch (error) {
    console.error('💥 Erro na conversão de chamado para OS:', error);
    throw error;
  }
};

export const updateChamadoStatus = async (chamadoId: string, newStatus: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('bd_chamados_os')
      .update({ status: newStatus })
      .eq('id', chamadoId);
      
    if (error) throw error;
    
    console.log(`✅ Status do chamado ${chamadoId} atualizado para: ${newStatus}`);
  } catch (error) {
    console.error("❌ Erro ao atualizar status do chamado:", error);
    throw error;
  }
};