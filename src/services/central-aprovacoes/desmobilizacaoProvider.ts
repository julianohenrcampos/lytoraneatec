/**
 * Provider da Central de Aprovações — módulo Desmobilização de Veic/Equip.
 * Fonte: bd_solicitacoes_desmobilizacao (RLS aplica escopo). Decisão via fn_desmobilizacao_decidir.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePermission } from '@/hooks/usePermission';
import {
  DESMOBILIZACAO_STATUS_LABELS,
  fetchDesmobilizacoes,
  type SolicitacaoDesmobilizacao,
} from '@/services/desmobilizacaoService';
import type {
  CentralApprovalItem,
  CentralFiltrosBase,
  CentralProviderResult,
  CentralView,
} from './types';

const viewMatches = (view: CentralView | undefined, s: SolicitacaoDesmobilizacao): boolean => {
  switch (view) {
    case 'concluidas':
      return s.status === 'APROVADA' || s.status === 'CONCLUIDA' || s.status === 'REPROVADA';
    case 'canceladas':
      return s.status === 'CANCELADA';
    case 'todas':
      return true;
    default:
      return s.status === 'PENDENTE_APROVACAO';
  }
};

export function useDesmobilizacaoCentralProvider(
  filtros: CentralFiltrosBase,
  opts?: { enabled?: boolean },
): CentralProviderResult {
  const enabled = opts?.enabled !== false;
  const { isSuperAdmin, hasActionPermission } = usePermission();
  const podeDecidir = isSuperAdmin || hasActionPermission('equipamentos_solicitacoes_aprovar', 'aprovar');

  const query = useQuery({
    queryKey: ['desmobilizacoes'],
    queryFn: fetchDesmobilizacoes,
    enabled,
  });

  const rows = query.data ?? [];

  const itens: CentralApprovalItem[] = useMemo(() => {
    const busca = (filtros.busca ?? '').trim().toLowerCase();
    return rows
      .filter((s) => viewMatches(filtros.view, s))
      .filter((s) => (filtros.solicitanteId ? s.solicitante_id === filtros.solicitanteId : true))
      .filter((s) => (filtros.centroCustoId ? s.centro_custo_origem_id === filtros.centroCustoId : true))
      .filter((s) => (filtros.status ? s.status === filtros.status : true))
      .filter((s) => (filtros.periodoInicio ? s.data_retirada >= filtros.periodoInicio : true))
      .filter((s) => (filtros.periodoFim ? s.data_retirada <= filtros.periodoFim : true))
      .filter((s) =>
        busca
          ? `${s.equipamento_label ?? ''} ${s.centro_custo_origem_label ?? ''} ${s.solicitante_nome ?? ''}`
              .toLowerCase()
              .includes(busca)
          : true,
      )
      .map((s) => {
        const pendente = s.status === 'PENDENTE_APROVACAO';
        return {
          id: s.id,
          modulo: 'desmobilizacao',
          moduloLabel: 'Desmobilização',
          protocolo: `DESMOB-${s.id.slice(0, 8).toUpperCase()}`,
          titulo: `Desmobilizar ${s.equipamento_label ?? 'ativo'}`,
          solicitanteNome: s.solicitante_nome ?? null,
          centroCustoLabel: s.centro_custo_origem_label ?? null,
          valorEstimado: null,
          statusCodigo: s.status,
          statusLabel: DESMOBILIZACAO_STATUS_LABELS[s.status],
          dataReferencia: s.data_retirada,
          atualizadoEm: s.created_at,
          aguardandoMinhaAcao: pendente && podeDecidir,
          canApprove: pendente && podeDecidir,
          canReject: pendente && podeDecidir,
          currentStageExecId: null,
          approveBlockReason: pendente ? (podeDecidir ? null : 'sem_permissao') : 'status_nao_pendente',
          rejectBlockReason: pendente ? (podeDecidir ? null : 'sem_permissao') : 'status_nao_pendente',
          authorizationSource: 'equipamentos_solicitacoes_aprovar',
          capabilitiesUnavailable: false,
          urgente: false,
          autoApproval: !s.exige_aprovacao,
          raw: s,
        } satisfies CentralApprovalItem;
      });
  }, [rows, filtros, podeDecidir]);

  const pendentes = rows.filter((s) => s.status === 'PENDENTE_APROVACAO').length;

  return {
    itens,
    indicadores: {
      pendentes,
      urgentes: null,
      aguardandoMinhaAcao: podeDecidir ? pendentes : 0,
      concluidasHoje: null,
      tempoMedioHojeMin: null,
    },
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => { void query.refetch(); },
    centrosCustoOptions: Array.from(
      new Map(rows.map((s) => [s.centro_custo_origem_id, s.centro_custo_origem_label ?? '—'])).entries(),
    ).map(([value, label]) => ({ value, label })),
    solicitantesOptions: Array.from(
      new Map(rows.map((s) => [s.solicitante_id, s.solicitante_nome ?? '—'])).entries(),
    ).map(([value, label]) => ({ value, label })),
    statusOptions: Array.from(new Set(rows.map((s) => s.status))).map((s) => ({
      value: s,
      label: DESMOBILIZACAO_STATUS_LABELS[s],
    })),
    moduleStates: {
      desmobilizacao: {
        enabled,
        isLoading: query.isLoading,
        isError: query.isError,
        errorMessage: query.error ? (query.error as Error).message : null,
        refetch: () => { void query.refetch(); },
      },
    },
  };
}
