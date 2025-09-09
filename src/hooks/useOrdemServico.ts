import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { 
  fetchOpenChamados,
  fetchOrdensServico,
  getOrdemServicoById,
  updateOrdemServico,
  createOrdemServico,
  getMaterialsByOsId,
  getMaoDeObraByOsId,
  getMovimentacoesByOsId,
  saveMaterial,
  deleteMaterial,
  saveMaoDeObra,
  deleteMaoDeObra,
  exportOsToExcel,
  getChamadoById,
  finishOrdemServico,
  generateOsPdf
} from "@/services/ordemServicoService";
import { convertChamadoToOs, updateChamadoStatus } from "@/services/convertChamadoService";
import { OrdemServico, Material, MaoDeObra, Movimentacao, OsFilterParams } from "@/types/ordemServico";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const useOrdemServico = () => {
  const [openChamados, setOpenChamados] = useState<any[]>([]);
  const [ordensServico, setOrdensServico] = useState<OrdemServico[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [currentOs, setCurrentOs] = useState<OrdemServico | null>(null);
  const [currentChamado, setCurrentChamado] = useState<any | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isOsModalOpen, setIsOsModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isOsDetailsModalOpen, setIsOsDetailsModalOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [isChamadoModalOpen, setIsChamadoModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentFilters, setCurrentFilters] = useState<OsFilterParams>({});
  const [activeTab, setActiveTab] = useState<string>("chamados");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [laborItems, setLaborItems] = useState<MaoDeObra[]>([]);
  const [movements, setMovements] = useState<Movimentacao[]>([]);
  const { toast } = useToast();
  
  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const user = await getCurrentUser();
        
        if (user) {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
          
          if (error) {
            console.error("Error loading user profile:", error);
            setCurrentUser(user);
          } else {
            setCurrentUser({
              ...user,
              ...profile
            });
          }
        }
      } catch (error) {
        console.error("Error loading current user:", error);
      }
    };
    
    loadCurrentUser();
  }, []);
  
  const loadOpenChamados = async (filters: OsFilterParams = {}) => {
    setIsLoading(true);
    setIsError(false);
    setErrorMessage("");
    
    try {
      console.log("Loading open chamados with filters:", filters);
      const data = await fetchOpenChamados(filters);
      console.log("Loaded open chamados:", data);
      setOpenChamados(data);
      setCurrentFilters(filters);
    } catch (error) {
      console.error("Error loading open chamados:", error);
      setIsError(true);
      setErrorMessage("Ocorreu um erro ao buscar os dados. Tente novamente.");
      
      toast({
        title: "Erro ao carregar chamados",
        description: "Ocorreu um erro ao buscar os dados. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const loadOrdensServico = async (filters: OsFilterParams = {}) => {
    setIsLoading(true);
    setIsError(false);
    setErrorMessage("");
    
    try {
      const data = await fetchOrdensServico(filters);
      setOrdensServico(data);
      setCurrentFilters(filters);
    } catch (error) {
      console.error("Error loading ordens de serviço:", error);
      setIsError(true);
      setErrorMessage("Ocorreu um erro ao buscar os dados. Tente novamente.");
      
      toast({
        title: "Erro ao carregar ordens de serviço",
        description: "Ocorreu um erro ao buscar os dados. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    if (activeTab === "chamados") {
      loadOpenChamados({});
    } else {
      loadOrdensServico({});
    }
  }, [activeTab]);
  
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setCurrentFilters({});
  };
  
  const handleOpenChamadoDetails = async (chamado: any) => {
    setIsLoading(true);
    try {
      const detailedChamado = await getChamadoById(chamado.id);
      setCurrentChamado(detailedChamado);
      setIsChamadoModalOpen(true);
    } catch (error) {
      console.error("Error fetching chamado details:", error);
      toast({
        title: "Erro ao buscar detalhes",
        description: "Não foi possível carregar os detalhes do chamado.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleOpenOsModal = async (os?: OrdemServico) => {
    console.log("🎯 DEBUG - handleOpenOsModal chamado com OS:", os);
    
    if (os) {
      console.log("📋 DEBUG - Abrindo modal para EDITAR OS:", os.numero_os);
      console.log("🔍 DEBUG - OS completa recebida:", JSON.stringify(os, null, 2));
      
      // CRITICAL: Set currentOs BEFORE everything else
      setCurrentOs(os);
      console.log("✅ DEBUG - currentOs definido ANTES de loadOsDetails:", os);
      
      await loadOsDetails(os.id);
      
      // Se a OS foi criada a partir de um chamado, buscar os dados do chamado original
      if (os.chamado_id) {
        try {
          const chamadoOriginal = await getChamadoById(os.chamado_id);
          setCurrentChamado(chamadoOriginal);
        } catch (error) {
          console.error("Error loading original chamado:", error);
          setCurrentChamado(null);
        }
      } else {
        setCurrentChamado(null);
      }
    } else {
      console.log("📋 DEBUG - Abrindo modal para NOVA OS");
      setCurrentOs(null);
      setCurrentChamado(null);
      setMaterials([]);
      setLaborItems([]);
      setMovements([]);
    }
    
    console.log("🎯 DEBUG - Estado final antes de abrir modal - currentOs:", !!os ? os.numero_os : null);
    setIsOsModalOpen(true);
  };
  
  const loadOsDetails = async (osId: string) => {
    setIsLoading(true);
    try {
      const [os, materials, labor, movements] = await Promise.all([
        getOrdemServicoById(osId),
        getMaterialsByOsId(osId),
        getMaoDeObraByOsId(osId),
        getMovimentacoesByOsId(osId)
      ]);
      
      setCurrentOs(os);
      setMaterials(materials);
      setLaborItems(labor);
      setMovements(movements);
    } catch (error) {
      console.error("Error loading OS details:", error);
      toast({
        title: "Erro ao carregar detalhes",
        description: "Não foi possível carregar os detalhes da ordem de serviço.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleOpenDetailsModal = async (osId: string) => {
    setIsLoading(true);
    try {
      await loadOsDetails(osId);
      setIsDetailsModalOpen(true);
    } catch (error) {
      console.error("Error fetching OS details:", error);
      toast({
        title: "Erro ao buscar detalhes",
        description: "Não foi possível carregar os detalhes da ordem de serviço.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenOsDetailsModal = async (os: OrdemServico) => {
    console.log('👁️ Abrindo modal de detalhes da OS:', os.id);
    setIsLoading(true);
    
    try {
      await loadOsDetails(os.id);
      setCurrentOs(os);
      setIsOsDetailsModalOpen(true);
    } catch (error) {
      console.error('❌ Erro ao carregar detalhes para visualização:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar detalhes da OS.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleConvertToOs = async (chamadoId: string, osData?: Partial<OrdemServico>) => {
    if (!currentUser) return;
    
    setIsLoading(true);
    try {
      console.log('🔄 Iniciando conversão de chamado para OS:', { chamadoId, userId: currentUser.id });
      
      const newOs = await convertChamadoToOs(chamadoId, currentUser.id, osData);
      console.log('✅ Chamado convertido para OS:', newOs);
      
      // Status já é atualizado no serviço convertChamadoToOs para 'Convertido para OS'
      
      toast({
        title: "Chamado convertido",
        description: `O chamado foi convertido para Ordem de Serviço com sucesso.`
      });
      
      // Atualizar ambas as abas
      await Promise.all([
        loadOpenChamados(currentFilters),
        loadOrdensServico(currentFilters)
      ]);
      
      console.log('📊 Ambas as abas atualizadas após conversão');
      
      // Mudar automaticamente para a aba "Ordens de Serviço"
      setActiveTab('ordens');
      
      setIsDetailsModalOpen(false);
    } catch (error) {
      console.error("❌ Erro na conversão de chamado para OS:", error);
      toast({
        title: "Erro na conversão",
        description: error instanceof Error ? error.message : "Erro ao converter chamado para OS",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleCreateOrUpdateOs = async (osData: Partial<OrdemServico>, motivo: string): Promise<OrdemServico | null> => {
    console.log('🎯🎯🎯 [HANDLE-CREATE-UPDATE-OS] Função foi chamada!');
    console.log('🎯 [HANDLE-CREATE-UPDATE-OS] osData recebido:', JSON.stringify(osData, null, 2));
    console.log('🎯 [HANDLE-CREATE-UPDATE-OS] motivo recebido:', motivo);
    console.log('🎯 [HANDLE-CREATE-UPDATE-OS] currentOs:', currentOs);
    console.log('🎯 [HANDLE-CREATE-UPDATE-OS] currentUser:', currentUser);
    
    // DEBUG: Mostrar toast com informações detalhadas
    toast({
      title: "🔍 DEBUG: Iniciando salvamento",
      description: `currentOs: ${currentOs?.id ? 'PRESENTE' : 'AUSENTE'} | numero_os: ${osData.numero_os || 'N/A'}`,
      variant: "default"
    });
    
    if (!currentUser) {
      console.error('❌ [HANDLE-CREATE-UPDATE-OS] ERRO: currentUser não definido!');
      toast({
        title: "Erro de autenticação",
        description: "Usuário não autenticado. Faça login novamente.",
        variant: "destructive"
      });
      return null;
    }
    
    setIsLoading(true);
    try {
      let result: OrdemServico;
      
      console.log('🎯 [HANDLE-CREATE-UPDATE-OS] ====== ANÁLISE DE ESTADO ======');
      console.log('🎯 [HANDLE-CREATE-UPDATE-OS] currentOs presente:', !!currentOs);
      console.log('🎯 [HANDLE-CREATE-UPDATE-OS] currentOs.id:', currentOs?.id);
      console.log('🎯 [HANDLE-CREATE-UPDATE-OS] currentOs.numero_os:', currentOs?.numero_os);
      console.log('🎯 [HANDLE-CREATE-UPDATE-OS] osData.numero_os:', osData.numero_os);
      
      // CORREÇÃO 1: Verificar por número de OS existente no banco (FALLBACK)
      let osExistente = null;
      const numeroOs = osData.numero_os || currentOs?.numero_os;
      
      if (numeroOs) {
        console.log('🔍 [HANDLE-CREATE-UPDATE-OS] Verificando OS existente por numero_os:', numeroOs);
        try {
          const { data: existingOs, error } = await supabase
            .from('bd_ordens_servico')
            .select('id, numero_os')
            .eq('numero_os', numeroOs)
            .single();
          
          if (!error && existingOs) {
            osExistente = existingOs;
            console.log('🎯 [HANDLE-CREATE-UPDATE-OS] OS encontrada no banco:', osExistente);
            
            // Se currentOs não estava definido, usar como fallback
            if (!currentOs) {
              console.log('🔄 [HANDLE-CREATE-UPDATE-OS] FALLBACK: Usando OS encontrada no banco como currentOs');
              const osCompleta = await getOrdemServicoById(existingOs.id);
              setCurrentOs(osCompleta);
            }
          }
        } catch (err) {
          console.log('🔍 [HANDLE-CREATE-UPDATE-OS] Nenhuma OS encontrada com esse número');
        }
      }
      
      // CORREÇÃO 2: Forçar update se currentOs.id existe OU se encontramos OS no banco
      const shouldUpdate = currentOs?.id || osExistente?.id;
      const targetOsId = currentOs?.id || osExistente?.id;
      
      console.log('🎯 [HANDLE-CREATE-UPDATE-OS] Decisão: shouldUpdate =', shouldUpdate);
      console.log('🎯 [HANDLE-CREATE-UPDATE-OS] targetOsId =', targetOsId);
      
      // DEBUG: Mostrar decisão via toast
      toast({
        title: `🎯 DEBUG: Decisão tomada`,
        description: `Ação: ${shouldUpdate ? 'UPDATE' : 'CREATE'} | ID: ${targetOsId || 'N/A'}`,
        variant: shouldUpdate ? "default" : "destructive"
      });
      
      if (shouldUpdate && targetOsId) {
        // SEMPRE atualizar quando há ID disponível
        console.log('🔄 [HANDLE-CREATE-UPDATE-OS] === EXECUTANDO UPDATE ===');
        console.log('🔄 [HANDLE-CREATE-UPDATE-OS] ID da OS:', targetOsId);
        
        try {
          result = await updateOrdemServico(
            targetOsId,
            osData,
            currentUser.id,
            motivo || 'Atualização via formulário'
          );
          console.log('✅ [HANDLE-CREATE-UPDATE-OS] OS atualizada:', result);
          
          // Recarregar detalhes da OS após salvamento
          console.log('🔄 [HANDLE-CREATE-UPDATE-OS] Recarregando detalhes da OS...');
          await loadOsDetails(targetOsId);
          
          // Atualizar currentOs com os dados atualizados
          setCurrentOs(result);
          
          // Success toast with status update info
          const statusMessage = osData.status ? ` | Status: ${osData.status}` : '';
          toast({
            title: "✅ OS atualizada com sucesso",
            description: `OS ${result.numero_os} foi salva${statusMessage}. Última atualização: ${new Date(result.updated_at || Date.now()).toLocaleString('pt-BR')}`
          });
        } catch (updateError) {
          console.error('❌ [HANDLE-CREATE-UPDATE-OS] Erro no updateOrdemServico:', updateError);
          toast({
            title: "❌ Erro ao atualizar OS",
            description: `Erro: ${updateError instanceof Error ? updateError.message : 'Erro desconhecido'}`,
            variant: "destructive"
          });
          throw updateError;
        }
      } else {
        // APENAS criar se não há ID disponível E não é formulário de edição
        console.log('🚫 [HANDLE-CREATE-UPDATE-OS] === BLOQUEIO DE CRIAÇÃO ===');
        console.log('🚫 [HANDLE-CREATE-UPDATE-OS] ESTE FORMULÁRIO NÃO DEVE CRIAR NOVAS OSs!');
        
        toast({
          title: "❌ Erro: Criação de OS bloqueada",
          description: "Este formulário é apenas para editar OSs existentes. Para criar nova OS, use a conversão de chamados.",
          variant: "destructive"
        });
        
        throw new Error('Formulário não autorizado para criar novas OSs. Use conversão de chamados.');
      }
      
      // Recarregar lista de OS
      await loadOrdensServico(currentFilters);
      
      return result;
      
    } catch (error) {
      console.error("❌❌❌ [HANDLE-CREATE-UPDATE-OS] Error completo:", error);
      
      // Exibir erro mais detalhado
      let errorMessage = "Ocorreu um erro inesperado.";
      if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      toast({
        title: currentOs ? "Erro ao atualizar OS" : "Erro ao criar OS",
        description: errorMessage,
        variant: "destructive"
      });
      
      return null;
    } finally {
      console.log('🏁 [HANDLE-CREATE-UPDATE-OS] Finalizando...');
      setIsLoading(false);
    }
  };

  // Manter função original para compatibilidade
  const handleUpdateOs = async (osData: Partial<OrdemServico>, motivo: string) => {
    return handleCreateOrUpdateOs(osData, motivo);
  };
  
  const handleSaveMaterial = async (material: Partial<Material>, osId?: string): Promise<Material | null> => {
    console.log('💾 [HANDLE_SAVE_MATERIAL] Iniciando salvamento:', material);
    console.log('💾 [HANDLE_SAVE_MATERIAL] osId explícito:', osId);
    console.log('💾 [HANDLE_SAVE_MATERIAL] CurrentOs:', currentOs);
    
    const finalOsId = osId ?? currentOs?.id;
    
    if (!finalOsId) {
      console.error('❌ [HANDLE_SAVE_MATERIAL] Nenhum osId disponível');
      toast({
        title: "Erro ao salvar material",
        description: "ID da ordem de serviço não encontrado. Salve a OS primeiro.",
        variant: "destructive"
      });
      return null;
    }
    
    setIsLoading(true);
    try {
      const materialWithOsId = {
        ...material,
        os_id: finalOsId
      };
      
      console.log('💾 [HANDLE_SAVE_MATERIAL] Salvando com os_id:', materialWithOsId);
      
      const savedMaterial = await saveMaterial(materialWithOsId);
      
      console.log('✅ [HANDLE_SAVE_MATERIAL] Material salvo:', savedMaterial);
      
      setMaterials(prev => {
        const index = prev.findIndex(m => m.id === savedMaterial.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = savedMaterial;
          return updated;
        }
        return [...prev, savedMaterial];
      });
      
      toast({
        title: "Material salvo",
        description: "Material adicionado/atualizado com sucesso."
      });
      
      return savedMaterial;
    } catch (error) {
      console.error("❌ [HANDLE_SAVE_MATERIAL] Erro ao salvar:", error);
      toast({
        title: "Erro ao salvar material",
        description: `Erro: ${error.message || 'Erro desconhecido'}`,
        variant: "destructive"
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDeleteMaterial = async (materialId: string) => {
    setIsLoading(true);
    try {
      await deleteMaterial(materialId);
      
      setMaterials(prev => prev.filter(m => m.id !== materialId));
      
      toast({
        title: "Material excluído",
        description: "Material excluído com sucesso."
      });
    } catch (error) {
      console.error("Error deleting material:", error);
      toast({
        title: "Erro ao excluir material",
        description: "Ocorreu um erro ao excluir o material. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSaveMaoDeObra = async (maoDeObra: Partial<MaoDeObra>, osId?: string): Promise<MaoDeObra | null> => {
    console.log('💼 [HANDLE_SAVE_MAO_DE_OBRA] Iniciando salvamento:', maoDeObra);
    console.log('💼 [HANDLE_SAVE_MAO_DE_OBRA] osId explícito:', osId);
    console.log('💼 [HANDLE_SAVE_MAO_DE_OBRA] CurrentOs:', currentOs);
    
    const finalOsId = osId ?? currentOs?.id;
    
    if (!finalOsId) {
      console.error('❌ [HANDLE_SAVE_MAO_DE_OBRA] Nenhum osId disponível');
      toast({
        title: "Erro ao salvar mão de obra",
        description: "ID da ordem de serviço não encontrado. Salve a OS primeiro.",
        variant: "destructive"
      });
      return null;
    }
    
    setIsLoading(true);
    try {
      const maoDeObraWithOsId = {
        ...maoDeObra,
        os_id: finalOsId
      };
      
      console.log('💼 [HANDLE_SAVE_MAO_DE_OBRA] Salvando com os_id:', maoDeObraWithOsId);
      
      const savedMaoDeObra = await saveMaoDeObra(maoDeObraWithOsId);
      
      console.log('✅ [HANDLE_SAVE_MAO_DE_OBRA] Mão de obra salva:', savedMaoDeObra);
      
      setLaborItems(prev => {
        const index = prev.findIndex(m => m.id === savedMaoDeObra.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = savedMaoDeObra;
          return updated;
        }
        return [...prev, savedMaoDeObra];
      });
      
      toast({
        title: "Mão de obra salva",
        description: "Mão de obra adicionada/atualizada com sucesso."
      });
      
      return savedMaoDeObra;
    } catch (error) {
      console.error("❌ [HANDLE_SAVE_MAO_DE_OBRA] Erro ao salvar:", error);
      toast({
        title: "Erro ao salvar mão de obra",
        description: `Erro: ${error.message || 'Erro desconhecido'}`,
        variant: "destructive"
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDeleteMaoDeObra = async (maoDeObraId: string) => {
    setIsLoading(true);
    try {
      await deleteMaoDeObra(maoDeObraId);
      
      setLaborItems(prev => prev.filter(m => m.id !== maoDeObraId));
      
      toast({
        title: "Mão de obra excluída",
        description: "Mão de obra excluída com sucesso."
      });
    } catch (error) {
      console.error("Error deleting labor:", error);
      toast({
        title: "Erro ao excluir mão de obra",
        description: "Ocorreu um erro ao excluir a mão de obra. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleFinishOs = async (osId: string) => {
    if (!currentUser) return;
    
    setIsLoading(true);
    try {
      await finishOrdemServico(osId, currentUser.id);
      
      toast({
        title: "OS encerrada",
        description: "A ordem de serviço foi encerrada com sucesso."
      });
      
      await loadOsDetails(osId);
      loadOrdensServico(currentFilters);
      
      setIsOsModalOpen(false);
    } catch (error) {
      console.error("Error finishing OS:", error);
      toast({
        title: "Erro ao encerrar OS",
        description: "Ocorreu um erro ao encerrar a ordem de serviço. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleGeneratePdf = async (osId: string) => {
    setIsLoading(true);
    try {
      await generateOsPdf(osId);
      
      toast({
        title: "PDF gerado",
        description: "O PDF da ordem de serviço foi gerado com sucesso."
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Erro ao gerar PDF",
        description: "Ocorreu um erro ao gerar o PDF. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleApplyChamadoFilters = (filters: OsFilterParams) => {
    loadOpenChamados(filters);
  };
  
  const handleApplyOsFilters = (filters: OsFilterParams) => {
    loadOrdensServico(filters);
  };
  
  const handleClearFilters = () => {
    if (activeTab === "chamados") {
      loadOpenChamados({});
    } else {
      loadOrdensServico({});
    }
  };
  
  const handleExportToExcel = async () => {
    setIsLoading(true);
    try {
      const blob = await exportOsToExcel(currentFilters);
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ordens-servico-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Exportação concluída",
        description: "Os dados foram exportados com sucesso."
      });
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      toast({
        title: "Erro na exportação",
        description: "Ocorreu um erro ao exportar os dados. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return {
    openChamados,
    ordensServico,
    isLoading,
    isError,
    errorMessage,
    currentUser,
    currentOs,
    currentChamado,
    materials,
    laborItems,
    movements,
    isOsModalOpen,
    setIsOsModalOpen,
    isDetailsModalOpen, 
    setIsDetailsModalOpen,
    isOsDetailsModalOpen,
    setIsOsDetailsModalOpen,
    isConvertModalOpen,
    setIsConvertModalOpen,
    isChamadoModalOpen,
    setIsChamadoModalOpen,
    isDeleteModalOpen,
    setIsDeleteModalOpen,
    activeTab,
    handleTabChange,
    handleOpenChamadoDetails,
    handleOpenOsModal,
    handleOpenDetailsModal,
    handleOpenOsDetailsModal,
    handleConvertToOs,
    handleCreateOrUpdateOs,
    handleUpdateOs,
    handleSaveMaterial,
    handleDeleteMaterial,
    handleSaveMaoDeObra,
    handleDeleteMaoDeObra,
    handleApplyChamadoFilters,
    handleApplyOsFilters,
    handleClearFilters,
    handleExportToExcel,
    handleFinishOs,
    handleGeneratePdf
  };
};
