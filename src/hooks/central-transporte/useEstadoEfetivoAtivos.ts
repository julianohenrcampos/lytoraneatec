/**
 * CT-2.2 — Hook em lote do estado efetivo dos ativos.
 *
 * Prefixo de queryKey `ct-estado-efetivo` (invalidado por
 * `invalidarCachesAtivosOperacionais` após qualquer operação do ciclo).
 *
 * Fail-closed: enquanto o status não for `CONSULTADO`, nenhuma operação de
 * atendimento pode ser habilitada pela UI.
 */
import { useQuery } from "@tanstack/react-query";
import { fetchEstadoEfetivoAtivos } from "@/services/centralTransporteEstadoEfetivoService";
import type {
  CtEstadoConsultaStatus,
  CtEstadoEfetivoMap,
} from "@/types/centralTransporteEstadoEfetivo";

export const CT_ESTADO_EFETIVO_PREFIX = "ct-estado-efetivo";

export interface UseEstadoEfetivoParams {
  equipamentoIds: string[];
  periodoInicio?: string | null;
  periodoFim?: string | null;
  enabled?: boolean;
}

const VAZIO: CtEstadoEfetivoMap = new Map();

export const useEstadoEfetivoAtivos = ({
  equipamentoIds,
  periodoInicio = null,
  periodoFim = null,
  enabled = true,
}: UseEstadoEfetivoParams) => {
  const ids = Array.from(new Set(equipamentoIds.filter(Boolean))).sort();
  const ativo = enabled && ids.length > 0;

  const query = useQuery<CtEstadoEfetivoMap>({
    enabled: ativo,
    queryKey: [CT_ESTADO_EFETIVO_PREFIX, ids.join(","), periodoInicio, periodoFim],
    queryFn: () =>
      fetchEstadoEfetivoAtivos({
        equipamentoIds: ids,
        periodoInicio,
        periodoFim,
      }),
  });

  const status: CtEstadoConsultaStatus = query.error
    ? "ERRO"
    : query.data
      ? "CONSULTADO"
      : "CARREGANDO";

  const erro = query.error;
  /** Detalhe observável do erro (código/hint do servidor), quando houver. */
  const errorInfo = erro
    ? {
        code: (erro as { code?: string | null }).code ?? null,
        message: (erro as Error).message ?? null,
        hint: (erro as { hint?: string | null }).hint ?? null,
      }
    : null;

  return {
    estados: (query.data ?? VAZIO) as CtEstadoEfetivoMap,
    status,
    /** true somente quando a consulta retornou com sucesso. */
    consultado: status === "CONSULTADO",
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    errorInfo,
    refetch: query.refetch,
  };
};

export default useEstadoEfetivoAtivos;
