/**
 * CT-2 / M4 — Listagem de atendimentos por solicitação (fn_ct_atendimento_listar).
 *
 * Nunca executa para solicitação em modelo legado (item null).
 */
import { useQuery } from "@tanstack/react-query";
import { listarAtendimentos } from "@/services/centralTransporteAtendimentoService";
import type {
  CtAtendimentoListarResult,
  CtItemComAtendimentos,
} from "@/types/centralTransporteCT2";

interface Params {
  solicitacaoId: string | null;
  itemId: string | null;
  enabled: boolean;
}

export const ctAtendimentosQueryKey = (solicitacaoId: string | null) =>
  ["ct2", "atendimentos", solicitacaoId] as const;

export const useAtendimentosSolicitacao = ({ solicitacaoId, itemId, enabled }: Params) => {
  const query = useQuery({
    queryKey: ctAtendimentosQueryKey(solicitacaoId),
    queryFn: (): Promise<CtAtendimentoListarResult> => listarAtendimentos(solicitacaoId as string),
    enabled: enabled && !!solicitacaoId && !!itemId,
  });

  const itemAtual: CtItemComAtendimentos | null =
    query.data?.itens.find((i) => i.solicitacao_item_id === itemId) ?? null;

  return {
    ...query,
    itemAtual,
    contadores: itemAtual?.contadores ?? null,
    atendimentos: itemAtual?.atendimentos ?? [],
  };
};

export default useAtendimentosSolicitacao;
