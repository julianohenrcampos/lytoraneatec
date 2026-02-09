import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { verAgirService, verAgirStorageService } from '@/services/ssoVerAgir';
import { VerAgirFormData, VerAgirFilters, VerAgirStatus } from '@/types/ssoVerAgir';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useVerAgir = (registroId?: string, filters?: VerAgirFilters) => {
  const queryClient = useQueryClient();
  const activeFilters = filters || {};

  // Query: Listar registros
  const listQuery = useQuery({
    queryKey: ['sso-ver-agir', activeFilters],
    queryFn: () => verAgirService.list(activeFilters),
    enabled: !registroId
  });

  // Query: Buscar registro por ID
  const detailQuery = useQuery({
    queryKey: ['sso-ver-agir-detail', registroId],
    queryFn: () => verAgirService.getById(registroId!),
    enabled: !!registroId
  });

  // Query: Listar centros de custo para o dropdown de Obra
  const centrosCustoQuery = useQuery({
    queryKey: ['centros-custo-ver-agir'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bd_centros_custo')
        .select('id, codigo_centro_custo, nome_centro_custo')
        .eq('situacao', 'Ativo')
        .order('nome_centro_custo');
      if (error) throw error;
      return data || [];
    }
  });

  // Mutation: Criar registro
  const createMutation = useMutation({
    mutationFn: async (params: { 
      formData: VerAgirFormData; 
      fotoAntes?: File;
      fotoDepois?: File;
    }) => {
      const { formData, fotoAntes, fotoDepois } = params;
      
      // 1. Criar registro
      const registro = await verAgirService.create(formData);
      
      // 2. Upload de fotos se houver
      if (fotoAntes) {
        const path = await verAgirStorageService.uploadFotoAntes(registro.id, fotoAntes);
        await verAgirService.updateFotoUrl(registro.id, 'foto_antes_url', path);
      }
      
      if (fotoDepois) {
        const path = await verAgirStorageService.uploadFotoDepois(registro.id, fotoDepois);
        await verAgirService.updateFotoUrl(registro.id, 'foto_depois_url', path);
      }
      
      return registro;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sso-ver-agir'] });
      toast.success('Registro criado com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Erro ao criar registro:', error);
      toast.error(`Erro ao criar registro: ${error.message}`);
    }
  });

  // Mutation: Atualizar registro
  const updateMutation = useMutation({
    mutationFn: async (params: {
      id: string;
      data: Partial<VerAgirFormData>;
      fotoAntes?: File;
      fotoDepois?: File;
      removerFotoAntes?: boolean;
      removerFotoDepois?: boolean;
    }) => {
      const { id, data, fotoAntes, fotoDepois, removerFotoAntes, removerFotoDepois } = params;
      
      // 1. Atualizar dados do registro
      await verAgirService.update(id, data);
      
      // 2. Gerenciar fotos
      if (removerFotoAntes) {
        const registro = await verAgirService.getById(id);
        if (registro?.foto_antes_url) {
          await verAgirStorageService.removeFoto(registro.foto_antes_url);
          await verAgirService.updateFotoUrl(id, 'foto_antes_url', null);
        }
      } else if (fotoAntes) {
        const path = await verAgirStorageService.uploadFotoAntes(id, fotoAntes);
        await verAgirService.updateFotoUrl(id, 'foto_antes_url', path);
      }
      
      if (removerFotoDepois) {
        const registro = await verAgirService.getById(id);
        if (registro?.foto_depois_url) {
          await verAgirStorageService.removeFoto(registro.foto_depois_url);
          await verAgirService.updateFotoUrl(id, 'foto_depois_url', null);
        }
      } else if (fotoDepois) {
        const path = await verAgirStorageService.uploadFotoDepois(id, fotoDepois);
        await verAgirService.updateFotoUrl(id, 'foto_depois_url', path);
      }
      
      return verAgirService.getById(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sso-ver-agir'] });
      queryClient.invalidateQueries({ queryKey: ['sso-ver-agir-detail', registroId] });
      toast.success('Registro atualizado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar registro: ${error.message}`);
    }
  });

  // Mutation: Deletar registro
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Primeiro remover fotos do storage
      const registro = await verAgirService.getById(id);
      if (registro?.foto_antes_url) {
        await verAgirStorageService.removeFoto(registro.foto_antes_url);
      }
      if (registro?.foto_depois_url) {
        await verAgirStorageService.removeFoto(registro.foto_depois_url);
      }
      
      return verAgirService.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sso-ver-agir'] });
      toast.success('Registro excluído com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir registro: ${error.message}`);
    }
  });

  // Mutation: Alterar status
  const setStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: VerAgirStatus }) => 
      verAgirService.setStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sso-ver-agir'] });
      queryClient.invalidateQueries({ queryKey: ['sso-ver-agir-detail', registroId] });
      toast.success('Status atualizado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar status: ${error.message}`);
    }
  });

  return {
    // Queries
    registros: listQuery.data || [],
    registro: detailQuery.data,
    isLoading: listQuery.isLoading || detailQuery.isLoading,
    error: listQuery.error || detailQuery.error,
    
    // Centro de custo
    centrosCusto: centrosCustoQuery.data || [],
    isLoadingCentrosCusto: centrosCustoQuery.isLoading,
    
    // Mutations
    createRegistro: createMutation.mutateAsync,
    updateRegistro: updateMutation.mutateAsync,
    deleteRegistro: deleteMutation.mutateAsync,
    setStatus: setStatusMutation.mutateAsync,
    
    // Loading states
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isChangingStatus: setStatusMutation.isPending,
    
    // Utils
    getSignedUrl: verAgirStorageService.getSignedUrl
  };
};
