/**
 * Ranking de candidatos por departamento preferencial.
 *
 * REGRA OBRIGATÓRIA: a preferência é PESO DE ORDENAÇÃO, nunca filtro.
 * Nenhum candidato é removido — os de outros departamentos permanecem como
 * alternativas visíveis.
 */

export interface CandidatoComDepartamento {
  departamento_id?: string | null;
  [k: string]: unknown;
}

/** Ordena preferenciais primeiro, preservando a ordem relativa original (estável). */
export function rankCandidatosPorDepartamentoPreferencial<T extends CandidatoComDepartamento>(
  candidatos: T[],
  departamentoPreferencialId: string | null | undefined,
): T[] {
  if (!departamentoPreferencialId) return [...candidatos];
  return candidatos
    .map((c, i) => ({ c, i, peso: c.departamento_id === departamentoPreferencialId ? 0 : 1 }))
    .sort((a, b) => a.peso - b.peso || a.i - b.i)
    .map((x) => x.c);
}

export interface GrupoCandidatos<T> {
  titulo: string;
  candidatos: T[];
}

/**
 * Agrupa em "Preferenciais — <departamento>" e "Alternativas — outros departamentos".
 * Sem preferência, devolve um único grupo com a ordem de matching original.
 */
export function agruparCandidatosPorPreferencia<T extends CandidatoComDepartamento>(
  candidatos: T[],
  departamentoPreferencialId: string | null | undefined,
  departamentoPreferencialNome?: string | null,
): GrupoCandidatos<T>[] {
  if (!departamentoPreferencialId) {
    return [{ titulo: "Candidatos", candidatos: [...candidatos] }];
  }
  const preferenciais = candidatos.filter((c) => c.departamento_id === departamentoPreferencialId);
  const alternativas = candidatos.filter((c) => c.departamento_id !== departamentoPreferencialId);
  const grupos: GrupoCandidatos<T>[] = [];
  if (preferenciais.length > 0) {
    grupos.push({
      titulo: `Preferenciais — ${departamentoPreferencialNome ?? "departamento preferencial"}`,
      candidatos: preferenciais,
    });
  }
  if (alternativas.length > 0) {
    grupos.push({ titulo: "Alternativas — outros departamentos", candidatos: alternativas });
  }
  return grupos;
}
