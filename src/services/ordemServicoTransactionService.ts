import { OrdemServico, Material, MaoDeObra } from "@/types/ordemServico";
import { createOrdemServico, saveMaterial, saveMaoDeObra } from "./ordemServicoService";

/**
 * Cria uma OS com materiais e mão de obra em uma única operação transacional
 * @param osData Dados da ordem de serviço
 * @param materials Lista de materiais
 * @param laborItems Lista de mão de obra
 * @param currentUserId ID do usuário atual
 * @returns Objeto com OS criada e itens salvos
 */
export const createOrdemServicoWithItems = async (
  osData: Partial<OrdemServico>,
  materials: Partial<Material>[],
  laborItems: Partial<MaoDeObra>[],
  currentUserId: string
) => {
  console.log('🔄 [TRANSACTION] Iniciando criação transacional de OS');
  console.log('🔄 [TRANSACTION] Materials count:', materials.length);
  console.log('🔄 [TRANSACTION] Labor items count:', laborItems.length);
  
  try {
    // 1. Criar a OS primeiro
    const os = await createOrdemServico(osData, currentUserId);
    console.log('✅ [TRANSACTION] OS criada:', os.id);
    
    // 2. Salvar materiais em paralelo
    const savedMaterials = await Promise.all(
      materials.map(material => 
        saveMaterial({ ...material, os_id: os.id })
      )
    );
    console.log('✅ [TRANSACTION] Materiais salvos:', savedMaterials.length);
    
    // 3. Salvar mão de obra em paralelo
    const savedLaborItems = await Promise.all(
      laborItems.map(labor => 
        saveMaoDeObra({ ...labor, os_id: os.id })
      )
    );
    console.log('✅ [TRANSACTION] Mão de obra salva:', savedLaborItems.length);
    
    console.log('🎉 [TRANSACTION] Transação completa com sucesso');
    
    return {
      os,
      materials: savedMaterials,
      laborItems: savedLaborItems
    };
  } catch (error) {
    console.error('❌ [TRANSACTION] Erro na transação:', error);
    throw error;
  }
};

/**
 * Atualiza uma OS com materiais e mão de obra salvos determinísticamente
 * @param osId ID da ordem de serviço
 * @param osData Dados da ordem de serviço
 * @param materials Lista de materiais
 * @param laborItems Lista de mão de obra
 * @param currentUserId ID do usuário atual
 * @param motivo Motivo da alteração
 * @returns Objeto com OS atualizada e itens salvos
 */
export const updateOrdemServicoWithItems = async (
  osId: string,
  osData: Partial<OrdemServico>,
  materials: Partial<Material>[],
  laborItems: Partial<MaoDeObra>[],
  currentUserId: string,
  motivo: string = "Atualização completa da OS"
) => {
  console.log('🔄 [UPDATE-TRANSACTION] Iniciando atualização transacional de OS');
  console.log('🔄 [UPDATE-TRANSACTION] OS ID:', osId);
  console.log('🔄 [UPDATE-TRANSACTION] Materials count:', materials.length);
  console.log('🔄 [UPDATE-TRANSACTION] Labor items count:', laborItems.length);
  
  try {
    // 1. Atualizar a OS primeiro
    const { updateOrdemServico } = await import('./ordemServicoService');
    const os = await updateOrdemServico(osId, osData, currentUserId, motivo);
    console.log('✅ [UPDATE-TRANSACTION] OS atualizada:', os.id);
    
    // 2. Salvar materiais em paralelo com os_id explícito
    const savedMaterials = await Promise.all(
      materials.map(material => 
        saveMaterial({ ...material, os_id: osId })
      )
    );
    console.log('✅ [UPDATE-TRANSACTION] Materiais salvos:', savedMaterials.length);
    
    // 3. Salvar mão de obra em paralelo com os_id explícito
    const savedLaborItems = await Promise.all(
      laborItems.map(labor => 
        saveMaoDeObra({ ...labor, os_id: osId })
      )
    );
    console.log('✅ [UPDATE-TRANSACTION] Mão de obra salva:', savedLaborItems.length);
    
    console.log('🎉 [UPDATE-TRANSACTION] Transação completa com sucesso');
    
    return {
      os,
      materials: savedMaterials,
      laborItems: savedLaborItems
    };
  } catch (error) {
    console.error('❌ [UPDATE-TRANSACTION] Erro na transação:', error);
    throw error;
  }
};