/**
 * Provider da Central de Aprovações — módulo Transferências de Funcionários.
 * Fonte: fn_transferencias_central_listar (RPC SECURITY DEFINER com escopo por papel).
 * Decisão via fn_transferencia_decidir (efetivação atômica da lotação).
 * Ativo apenas quando o toggle transferencia_aprovacao_recebedor_ativo = true.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePermission } from '@/hooks/usePermission';
import type {
  CentralApprovalItem,
  CentralFiltrosBase,
  CentralProviderResult,
  CentralView,
} from './types';

export const TRANSFERENCIA_CENTRAL_QUERY_KEY = 'transferencias-central';

export const TRANSFERENCIA_STATUS_LABELS: Record<string, string> = {
  pendente_aprovacao: 'Pendente de aprovação',
  aprovada: 'Aprovada',
  rejeitada: 'Rejeitada',
  cancelada: 'Cancelada',
};

export interface TransferenciaCentralRow {
  id: string;
  protocolo: string;
  data_solicitacao: string | null;
  solicitante_id: string | null;
  solicitante_nome_snapshot: string | null;
  status: string;
  total_funcionarios: number;
  centro_custo_destino_id: string | null;
  centro_custo_destino_snapshot: string | null;
  recebedor_user_id: string | null;
  observacao_decisao: string | null;
  aprovado_em: string | null;
  created_at: string | null;
  updated_at: string | null;
  aguardando_minha_acao: boolean;
}

async function fetchTransferenciasCentral(): Promise<TransferenciaCentralRow[]> {
  const { data, error } = await supabase.rpc('fn_transferencias_central_listar', {
    p_view: 'todas',
  });
  if (error) throw error;
  return (data ?? []) as TransferenciaCentralRow[];
}

const viewMatches = (view: CentralView | undefined, s: TransferenciaCentralRow): boolean => {
  switch (view) {
    case 'concluidas':
      return s.status === 'aprovada';
    case 'canceladas':
      return s.status === 'rejeitada' || s.status === 'cancelada';
    case 'todas':
      return true;
    default:
      return s.status === 'pendente_aprovacao';
  }
};

export function useTransferenciasCentralProvider(
  filtros: CentralFiltrosBase,
  opts?: { enabled?: boolean },
): CentralProviderResult {
  const enabled = opts?.enabled !== false;
  const { userId, isSuperAdmin, hasActionPermission } = usePermission();
  const podeAprovarAction = hasActionPermission('gestao_rh_solicitacoes_transferencia_view', 'aprovar');

  const query = useQuery({
    queryKey: [TRANSFERENCIA_CENTRAL_QUERY_KEY],
    queryFn: fetchTransferenciasCentral,
    enabled,
  });

  const rows = query.data ?? [];

  const itens: CentralApprovalItem[] = useMemo(() => {
    const busca = (filtros.busca ?? '').trim().toLowerCase();
    return rows
      .filter((s) => viewMatches(filtros.view, s))
      .filter((s) => (filtros.solicitanteId ? s.solicitante_id === filtros.solicitanteId : true))
      .filter((s) =>
        filtros.centroCustoId ? s.centro_custo_destino_id === filtros.centroCustoId : true,
      )
      .filter((s) => (filtros.status ? s.status === filtros.status : true))
      .filter((s) => (filtros.apenasMinhas ? s.recebedor_user_id === userId : true))
      .filter((s) =>
        busca
          ? `${s.protocolo ?? ''} ${s.solicitante_nome_snapshot ?? ''} ${s.centro_custo_destino_snapshot ?? ''}`
              .toLowerCase()
              .includes(busca)
          : true,
      )
      .map((s) => {
        const pendente = s.status === 'pendente_aprovacao';
        const podeDecidir =
          isSuperAdmin || (s.recebedor_user_id === userId && podeAprovarAction);
        return {
          id: s.id,
          modulo: 'transferencias',
          moduloLabel: 'Transferências',
          protocolo: s.protocolo,
          titulo: `Transferência de ${s.total_funcionarios} funcionário(s) para ${s.centro_custo_destino_snapshot ?? 'CC destino'}`,
          solicitanteNome: s.solicitante_nome_snapshot ?? null,
          centroCustoLabel: s.centro_custo_destino_snapshot ?? null,
          valorEstimado: null,
          statusCodigo: s.status,
          statusLabel: TRANSFERENCIA_STATUS_LABELS[s.status] ?? s.status,
          dataReferencia: s.data_solicitacao,
          atualizadoEm: s.updated_at ?? s.created_at,
          aguardandoMinhaAcao: pendente && s.aguardando_minha_acao,
          canApprove: pendente && podeDecidir,
          canReject: pendente && podeDecidir,
          currentStageExecId: null,
          approveBlockReason: pendente ? (podeDecidir ? null : 'sem_permissao') : 'status_nao_pendente',
          rejectBlockReason: pendente ? (podeDecidir ? null : 'sem_permissao') : 'status_nao_pendente',
          authorizationSource: 'gestao_rh_solicitacoes_transferencia_view',
          capabilitiesUnavailable: false,
          urgente: false,
          autoApproval: false,
          raw: s,
        } satisfies CentralApprovalItem;
      });
  }, [rows, filtros, userId, isSuperAdmin, podeAprovarAction]);

  const pendentes = rows.filter((s) => s.status === 'pendente_aprovacao').length;
  const aguardandoMinha = rows.filter(
    (s) => s.status === 'pendente_aprovacao' && s.aguardando_minha_acao,
  ).length;

  return {
    itens,
    indicadores: {
      pendentes,
      urgentes: null,
      aguardandoMinhaAcao: aguardandoMinha,
      concluidasHoje: null,
      tempoMedioHojeMin: null,
    },
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => { void query.refetch(); },
    centrosCustoOptions: Array.from(
      new Map(
        rows
          .filter((s) => s.centro_custo_destino_id)
          .map((s) => [s.centro_custo_destino_id, s.centro_custo_destino_snapshot ?? '—']),
      ).entries(),
    ).map(([value, label]) => ({ value: value as string, label: label as string })),
    solicitantesOptions: Array.from(
      new Map(
        rows
          .filter((s) => s.solicitante_id)
          .map((s) => [s.solicitante_id, s.solicitante_nome_snapshot ?? '—']),
      ).entries(),
    ).map(([value, label]) => ({ value: value as string, label: label as string })),
    statusOptions: Array.from(new Set(rows.map((s) => s.status))).map((s) => ({
      value: s,
      label: TRANSFERENCIA_STATUS_LABELS[s] ?? s,
    })),
    moduleStates: {
      transferencias: {
        enabled,
        isLoading: query.isLoading,
        isError: query.isError,
        errorMessage: query.error ? (query.error as Error).message : null,
        refetch: () => { void query.refetch(); },
      },
    },
  };
}
