import { useQuery } from "@tanstack/react-query";
import {
  getAcoesIntegradasDisponivel,
  getAprovacaoPreview,
  getAprovacaoResumoLote,
  getMotorCorporativoDisponivel,
  getPodeResolverOperacional,
  getProcessoOperacionalChamado,
} from "@/services/chamadoOperacionalService";

/**
 * Capability efetiva da integração (gate de piloto no banco):
 * toggle global ON OU permissão `chamados_acoes_integradas_teste`.
 * O backend é a autoridade — esta consulta só governa a apresentação.
 */
export function useAcoesIntegradasAtivas() {
  const query = useQuery({
    queryKey: ["chamado-interno", "acoes-integradas-disponivel"],
    queryFn: getAcoesIntegradasDisponivel,
    staleTime: 5 * 60 * 1000,
  });
  return { ativo: query.data === true, isLoading: query.isLoading };
}

/** Capability efetiva do motor corporativo (global OU piloto). */
export function useMotorCorporativoDisponivel() {
  const query = useQuery({
    queryKey: ["aprovacao", "motor-corporativo-disponivel"],
    queryFn: getMotorCorporativoDisponivel,
    staleTime: 5 * 60 * 1000,
  });
  return { ativo: query.data === true, isLoading: query.isLoading };
}


export function useProcessoOperacionalChamado(chamadoId: string | null | undefined) {
  return useQuery({
    queryKey: ["chamado-interno", "processo-operacional", chamadoId],
    queryFn: () => getProcessoOperacionalChamado(chamadoId as string),
    enabled: !!chamadoId,
    staleTime: 30 * 1000,
  });
}

export function usePodeResolverOperacional(chamadoId: string | null | undefined) {
  return useQuery({
    queryKey: ["chamado-interno", "pode-resolver-operacional", chamadoId],
    queryFn: () => getPodeResolverOperacional(chamadoId as string),
    enabled: !!chamadoId,
    staleTime: 15 * 1000,
  });
}

export function useAprovacaoPreview(
  centroCustoId: string | null | undefined,
  contexto: Record<string, unknown> = {},
  enabled = true,
) {
  return useQuery({
    queryKey: ["solic-equip", "aprovacao-preview", centroCustoId, contexto],
    queryFn: () => getAprovacaoPreview(centroCustoId as string, contexto),
    enabled: !!centroCustoId && enabled,
    staleTime: 60 * 1000,
  });
}

export function useAprovacaoResumoLote(ids: string[]) {
  const key = [...ids].sort().join(",");
  return useQuery({
    queryKey: ["solic-equip", "aprovacao-resumo", key],
    queryFn: () => getAprovacaoResumoLote(ids),
    enabled: ids.length > 0,
    staleTime: 30 * 1000,
  });
}
