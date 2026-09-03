import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ssoChecklistService } from '@/services/sso/ssoChecklistService';
import { ssoItemService } from '@/services/sso/ssoItemService';
import { ssoStorageService } from '@/services/sso/ssoStorageService';
import {
  comRetryDeRede,
  isChaveDuplicada,
  isErroDeRede,
  MENSAGEM_SEM_CONEXAO
} from '@/services/sso/ssoNetwork';
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

      // UUIDs gerados no cliente tornam as duas gravações idempotentes:
      // se a resposta se perder mas o INSERT tiver chegado ao banco, o
      // reenvio volta com 23505 e é tratado como sucesso, sem duplicar.
      const novoChecklistId = crypto.randomUUID();
      const idPorItem = new Map(itens.map(item => [item.id, crypto.randomUUID()]));

      // 1. Cabeçalho do checklist
      const checklist = await comRetryDeRede(async () => {
        try {
          return await ssoChecklistService.create(formData, novoChecklistId);
        } catch (error) {
          if (isChaveDuplicada(error)) return await ssoChecklistService.getById(novoChecklistId);
          throw error;
        }
      }, 'criar checklist');

      // 2. TODOS os itens numa única requisição.
      //    Antes era um POST por item, em série: com 36 itens bastava uma
      //    oscilação de sinal para o checklist inteiro ser perdido.
      try {
        await comRetryDeRede(async () => {
          try {
            return await ssoItemService.createMany(
              itens.map(item => ({
                id: idPorItem.get(item.id),
                checklist_id: novoChecklistId,
                item_modelo_id: item.item_modelo_id,
                avaliacao: item.avaliacao,
                evidencia: item.evidencia,
                ordem: item.ordem,
                tema: item.tema,
                descricao: item.descricao,
                fotos: []
              }))
            );
          } catch (error) {
            if (isChaveDuplicada(error)) return await ssoItemService.getByChecklistId(novoChecklistId);
            throw error;
          }
        }, 'gravar itens do checklist');
      } catch (error) {
        // Sem os itens o cabeçalho é lixo: some com ele para não deixar
        // checklist vazio na listagem nem duplicar quando o técnico refizer.
        await ssoChecklistService.delete(novoChecklistId).catch(() => undefined);
        throw error;
      }

      // 3. Fotos por último. As respostas já estão salvas, então uma falha
      //    de upload não descarta mais o preenchimento inteiro.
      const fotosNaoEnviadas: number[] = [];

      for (const item of itens) {
        const files = itemFiles[item.id];
        if (!files || files.length === 0) continue;

        const itemId = idPorItem.get(item.id);
        if (!itemId) continue;

        try {
          const uploads = await ssoStorageService.uploadMultiple(novoChecklistId, files);

          await ssoItemService.update(itemId, {
            fotos: uploads.map(upload => ({
              ...upload,
              created_at: new Date().toISOString()
            })) as any
          });
        } catch (error) {
          console.error(`Falha ao enviar fotos do item ${item.ordem}:`, error);
          fotosNaoEnviadas.push(item.ordem);
        }
      }

      return { checklist, fotosNaoEnviadas };
    },
    onSuccess: ({ fotosNaoEnviadas }) => {
      queryClient.invalidateQueries({ queryKey: ['sso-checklists'] });

      if (fotosNaoEnviadas.length > 0) {
        toast.warning(
          `Checklist salvo. As fotos dos itens ${fotosNaoEnviadas.join(', ')} não subiram — ` +
          'edite o checklist para reenviá-las.'
        );
        return;
      }

      toast.success('Checklist criado com sucesso!');
    },
    onError: (error: any) => {
      console.error('Erro ao criar checklist:', error);
      toast.error(
        isErroDeRede(error)
          ? MENSAGEM_SEM_CONEXAO
          : `Erro ao criar checklist: ${error.message}`
      );
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
