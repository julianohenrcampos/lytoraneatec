/**
 * CT-3B — Listagem completa de atendimentos da solicitação (todos os itens).
 *
 * Mesma RPC e mesma queryKey do hook por item (`fn_ct_atendimento_listar`):
 * uma única chamada devolve contadores + atendimentos de TODOS os itens, então
 * a página dedicada não multiplica requisições ao trocar de item.
 *
 * Nenhum contador é calculado no frontend.
 */
import { useQuery } from "@tanstack/react-query";
import { listarAtendimentos } from "@/services/centralTransporteAtendimentoService";
import { ctAtendimentosQueryKey } from "./useAtendimentosSolicitacao";
import type {
  CtAtendimentoListarResult,
  CtContadores,
  CtItemComAtendimentos,
} from "@/types/centralTransporteCT2";

interface Params {
  solicitacaoId: string | null;
  enabled: boolean;
}

export const useAtendimentosSolicitacaoCompleta = ({ solicitacaoId, enabled }: Params) => {
  const query = useQuery({
    queryKey: ctAtendimentosQueryKey(solicitacaoId),
    queryFn: (): Promise<CtAtendimentoListarResult> => listarAtendimentos(solicitacaoId as string),
    enabled: enabled && !!solicitacaoId,
  });

  const itens: CtItemComAtendimentos[] = query.data?.itens ?? [];

  const porItem = (itemId: string | null): CtItemComAtendimentos | null =>
    itemId ? (itens.find((i) => i.solicitacao_item_id === itemId) ?? null) : null;

  const contadoresDe = (itemId: string | null): CtContadores | null =>
    porItem(itemId)?.contadores ?? null;

  return { ...query, itens, porItem, contadoresDe };
};

export default useAtendimentosSolicitacaoCompleta;
