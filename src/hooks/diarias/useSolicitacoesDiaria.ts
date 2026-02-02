import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { SolicitacaoFormData, SolicitacaoFilters } from '@/types/diarias';
import {
  getSolicitacoes,
  getSolicitacaoById,
  createSolicitacao,
  updateSolicitacao,
  deleteSolicitacao,
  enviarParaAutorizacao,
  autorizarSolicitacao,
  reprovarSolicitacao,
  cancelarEnvioSolicitacao,
  getSolicitacoesResumo,
  getHistoricoAprovacoes
} from '@/services/diarias';

const QUERY_KEY = 'diarias-solicitacoes';

export function useSolicitacoesDiaria(filters?: SolicitacaoFilters) {
  return useQuery({
    queryKey: [QUERY_KEY, filters],
    queryFn: () => getSolicitacoes(filters),
    retry: 2,
    retryDelay: 1000,
    staleTime: 30000,
  });
}

export function useSolicitacaoById(id: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: () => getSolicitacaoById(id!),
    enabled: !!id,
    retry: 2,
    retryDelay: 1000,
    staleTime: 30000,
  });
}

export function useSolicitacoesResumo(filters?: SolicitacaoFilters) {
  return useQuery({
    queryKey: [QUERY_KEY, 'resumo', filters],
    queryFn: () => getSolicitacoesResumo(filters),
    retry: 2,
    retryDelay: 1000,
    staleTime: 30000,
  });
}

export function useHistoricoAprovacoes(entidadeId: string | undefined) {
  return useQuery({
    queryKey: ['diarias-aprovacoes', entidadeId],
    queryFn: () => getHistoricoAprovacoes(entidadeId!),
    enabled: !!entidadeId,
    retry: 2,
    retryDelay: 1000,
    staleTime: 30000,
  });
}

export function useCreateSolicitacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (formData: SolicitacaoFormData) => createSolicitacao(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Solicitação criada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar solicitação: ${error.message}`);
    },
  });
}

export function useUpdateSolicitacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, formData }: { id: string; formData: Partial<SolicitacaoFormData> }) =>
      updateSolicitacao(id, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Solicitação atualizada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar solicitação: ${error.message}`);
    },
  });
}

export function useDeleteSolicitacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteSolicitacao(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Solicitação excluída com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir solicitação: ${error.message}`);
    },
  });
}

export function useEnviarParaAutorizacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => enviarParaAutorizacao(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Solicitação enviada para autorização!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao enviar: ${error.message}`);
    },
  });
}

export function useAutorizarSolicitacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, comentario }: { id: string; comentario?: string }) =>
      autorizarSolicitacao(id, comentario),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Solicitação autorizada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao autorizar: ${error.message}`);
    },
  });
}

export function useReprovarSolicitacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, comentario }: { id: string; comentario?: string }) =>
      reprovarSolicitacao(id, comentario),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Solicitação reprovada.');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao reprovar: ${error.message}`);
    },
  });
}

export function useCancelarEnvioSolicitacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => cancelarEnvioSolicitacao(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Envio cancelado. Solicitação voltou para rascunho.');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao cancelar: ${error.message}`);
    },
  });
}
