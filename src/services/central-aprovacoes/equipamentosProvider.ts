/**
 * equipamentosProvider — adapta Solicitações de Equipamento ao contrato CentralApprovalItem.
 * Consome fn_solic_equip_listar_central (paginada), fn_solic_equip_indicadores_central
 * (indicadores canônicos) e mapeia visões (pendentes/concluidas/canceladas/todas/minhas_decisoes).
 */
import { useMemo } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  CentralApprovalItem,
  CentralIndicadores,
  CentralProviderResult,
  CentralFiltrosBase,
  CentralView,
} from './types';

interface RpcRow {
  solicitacao_id: string;
  centro_custo_id: string;
  codigo_cc: string | null;
  nome_cc: string | null;
  solicitante_id: string;
  solicitante_nome: string | null;
  aprovador_centro_custo_id: string | null;
  status: string | null;
  status_fluxo: string | null;
  prioridade: string | null;
  data_inicio: string | null;
  created_at: string | null;
  updated_at: string | null;
  quantidade: number | null;
  qtd_itens: number | null;
  itens_resumo: string | null;
  can_approve: boolean | null;
  can_reject: boolean | null;
  auto_approval: boolean | null;
  block_reason: string | null;
  authorization_source: string | null;
  total_count: number | string | null;
}

const PAGE_SIZE = 50;

const STATUS_LABELS: Record<string, string> = {
  PENDENTE_APROVACAO: 'Pendente Aprovação',
  APROVADO: 'Aprovada',
  NEGADO: 'Negada',
  CANCELADO: 'Cancelada',
  EM_TRANSPORTE: 'Em Transporte',
};

const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));

interface ViewMap {
  status_fluxo: string[];
  minhas_decisoes: boolean;
}

function resolveView(view: CentralView | undefined, filtroStatus?: string): ViewMap {
  if (filtroStatus) return { status_fluxo: [filtroStatus], minhas_decisoes: false };
  switch (view) {
    case 'concluidas': return { status_fluxo: ['APROVADO', 'NEGADO'], minhas_decisoes: false };
    case 'canceladas': return { status_fluxo: ['CANCELADO'], minhas_decisoes: false };
    case 'todas':      return { status_fluxo: ['PENDENTE_APROVACAO', 'APROVADO', 'NEGADO', 'CANCELADO'], minhas_decisoes: false };
    case 'pendentes':
    default:           return { status_fluxo: ['PENDENTE_APROVACAO'], minhas_decisoes: false };
  }
}

function labelStatus(codigo: string | null): string {
  if (!codigo) return '—';
  return STATUS_LABELS[codigo] ?? codigo;
}

function buildRpcParams(filtros: CentralFiltrosBase, offset: number, limit = PAGE_SIZE) {
  const v = resolveView(filtros.view, filtros.status);
  return {
    p_status_fluxo: v.status_fluxo,
    p_centro_custo_ids: filtros.centroCustoId ? [filtros.centroCustoId] : null,
    p_solicitante_id: filtros.solicitanteId || null,
    p_busca: filtros.busca || null,
    p_apenas_minha_acao: filtros.apenasMinhas === true,
    p_periodo_inicio: filtros.periodoInicio || null,
    p_periodo_fim: filtros.periodoFim || null,
    p_limit: limit,
    p_offset: offset,
    p_minhas_decisoes: v.minhas_decisoes,
  } as const;
}

function mapRow(row: RpcRow): CentralApprovalItem {
  const ccLabel = row.codigo_cc && row.nome_cc ? `${row.codigo_cc} - ${row.nome_cc}` : (row.codigo_cc ?? null);
  const protocolo = `SOL-${row.solicitacao_id.slice(0, 8).toUpperCase()}`;
  return {
    id: row.solicitacao_id,
    modulo: 'equipamentos',
    moduloLabel: 'Equipamentos',
    protocolo,
    titulo: `Equipamentos — ${row.codigo_cc ?? '—'} - ${row.nome_cc ?? '—'}`,
    solicitanteNome: row.solicitante_nome,
    centroCustoLabel: ccLabel,
    valorEstimado: null,
    statusCodigo: row.status_fluxo,
    statusLabel: labelStatus(row.status_fluxo),
    dataReferencia: row.data_inicio,
    atualizadoEm: row.updated_at || row.created_at,
    aguardandoMinhaAcao: !!row.can_approve,
    canApprove: !!row.can_approve,
    canReject: !!row.can_reject,
    autoApproval: !!row.auto_approval,
    currentStageExecId: null,
    approveBlockReason: row.block_reason,
    rejectBlockReason: row.block_reason,
    authorizationSource: row.authorization_source,
    capabilitiesUnavailable: false,
    urgente: row.prioridade === 'URGENTE',
    raw: row,
  };
}

interface IndicadoresRpc {
  pendentes: number | null;
  aguardando_minha_acao: number | null;
  concluidas_hoje: number | null;
  tempo_medio_hoje_min: number | null;
}

export function useEquipamentosCentralProvider(
  filtros: CentralFiltrosBase,
  options: { enabled: boolean },
): CentralProviderResult {
  const enabled = options.enabled;

  const filtrosKey = useMemo(
    () => JSON.stringify({
      cc: filtros.centroCustoId ?? null,
      st: filtros.status ?? null,
      sol: filtros.solicitanteId ?? null,
      b: filtros.busca ?? null,
      am: !!filtros.apenasMinhas,
      pi: filtros.periodoInicio ?? null,
      pf: filtros.periodoFim ?? null,
      v: filtros.view ?? 'pendentes',
    }),
    [filtros.centroCustoId, filtros.status, filtros.solicitanteId, filtros.busca, filtros.apenasMinhas, filtros.periodoInicio, filtros.periodoFim, filtros.view],
  );

  const listQuery = useInfiniteQuery({
    queryKey: ['central-aprovacoes:equipamentos:list', filtrosKey],
    enabled,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const offset = typeof pageParam === 'number' ? pageParam : 0;
      const { data, error } = await supabase.rpc(
        'fn_solic_equip_listar_central' as any,
        buildRpcParams(filtros, offset) as any,
      );
      if (error) throw error;
      return { rows: (data ?? []) as RpcRow[], offset };
    },
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((n, p) => n + p.rows.length, 0);
      const total = Number(lastPage.rows[0]?.total_count ?? 0);
      if (loaded >= total) return undefined;
      return loaded;
    },
    staleTime: 15_000,
  });

  const indicadoresQuery = useQuery({
    queryKey: ['central-aprovacoes:equipamentos:indicadores'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fn_solic_equip_indicadores_central' as any);
      if (error) throw error;
      return (data ?? {}) as IndicadoresRpc;
    },
    staleTime: 30_000,
  });

  const rows = useMemo(
    () => (listQuery.data?.pages ?? []).flatMap((p) => p.rows),
    [listQuery.data],
  );

  const itens = useMemo(() => rows.map(mapRow), [rows]);

  const indicadores: CentralIndicadores = useMemo(() => ({
    pendentes: indicadoresQuery.data?.pendentes ?? null,
    urgentes: null,
    aguardandoMinhaAcao: indicadoresQuery.data?.aguardando_minha_acao ?? null,
    concluidasHoje: indicadoresQuery.data?.concluidas_hoje ?? null,
    tempoMedioHojeMin: indicadoresQuery.data?.tempo_medio_hoje_min ?? null,
  }), [indicadoresQuery.data]);

  const centrosCustoOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      if (r.centro_custo_id) {
        const label = r.codigo_cc && r.nome_cc ? `${r.codigo_cc} - ${r.nome_cc}` : (r.codigo_cc ?? r.centro_custo_id);
        map.set(r.centro_custo_id, label);
      }
    }
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [rows]);

  const solicitantesOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      if (r.solicitante_id) map.set(r.solicitante_id, r.solicitante_nome ?? r.solicitante_id);
    }
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [rows]);

  const refetchAll = () => { listQuery.refetch(); indicadoresQuery.refetch(); };

  return {
    itens,
    indicadores,
    isLoading: enabled && listQuery.isLoading,
    isError: enabled && listQuery.isError,
    refetch: refetchAll,
    centrosCustoOptions,
    solicitantesOptions,
    statusOptions: STATUS_OPTIONS,
    moduleStates: {
      equipamentos: {
        enabled,
        isLoading: enabled && listQuery.isLoading,
        isError: enabled && listQuery.isError,
        errorMessage: listQuery.error ? String((listQuery.error as Error).message ?? listQuery.error) : null,
        refetch: refetchAll,
      },
    },
    hasMore: !!listQuery.hasNextPage,
    isLoadingMore: listQuery.isFetchingNextPage,
    loadMore: () => { if (listQuery.hasNextPage) listQuery.fetchNextPage(); },
  };
}
