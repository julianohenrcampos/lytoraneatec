import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ssoChecklistService } from '@/services/sso/ssoChecklistService';
import { ssoItemService } from '@/services/sso/ssoItemService';
import { ssoStorageService } from '@/services/sso/ssoStorageService';
import { SSOChecklistFormData, SSOChecklistFilters, SSOChecklistItem } from '@/types/sso';
import { toast } from 'sonner';

export const useSSOChecklist = (checklistId?: string, filters?: SSOChecklistFilters) => {
  const queryClient = useQueryClient();
  const activeFilters = filters || {};

  // Query: Listar checklists
  const listQuery = useQuery({
    queryKey: ['sso-checklists', activeFilters],
    queryFn: () => ssoChecklistService.list(activeFilters),
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
    mutationFn: async (params: { 
      formData: SSOChecklistFormData; 
      itens: SSOChecklistItem[];
      itemFiles: Record<string, File[]>;
    }) => {
      const { formData, itens, itemFiles } = params;
      
      // 1. Criar checklist
      const checklist = await ssoChecklistService.create(formData);
      
      // 2. Para cada item, criar no banco
      for (const item of itens) {
        // Criar item no banco
        const createdItem = await ssoItemService.create({
          checklist_id: checklist.id,
          item_modelo_id: item.item_modelo_id,
          avaliacao: item.avaliacao,
          evidencia: item.evidencia,
          ordem: item.ordem,
          tema: item.tema,
          descricao: item.descricao,
          fotos: []
        });
        
        // Se tem fotos para este item, fazer upload
        const files = itemFiles[item.id];
        if (files && files.length > 0) {
          // Upload das fotos
          const uploads = await ssoStorageService.uploadMultiple(
            checklist.id, 
            files
          );
          
          // Adicionar timestamp
          const fotosComTimestamp = uploads.map(upload => ({
            ...upload,
            created_at: new Date().toISOString()
          }));
          
          // Atualizar item com as fotos
          await ssoItemService.update(createdItem.id, { 
            fotos: fotosComTimestamp as any
          });
        }
      }
      
      return checklist;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sso-checklists'] });
      toast.success('Checklist criado com sucesso!');
      return data;
    },
    onError: (error: any) => {
      console.error('Erro ao criar checklist:', error);
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
