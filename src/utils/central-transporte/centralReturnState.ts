/**
 * CT-3B — Estado de retorno à Central do Transporte.
 *
 * A navegação para a página dedicada carrega os filtros vigentes, de modo que
 * "Voltar à Central" restaure exatamente a lista de onde o usuário saiu.
 */
import type { CentralTransporteFilterState } from "@/components/central-transporte/CentralTransportePage";

export interface CentralTransporteReturnState {
  ctFilters?: CentralTransporteFilterState;
}

const CHAVES: Array<keyof CentralTransporteFilterState> = [
  "centro_custo_id",
  "departamento_id",
  "prioridade",
  "tipo_equipamento_id",
  "status_fluxo",
];

/** Sanitiza o state recebido do router (não confiável) em filtros tipados. */
export const lerFiltrosDoState = (state: unknown): CentralTransporteFilterState => {
  const bruto = (state as CentralTransporteReturnState | null)?.ctFilters;
  if (!bruto || typeof bruto !== "object") return {};
  const saida: CentralTransporteFilterState = {};
  for (const chave of CHAVES) {
    const valor = (bruto as Record<string, unknown>)[chave];
    if (typeof valor === "string" && valor.length > 0) saida[chave] = valor;
  }
  return saida;
};

export const criarStateDeRetorno = (
  filters: CentralTransporteFilterState,
): CentralTransporteReturnState => ({ ctFilters: { ...filters } });
