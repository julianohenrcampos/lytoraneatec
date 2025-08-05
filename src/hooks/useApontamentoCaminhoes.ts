
import { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { useUserDataAccess } from './useUserDataAccess';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { 
  ApontamentoCaminhao, 
  ApontamentoInspecao, 
  ApontamentoFilterParams,
  fetchApontamentos,
  fetchApontamentoById,
  createApontamento,
  updateApontamento,
  deleteApontamento,
  getUltimoHorimetro,
  uploadFotoAvaria,
  fetchFuncionariosOperacionais
} from '@/services/apontamentoCaminhoesService';
import { getCurrentUser } from '@/lib/auth';
import { fetchCaminhoes, Caminhao } from '@/services/caminhoesService';
import { formatBrazilianDateForDisplay } from '@/utils/timezoneUtils';

interface VeiculoDropdownItem {
  id: string;
  label: string;
  situacao?: string;
}

export const useApontamentoCaminhoes = () => {
  const { toast } = useToast();
  const { canAccessAllData, onlyOwnRecords, userId } = useUserDataAccess();
  const [apontamentos, setApontamentos] = useState<ApontamentoCaminhao[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [veiculosDropdown, setVeiculosDropdown] = useState<VeiculoDropdownItem[]>([]);
  const [operadoresDropdown, setOperadoresDropdown] = useState<Array<{id: string, label: string}>>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [apontamentoToDelete, setApontamentoToDelete] = useState<string | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [currentApontamento, setCurrentApontamento] = useState<{
    apontamento: ApontamentoCaminhao | null;
    inspecao: ApontamentoInspecao | null;
  }>({ apontamento: null, inspecao: null });
  const [filters, setFilters] = useState<ApontamentoFilterParams>({});
  const [isFilterApplied, setIsFilterApplied] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load data on first mount
  useEffect(() => {
    if (!isInitialized) {
      setIsInitialized(true);
      loadApontamentos();
      loadVeiculos();
      loadOperadores();
      loadCurrentUser();
    }
  }, [isInitialized]);

  // Reload data when filters change
  useEffect(() => {
    loadApontamentos();
  }, [filters]);

  const loadApontamentos = async () => {
    setIsLoading(true);
    try {
      console.log("Fetching apontamentos with filters:", filters);
      let data = await fetchApontamentos(filters);
      
      // Aplicar filtro adicional no frontend para usuários que só podem ver próprios registros
      if (onlyOwnRecords && userId) {
        console.log("Aplicando filtro para usuário - somente registros próprios");
        data = data.filter(apontamento => apontamento.created_by === userId);
      }
      
      console.log("Fetched apontamentos data:", data);
      setApontamentos(data);
    } catch (error) {
      console.error("Error loading apontamentos:", error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar os apontamentos.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadVeiculos = async () => {
    try {
      const data = await fetchCaminhoes();
      const veiculosFormatados = data.map(veiculo => ({
        id: veiculo.id,
        label: `${veiculo.frota || ''}${veiculo.numero_frota || ''} - ${veiculo.placa || ''} ${veiculo.modelo ? `(${veiculo.modelo})` : ''}`.trim(),
        situacao: veiculo.situacao || "Operando"
      }));
      setVeiculosDropdown(veiculosFormatados);
    } catch (error) {
      console.error("Erro ao carregar veículos:", error);
      toast({
        title: "Erro ao carregar veículos",
        description: "Não foi possível carregar a lista de veículos.",
        variant: "destructive",
      });
    }
  };

  const loadOperadores = async () => {
    try {
      console.log("🔍 Carregando operadores...");
      const operadores = await fetchFuncionariosOperacionais();
      console.log("✅ Operadores carregados:", operadores);
      setOperadoresDropdown(operadores);
    } catch (error) {
      console.error("❌ Erro ao carregar operadores:", error);
      toast({
        title: "Erro ao carregar operadores",
        description: "Não foi possível carregar a lista de operadores.",
        variant: "destructive",
      });
    }
  };

  const loadCurrentUser = async () => {
    try {
      const user = await getCurrentUser();
      console.log("Current user loaded:", user);
      setCurrentUser(user);
    } catch (error) {
      console.error("Erro ao carregar usuário:", error);
    }
  };

  const handleOpenDeleteModal = (id: string) => {
    setApontamentoToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const handleOpenFormModal = (id?: string) => {
    if (id) {
      loadApontamentoById(id);
    } else {
      setCurrentApontamento({ apontamento: null, inspecao: null });
    }
    setIsFormModalOpen(true);
  };

  const handleOpenDetailsModal = (id: string) => {
    loadApontamentoById(id);
    setIsDetailsModalOpen(true);
  };

  const loadApontamentoById = async (id: string) => {
    setIsLoading(true);
    try {
      const data = await fetchApontamentoById(id);
      setCurrentApontamento(data);
    } catch (error) {
      toast({
        title: "Erro ao carregar detalhes",
        description: "Não foi possível carregar os detalhes do apontamento.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!apontamentoToDelete) return;
    
    setIsLoading(true);
    try {
      await deleteApontamento(apontamentoToDelete);
      setApontamentos(prev => prev.filter(item => item.id !== apontamentoToDelete));
      toast({
        title: "Apontamento excluído",
        description: "O apontamento foi excluído com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir o apontamento.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setIsDeleteModalOpen(false);
      setApontamentoToDelete(null);
    }
  };

  const handleCreateOrUpdate = async (
    formData: {
      apontamento: Omit<ApontamentoCaminhao, 'id'> | Partial<ApontamentoCaminhao>,
      inspecao?: Omit<ApontamentoInspecao, 'id' | 'apontamento_caminhao_equipamento_id'> | Partial<ApontamentoInspecao>
    }
  ) => {
    console.log("Saving form data:", formData);
    setIsLoading(true);
    try {
      if (currentApontamento.apontamento?.id) {
        console.log("Updating apontamento with ID:", currentApontamento.apontamento.id);
        
        // Incluir todos os campos editáveis na atualização
        const updateData = {
          horimetro_final: formData.apontamento.horimetro_final,
          hora_final: formData.apontamento.hora_final,
          abastecimento: formData.apontamento.abastecimento,
          situacao: formData.apontamento.situacao,
          centro_custo_id: formData.apontamento.centro_custo_id,
          caminhao_equipamento_id: formData.apontamento.caminhao_equipamento_id
        };
        
        await updateApontamento(
          currentApontamento.apontamento.id,
          updateData,
          formData.inspecao
        );
        
        toast({
          title: "Apontamento atualizado",
          description: "O apontamento foi atualizado com sucesso.",
        });
      } else {
        if (!currentUser) {
          throw new Error("Usuário não está autenticado. Por favor, faça login novamente.");
        }
        
        try {
          const apontamentoData = {
            ...formData.apontamento,
            operador_id: currentUser.id
          };
          
          const newId = await createApontamento(
            apontamentoData as Omit<ApontamentoCaminhao, 'id'>,
            formData.inspecao as Omit<ApontamentoInspecao, 'id' | 'apontamento_caminhao_equipamento_id'>,
            currentUser?.email
          );
          
          console.log("Created with ID:", newId);
          toast({
            title: "Apontamento criado",
            description: "O apontamento foi criado com sucesso.",
          });
        } catch (error) {
          if (error instanceof Error) {
            // Handle funcionário creation error with specific message
            if (error.message.includes('funcionário')) {
              toast({
                title: "Erro ao salvar",
                description: error.message,
                variant: "destructive",
              });
              
              // Don't close the modal for this specific error so user can try again
              setIsLoading(false);
              return;
            } else {
              toast({
                title: "Erro ao salvar",
                description: error.message,
                variant: "destructive",
              });
              setIsFormModalOpen(false);
              return;
            }
          } else {
            throw error;
          }
        }
      }
      await loadApontamentos();
      setIsFormModalOpen(false);
    } catch (error) {
      console.error("Erro ao salvar apontamento:", error);
      
      let errorMessage = "Não foi possível salvar o apontamento.";
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Erro ao salvar",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetUltimoHorimetro = async (caminhaoId: string): Promise<number | null> => {
    try {
      console.log(`🚀 Hook - Iniciando busca do último horímetro para: ${caminhaoId}`);
      
      if (!caminhaoId) {
        console.log('⚠️ Hook - ID do caminhão não fornecido');
        return null;
      }

      const ultimoHorimetro = await getUltimoHorimetro(caminhaoId);
      
      if (ultimoHorimetro !== null) {
        console.log(`✅ Hook - Último horímetro encontrado: ${ultimoHorimetro}`);
        toast({
          title: "Horímetro carregado",
          description: `Último horímetro: ${ultimoHorimetro}`,
        });
      } else {
        console.log('ℹ️ Hook - Nenhum horímetro anterior encontrado');
        toast({
          title: "Sem histórico",
          description: "Nenhum apontamento anterior encontrado para este veículo. Informe o valor manualmente.",
        });
      }
      
      return ultimoHorimetro;
    } catch (error) {
      console.error('❌ Hook - Erro ao buscar último horímetro:', error);
      toast({
        title: "Erro ao buscar horímetro",
        description: "Não foi possível buscar o último horímetro registrado. Você pode informar o valor manualmente.",
        variant: "destructive",
      });
      return null;
    }
  };

  const handleUploadFoto = async (file: File): Promise<string> => {
    try {
      return await uploadFotoAvaria(file);
    } catch (error) {
      toast({
        title: "Erro ao fazer upload",
        description: "Não foi possível enviar a imagem.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleApplyFilters = (newFilters: ApontamentoFilterParams) => {
    console.log("Applying filters:", newFilters);
    const processedFilters: ApontamentoFilterParams = {};
    
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value && value !== "_all") {
        processedFilters[key as keyof ApontamentoFilterParams] = value;
      }
    });
    
    setFilters(processedFilters);
    setIsFilterApplied(true);
  };

  const handleClearFilters = () => {
    console.log("Clearing filters");
    setFilters({});
    setIsFilterApplied(false);
    loadApontamentos();
  };

  const handleExportToExcel = () => {
    try {
      const dataForExport = apontamentos.map(item => ({
        'Data': item.data ? formatBrazilianDateForDisplay(item.data) : '',
        'Caminhão/Equipamento': item.veiculo_identificacao || '',
        'Operador': item.nome_operador || '',
        'Centro de Custo': item.nome_centro_custo || '',
        'Horímetro Inicial': item.horimetro_inicial || '',
        'Horímetro Final': item.horimetro_final || '',
        'Abastecimento (L)': item.abastecimento || '',
        'Hora Inicial': item.hora_inicial || '',
        'Hora Final': item.hora_final || '',
      }));

      const ws = XLSX.utils.json_to_sheet(dataForExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Apontamentos');

      const now = new Date();
      const fileName = `apontamentos_${format(now, 'dd-MM-yyyy')}.xlsx`;

      XLSX.writeFile(wb, fileName);

      toast({
        title: "Exportação concluída",
        description: "Os dados foram exportados com sucesso.",
      });
    } catch (error) {
      console.error('Erro ao exportar para Excel:', error);
      toast({
        title: "Erro na exportação",
        description: "Não foi possível exportar os dados.",
        variant: "destructive",
      });
    }
  };

  return {
    apontamentos,
    isLoading,
    veiculosDropdown,
    operadoresDropdown,
    currentUser,
    isDeleteModalOpen,
    setIsDeleteModalOpen,
    apontamentoToDelete,
    isFormModalOpen,
    setIsFormModalOpen,
    isDetailsModalOpen,
    setIsDetailsModalOpen,
    currentApontamento,
    filters,
    isFilterApplied,
    handleOpenDeleteModal,
    handleOpenFormModal,
    handleOpenDetailsModal,
    handleDelete,
    handleCreateOrUpdate,
    handleGetUltimoHorimetro,
    handleUploadFoto,
    handleApplyFilters,
    handleClearFilters,
    handleExportToExcel,
  };
};
