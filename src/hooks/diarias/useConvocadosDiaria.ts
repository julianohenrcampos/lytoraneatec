import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { StatusPresenca } from '@/types/diarias';
import {
  getConvocadosByConvocacao,
  getConvocadoById,
  addConvocado,
  removeConvocado,
  updateConvocadoHorarios,
  confirmarPresenca,
  getConvocadosParaPresenca,
  getConvocadosStats
} from '@/services/diarias';

const QUERY_KEY = 'diarias-convocados';

export function useConvocadosByConvocacao(convocacaoId: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, convocacaoId],
    queryFn: () => getConvocadosByConvocacao(convocacaoId!),
    enabled: !!convocacaoId,
    retry: 2,
    retryDelay: 1000,
    staleTime: 30000,
  });
}

export function useConvocadoById(id: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, 'detail', id],
    queryFn: () => getConvocadoById(id!),
    enabled: !!id,
    retry: 2,
    retryDelay: 1000,
    staleTime: 30000,
  });
}

export function useConvocadosStats(convocacaoId: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, 'stats', convocacaoId],
    queryFn: () => getConvocadosStats(convocacaoId!),
    enabled: !!convocacaoId,
    retry: 2,
    retryDelay: 1000,
    staleTime: 30000,
  });
}

export function useConvocadosParaPresenca(
  data?: string,
  centroCustoId?: string,
  convocacaoId?: string
) {
  return useQuery({
    queryKey: [QUERY_KEY, 'presenca', data, centroCustoId, convocacaoId],
    queryFn: () => getConvocadosParaPresenca(data, centroCustoId, convocacaoId),
    retry: 2,
    retryDelay: 1000,
    staleTime: 30000,
  });
}

export function useAddConvocado() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      convocacaoId, 
      funcionarioId, 
      usarDiariaExclusiva 
    }: { 
      convocacaoId: string; 
      funcionarioId: string; 
      usarDiariaExclusiva?: boolean;
    }) => addConvocado(convocacaoId, funcionarioId, usarDiariaExclusiva),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, variables.convocacaoId] });
      queryClient.invalidateQueries({ queryKey: ['diarias-convocacoes'] });
      toast.success('Funcionário adicionado à convocação!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao adicionar: ${error.message}`);
    },
  });
}

export function useRemoveConvocado() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => removeConvocado(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['diarias-convocacoes'] });
      toast.success('Funcionário removido da convocação.');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover: ${error.message}`);
    },
  });
}

export function useUpdateConvocadoHorarios() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      id, 
      horarios 
    }: { 
      id: string; 
      horarios: {
        hora_entrada?: string;
        hora_saida?: string;
        intervalo_inicio?: string;
        intervalo_fim?: string;
      };
    }) => updateConvocadoHorarios(id, horarios),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Horários atualizados!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });
}

export function useConfirmarPresenca() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      id, 
      status, 
      horarios 
    }: { 
      id: string; 
      status: StatusPresenca;
      horarios?: {
        hora_entrada?: string;
        hora_saida?: string;
        intervalo_inicio?: string;
        intervalo_fim?: string;
      };
    }) => confirmarPresenca(id, status, horarios),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['diarias-relatorio'] });
      const msg = variables.status === 'presente' ? 'Presença confirmada!' : 'Ausência registrada.';
      toast.success(msg);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao confirmar presença: ${error.message}`);
    },
  });
}
