/**
 * CT-4 — Regra de SELEÇÃO de ativos para o RASCUNHO de uma parada.
 *
 * Autoridade única: `elegivel` calculado pelo servidor
 * (fn_ct_ativos_movimentacao_listar) + duplicidade local dentro da própria
 * viagem. NÃO recalcular status_operacional, previsao_liberacao ou qualquer
 * gate de PROGRAMAÇÃO aqui — isso continua sendo avaliado server-side por
 * fn_ct_avaliar_disponibilidade no momento de programar a movimentação.
 */
export interface EntradaSelecaoParada {
  /** Vem do servidor; nunca recalculado no cliente. */
  elegivel: boolean;
  /** Já selecionado NESTA parada (permite remover). */
  jaNestaParada: boolean;
  /** Já usado em OUTRA parada da mesma movimentação. */
  usadoEmOutraParada: boolean;
}

export const podeSelecionarAtivoParada = ({
  elegivel,
  jaNestaParada,
  usadoEmOutraParada,
}: EntradaSelecaoParada): boolean =>
  jaNestaParada || (elegivel && !usadoEmOutraParada);
