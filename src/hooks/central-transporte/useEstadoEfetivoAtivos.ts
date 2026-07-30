/**
 * CT-2.2 — Hook em lote do estado efetivo dos ativos.
 *
 * Prefixo de queryKey `ct-estado-efetivo` (invalidado por
 * `invalidarCachesAtivosOperacionais` após qualquer operação do ciclo).
 */
import { useQuery } from "@tanstack/react-query";
import { fetchEstadoEfetivoAtivos } from "@/services/centralTransporteEstadoEfetivoService";
import type { CtEstadoEfetivoMap } from "@/types/centralTransporteEstadoEfetivo";

export const CT_ESTADO_EFETIVO_PREFIX = "ct-estado-efetivo";

export interface UseEstadoEfetivoParams {
  equipamentoIds: string[];
  periodoInicio?: string | null;
  periodoFim?: string | null;
  enabled?: boolean;
}

export const useEstadoEfetivoAtivos = ({
  equipamentoIds,
  periodoInicio = null,
  periodoFim = null,
  enabled = true,
}: UseEstadoEfetivoParams) => {
  const ids = Array.from(new Set(equipamentoIds.filter(Boolean))).sort();

  const query = useQuery<CtEstadoEfetivoMap>({
    enabled: enabled && ids.length > 0,
    queryKey: [CT_ESTADO_EFETIVO_PREFIX, ids.join(","), periodoInicio, periodoFim],
    queryFn: () =>
      fetchEstadoEfetivoAtivos({
        equipamentoIds: ids,
        periodoInicio,
        periodoFim,
      }),
  });

  return {
    estados: (query.data ?? new Map()) as CtEstadoEfetivoMap,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
};

export default useEstadoEfetivoAtivos;
