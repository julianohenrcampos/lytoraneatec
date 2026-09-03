/**
 * CT-3D — Ordens do motorista logado (somente leitura, fail-closed na RPC).
 */
import { useQuery } from "@tanstack/react-query";
import { fetchMinhasOrdens } from "@/services/ctMotoristaOrdensService";
import type {
  CtOrdemMotorista,
  CtOrdensMotoristaResultado,
} from "@/types/centralTransporteMobilizacao";

export interface GruposOrdens {
  emAndamento: CtOrdemMotorista[];
  hoje: CtOrdemMotorista[];
  proximas: CtOrdemMotorista[];
  concluidas: CtOrdemMotorista[];
}

export const agruparOrdens = (
  ordens: CtOrdemMotorista[],
  hoje: string | null,
): GruposOrdens => {
  const grupos: GruposOrdens = { emAndamento: [], hoje: [], proximas: [], concluidas: [] };
  for (const o of ordens) {
    if (o.status === "EM_TRANSITO") grupos.emAndamento.push(o);
    else if (o.status === "CONCLUIDA") grupos.concluidas.push(o);
    else if (hoje && o.dataOrdem === hoje) grupos.hoje.push(o);
    else grupos.proximas.push(o);
  }
  return grupos;
};

export const useCtMinhasOrdens = (enabled = true) => {
  const query = useQuery<CtOrdensMotoristaResultado>({
    enabled,
    queryKey: ["ct3d", "minhas-ordens"],
    staleTime: 60 * 1000,
    queryFn: () => fetchMinhasOrdens(),
  });

  const ordens = query.data?.ordens ?? [];

  return {
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    vinculoFuncionario: query.data?.vinculoFuncionario ?? false,
    hoje: query.data?.hoje ?? null,
    ordens,
    grupos: agruparOrdens(ordens, query.data?.hoje ?? null),
  };
};

export default useCtMinhasOrdens;
