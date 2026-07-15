/**
 * diariasProvider — adapta o fluxo de Diárias para o contrato CentralApprovalItem.
 * PF-2: consome fn_diaria_capacidades_aprovacao (permission-first, fail-closed, lotes de 200).
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  useGestaoAprovacoesDiarias,
  type SolicitacaoGestao,
  type GestaoAprovacoesFiltros,
} from '@/hooks/diarias/useGestaoAprovacoesDiarias';
import type {
  CentralApprovalItem,
  CentralIndicadores,
  CentralProviderResult,
  CentralFiltrosBase,
} from './types';

const STATUS_LABELS: Record<string, string> = {
  aguardando_aprovacao_gerenteadm: 'Aguardando Gerente ADM',
  aguardando_aprovacao_diretor_operacional: 'Aguardando Diretor Operacional',
  aguardando_aprovacao_diretor_adm: 'Aguardando Diretor ADM',
  ajuste_solicitado_adm: 'Ajuste Solicitado',
  finalizado: 'Finalizado',
};
const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));

const BATCH_SIZE = 200;

interface CapabilityRow {
  solicitacao_id: string;
  can_view: boolean;
  can_approve: boolean;
  can_reject: boolean;
  current_stage_exec_id: string | null;
  current_stage_code: string | null;
  current_stage_label: string | null;
  actionable_stage_ids: string[] | null;
  actionable_stage_count: number;
  has_parallel_stages: boolean;
  is_requester: boolean;
  is_in_scope: boolean;
  approval_requires_signature: boolean;
  has_signature: boolean;
  approve_block_reason: string | null;
  reject_block_reason: string | null;
  authorization_source: string | null;
}

async function fetchCapabilitiesBatched(ids: string[]): Promise<Map<string, CapabilityRow>> {
  const map = new Map<string, CapabilityRow>();
  if (ids.length === 0) return map;

  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    batches.push(ids.slice(i, i + BATCH_SIZE));
  }

  const results = await Promise.all(
    batches.map((batch) =>
      supabase.rpc('fn_diaria_capacidades_aprovacao' as any, { p_solicitacao_ids: batch }),
    ),
  );


  for (const res of results) {
    if (res.error) throw res.error;
    for (const row of (res.data || []) as CapabilityRow[]) {
      map.set(row.solicitacao_id, row);
    }
  }
  return map;
}

function mapItem(
  sol: SolicitacaoGestao,
  cap: CapabilityRow | undefined,
  capsUnavailable: boolean,
): CentralApprovalItem {
  const cc = sol.bd_centros_custo;
  const ccLabel = cc ? `${cc.codigo_centro_custo} - ${cc.nome_centro_custo}` : null;
  const protocolo = sol.numero_solicitacao || `#${sol.id.slice(0, 8).toUpperCase()}`;
  const statusLabel =
    (cap?.current_stage_label) ||
    STATUS_LABELS[sol.status_fluxo || ''] ||
    sol.status_fluxo ||
    sol.status ||
    '—';

  const canApprove = capsUnavailable ? false : (cap?.can_approve ?? false);
  const canReject = capsUnavailable ? false : (cap?.can_reject ?? false);

  return {
    id: sol.id,
    modulo: 'diarias',
    moduloLabel: 'Diárias',
    protocolo,
    titulo: ccLabel ? `Diárias — ${ccLabel}` : 'Diárias',
    solicitanteNome: sol.profiles?.nome_completo ?? null,
    centroCustoLabel: ccLabel,
    valorEstimado: sol.valor_estimado_total ?? null,
    statusCodigo: cap?.current_stage_code ?? sol.status_fluxo,
    statusLabel,
    dataReferencia: sol.data_inicio ?? null,
    atualizadoEm: sol.updated_at ?? null,
    aguardandoMinhaAcao: canApprove,
    canApprove,
    canReject,
    currentStageExecId: cap?.current_stage_exec_id ?? null,
    approveBlockReason: capsUnavailable ? 'capacidades_indisponiveis' : (cap?.approve_block_reason ?? null),
    rejectBlockReason: capsUnavailable ? 'capacidades_indisponiveis' : (cap?.reject_block_reason ?? null),
    authorizationSource: cap?.authorization_source ?? null,
    capabilitiesUnavailable: capsUnavailable,
    urgente: false,
    autoApproval: false,
    raw: sol,
  };
}

export function useDiariasCentralProvider(filtros: CentralFiltrosBase): CentralProviderResult {
  const gestaoFiltros: GestaoAprovacoesFiltros = {
    centro_custo_id: filtros.centroCustoId || undefined,
    status_fluxo: filtros.status || undefined,
    solicitante_id: filtros.solicitanteId || undefined,
    periodo_inicio: filtros.periodoInicio,
    periodo_fim: filtros.periodoFim,
  };

  // Central permission-first: desliga auto-filter por role
  const gestao = useGestaoAprovacoesDiarias(gestaoFiltros, { disableRoleAutoFilter: true });

  const solicitacaoIds = useMemo(
    () => gestao.solicitacoes.map((s) => s.id),
    [gestao.solicitacoes],
  );
  const idsKey = solicitacaoIds.join('|');

  const capsQuery = useQuery({
    queryKey: ['central-aprovacoes:diarias:capacidades', idsKey],
    queryFn: () => fetchCapabilitiesBatched(solicitacaoIds),
    enabled: !gestao.isLoading && solicitacaoIds.length > 0,
    staleTime: 30_000,
  });

  const capsUnavailable = capsQuery.isError;

  const itens = useMemo(() => {
    const capsMap = capsQuery.data ?? new Map<string, CapabilityRow>();
    let list = gestao.solicitacoes.map((s) => mapItem(s, capsMap.get(s.id), capsUnavailable));
    if (filtros.apenasMinhas) list = list.filter((i) => i.canApprove);
    if (filtros.busca) {
      const q = filtros.busca.toLowerCase();
      list = list.filter(
        (i) =>
          i.protocolo.toLowerCase().includes(q) ||
          i.titulo.toLowerCase().includes(q) ||
          (i.solicitanteNome || '').toLowerCase().includes(q) ||
          (i.centroCustoLabel || '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [gestao.solicitacoes, capsQuery.data, capsUnavailable, filtros.apenasMinhas, filtros.busca]);

  const indicadores: CentralIndicadores = useMemo(() => {
    const pendentes =
      gestao.kpis.aguardando_gerenteadm +
      gestao.kpis.aguardando_diretor_operacional +
      gestao.kpis.aguardando_diretor_adm;
    const aguardandoMinhaAcao = itens.filter((i) => i.canApprove).length;
    return {
      pendentes,
      urgentes: null,
      aguardandoMinhaAcao,
      concluidasHoje: null,
      tempoMedioHojeMin: null,
    };
  }, [gestao.kpis, itens]);

  const refetchAll = () => { gestao.refetch(); capsQuery.refetch(); };

  return {
    itens,
    indicadores,
    isLoading: gestao.isLoading || capsQuery.isLoading,
    isError: gestao.isError,
    refetch: refetchAll,
    centrosCustoOptions: gestao.centrosCustoOptions,
    solicitantesOptions: gestao.solicitantesOptions,
    statusOptions: STATUS_OPTIONS,
    moduleStates: {
      diarias: {
        enabled: true,
        isLoading: gestao.isLoading || capsQuery.isLoading,
        isError: gestao.isError,
        errorMessage: gestao.isError ? 'Erro ao carregar Diárias' : null,
        refetch: refetchAll,
      },
    },
  };
}
