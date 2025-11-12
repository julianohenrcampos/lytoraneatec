import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ssoItemService } from '@/services/sso/ssoItemService';
import { ssoStorageService } from '@/services/sso/ssoStorageService';
import { AvaliacaoTipo, SSOFoto } from '@/types/sso';
import { toast } from 'sonner';

export const useSSOChecklistItem = (checklistId: string) => {
  const queryClient = useQueryClient();

  // Mutation: Atualizar avaliação do item
  const updateAvaliacaoMutation = useMutation({
    mutationFn: ({ itemId, avaliacao }: { itemId: string; avaliacao: AvaliacaoTipo }) =>
      ssoItemService.update(itemId, { avaliacao }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sso-checklist', checklistId] });
    },
    onError: (error: any) => {
      toast.error(`Erro ao atualizar avaliação: ${error.message}`);
    }
  });

  // Mutation: Atualizar evidência
  const updateEvidenciaMutation = useMutation({
    mutationFn: ({ itemId, evidencia }: { itemId: string; evidencia: string }) =>
      ssoItemService.update(itemId, { evidencia }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sso-checklist', checklistId] });
    },
    onError: (error: any) => {
      toast.error(`Erro ao salvar evidência: ${error.message}`);
    }
  });

  // Mutation: Upload de fotos
  const uploadFotosMutation = useMutation({
    mutationFn: async ({ itemId, files, currentFotos }: {
      itemId: string;
      files: File[];
      currentFotos: SSOFoto[];
    }) => {
      // Upload das novas fotos
      const uploads = await ssoStorageService.uploadMultiple(checklistId, files);
      
      // Adicionar timestamp
      const newFotos = uploads.map(upload => ({
        ...upload,
        created_at: new Date().toISOString()
      }));
      
      // Combinar com fotos existentes
      const updatedFotos = [...currentFotos, ...newFotos];
      
      // Atualizar item com novo array de fotos
      return ssoItemService.update(itemId, { fotos: updatedFotos as any });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sso-checklist', checklistId] });
      toast.success('Fotos enviadas com sucesso!');
    },
    onError: (error: any) => {
      toast.error(`Erro ao enviar fotos: ${error.message}`);
    }
  });

  // Mutation: Remover foto
  const removeFotoMutation = useMutation({
    mutationFn: async ({ itemId, fotoPath, currentFotos }: {
      itemId: string;
      fotoPath: string;
      currentFotos: SSOFoto[];
    }) => {
      // Deletar do storage
      await ssoStorageService.deleteFoto(fotoPath);
      
      // Remover do array de fotos
      const updatedFotos = currentFotos.filter(f => f.path !== fotoPath);
      
      // Atualizar item
      return ssoItemService.update(itemId, { fotos: updatedFotos as any });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sso-checklist', checklistId] });
      toast.success('Foto removida!');
    },
    onError: (error: any) => {
      toast.error(`Erro ao remover foto: ${error.message}`);
    }
  });

  return {
    updateAvaliacao: updateAvaliacaoMutation.mutateAsync,
    updateEvidencia: updateEvidenciaMutation.mutateAsync,
    uploadFotos: uploadFotosMutation.mutateAsync,
    removeFoto: removeFotoMutation.mutateAsync,
    
    isUpdatingAvaliacao: updateAvaliacaoMutation.isPending,
    isUpdatingEvidencia: updateEvidenciaMutation.isPending,
    isUploadingFotos: uploadFotosMutation.isPending,
    isRemovingFoto: removeFotoMutation.isPending
  };
};
