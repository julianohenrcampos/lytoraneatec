/**
 * Fase G — Estimativa única para Modal Detalhes e PDF da Solicitação.
 *
 * Reaproveita `calcularEstimativaPorMatriz` (Fase C) como única fonte de verdade.
 * Lê `dias_solicitados` de cada convocado_pre e monta `diasPorFuncionario`.
 * Fallback legado: solicitações antigas sem `dias_solicitados` mantêm comportamento
 * anterior (todas as datas do período, respeitando `considera_fds_feriado`).
 */

import type { DiariaSolicitacao, FuncionarioPreConvocado } from '@/types/diarias';
import type { DataClassificada } from './diariasPeriodoUtils';
import {
  calcularEstimativaPorMatriz,
  type FuncionarioMatriz,
  type RegraOperacionalPorData,
  type SimulacaoPorMatriz,
} from './diariasEstimativaMatriz';
import { resolverDiasSolicitadosItem } from './diariasDiasSolicitadosFallback';

export interface ResumoEstimativa {
  total_diarias_uteis: number;
  total_diarias_fds_feriados: number;
  total_refeicoes: number;
  total_geral: number;
  ocorrencias_uteis: number;
  ocorrencias_exclusivos: number;
  quantidade_pares_refeicao: number;
  breakdown_por_data: SimulacaoPorMatriz['porData'];
  breakdown_por_funcionario: SimulacaoPorMatriz['detalhePorFuncionario'];
  fallback_legado: boolean;
}

function extrairRegrasOperacionais(
  snapshot: unknown,
): Record<string, RegraOperacionalPorData> {
  const result: Record<string, RegraOperacionalPorData> = {};
  if (!snapshot || typeof snapshot !== 'object') return result;

  // Formato persistido pelo SolicitacaoFormModal:
  //   { datas: { 'YYYY-MM-DD': { ativa, tipo, descricao, ... } }, observacao, classificacao }
  const datasMap = (snapshot as Record<string, unknown>).datas;
  if (datasMap && typeof datasMap === 'object' && !Array.isArray(datasMap)) {
    for (const [data, regraRaw] of Object.entries(datasMap as Record<string, unknown>)) {
      if (!data || typeof data !== 'string') continue;
      const regra = (regraRaw && typeof regraRaw === 'object') ? (regraRaw as Record<string, unknown>) : {};
      const ativa =
        regra.ativa === true ||
        regra.operacional === true ||
        regra.is_operacional === true ||
        regra.tipo === 'feriado_ponte_operacional';
      if (!ativa) continue;
      // Preserva metadados originais da regra (tipo, descricao, classificacao,
      // justificativa, ...) para uso futuro em relatório/PDF/auditoria.
      result[data] = {
        ...(regra as object),
        ativa: true,
      } as RegraOperacionalPorData;
    }
    return result;
  }

  // Fallback legado: array, ou objeto cujos values trazem `data`/`date`.
  const arr = Array.isArray(snapshot)
    ? snapshot
    : Object.values(snapshot as Record<string, unknown>);
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const data = (obj.data as string) || (obj.date as string);
    if (!data || typeof data !== 'string') continue;
    const ativa =
      obj.ativa === true ||
      obj.operacional === true ||
      obj.is_operacional === true;
    if (ativa) {
      result[data] = { ...(obj as object), ativa: true } as RegraOperacionalPorData;
    }
  }
  return result;
}

export function calcularEstimativaPorConvocadosPre(params: {
  solicitacao: Pick<
    DiariaSolicitacao,
    'id' | 'numero_solicitacao' | 'considera_fds_feriado' | 'tipo_solicitacao'
  > & { regras_operacionais_snapshot?: unknown };
  convocadosPre: FuncionarioPreConvocado[];
  datasClassificadas: DataClassificada[];
  tipoSolicitacao?: 'normal' | 'extraordinaria';
}): ResumoEstimativa {
  const { solicitacao, convocadosPre, datasClassificadas } = params;
  const consideraFdsFeriado = !!solicitacao.considera_fds_feriado;

  // 1) Resolve dias_solicitados item-a-item via fallback centralizado.
  //    Itens novos preservam a regra Fase F; itens legados caem no período.
  const diasPorFuncionario: Record<string, string[]> = {};
  let fallbackLegado = false;
  let legadoCount = 0;

  for (const conv of convocadosPre) {
    const resolucao = resolverDiasSolicitadosItem(
      { funcionario_id: conv.funcionario_id, dias_solicitados: (conv as any).dias_solicitados },
      { datasClassificadas, consideraFdsFeriado },
    );
    diasPorFuncionario[conv.funcionario_id] = resolucao.dias;
    if (resolucao.origem === 'legado_periodo') {
      fallbackLegado = true;
      legadoCount += 1;
    }
  }

  if (fallbackLegado) {
    // eslint-disable-next-line no-console
    console.warn('[DIARIA][FALLBACK_DIAS_SOLICITADOS]', {
      solicitacao_id: solicitacao.id,
      numero_solicitacao: solicitacao.numero_solicitacao,
      total_convocados: convocadosPre.length,
      total_legado: legadoCount,
    });
  }

  // 3) Regras operacionais (best-effort, sem efeito se snapshot ausente).
  const regrasOperacionaisPorData = extrairRegrasOperacionais(
    solicitacao.regras_operacionais_snapshot,
  );

  // 4) Mapeia convocados para o tipo aceito pela função pura da Fase C.
  const matrizConvocados: FuncionarioMatriz[] = convocadosPre.map((c) => ({
    funcionario_id: c.funcionario_id,
    nome_funcionario: c.nome_funcionario,
    valor_diaria: c.valor_diaria,
    valor_diaria_exclusiva: c.valor_diaria_exclusiva,
    valor_refeicao: c.valor_refeicao,
    matricula: c.matricula,
    usar_diaria_exclusiva: (c as any).usar_diaria_exclusiva === true,
  })) as FuncionarioMatriz[];

  const sim = calcularEstimativaPorMatriz({
    convocadosPre: matrizConvocados,
    diasPorFuncionario,
    datasClassificadas,
    regrasOperacionaisPorData,
    tipoSolicitacao:
      params.tipoSolicitacao ??
      (solicitacao.tipo_solicitacao as 'normal' | 'extraordinaria') ??
      'normal',
  });

  return {
    total_diarias_uteis: sim.totalDiasUteisESabados,
    total_diarias_fds_feriados: sim.totalDomFeriados,
    total_refeicoes: sim.totalRefeicoes,
    total_geral: sim.totalEstimado,
    ocorrencias_uteis: sim.diasNormaisCount,
    ocorrencias_exclusivos: sim.diasExclusivosCount,
    quantidade_pares_refeicao: sim.diasRefeicaoCount,
    breakdown_por_data: sim.porData,
    breakdown_por_funcionario: sim.detalhePorFuncionario,
    fallback_legado: fallbackLegado,
  };
}
