// =====================================================
// HOOK: ESTIMATIVAS DA LISTAGEM DE SOLICITAÇÕES (Fase I.4)
// =====================================================
// Calcula o Valor Estimado de cada solicitação visível na listagem
// usando a mesma função oficial do Modal Detalhes / PDF
// (`calcularEstimativaPorConvocadosPre`).
//
// Faz UMA ÚNICA query de feriados para a janela completa (menor
// data_inicio → maior data_fim) e reaproveita em todas as linhas.
// Não usa `bd_diaria_solicitacoes.valor_estimado_total` persistido.
// =====================================================

import { useMemo } from 'react';
import { useFeriadosPeriodo } from '@/hooks/diarias/useFeriados';
import { analisarPeriodo } from '@/utils/diariasPeriodoUtils';
import { calcularEstimativaPorConvocadosPre } from '@/utils/diariasEstimativaPorConvocadosPre';
import type { DiariaSolicitacao, FuncionarioPreConvocado } from '@/types/diarias';

export function useEstimativasListagem(
  solicitacoes: DiariaSolicitacao[],
): Map<string, number> {
  const { minInicio, maxFim } = useMemo(() => {
    if (!solicitacoes.length) {
      return { minInicio: undefined as string | undefined, maxFim: undefined as string | undefined };
    }
    let mi = solicitacoes[0].data_inicio;
    let ma = solicitacoes[0].data_fim;
    for (const s of solicitacoes) {
      if (s.data_inicio && s.data_inicio < mi) mi = s.data_inicio;
      if (s.data_fim && s.data_fim > ma) ma = s.data_fim;
    }
    return { minInicio: mi, maxFim: ma };
  }, [solicitacoes]);

  const { data: feriados = [] } = useFeriadosPeriodo(minInicio, maxFim);

  return useMemo(() => {
    const map = new Map<string, number>();
    if (!solicitacoes.length) return map;
    const feriadosFormatados = feriados.map((f) => ({ data: f.data, nome: f.nome }));

    for (const sol of solicitacoes) {
      try {
        const convocadosPre = Array.isArray((sol as any).convocados_pre)
          ? ((sol as any).convocados_pre as FuncionarioPreConvocado[])
          : [];
        if (!convocadosPre.length) continue;

        const analise = analisarPeriodo(
          sol.data_inicio,
          sol.data_fim,
          feriadosFormatados,
          !!sol.considera_fds_feriado,
        );
        const est = calcularEstimativaPorConvocadosPre({
          solicitacao: sol,
          convocadosPre,
          datasClassificadas: analise.datasClassificadas,
        });
        map.set(sol.id, est.total_geral);
      } catch (e) {
        // Silencioso — listagem cai no fallback do consumidor
        // (sol.valor_estimado_total) quando o cálculo falha.
        if (import.meta.env.DEV) {
          console.warn('[useEstimativasListagem] falha ao calcular', sol.id, e);
        }
      }
    }
    return map;
  }, [solicitacoes, feriados]);
}
