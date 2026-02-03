// =====================================================
// HOOKS: APONTAMENTOS DE CAMPO - DIÁRIAS
// =====================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { StatusApontamento } from '@/types/diarias';
import {
  getApontamentos,
  getApontamentoById,
  getApontamentoBySolicitacaoId,
  iniciarApontamento,
  finalizarApontamento,
  cancelarApontamento,
  updateApontamentoObservacoes
} from '@/services/diarias/apontamentosService';

// Query: Listar apontamentos
export function useApontamentosCampo(filters?: {
  status?: StatusApontamento;
  responsavel_campo_id?: string;
  data_inicio?: string;
  data_fim?: string;
}) {
  return useQuery({
    queryKey: ['diaria-apontamentos', filters],
    queryFn: () => getApontamentos(filters)
  });
}

// Query: Buscar apontamento por ID
export function useApontamentoById(id: string | null) {
  return useQuery({
    queryKey: ['diaria-apontamento', id],
    queryFn: () => getApontamentoById(id!),
    enabled: !!id
  });
}

// Query: Buscar apontamento por solicitação
export function useApontamentoBySolicitacao(solicitacaoId: string | null) {
  return useQuery({
    queryKey: ['diaria-apontamento-solicitacao', solicitacaoId],
    queryFn: () => getApontamentoBySolicitacaoId(solicitacaoId!),
    enabled: !!solicitacaoId
  });
}

// Mutation: Iniciar apontamento
export function useIniciarApontamento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: iniciarApontamento,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diaria-apontamentos'] });
      toast.success('Apontamento iniciado!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao iniciar apontamento');
    }
  });
}

// Mutation: Finalizar apontamento
export function useFinalizarApontamento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, observacoes }: { id: string; observacoes?: string }) =>
      finalizarApontamento(id, observacoes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diaria-apontamentos'] });
      toast.success('Apontamento finalizado!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao finalizar apontamento');
    }
  });
}

// Mutation: Cancelar apontamento
export function useCancelarApontamento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, observacoes }: { id: string; observacoes?: string }) =>
      cancelarApontamento(id, observacoes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diaria-apontamentos'] });
      toast.success('Apontamento cancelado');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao cancelar apontamento');
    }
  });
}

// Mutation: Atualizar observações
export function useUpdateApontamentoObservacoes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, observacoes }: { id: string; observacoes: string }) =>
      updateApontamentoObservacoes(id, observacoes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diaria-apontamentos'] });
      toast.success('Observações salvas');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao salvar observações');
    }
  });
}
