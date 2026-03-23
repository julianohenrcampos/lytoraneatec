import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getConfiguracaoSistema, listarConfiguracoes, updateConfiguracaoSistema } from '@/services/configService';
import { toast } from 'sonner';

export function useConfiguracaoSistema(chave: string) {
  return useQuery({
    queryKey: ['configuracao-sistema', chave],
    queryFn: () => getConfiguracaoSistema(chave),
    staleTime: 5 * 60 * 1000,
  });
}

export function useFluxoDinamicoAtivo() {
  const query = useConfiguracaoSistema('fluxo_aprovacao_dinamico');
  return {
    ativo: query.data === 'true',
    isLoading: query.isLoading,
  };
}

export function useListarConfiguracoes() {
  return useQuery({
    queryKey: ['configuracoes-sistema'],
    queryFn: listarConfiguracoes,
    staleTime: 60 * 1000,
  });
}

export function useUpdateConfiguracao() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ chave, valor }: { chave: string; valor: string }) =>
      updateConfiguracaoSistema(chave, valor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracoes-sistema'] });
      queryClient.invalidateQueries({ queryKey: ['configuracao-sistema'] });
      toast.success('Configuração atualizada com sucesso');
    },
    onError: (error: any) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });
}
