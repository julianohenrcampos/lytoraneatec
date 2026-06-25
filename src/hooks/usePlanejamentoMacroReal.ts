// Fase 6D.1 — Hook de leitura real do Planejamento Macro.
// Apenas SELECT. Mantém mock como fallback no componente.

import { useQuery } from "@tanstack/react-query";
import {
  buscarPlanejamentoVigentePorCentroCusto,
  listarAtividadesPorPlanejamento,
  type PlanejamentoObraRow,
  type PlanejamentoAtividadeRow,
} from "@/services/planejamentoMacro/planejamentoMacroService";
import type {
  AtividadePlanejada,
  StatusAtividadePlanejada,
  PrioridadeAtividade,
} from "@/types/planejamentoMacro";

const STATUS_MAP: Record<string, StatusAtividadePlanejada> = {
  planejada: "Planejada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  atrasada: "Atrasada",
  cancelada: "Cancelada",
};

const PRIORIDADE_VALIDA = new Set<PrioridadeAtividade>(["baixa", "media", "alta"]);

function adaptarAtividade(row: PlanejamentoAtividadeRow): AtividadePlanejada {
  const statusLabel = STATUS_MAP[row.status] ?? "Planejada";
  const prioridade =
    row.prioridade && PRIORIDADE_VALIDA.has(row.prioridade as PrioridadeAtividade)
      ? (row.prioridade as PrioridadeAtividade)
      : undefined;

  const pctRaw = (row as { percentual_concluido_importado?: number | string | null })
    .percentual_concluido_importado;
  const pct = pctRaw == null ? null : Number(pctRaw);
  const pctManualRaw = (row as { percentual_manual?: number | string | null }).percentual_manual;
  const pctManual = pctManualRaw == null ? null : Number(pctManualRaw);
  const rowAny = row as Record<string, unknown>;
  return {
    id: row.id,
    planejamento_id: row.planejamento_id ?? undefined,
    nome: row.nome,
    frente: row.frente_servico ?? "—",
    inicio: row.data_inicio,
    fim: row.data_fim,
    status: statusLabel,
    status_tecnico: row.status,
    prioridade,
    quantidade_prevista:
      row.quantidade_prevista != null ? Number(row.quantidade_prevista) : undefined,
    unidade: row.unidade ?? undefined,
    codigo_wbs: row.codigo_wbs ?? null,
    descricao: row.descricao ?? null,
    percentual_concluido_importado: pct != null && Number.isFinite(pct) ? pct : null,
    percentual_manual: pctManual != null && Number.isFinite(pctManual) ? pctManual : null,
    percentual_manual_observacao: (rowAny.percentual_manual_observacao as string | null) ?? null,
    percentual_manual_atualizado_por: (rowAny.percentual_manual_atualizado_por as string | null) ?? null,
    percentual_manual_atualizado_em: (rowAny.percentual_manual_atualizado_em as string | null) ?? null,
    fonte_progresso: (rowAny.fonte_progresso as AtividadePlanejada["fonte_progresso"]) ?? null,
    is_critica: Boolean(rowAny.is_critica),
    quantidade_origem: (rowAny.quantidade_origem as AtividadePlanejada["quantidade_origem"]) ?? null,
  };
}

export interface UsePlanejamentoMacroRealResult {
  planejamento: PlanejamentoObraRow | null;
  atividades: AtividadePlanejada[];
  atividadesRawById: Record<string, PlanejamentoAtividadeRow>;
  hasPlanejamentoReal: boolean;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}

export function usePlanejamentoMacroReal(
  centroCustoId: string | null
): UsePlanejamentoMacroRealResult {
  const planejamentoQuery = useQuery({
    queryKey: ["planejamento-macro-vigente", centroCustoId],
    queryFn: () => buscarPlanejamentoVigentePorCentroCusto(centroCustoId as string),
    enabled: !!centroCustoId,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: false,
  });

  const planejamento = planejamentoQuery.data ?? null;

  const atividadesQuery = useQuery({
    queryKey: ["planejamento-macro-atividades", planejamento?.id ?? null],
    queryFn: () => listarAtividadesPorPlanejamento(planejamento!.id),
    enabled: !!planejamento?.id,
    staleTime: 0,
    gcTime: 5 * 60_000,
    retry: false,
  });

  const rawRows = atividadesQuery.data ?? [];

  // Fase 6G.1: todas as atividades são entregues à UI (inclusive canceladas).
  // O filtro visual é responsabilidade da aba.
  const atividades = rawRows.map(adaptarAtividade);

  // Fase 6G: índice por id com dados brutos para edição.
  const atividadesRawById: Record<string, PlanejamentoAtividadeRow> = {};
  for (const row of rawRows) atividadesRawById[row.id] = row;

  if (import.meta.env.DEV && rawRows.length) {
    const counts: Record<string, number> = {};
    for (const r of rawRows) counts[r.status] = (counts[r.status] ?? 0) + 1;
    // eslint-disable-next-line no-console
    console.debug("[planejamento-macro] atividades por status", counts, "total=", rawRows.length);
  }


  const isLoading = planejamentoQuery.isLoading || atividadesQuery.isLoading;
  const isError = planejamentoQuery.isError || atividadesQuery.isError;
  const error = planejamentoQuery.error ?? atividadesQuery.error;

  return {
    planejamento,
    atividades,
    atividadesRawById,
    hasPlanejamentoReal: !!planejamento,
    isLoading,
    isError,
    error,
  };
}
