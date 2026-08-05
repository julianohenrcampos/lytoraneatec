/**
 * CT-3B.1 — Filtros de estado do universo de candidatos.
 *
 * Escopo honesto: o conjunto filtrado é o conjunto COMPATÍVEL carregado pela
 * análise (fetchAnaliseOperacional), nunca o parque total de ativos. Por isso o
 * rótulo do filtro neutro é "Todos os compatíveis".
 *
 * `ELEGIVEL` deriva EXCLUSIVAMENTE da avaliação server-side já refletida no
 * estado efetivo — o frontend nunca declara elegibilidade própria.
 */
import type { AtivoAnalise } from "@/services/centralTransporteService";
import type { CtEstadoEfetivoMap } from "@/types/centralTransporteEstadoEfetivo";
import { badgeDoEstadoEfetivo } from "./estadoEfetivoBadges";
import {
  dataReferenciaOperacional,
  disponivelFuturamente,
  liberacaoPrevista,
} from "./disponibilidadeTemporal";

export type FiltroEstadoAtivo =
  | "TODOS"
  | "ELEGIVEL"
  | "DISPONIVEL_FUTURAMENTE"
  | "LIBERACAO_PREVISTA"
  | "COMPROMETIDO"
  | "ALOCADO"
  | "MANUTENCAO"
  | "INDISPONIVEL"
  | "SEM_STATUS";

export const FILTRO_ESTADO_LABELS: Record<FiltroEstadoAtivo, string> = {
  TODOS: "Todos os compatíveis",
  ELEGIVEL: "Elegíveis (avaliação do servidor)",
  DISPONIVEL_FUTURAMENTE: "Disponíveis futuramente",
  LIBERACAO_PREVISTA: "Com previsão de liberação",
  COMPROMETIDO: "Comprometidos / reservados",
  ALOCADO: "Alocados",
  MANUTENCAO: "Em manutenção",
  INDISPONIVEL: "Indisponíveis",
  SEM_STATUS: "Sem status operacional",
};

export const FILTROS_ESTADO_ORDEM: FiltroEstadoAtivo[] = [
  "TODOS",
  "ELEGIVEL",
  "DISPONIVEL_FUTURAMENTE",
  "LIBERACAO_PREVISTA",
  "COMPROMETIDO",
  "ALOCADO",
  "MANUTENCAO",
  "INDISPONIVEL",
  "SEM_STATUS",
];

export const filtrarPorEstado = (
  rows: AtivoAnalise[],
  filtro: FiltroEstadoAtivo,
  estados?: CtEstadoEfetivoMap,
  referencia: string = dataReferenciaOperacional(),
): AtivoAnalise[] => {
  if (filtro === "TODOS") return rows;
  return rows.filter((r) => {
    const status = r.status_operacional;
    switch (filtro) {
      case "ELEGIVEL": {
        const estado = estados?.get(r.equipamento_id);
        // Fail-closed: estado não consultado nunca é elegível.
        if (!estado) return false;
        return !badgeDoEstadoEfetivo(estado).bloqueiaOperacao;
      }
      case "DISPONIVEL_FUTURAMENTE":
        return disponivelFuturamente(status, r.data_inicio_disponibilidade, referencia);
      case "LIBERACAO_PREVISTA":
        return liberacaoPrevista(status, r.previsao_liberacao);
      case "COMPROMETIDO": {
        const estado = estados?.get(r.equipamento_id);
        return !!estado?.compromissoAtual;
      }
      case "ALOCADO":
        return status === "ALOCADO";
      case "MANUTENCAO":
        return status === "MANUTENCAO";
      case "INDISPONIVEL":
        return status === "INDISPONIVEL";
      case "SEM_STATUS":
        return status === "SEM_STATUS" || !r.possui_registro_disponibilidade;
      default:
        return true;
    }
  });
};
