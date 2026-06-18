import { useQuery } from "@tanstack/react-query";
import { listarSolicitacoesEquipamentoPorCentroPeriodo } from "@/services/solicitacaoEquipamentoService";

interface Params {
  centroCustoId: string | null;
  dataInicio: string | null;
  dataFim: string | null;
}

/**
 * Fase 3 — Leitura somente leitura das Solicitações de Equipamento
 * existentes para um Centro de Custo e janela de período, usadas na
 * aba Equipamentos do Planejamento Macro da Obra.
 *
 * Não cria, não altera, não exclui solicitações.
 */
export const useSolicitacoesEquipamentoPlanejamento = ({
  centroCustoId,
  dataInicio,
  dataFim,
}: Params) => {
  return useQuery({
    queryKey: [
      "solicitacoes-equipamento-planejamento",
      centroCustoId,
      dataInicio,
      dataFim,
    ],
    queryFn: () =>
      listarSolicitacoesEquipamentoPorCentroPeriodo({
        centroCustoId: centroCustoId as string,
        dataInicio: dataInicio as string,
        dataFim: dataFim as string,
      }),
    enabled: !!centroCustoId && !!dataInicio && !!dataFim,
    staleTime: 60_000,
  });
};
