import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ssoChecklistService } from '@/services/sso/ssoChecklistService';
import { ssoItemService } from '@/services/sso/ssoItemService';
import { SSOChecklistFormData, SSOChecklistFilters } from '@/types/sso';
import { toast } from 'sonner';

export const useSSOChecklist = (checklistId?: string, initialFilters?: SSOChecklistFilters) => {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<SSOChecklistFilters>(initialFilters || {});

  // Query: Listar checklists
  const listQuery = useQuery({
    queryKey: ['sso-checklists', filters],
    queryFn: () => ssoChecklistService.list(filters),
    enabled: !checklistId
  });

  // Query: Buscar checklist por ID
  const detailQuery = useQuery({
    queryKey: ['sso-checklist', checklistId],
    queryFn: () => ssoChecklistService.getById(checklistId!),
    enabled: !!checklistId
  });

  // Mutation: Criar checklist
  const createMutation = useMutation({
    mutationFn: async (formData: SSOChecklistFormData) => {
      // 1. Criar checklist
      const checklist = await ssoChecklistService.create(formData);
      
      // 2. Buscar itens modelo
      const itensModelo = await ssoItemService.getModelo();
      
      // 3. Criar 36 itens vinculados ao checklist
      await ssoItemService.createBatch(checklist.id, itensModelo);
      
      return checklist;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sso-checklists'] });
      toast.success('Checklist criado com sucesso!');
      return data;
    },
    onError: (error: any) => {
      toast.error(`Erro ao criar checklist: ${error.message}`);
      throw error;
    }
  });

  // Mutation: Atualizar checklist
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SSOChecklistFormData> }) =>
      ssoChecklistService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sso-checklists'] });
      queryClient.invalidateQueries({ queryKey: ['sso-checklist', checklistId] });
      toast.success('Checklist atualizado com sucesso!');
    },
    onError: (error: any) => {
      toast.error(`Erro ao atualizar checklist: ${error.message}`);
    }
  });

  // Mutation: Deletar checklist
  const deleteMutation = useMutation({
    mutationFn: (id: string) => ssoChecklistService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sso-checklists'] });
      toast.success('Checklist excluído com sucesso!');
    },
    onError: (error: any) => {
      toast.error(`Erro ao excluir checklist: ${error.message}`);
    }
  });

  return {
    // Queries
    checklists: listQuery.data || [],
    checklist: detailQuery.data,
    isLoading: listQuery.isLoading || detailQuery.isLoading,
    error: listQuery.error || detailQuery.error,
    
    // Filters
    filters,
    setFilters,
    
    // Mutations
    createChecklist: createMutation.mutateAsync,
    updateChecklist: updateMutation.mutateAsync,
    deleteChecklist: deleteMutation.mutateAsync,
    
    // Loading states
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending
  };
};
