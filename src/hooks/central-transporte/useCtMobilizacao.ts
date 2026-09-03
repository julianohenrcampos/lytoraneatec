/**
 * CT-3C — Hook do estado de mobilização de uma solicitação.
 *
 * Prefixo de queryKey `ct-mobilizacao` (invalidado por
 * `invalidarCachesAtivosOperacionais` após qualquer operação do ciclo).
 *
 * Fail-closed: enquanto o estado não for carregado, nenhuma programação é
 * habilitada pela UI. O planejamento em foco é o rascunho em edição quando
 * existe; caso contrário, o programado vigente.
 */
import { useQuery } from "@tanstack/react-query";
import { fetchMobilizacaoEstado } from "@/services/centralTransporteMobilizacaoService";
import type { CtMobilizacaoEstado } from "@/types/centralTransporteMobilizacao";

export const CT_MOBILIZACAO_PREFIX = "ct-mobilizacao";

export interface UseCtMobilizacaoParams {
  solicitacaoId: string;
  enabled?: boolean;
}

export const useCtMobilizacao = ({ solicitacaoId, enabled = true }: UseCtMobilizacaoParams) => {
  const query = useQuery<CtMobilizacaoEstado>({
    enabled: enabled && !!solicitacaoId,
    queryKey: [CT_MOBILIZACAO_PREFIX, solicitacaoId],
    queryFn: () => fetchMobilizacaoEstado(solicitacaoId),
  });

  const vigente = query.data?.planejamentoVigente ?? null;
  const rascunho = query.data?.rascunhoEmEdicao ?? null;

  return {
    estado: query.data ?? null,
    ativos: query.data?.ativos ?? [],
    viagens: query.data?.viagens ?? [],
    planejamentoVigente: vigente,
    rascunhoEmEdicao: rascunho,
    /** Versão em foco na UI (rascunho quando existe). */
    planejamento: rascunho ?? vigente,
    carregado: !!query.data && !query.error,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
};

export default useCtMobilizacao;
