import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ConvocacaoFormData, ConvocacaoFilters } from '@/types/diarias';
import {
  getConvocacoes,
  getConvocacaoById,
  createConvocacao,
  updateConvocacao,
  deleteConvocacao,
  enviarParaAprovacao,
  aprovarConvocacao,
  reprovarConvocacao,
  iniciarExecucao,
  finalizarConvocacao,
  cancelarConvocacao,
  getConvocacoesResumo
} from '@/services/diarias';

const QUERY_KEY = 'diarias-convocacoes';

export function useConvocacoesDiaria(filters?: ConvocacaoFilters) {
  return useQuery({
    queryKey: [QUERY_KEY, filters],
    queryFn: () => getConvocacoes(filters),
    retry: 2,
    retryDelay: 1000,
    staleTime: 30000,
  });
}

export function useConvocacaoById(id: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: () => getConvocacaoById(id!),
    enabled: !!id,
    retry: 2,
    retryDelay: 1000,
    staleTime: 30000,
  });
}

export function useConvocacoesResumo(filters?: ConvocacaoFilters) {
  return useQuery({
    queryKey: [QUERY_KEY, 'resumo', filters],
    queryFn: () => getConvocacoesResumo(filters),
    retry: 2,
    retryDelay: 1000,
    staleTime: 30000,
  });
}

export function useCreateConvocacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (formData: ConvocacaoFormData) => createConvocacao(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['diarias-solicitacoes'] });
      toast.success('Convocação criada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar convocação: ${error.message}`);
    },
  });
}

export function useUpdateConvocacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, formData }: { id: string; formData: Partial<ConvocacaoFormData> }) =>
      updateConvocacao(id, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Convocação atualizada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar convocação: ${error.message}`);
    },
  });
}

export function useDeleteConvocacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteConvocacao(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Convocação excluída com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir convocação: ${error.message}`);
    },
  });
}

export function useEnviarParaAprovacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => enviarParaAprovacao(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Convocação enviada para aprovação!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao enviar: ${error.message}`);
    },
  });
}

export function useAprovarConvocacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, comentario }: { id: string; comentario?: string }) =>
      aprovarConvocacao(id, comentario),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Convocação aprovada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao aprovar: ${error.message}`);
    },
  });
}

export function useReprovarConvocacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, comentario }: { id: string; comentario?: string }) =>
      reprovarConvocacao(id, comentario),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Convocação reprovada.');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao reprovar: ${error.message}`);
    },
  });
}

export function useIniciarExecucao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => iniciarExecucao(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Execução iniciada!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao iniciar: ${error.message}`);
    },
  });
}

export function useFinalizarConvocacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => finalizarConvocacao(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Convocação finalizada!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao finalizar: ${error.message}`);
    },
  });
}

export function useCancelarConvocacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, comentario }: { id: string; comentario?: string }) =>
      cancelarConvocacao(id, comentario),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Convocação cancelada.');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao cancelar: ${error.message}`);
    },
  });
}
