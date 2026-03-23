import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getEtapasExecucao,
  aprovarEtapaDinamica,
  rejeitarEtapaDinamica,
} from '@/services/fluxoExecucaoService';

export function useEtapasExecucao(solicitacaoId: string | null) {
  return useQuery({
    queryKey: ['etapas-execucao', solicitacaoId],
    queryFn: () => getEtapasExecucao(solicitacaoId!),
    enabled: !!solicitacaoId,
  });
}

export function useAprovarEtapaDinamica() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { solicitacaoId: string; etapaExecId: string; observacao?: string }) =>
      aprovarEtapaDinamica(params.solicitacaoId, params.etapaExecId, params.observacao),
    onSuccess: () => {
      toast.success('Etapa aprovada com sucesso');
      qc.invalidateQueries({ queryKey: ['gestao-aprovacoes-diarias'] });
      qc.invalidateQueries({ queryKey: ['gestao-aprovacoes-kpis'] });
      qc.invalidateQueries({ queryKey: ['etapas-execucao'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao aprovar etapa');
    },
  });
}

export function useRejeitarEtapaDinamica() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { solicitacaoId: string; etapaExecId: string; observacao?: string }) =>
      rejeitarEtapaDinamica(params.solicitacaoId, params.etapaExecId, params.observacao),
    onSuccess: () => {
      toast.success('Etapa rejeitada');
      qc.invalidateQueries({ queryKey: ['gestao-aprovacoes-diarias'] });
      qc.invalidateQueries({ queryKey: ['gestao-aprovacoes-kpis'] });
      qc.invalidateQueries({ queryKey: ['etapas-execucao'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao rejeitar etapa');
    },
  });
}
