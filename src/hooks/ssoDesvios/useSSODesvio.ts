import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ssoDesvioService, ssoDesvioFotoService, ssoDesvioStorageService } from '@/services/ssoDesvios';
import { SSODesvioFormData, SSODesvioFilters } from '@/types/ssoDesvios';
import { toast } from 'sonner';

export const useSSODesvio = (desvioId?: string, filters?: SSODesvioFilters) => {
  const queryClient = useQueryClient();
  const activeFilters = filters || {};

  // Query: Listar desvios
  const listQuery = useQuery({
    queryKey: ['sso-desvios', activeFilters],
    queryFn: () => ssoDesvioService.list(activeFilters),
    enabled: !desvioId
  });

  // Query: Buscar desvio por ID
  const detailQuery = useQuery({
    queryKey: ['sso-desvio', desvioId],
    queryFn: () => ssoDesvioService.getById(desvioId!),
    enabled: !!desvioId
  });

  // Mutation: Criar desvio
  const createMutation = useMutation({
    mutationFn: async (params: { 
      formData: SSODesvioFormData; 
      files?: File[];
      legendas?: Record<number, string>;
    }) => {
      const { formData, files, legendas } = params;
      
      // 1. Criar desvio
      const desvio = await ssoDesvioService.create(formData);
      
      // 2. Upload de fotos se houver
      if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const legenda = legendas?.[i];
          await ssoDesvioFotoService.uploadAndCreate(desvio.id, file, legenda);
        }
      }
      
      return desvio;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sso-desvios'] });
      toast.success('Registro de desvio criado com sucesso!');
      return data;
    },
    onError: (error: any) => {
      console.error('Erro ao criar registro de desvio:', error);
      toast.error(`Erro ao criar registro: ${error.message}`);
      throw error;
    }
  });

  // Mutation: Atualizar desvio
  const updateMutation = useMutation({
    mutationFn: async (params: {
      id: string;
      data: Partial<SSODesvioFormData>;
      newFiles?: File[];
      legendas?: Record<number, string>;
      deletedFotoIds?: string[];
    }) => {
      const { id, data, newFiles, legendas, deletedFotoIds } = params;
      
      // 1. Deletar fotos removidas
      if (deletedFotoIds && deletedFotoIds.length > 0) {
        for (const fotoId of deletedFotoIds) {
          await ssoDesvioFotoService.delete(fotoId);
        }
      }
      
      // 2. Upload novas fotos
      if (newFiles && newFiles.length > 0) {
        for (let i = 0; i < newFiles.length; i++) {
          const file = newFiles[i];
          const legenda = legendas?.[i];
          await ssoDesvioFotoService.uploadAndCreate(id, file, legenda);
        }
      }
      
      // 3. Atualizar dados do desvio
      return ssoDesvioService.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sso-desvios'] });
      queryClient.invalidateQueries({ queryKey: ['sso-desvio', desvioId] });
      toast.success('Registro de desvio atualizado com sucesso!');
    },
    onError: (error: any) => {
      toast.error(`Erro ao atualizar registro: ${error.message}`);
    }
  });

  // Mutation: Deletar desvio
  const deleteMutation = useMutation({
    mutationFn: (id: string) => ssoDesvioService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sso-desvios'] });
      toast.success('Registro de desvio excluído com sucesso!');
    },
    onError: (error: any) => {
      toast.error(`Erro ao excluir registro: ${error.message}`);
    }
  });

  return {
    // Queries
    desvios: listQuery.data || [],
    desvio: detailQuery.data,
    isLoading: listQuery.isLoading || detailQuery.isLoading,
    error: listQuery.error || detailQuery.error,
    
    // Mutations
    createDesvio: createMutation.mutateAsync,
    updateDesvio: updateMutation.mutateAsync,
    deleteDesvio: deleteMutation.mutateAsync,
    
    // Loading states
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending
  };
};
