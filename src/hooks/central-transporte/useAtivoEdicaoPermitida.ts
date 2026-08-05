/**
 * CT-2.5 — Hook da trava de edição da condição operacional do ativo.
 *
 * Fail-closed: até a consulta confirmar, a UI trata a edição como bloqueada
 * (EDICAO_NAO_CONSULTADA). A decisão final continua no servidor.
 */
import { useQuery } from "@tanstack/react-query";
import { fetchAtivoEdicaoPermitida } from "@/services/centralTransporteEdicaoAtivoService";
import {
  EDICAO_NAO_CONSULTADA,
  type CtAtivoEdicaoPermitida,
} from "@/types/centralTransporteMobilizacao";

export const CT_EDICAO_ATIVO_PREFIX = "ct-edicao-ativo";

export const useAtivoEdicaoPermitida = (equipamentoId: string, enabled = true) => {
  const query = useQuery<CtAtivoEdicaoPermitida>({
    enabled: enabled && !!equipamentoId,
    queryKey: [CT_EDICAO_ATIVO_PREFIX, equipamentoId],
    queryFn: () => fetchAtivoEdicaoPermitida(equipamentoId),
  });

  const consultado = !!query.data && !query.error;

  return {
    trava: consultado ? (query.data as CtAtivoEdicaoPermitida) : EDICAO_NAO_CONSULTADA,
    consultado,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};

export default useAtivoEdicaoPermitida;
