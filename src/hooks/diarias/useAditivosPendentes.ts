// =====================================================
// HOOK: ADITIVOS PENDENTES (Fase I.2) — fila de aprovação
// =====================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  aprovarAditivo,
  contarAditivosPendentes,
  listarAditivosPendentes,
  reprovarAditivo,
  type ListarAditivosPendentesFiltros,
} from '@/services/diarias/aditivoService';

const QK_ROOT = 'diarias-aditivos';

export function useAditivosPendentes(
  filtros?: ListarAditivosPendentesFiltros,
  options?: { refetchInterval?: number; enabled?: boolean },
) {
  return useQuery({
    queryKey: [QK_ROOT, 'pendentes', filtros ?? null],
    queryFn: () => listarAditivosPendentes(filtros),
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchInterval,
    staleTime: 15_000,
  });
}

export function useContarAditivosPendentes(options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: [QK_ROOT, 'contagem-pendentes'],
    queryFn: () => contarAditivosPendentes(),
    refetchInterval: options?.refetchInterval ?? 60_000,
    staleTime: 30_000,
  });
}

export function invalidatePendentes(qc: ReturnType<typeof useQueryClient>, solicitacaoId?: string) {
  // Aditivos
  qc.invalidateQueries({ queryKey: [QK_ROOT, 'pendentes'] });
  qc.invalidateQueries({ queryKey: [QK_ROOT, 'contagem-pendentes'] });
  qc.invalidateQueries({
    queryKey: solicitacaoId
      ? [QK_ROOT, 'por-solicitacao', solicitacaoId]
      : [QK_ROOT, 'por-solicitacao'],
  });
  qc.invalidateQueries({ queryKey: ['aditivos-pendentes-por-solicitacao'] });

  // Listagem/Detalhes/PDF recalculam via convocados_pre atualizado pela RPC.
  qc.invalidateQueries({ queryKey: ['diarias-solicitacoes'] });
  qc.invalidateQueries({ queryKey: ['estimativas-listagem'] });
  if (solicitacaoId) {
    qc.invalidateQueries({ queryKey: ['solicitacao-detalhes', solicitacaoId] });
    qc.invalidateQueries({ queryKey: ['solicitacao', solicitacaoId] });
  }

  // Apontamento de Campo: precisa refetch imediato para a linha fantasma sumir
  // e o funcionário aprovado aparecer como apontável.
  qc.invalidateQueries({ queryKey: ['diaria-apontamentos'] });
  qc.invalidateQueries({ queryKey: ['diaria-presencas'] });
  if (solicitacaoId) {
    qc.invalidateQueries({ queryKey: ['diaria-apontamento-solicitacao', solicitacaoId] });
    qc.invalidateQueries({ queryKey: ['inclusoes-pendentes-apontamento', solicitacaoId] });
    // Refetch ativo da query da tela aberta
    qc.refetchQueries({ queryKey: ['diaria-apontamento-solicitacao', solicitacaoId], type: 'active' });
  } else {
    qc.invalidateQueries({ queryKey: ['diaria-apontamento-solicitacao'] });
    qc.invalidateQueries({ queryKey: ['inclusoes-pendentes-apontamento'] });
  }
  qc.refetchQueries({ queryKey: ['diaria-apontamentos'], type: 'active' });

  // Notificações
  qc.invalidateQueries({ queryKey: ['notifications-list'] });
  qc.invalidateQueries({ queryKey: ['notifications-unread-count'] });

  // M5 — Gestão de Aprovações: linha/KPI precisa refletir status pós-aditivo
  qc.invalidateQueries({ queryKey: ['gestao-aprovacoes-diarias'] });
  qc.invalidateQueries({ queryKey: ['gestao-aprovacoes-kpis'] });
}

export function useAprovarAditivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ aditivoId, observacao }: { aditivoId: string; observacao?: string; solicitacaoId?: string }) =>
      aprovarAditivo(aditivoId, observacao),
    onSuccess: (resumo, vars) => {
      const ignorados = resumo?.ignorados ?? [];
      if (ignorados.length > 0) {
        toast.warning('Aditivo aprovado parcialmente.', {
          description: `${ignorados.length} funcionário(s) mantidos por presença real registrada: ${ignorados
            .map((i) => i.nome)
            .join(', ')}.`,
          duration: 10_000,
        });
      } else {
        toast.success('Aditivo aprovado.');
      }
      invalidatePendentes(qc, vars.solicitacaoId);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}


export function useReprovarAditivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ aditivoId, motivo }: { aditivoId: string; motivo: string; solicitacaoId?: string }) =>
      reprovarAditivo(aditivoId, motivo),
    onSuccess: (_v, vars) => {
      toast.success('Aditivo reprovado.');
      invalidatePendentes(qc, vars.solicitacaoId);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
