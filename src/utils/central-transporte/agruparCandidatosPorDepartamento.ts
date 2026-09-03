/**
 * Agrupamento de candidatos da Central do Transporte por departamento
 * preferencial da solicitação.
 *
 * REGRA ESTRUTURAL: departamento é APRESENTAÇÃO. Entra depois de todo o
 * matching/reconciliação/ordenação madura (`chave_ordenacao`), apenas
 * particionando a lista já ordenada em dois blocos. Nenhum candidato elegível
 * é removido — jamais existe `where departamento_id = preferencial`.
 */
import type { AtivoAnalise } from "@/services/centralTransporteService";
import { rankCandidatosPorDepartamentoPreferencial } from "./rankCandidatosPorDepartamento";

export interface GrupoCandidatosAtivo {
  id: "RECOMENDADOS" | "ALTERNATIVAS" | "MELHORES";
  titulo: string;
  candidatos: AtivoAnalise[];
}

export const TITULO_MELHORES_OPCOES = "Melhores opções";

/**
 * Sem preferência: um único bloco, ordenação madura preservada.
 * Com preferência: "Recomendados — <dep>" primeiro, depois "Alternativas —
 * outros departamentos". A ordem interna de cada bloco é a original.
 */
export function agruparCandidatosPorDepartamento(
  candidatos: AtivoAnalise[],
  departamentoPreferencialId: string | null | undefined,
  departamentoPreferencialNome?: string | null,
): GrupoCandidatosAtivo[] {
  if (!departamentoPreferencialId) {
    return [{ id: "MELHORES", titulo: TITULO_MELHORES_OPCOES, candidatos: [...candidatos] }];
  }

  // Estabilidade garantida pelo ranking compartilhado (peso, nunca filtro).
  const ordenados = rankCandidatosPorDepartamentoPreferencial(
    candidatos.map((c) => ({ ...c })) as unknown as { departamento_id?: string | null }[],
    departamentoPreferencialId,
  ) as unknown as AtivoAnalise[];


  const recomendados = ordenados.filter((c) => c.departamento_id === departamentoPreferencialId);
  const alternativas = ordenados.filter((c) => c.departamento_id !== departamentoPreferencialId);

  const grupos: GrupoCandidatosAtivo[] = [];
  if (recomendados.length > 0) {
    grupos.push({
      id: "RECOMENDADOS",
      titulo: `Recomendados — ${departamentoPreferencialNome ?? "departamento preferencial"}`,
      candidatos: recomendados,
    });
  }
  if (alternativas.length > 0) {
    grupos.push({
      id: "ALTERNATIVAS",
      titulo: "Alternativas — outros departamentos",
      candidatos: alternativas,
    });
  }
  return grupos;
}

/** true quando o ativo pertence a departamento diferente do preferencial. */
export function ativoDeDepartamentoAlternativo(
  ativo: Pick<AtivoAnalise, "departamento_id">,
  departamentoPreferencialId: string | null | undefined,
): boolean {
  if (!departamentoPreferencialId) return false;
  return ativo.departamento_id !== departamentoPreferencialId;
}
