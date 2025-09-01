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
    console.log(`🔄 Iniciando conversão do chamado ${chamadoId} para OS...`, { userId, additionalData });
    
    // 1. Buscar o chamado
    const chamado = await getChamadoById(chamadoId);
    
    if (!chamado) {
      throw new Error('Chamado não encontrado');
    }

    console.log(`📋 Chamado encontrado: #${chamado.numero_chamado} - Status: ${chamado.status}`);

    // 2. Verificar se já foi convertido
    if (chamado.status === 'Convertido para OS') {
      throw new Error(`Chamado #${chamado.numero_chamado} já foi convertido para OS`);
    }

    if (chamado.status !== 'Aberto') {
      throw new Error(`Chamado deve estar com status "Aberto" para ser convertido. Status atual: ${chamado.status}`);
    }

    // 3. Gerar número da OS
    const numeroOs = await generateOsNumber();
    console.log(`🆔 Número da OS gerado: ${numeroOs}`);
    
    // 4. Preparar dados da OS (usando apenas colunas que existem na bd_ordens_servico)
    const osData = {
      numero_os: numeroOs,
      chamado_id: chamadoId,
      caminhao_equipamento_id: chamado.caminhao_equipamento_id,
      data_abertura: new Date().toISOString().split('T')[0],
      tipo_servico: chamado.tipo_falha || 'Mecânica',
      descricao_servico: chamado.descricao_problema,
      status: 'Aberta',
      ...additionalData
    };
    
    console.log('📝 Dados da OS preparados:', osData);
    
    // 5. Criar a OS
    const { data: novaOs, error: osError } = await supabase
      .from('bd_ordens_servico')
      .insert(osData)
      .select()
      .single();
      
    if (osError) {
      console.error('❌ Erro ao criar OS:', osError);
      throw new Error(`Erro ao criar OS: ${osError.message}`);
    }
    
    console.log('✅ OS criada com sucesso:', novaOs);
    
    // 6. Criar movimentação de conversão
    const { error: movError } = await supabase
      .from('bd_os_movimentacoes')
      .insert({
        os_id: novaOs.id,
        usuario_id: userId,
        motivo: `Conversão do chamado #${chamado.numero_chamado} para OS #${numeroOs}`
      });
    
    if (movError) {
      console.warn('⚠️ Erro ao criar movimentação (não crítico):', movError);
    } else {
      console.log('📝 Movimentação de conversão registrada');
    }
    
    // 7. Atualizar status do chamado
    const { error: statusError } = await supabase
      .from('bd_chamados_os')
      .update({ status: 'Convertido para OS' })
      .eq('id', chamadoId);
      
    if (statusError) {
      console.error('❌ Erro ao atualizar status do chamado:', statusError);
      throw new Error(`Erro ao atualizar status do chamado: ${statusError.message}`);
    }
    
    console.log(`🎉 Conversão concluída! Chamado #${chamado.numero_chamado} → OS #${numeroOs}`);
    
    return novaOs as any;
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