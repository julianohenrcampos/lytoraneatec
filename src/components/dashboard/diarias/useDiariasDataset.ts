// =====================================================
// Dataset central compartilhado do Dashboard de Diárias
// Resolve UMA VEZ por conjunto de filtros:
//   - solicitacoes (filtradas)
//   - solIdSet     (derivado, sem requisição extra)
//   - presencas    (confirmadas, com solIdSet aplicado)
//   - feriadosSet
// Componentes consomem este hook e calculam agregados localmente.
// =====================================================
import { useQuery } from "@tanstack/react-query";
import {
  DASHBOARD_QUERY_OPTS,
  fetchFeriadosSet,
  fetchPresencasConfirmadas,
  fetchSolicitacoesFiltradas,
  stableFilterKey,
  type DiariasFilters,
  type PresencaRow,
  type SolicitacaoRow,
} from "./_dashboardHelpers";

export interface DiariasDataset {
  solicitacoes: SolicitacaoRow[];
  /** null = sem restrição (todos), Set vazio = nenhum match (curto-circuito) */
  solIdSet: Set<string> | null;
  presencas: PresencaRow[];
  feriadosSet: Set<string>;
}

/**
 * Indica se os filtros exigem restrição de solicitação ID
 * (engenheiro/gerente/solicitação específica). Se sim, derivamos o Set a
 * partir das solicitações já carregadas — evita um round-trip a mais.
 */
function needsSolIdSet(filters: DiariasFilters): boolean {
  return (
    !!filters.solicitacaoId ||
    !!filters.engenheiroSolicitanteId ||
    !!(filters.gerenteRegionalIds && filters.gerenteRegionalIds.length > 0)
  );
}

export function useDiariasDataset(filters: DiariasFilters) {
  return useQuery<DiariasDataset>({
    queryKey: ["diarias-dashboard-dataset-v1", stableFilterKey(filters)],
    ...DASHBOARD_QUERY_OPTS,
    enabled: !!filters.dataInicio && !!filters.dataFim,
    queryFn: async () => {
      // 1) Solicitações + feriados em paralelo.
      const [solicitacoes, feriadosSet] = await Promise.all([
        fetchSolicitacoesFiltradas(filters),
        fetchFeriadosSet(),
      ]);

      // 2) Deriva solIdSet do que já foi carregado (sem nova request).
      const solIdSet: Set<string> | null = needsSolIdSet(filters)
        ? new Set(solicitacoes.map((s) => s.id))
        : null;

      // Curto-circuito: filtro exige sol IDs mas não retornou nada.
      if (solIdSet !== null && solIdSet.size === 0) {
        return {
          solicitacoes,
          solIdSet,
          presencas: [],
          feriadosSet,
        };
      }

      // 3) Presenças confirmadas usando o solIdSet derivado.
      // Cuidado: PostgREST limita arrays grandes em URL — se passou de 800,
      // não filtra por solIdSet (os outros filtros server-side já reduzem).
      const safeSet = solIdSet && solIdSet.size > 800 ? null : solIdSet;
      const presencas = await fetchPresencasConfirmadas(filters, safeSet);

      return { solicitacoes, solIdSet, presencas, feriadosSet };
    },
  });
}
