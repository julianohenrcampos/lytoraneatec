import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as svc from '@/services/rh/solicitacaoDesligamentoService';

const KEY = ['solicitacoes-desligamento'];

export function useSolicitacoesDesligamento() {
  return useQuery({ queryKey: KEY, queryFn: svc.listarSolicitacoes });
}

export function useSolicitacaoDesligamento(id: string | null | undefined) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => svc.obterSolicitacao(id!),
    enabled: !!id,
  });
}

export function useCancelarSolicitacaoDesligamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => svc.cancelarSolicitacao(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: [...KEY, id] });
    },
  });
}

export function useExcluirSolicitacaoDesligamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => svc.excluirSolicitacao(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.removeQueries({ queryKey: [...KEY, id] });
    },
  });
}
