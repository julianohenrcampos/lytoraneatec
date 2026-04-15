// =====================================================
// HOOK: INCLUSÃO DE FUNCIONÁRIO EM DIÁRIAS
// =====================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  solicitarInclusaoFuncionario,
  aprovarInclusaoFuncionario,
  recusarInclusaoFuncionario,
  listarInclusoesPendentes,
  contarInclusoesPendentes,
  notificarAprovadorInclusao
} from '@/services/diarias/inclusaoFuncionarioService';

/**
 * Hook para listar inclusões pendentes
 */
export function useInclusoesPendentes(solicitacaoId?: string) {
  return useQuery({
    queryKey: ['inclusoes-pendentes', solicitacaoId],
    queryFn: () => listarInclusoesPendentes(solicitacaoId),
    refetchInterval: 30000 // Atualiza a cada 30s
  });
}

/**
 * Hook para contar inclusões pendentes (badge)
 */
export function useContarInclusoesPendentes() {
  return useQuery({
    queryKey: ['inclusoes-pendentes-count'],
    queryFn: contarInclusoesPendentes,
    refetchInterval: 60000
  });
}

/**
 * Hook para solicitar inclusão de funcionário
 */
export function useSolicitarInclusao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: solicitarInclusaoFuncionario,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inclusoes-pendentes'] });
      toast.success('Solicitação de inclusão enviada para aprovação.');
    },
    onError: (error: any) => {
      toast.error('Erro ao solicitar inclusão: ' + error.message);
    }
  });
}

/**
 * Hook para aprovar inclusão
 */
export function useAprovarInclusao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: aprovarInclusaoFuncionario,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inclusoes-pendentes'] });
      toast.success('Inclusão aprovada com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao aprovar inclusão: ' + error.message);
    }
  });
}

/**
 * Hook para recusar inclusão
 */
export function useRecusarInclusao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, justificativa }: { id: string; justificativa?: string }) =>
      recusarInclusaoFuncionario(id, justificativa),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inclusoes-pendentes'] });
      toast.success('Inclusão recusada.');
    },
    onError: (error: any) => {
      toast.error('Erro ao recusar inclusão: ' + error.message);
    }
  });
}

/**
 * Hook para notificar aprovador
 */
export function useNotificarAprovadorInclusao() {
  return useMutation({
    mutationFn: notificarAprovadorInclusao
  });
}
