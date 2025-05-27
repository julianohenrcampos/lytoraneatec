
import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
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
    queryKey: ['apontamentos', filters],
    queryFn: () => fetchApontamentos(filters),
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
      let formattedData = { ...data };
      if (formattedData.data_registro) {
        // Fixed the instanceof check by checking type instead
        if (typeof formattedData.data_registro === 'object') {
          formattedData.data_registro = normalizeDate(formattedData.data_registro as Date);
        } else if (typeof formattedData.data_registro === 'string') {
          formattedData.data_registro = normalizeDate(formattedData.data_registro);
        }
      }
      return createApontamentoEquipe(formattedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apontamentos'] });
      toast({
        title: "Apontamento criado",
        description: "Apontamento de equipe criado com sucesso"
      });
      setIsFormModalOpen(false);
    },
    onError: (error) => {
      console.error("Error creating apontamento:", error);
      toast({
        title: "Erro ao criar apontamento",
        description: "Houve um erro ao criar o apontamento de equipe",
        variant: "destructive"
      });
    }
  });
  
  const updateMutation = useMutation({
    mutationFn: (data: ApontamentoEquipeFormValues) => {
      let formattedData = { ...data };
      if (formattedData.data_registro) {
        // Fixed the instanceof check by checking type instead
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
      queryClient.invalidateQueries({ queryKey: ['apontamentos'] });
      toast({
        title: "Apontamento atualizado",
        description: "Apontamento de equipe atualizado com sucesso"
      });
      setIsFormModalOpen(false);
    },
    onError: (error) => {
      console.error("Error updating apontamento:", error);
      toast({
        title: "Erro ao atualizar apontamento",
        description: "Houve um erro ao atualizar o apontamento de equipe",
        variant: "destructive"
      });
    }
  });
  
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteApontamentoEquipe(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apontamentos'] });
      toast({
        title: "Apontamento excluído",
        description: "Apontamento de equipe excluído com sucesso"
      });
      setIsDeleteModalOpen(false);
      setDeletingApontamento(null);
      setIsDeleting(false);
    },
    onError: (error) => {
      console.error("Error deleting apontamento:", error);
      toast({
        title: "Erro ao excluir apontamento",
        description: "Houve um erro ao excluir o apontamento de equipe",
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
        // Fixed Type error by assigning a Date object
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
      // Use the updated export function that includes both apontamentos and avaliações
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
    isLoading,
    isError,
    
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
