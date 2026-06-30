import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as svc from '@/services/rh/solicitacaoTransferenciaService';
import { usePermission } from '@/hooks/usePermission';

const KEY = ['solicitacoes-transferencia'];

function useScope() {
  const { userId, isSuperAdmin, isLoading } = usePermission();
  const scopeUserId: string | null = isSuperAdmin ? null : (userId ?? null);
  return { userId, isLoading, scopeUserId };
}

export function useSolicitacoesTransferencia() {
  const { userId, isLoading, scopeUserId } = useScope();
  return useQuery({
    queryKey: [...KEY, scopeUserId ?? '__all__'],
    queryFn: () => svc.listarSolicitacoes(scopeUserId),
    enabled: !!userId && !isLoading,
  });
}

export function useSolicitacaoTransferencia(id: string | null | undefined) {
  const { userId, isLoading, scopeUserId } = useScope();
  return useQuery({
    queryKey: [...KEY, id, scopeUserId ?? '__all__'],
    queryFn: () => svc.obterSolicitacao(id!, scopeUserId),
    enabled: !!id && !!userId && !isLoading,
  });
}

export function useCancelarSolicitacaoTransferencia() {
  const qc = useQueryClient();
  const { scopeUserId } = useScope();
  return useMutation({
    mutationFn: (id: string) => svc.cancelarSolicitacao(id, scopeUserId),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: [...KEY, id] });
    },
  });
}

export function useExcluirSolicitacaoTransferencia() {
  const qc = useQueryClient();
  const { scopeUserId } = useScope();
  return useMutation({
    mutationFn: (id: string) => svc.excluirSolicitacao(id, scopeUserId),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.removeQueries({ queryKey: [...KEY, id] });
    },
  });
}
