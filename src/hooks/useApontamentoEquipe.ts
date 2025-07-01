import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useUserDataAccess } from "@/hooks/useUserDataAccess";
import { 
  fetchApontamentos,
  getApontamentoById,
  createApontamentoEquipe,
  updateApontamentoEquipe,
  deleteApontamentoEquipe,
  exportApontamentoAndAvaliacoes
} from "@/services/apontamentoEquipeService";
import { 
  ApontamentoEquipe, 
  ApontamentoEquipeFilters,
  ApontamentoEquipeFormValues
} from "@/types/apontamentoEquipe";
import { format } from "date-fns";

const normalizeDate = (date: Date | string): string => {
  if (typeof date === 'string') {
    if (date.includes('T')) {
      const dateObj = new Date(date);
      return format(dateObj, "yyyy-MM-dd");
    }
    return date; // Already in yyyy-MM-dd format
  }
  
  const normalizedDate = new Date(date);
  normalizedDate.setHours(12, 0, 0, 0);
  return format(normalizedDate, "yyyy-MM-dd");
};

export const useApontamentoEquipe = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Get user data access control
  const { allowedTeamIds, userRole, canAccessAllTeams, isLoading: accessLoading } = useUserDataAccess();
  
  const [filters, setFilters] = useState<ApontamentoEquipeFilters>({});
  const [currentApontamento, setCurrentApontamento] = useState<ApontamentoEquipe | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingApontamento, setDeletingApontamento] = useState<ApontamentoEquipe | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const { 
    data: apontamentos = [], 
    isLoading, 
    isError, 
    refetch 
  } = useQuery({
    queryKey: ['apontamentos', filters, allowedTeamIds],
    queryFn: () => fetchApontamentos(filters, allowedTeamIds),
    enabled: !accessLoading && allowedTeamIds.length >= 0, // Allow empty array (no access)
  });
  
  const groupedApontamentos = useMemo(() => {
    const groups: Record<string, ApontamentoEquipe[]> = {};
    
    apontamentos.forEach(apontamento => {
      const key = `${apontamento.equipe_id}-${apontamento.data_registro}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(apontamento);
    });
    
    return Object.values(groups);
  }, [apontamentos]);
  
  const apontamentoSummaries = useMemo(() => {
    return groupedApontamentos.map(group => {
      const first = group[0];
      const presencaPercentage = Math.round((group.filter(a => a.presente).length / group.length) * 100);
      
      return {
        equipe_id: first.equipe_id,
        equipe_nome: first.equipe?.nome_equipe || 'N/A',
        data_registro: first.data_registro,
        encarregado: first.equipe?.encarregado?.nome_completo || 'N/A',
        apontador: first.equipe?.apontador?.nome_completo || 'N/A',
        presenca_percentage: presencaPercentage,
        total_colaboradores: group.length,
        colaboradores: group
      };
    });
  }, [groupedApontamentos]);
  
  const createMutation = useMutation({
    mutationFn: (data: ApontamentoEquipeFormValues) => {
      console.log("🔄 Creating apontamento with normalized data:", data);
      let formattedData = { ...data };
      if (formattedData.data_registro) {
        if (typeof formattedData.data_registro === 'object') {
          formattedData.data_registro = normalizeDate(formattedData.data_registro as Date);
        } else if (typeof formattedData.data_registro === 'string') {
          formattedData.data_registro = normalizeDate(formattedData.data_registro);
        }
      }
      return createApontamentoEquipe(formattedData);
    },
    onSuccess: () => {
      console.log("✅ Apontamento created successfully");
      queryClient.invalidateQueries({ queryKey: ['apontamentos'] });
      toast({
        title: "Apontamento criado",
        description: "Apontamento de equipe criado com sucesso"
      });
      setIsFormModalOpen(false);
    },
    onError: (error: any) => {
      console.error("❌ Error creating apontamento:", error);
      
      let errorMessage = "Houve um erro ao criar o apontamento de equipe";
      
      if (error.message?.includes("violates row-level security")) {
        errorMessage = "Você não tem permissão para criar apontamentos para esta equipe.";
      } else if (error.message?.includes("permission")) {
        errorMessage = "Permissão negada para criar apontamentos.";
      } else if (error.message?.includes("unique")) {
        errorMessage = "Já existe um apontamento para esta equipe nesta data.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Erro ao criar apontamento",
        description: errorMessage,
        variant: "destructive"
      });
    }
  });
  
  const updateMutation = useMutation({
    mutationFn: (data: ApontamentoEquipeFormValues) => {
      console.log("🔄 Updating apontamento with normalized data:", data);
      let formattedData = { ...data };
      if (formattedData.data_registro) {
        if (typeof formattedData.data_registro === 'object') {
          formattedData.data_registro = normalizeDate(formattedData.data_registro as Date);
        } else if (typeof formattedData.data_registro === 'string') {
          formattedData.data_registro = normalizeDate(formattedData.data_registro);
        }
      }
      
      console.log(`Updating apontamento for team ${formattedData.equipe_id} on date ${formattedData.data_registro}`);
      
      return updateApontamentoEquipe(formattedData.equipe_id, formattedData.data_registro, formattedData);
    },
    onSuccess: () => {
      console.log("✅ Apontamento updated successfully");
      queryClient.invalidateQueries({ queryKey: ['apontamentos'] });
      toast({
        title: "Apontamento atualizado",
        description: "Apontamento de equipe atualizado com sucesso"
      });
      setIsFormModalOpen(false);
    },
    onError: (error: any) => {
      console.error("❌ Error updating apontamento:", error);
      
      let errorMessage = "Houve um erro ao atualizar o apontamento de equipe";
      
      if (error.message?.includes("violates row-level security")) {
        errorMessage = "Você não tem permissão para editar apontamentos desta equipe.";
      } else if (error.message?.includes("permission")) {
        errorMessage = "Permissão negada para editar apontamentos.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Erro ao atualizar apontamento",
        description: errorMessage,
        variant: "destructive"
      });
    }
  });
  
  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      console.log("🔄 Deleting apontamento:", id);
      return deleteApontamentoEquipe(id);
    },
    onSuccess: () => {
      console.log("✅ Apontamento deleted successfully");
      queryClient.invalidateQueries({ queryKey: ['apontamentos'] });
      toast({
        title: "Apontamento excluído",
        description: "Apontamento de equipe excluído com sucesso"
      });
      setIsDeleteModalOpen(false);
      setDeletingApontamento(null);
      setIsDeleting(false);
    },
    onError: (error: any) => {
      console.error("❌ Error deleting apontamento:", error);
      
      let errorMessage = "Houve um erro ao excluir o apontamento de equipe";
      
      if (error.message?.includes("violates row-level security")) {
        errorMessage = "Você não tem permissão para excluir este apontamento.";
      } else if (error.message?.includes("permission")) {
        errorMessage = "Permissão negada para excluir apontamentos.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Erro ao excluir apontamento",
        description: errorMessage,
        variant: "destructive"
      });
      setIsDeleting(false);
    }
  });
  
  const handleFilterChange = useCallback((filterName: keyof ApontamentoEquipeFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
  }, [setFilters]);
  
  const resetFilters = useCallback(() => {
    setFilters({});
  }, [setFilters]);
  
  const openFormModal = useCallback((apontamento?: ApontamentoEquipe) => {
    if (apontamento) {
      const currentApontamento = { ...apontamento };
      if (typeof currentApontamento.data_registro === 'string') {
        const [year, month, day] = currentApontamento.data_registro.split('-').map(Number);
        currentApontamento.data_registro = new Date(year, month - 1, day, 12, 0, 0) as any;
      }
      setCurrentApontamento(currentApontamento);
    } else {
      setCurrentApontamento(null);
    }
    setIsFormModalOpen(true);
  }, []);
  
  const openDetailsModal = useCallback((apontamento: ApontamentoEquipe) => {
    setCurrentApontamento(apontamento);
    setIsDetailsModalOpen(true);
  }, [setCurrentApontamento, setIsDetailsModalOpen]);
  
  const confirmDelete = useCallback((apontamento: ApontamentoEquipe) => {
    setDeletingApontamento(apontamento);
    setIsDeleteModalOpen(true);
  }, [setDeletingApontamento, setIsDeleteModalOpen]);
  
  const handleDelete = useCallback(async () => {
    if (!deletingApontamento) return;
    
    setIsDeleting(true);
    await deleteMutation.mutateAsync(deletingApontamento.id);
  }, [deletingApontamento, deleteMutation]);
  
  const handleExport = useCallback(() => {
    try {
      exportApontamentoAndAvaliacoes(filters);
      toast({
        title: "Exportação concluída",
        description: "Apontamentos e avaliações exportados com sucesso",
      });
    } catch (error) {
      console.error("Error exporting data:", error);
      toast({
        title: "Erro na exportação",
        description: "Ocorreu um erro ao exportar os dados",
        variant: "destructive",
      });
    }
  }, [filters, toast]);
  
  return {
    filters,
    currentApontamento,
    isFormModalOpen,
    isDetailsModalOpen,
    isDeleteModalOpen,
    deletingApontamento,
    isDeleting,
    
    apontamentos,
    apontamentoSummaries,
    isLoading: isLoading || accessLoading,
    isError,
    
    // Access control data
    allowedTeamIds,
    userRole,
    canAccessAllTeams,
    
    setFilters,
    setIsFormModalOpen,
    setIsDetailsModalOpen,
    setIsDeleteModalOpen,
    
    handleFilterChange,
    resetFilters,
    openFormModal,
    openDetailsModal,
    confirmDelete,
    handleDelete,
    handleExport,
    refetch,
    createMutation,
    updateMutation
  };
};
