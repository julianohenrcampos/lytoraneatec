/**
 * Compatibilidade pré-deploy — fallback de `dias_solicitados`.
 *
 * Itens de `convocados_pre` criados antes da nova regra (Fase F) não possuem
 * `dias_solicitados`. Esta função centraliza a regra para resolver os dias
 * efetivos de cálculo/exibição de cada item individualmente, sem UPDATE no
 * banco e sem afetar itens novos que possuam o campo.
 *
 * Regra única:
 *  - Se `item.dias_solicitados` for array com ≥1 string → usa exatamente esses dias (origem='campo').
 *  - Caso contrário (ausente/null/[]/inválido) → fallback legado: todas as
 *    datas do período classificadas conforme `considera_fds_feriado`:
 *      • considera_fds_feriado=true  → todas as datas classificadas
 *      • considera_fds_feriado=false → apenas datas com tipo ∈ {util, sabado}
 *    (origem='legado_periodo').
 *
 * NÃO infere a partir de aditivos aprovados nem de presenças reais.
 * Granularidade é por item: uma mesma solicitação pode ter convocados legados
 * e convocados novos sem conflito.
 */

import type { DataClassificada } from './diariasPeriodoUtils';

export type FallbackOrigem = 'campo' | 'legado_periodo';

export interface ResolucaoDiasItem {
  funcionario_id: string;
  dias: string[];
  origem: FallbackOrigem;
}

export interface ContextoFallback {
  datasClassificadas: DataClassificada[];
  consideraFdsFeriado: boolean;
}

function datasLegadasDoPeriodo(ctx: ContextoFallback): string[] {
  return ctx.datasClassificadas
    .filter((d) =>
      ctx.consideraFdsFeriado ? true : d.tipo === 'util' || d.tipo === 'sabado',
    )
    .map((d) => d.data);
}

function extrairDiasValidos(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const arr = raw.filter((d): d is string => typeof d === 'string');
  return arr.length > 0 ? arr : null;
}

/**
 * Resolve a lista efetiva de dias de um item de `convocados_pre`.
 */
export function resolverDiasSolicitadosItem(
  item: { funcionario_id: string; dias_solicitados?: unknown },
  ctx: ContextoFallback,
): ResolucaoDiasItem {
  const dias = extrairDiasValidos(item.dias_solicitados);
  if (dias) {
    return { funcionario_id: item.funcionario_id, dias, origem: 'campo' };
  }
  return {
    funcionario_id: item.funcionario_id,
    dias: datasLegadasDoPeriodo(ctx),
    origem: 'legado_periodo',
  };
}

/**
 * Indica se um item está convocado para uma data específica.
 * Compatível com itens novos (filtra por `dias_solicitados`) e legados
 * (qualquer data dentro do período legado é considerada convocada).
 */
export function itemConvocadoNaData(
  item: { funcionario_id: string; dias_solicitados?: unknown },
  data: string,
  ctx: ContextoFallback,
): { convocado: boolean; origem: FallbackOrigem } {
  const r = resolverDiasSolicitadosItem(item, ctx);
  return { convocado: r.dias.includes(data), origem: r.origem };
}
