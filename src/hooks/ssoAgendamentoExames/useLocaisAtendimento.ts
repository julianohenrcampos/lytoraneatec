import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { locaisAtendimentoService, LocalAtendimentoFormData } from '@/services/ssoAgendamentoExames/locaisAtendimentoService';
import { toast } from 'sonner';

export const useLocaisAtendimento = (localId?: string) => {
  const queryClient = useQueryClient();

  // Query: Listar todos os locais
  const listQuery = useQuery({
    queryKey: ['locais-atendimento-all'],
    queryFn: () => locaisAtendimentoService.list(),
    enabled: !localId
  });

  // Query: Buscar local por ID
  const detailQuery = useQuery({
    queryKey: ['local-atendimento', localId],
    queryFn: () => locaisAtendimentoService.getById(localId!),
    enabled: !!localId
  });

  // Mutation: Criar local
  const createMutation = useMutation({
    mutationFn: (formData: LocalAtendimentoFormData) => locaisAtendimentoService.create(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locais-atendimento-all'] });
      queryClient.invalidateQueries({ queryKey: ['locais-atendimento'] });
      toast.success('Clínica cadastrada com sucesso!');
    },
    onError: (error: any) => {
      console.error('Erro ao criar clínica:', error);
      toast.error(`Erro ao criar clínica: ${error.message}`);
    }
  });

  // Mutation: Atualizar local
  const updateMutation = useMutation({
    mutationFn: (params: { id: string; data: Partial<LocalAtendimentoFormData> }) =>
      locaisAtendimentoService.update(params.id, params.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locais-atendimento-all'] });
      queryClient.invalidateQueries({ queryKey: ['locais-atendimento'] });
      queryClient.invalidateQueries({ queryKey: ['local-atendimento', localId] });
      toast.success('Clínica atualizada com sucesso!');
    },
    onError: (error: any) => {
      toast.error(`Erro ao atualizar clínica: ${error.message}`);
    }
  });

  // Mutation: Deletar local
  const deleteMutation = useMutation({
    mutationFn: (id: string) => locaisAtendimentoService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locais-atendimento-all'] });
      queryClient.invalidateQueries({ queryKey: ['locais-atendimento'] });
      toast.success('Clínica excluída com sucesso!');
    },
    onError: (error: any) => {
      toast.error(`Erro ao excluir clínica: ${error.message}`);
    }
  });

  // Mutation: Toggle ativo
  const toggleAtivoMutation = useMutation({
    mutationFn: (params: { id: string; ativo: boolean }) =>
      locaisAtendimentoService.toggleAtivo(params.id, params.ativo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locais-atendimento-all'] });
      queryClient.invalidateQueries({ queryKey: ['locais-atendimento'] });
      toast.success('Status atualizado!');
    },
    onError: (error: any) => {
      toast.error(`Erro ao atualizar status: ${error.message}`);
    }
  });

  return {
    // Queries
    locais: listQuery.data || [],
    local: detailQuery.data,
    isLoading: listQuery.isLoading || detailQuery.isLoading,

    // Mutations
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
    toggleAtivo: toggleAtivoMutation.mutateAsync,

    // States
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending
  };
};
