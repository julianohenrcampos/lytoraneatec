
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useUserDataAccess } from "@/hooks/useUserDataAccess";
import { 
  fetchSecureApontamentos, 
  fetchSecureEquipes,
  canCreateApontamentoForTeam 
} from "@/services/apontamentoEquipeSecureService";
import { 
  ApontamentoEquipe, 
  ApontamentoEquipeFilters, 
  ApontamentoEquipeFormValues 
} from "@/types/apontamentoEquipe";
import { 
  createApontamentoEquipe,
  updateApontamentoEquipe,
  deleteApontamentoEquipe
} from "@/services/apontamentoEquipeService";

export const useSecureApontamentoEquipe = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { allowedTeamIds, userRole, canAccessAllTeams, isLoading: accessLoading } = useUserDataAccess();
  
  // Form states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentApontamento, setCurrentApontamento] = useState<ApontamentoEquipe | null>(null);
  const [deletingApontamento, setDeletingApontamento] = useState<ApontamentoEquipe | null>(null);
  
  // Filter states
  const [filters, setFilters] = useState<ApontamentoEquipeFilters>({});

  // Queries with RLS filtering
  const {
    data: apontamentos = [],
    isLoading: isApontamentosLoading,
    refetch: refetchApontamentos
  } = useQuery({
    queryKey: ['secure-apontamentos', filters, allowedTeamIds],
    queryFn: () => fetchSecureApontamentos(filters),
    enabled: !accessLoading && allowedTeamIds.length > 0,
    staleTime: 30000
  });

  const {
    data: equipes = [],
    isLoading: isEquipesLoading
  } = useQuery({
    queryKey: ['secure-equipes', allowedTeamIds],
    queryFn: fetchSecureEquipes,
    enabled: !accessLoading,
    staleTime: 30000
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: ApontamentoEquipeFormValues) => {
      // Check permission before creating
      const canCreate = await canCreateApontamentoForTeam(data.equipe_id);
      if (!canCreate) {
        throw new Error("Você não tem permissão para criar apontamentos para esta equipe.");
      }
      return createApontamentoEquipe(data);
    },
    onSuccess: () => {
      toast({
        title: "Apontamento criado com sucesso",
        variant: "default",
      });
      setIsFormModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['secure-apontamentos'] });
    },
    onError: (error: any) => {
      console.error("Error creating apontamento:", error);
      toast({
        title: "Erro ao criar apontamento",
        description: error.message || "Houve um erro ao criar o apontamento.",
        variant: "destructive",
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data: ApontamentoEquipeFormValues) => {
      if (!currentApontamento) throw new Error("Nenhum apontamento selecionado");
      
      // Check permission before updating
      const canCreate = await canCreateApontamentoForTeam(data.equipe_id);
      if (!canCreate) {
        throw new Error("Você não tem permissão para editar apontamentos desta equipe.");
      }
      
      return updateApontamentoEquipe(
        currentApontamento.equipe_id,
        currentApontamento.data_registro,
        data
      );
    },
    onSuccess: () => {
      toast({
        title: "Apontamento atualizado com sucesso",
        variant: "default",
      });
      setIsFormModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['secure-apontamentos'] });
    },
    onError: (error: any) => {
      console.error("Error updating apontamento:", error);
      toast({
        title: "Erro ao atualizar apontamento",
        description: error.message || "Houve um erro ao atualizar o apontamento.",
        variant: "destructive",
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteApontamentoEquipe(id),
    onSuccess: () => {
      toast({
        title: "Apontamento excluído com sucesso",
        variant: "default",
      });
      setIsDeleteModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['secure-apontamentos'] });
    },
    onError: (error: any) => {
      console.error("Error deleting apontamento:", error);
      toast({
        title: "Erro ao excluir apontamento",
        description: error.message || "Houve um erro ao excluir o apontamento.",
        variant: "destructive",
      });
    }
  });

  // Helper functions
  const handleFilterChange = (name: keyof ApontamentoEquipeFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const resetFilters = () => {
    setFilters({});
  };

  const openFormModal = (apontamento?: ApontamentoEquipe) => {
    setCurrentApontamento(apontamento || null);
    setIsFormModalOpen(true);
  };

  const openDetailsModal = (apontamento: ApontamentoEquipe) => {
    setCurrentApontamento(apontamento);
    setIsDetailsModalOpen(true);
  };

  const confirmDelete = (apontamento: ApontamentoEquipe) => {
    setDeletingApontamento(apontamento);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = () => {
    if (deletingApontamento?.id) {
      deleteMutation.mutate(deletingApontamento.id);
    }
  };

  const handleExport = () => {
    toast({
      title: "Exportação iniciada",
      description: "O arquivo será baixado em breve.",
    });
  };

  // Process apontamentos for summary view
  const apontamentoSummaries = apontamentos.reduce((acc, apontamento) => {
    const key = `${apontamento.equipe_id}-${apontamento.data_registro}`;
    if (!acc[key]) {
      acc[key] = {
        ...apontamento,
        colaboradores: []
      };
    }
    return acc;
  }, {} as Record<string, any>);

  return {
    // Data
    apontamentos,
    apontamentoSummaries: Object.values(apontamentoSummaries),
    equipes,
    allowedTeamIds,
    userRole,
    canAccessAllTeams,
    
    // Loading states
    isLoading: isApontamentosLoading || isEquipesLoading || accessLoading,
    
    // Modal states
    isFormModalOpen,
    setIsFormModalOpen,
    isDetailsModalOpen,
    setIsDetailsModalOpen,
    isDeleteModalOpen,
    setIsDeleteModalOpen,
    currentApontamento,
    deletingApontamento,
    
    // Filters
    filters,
    handleFilterChange,
    resetFilters,
    
    // Actions
    openFormModal,
    openDetailsModal,
    confirmDelete,
    handleDelete,
    handleExport,
    refetchApontamentos,
    
    // Mutations
    createMutation,
    updateMutation,
    isDeleting: deleteMutation.isPending
  };
};
