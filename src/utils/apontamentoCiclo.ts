export type CicloApontamento = "EM_ANDAMENTO" | "FINALIZADO" | "INCONSISTENTE";

export interface ApontamentoCicloInput {
  hora_final?: string | null;
  horimetro_final?: number | null;
}

/**
 * Deriva o ciclo do apontamento a partir dos campos finais.
 * - EM_ANDAMENTO: ambos nulos/vazios.
 * - FINALIZADO: ambos preenchidos.
 * - INCONSISTENTE: apenas um preenchido.
 */
export function derivarCicloApontamento(ap: ApontamentoCicloInput): CicloApontamento {
  const hasHoraFinal = ap.hora_final != null && ap.hora_final !== "";
  const hasHorimetroFinal = ap.horimetro_final != null;
  if (hasHoraFinal && hasHorimetroFinal) return "FINALIZADO";
  if (!hasHoraFinal && !hasHorimetroFinal) return "EM_ANDAMENTO";
  return "INCONSISTENTE";
}
