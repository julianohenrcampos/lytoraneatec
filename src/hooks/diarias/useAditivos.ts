// =====================================================
// HOOK: ADITIVOS POR SOLICITAÇÃO (Fase I.2)
// =====================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  cancelarAditivo,
  getAditivoById,
  listarAditivosPorSolicitacao,
  solicitarAditivoDia,
  solicitarAditivoFuncionario,
  type SolicitarAditivoDiaInput,
  type SolicitarAditivoFuncionarioInput,
} from '@/services/diarias/aditivoService';

const QK_ROOT = 'diarias-aditivos';

export function useAditivos(solicitacaoId?: string) {
  return useQuery({
    queryKey: [QK_ROOT, 'por-solicitacao', solicitacaoId],
    queryFn: () => listarAditivosPorSolicitacao(solicitacaoId!),
    enabled: !!solicitacaoId,
    staleTime: 30_000,
  });
}

export function useAditivoById(id?: string) {
  return useQuery({
    queryKey: [QK_ROOT, 'detalhe', id],
    queryFn: () => getAditivoById(id!),
    enabled: !!id,
  });
}

function invalidateAditivos(qc: ReturnType<typeof useQueryClient>, solicitacaoId?: string) {
  qc.invalidateQueries({ queryKey: [QK_ROOT, 'pendentes'] });
  qc.invalidateQueries({ queryKey: [QK_ROOT, 'contagem-pendentes'] });
  if (solicitacaoId) {
    qc.invalidateQueries({ queryKey: [QK_ROOT, 'por-solicitacao', solicitacaoId] });
  } else {
    qc.invalidateQueries({ queryKey: [QK_ROOT, 'por-solicitacao'] });
  }
}

export function useSolicitarAditivoFuncionario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SolicitarAditivoFuncionarioInput) => solicitarAditivoFuncionario(input),
    onSuccess: (_id, vars) => {
      toast.success('Aditivo de funcionário solicitado com sucesso.');
      invalidateAditivos(qc, vars.solicitacaoId);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useSolicitarAditivoDia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SolicitarAditivoDiaInput) => solicitarAditivoDia(input),
    onSuccess: (_id, vars) => {
      toast.success(
        vars.acao === 'adicionar_dia'
          ? 'Aditivo de adição de dia solicitado.'
          : 'Aditivo de remoção de dia solicitado.',
      );
      invalidateAditivos(qc, vars.solicitacaoId);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCancelarAditivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ aditivoId, motivo }: { aditivoId: string; motivo?: string; solicitacaoId?: string }) =>
      cancelarAditivo(aditivoId, motivo),
    onSuccess: (_v, vars) => {
      toast.success('Aditivo cancelado.');
      invalidateAditivos(qc, vars.solicitacaoId);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
