/**
 * Estimativa por matriz funcionário × data (Fase B/C).
 *
 * Substitui o cálculo agregado por período. Cada par funcionário × data
 * marcado em `diasPorFuncionario` é avaliado individualmente:
 *  - dia útil normal: usa valor_diaria (ou exclusiva, se usar_diaria_exclusiva).
 *    Aplica regra de Remessa por data.
 *  - sábado/domingo/feriado/dia operacional (laranja): usa valor_diaria_exclusiva
 *    (fallback valor_diaria * 1.2).
 *  - se o valor de diária resolvido for 0, NÃO gera diária e NÃO gera refeição.
 *  - refeição é paga apenas nos dias em que houve diária para o funcionário.
 *
 * Sem média histórica de FDS, sem agregação por período inteiro.
 */

import type {
  DataClassificada,
  SimulacaoValores,
  FuncionarioParaCalculo,
  ContextoDia,
} from './diariasPeriodoUtils';
import { podeParticiparDiaUtil } from './diariasPeriodoUtils';

export type FuncionarioMatriz = FuncionarioParaCalculo & {
  usar_diaria_exclusiva?: boolean;
};

export interface RegraOperacionalPorData {
  /** true quando há regra ativa (local ou global) marcando o dia como operacional/laranja. */
  ativa: boolean;
}

export interface DetalheParPorData {
  data: string;
  funcionario_id: string;
  classificacao: 'util' | 'sabado' | 'fds' | 'feriado' | 'operacional';
  bucket: 'normal' | 'exclusiva';
  valorDiaria: number;
  valorRefeicao: number;
  bloqueadoRemessa?: boolean;
}

export type SimulacaoPorMatriz = SimulacaoValores & {
  /** Quantidade de pares funcionário×data que entraram em "diária normal". */
  diasNormaisCount: number;
  /** Quantidade de pares funcionário×data que entraram em "diária exclusiva" (sáb/dom/feriado/operacional). */
  diasExclusivosCount: number;
  /** Quantidade de pares que pagam refeição (sempre = pares que pagaram diária). */
  diasRefeicaoCount: number;
  detalhePares: DetalheParPorData[];
  /** Soma por data (todos os funcionários marcados naquela data). */
  porData: Array<{
    data: string;
    classificacao: 'util' | 'sabado' | 'fds' | 'feriado' | 'operacional';
    funcionariosCount: number;
    valorDiarias: number;
    valorRefeicoes: number;
    valorTotal: number;
  }>;
};

interface ParamsCalcular {
  convocadosPre: FuncionarioMatriz[];
  diasPorFuncionario: Record<string, string[]>;
  datasClassificadas: DataClassificada[];
  regrasOperacionaisPorData?: Record<string, RegraOperacionalPorData>;
  tipoSolicitacao?: 'normal' | 'extraordinaria';
}

export function calcularEstimativaPorMatriz({
  convocadosPre,
  diasPorFuncionario,
  datasClassificadas,
  regrasOperacionaisPorData = {},
  tipoSolicitacao = 'normal',
}: ParamsCalcular): SimulacaoPorMatriz {
  const classifMap = new Map(datasClassificadas.map((d) => [d.data, d.tipo]));

  const detalhePorFuncionario: SimulacaoValores['detalhePorFuncionario'] = [];
  const detalhePares: DetalheParPorData[] = [];
  const porDataMap = new Map<string, {
    data: string;
    classificacao: DetalheParPorData['classificacao'];
    funcionariosCount: number;
    valorDiarias: number;
    valorRefeicoes: number;
    valorTotal: number;
  }>();

  let diasNormaisCount = 0;
  let diasExclusivosCount = 0;
  let diasRefeicaoCount = 0;

  for (const conv of convocadosPre) {
    const dias = diasPorFuncionario[conv.funcionario_id] ?? [];
    const valorDiaria = conv.valor_diaria || 0;
    const valorDiariaExclusiva = conv.valor_diaria_exclusiva || (valorDiaria > 0 ? valorDiaria * 1.2 : 0);
    const valorRefeicao = conv.valor_refeicao || 0;
    const temMatricula = !!conv.matricula;
    const forcarExclusiva = conv.usar_diaria_exclusiva === true;

    let valorDiasUteisESabados = 0;
    let valorDomFeriados = 0;
    let valorRefeicoes = 0;
    let remessaBloqueado = false;

    for (const data of dias) {
      const tipoBase = classifMap.get(data) ?? 'util';
      const isOperacional = !!regrasOperacionaisPorData[data]?.ativa;

      // Classificação efetiva da data para o cálculo.
      const classifEfetiva: DetalheParPorData['classificacao'] = isOperacional
        ? 'operacional'
        : tipoBase;

      const isExclusivaPorData =
        classifEfetiva === 'sabado' ||
        classifEfetiva === 'fds' ||
        classifEfetiva === 'feriado' ||
        classifEfetiva === 'operacional';

      let valorDiariaPar = 0;
      let bucket: 'normal' | 'exclusiva' = 'normal';

      if (isExclusivaPorData) {
        valorDiariaPar = valorDiariaExclusiva;
        bucket = 'exclusiva';
      } else {
        // Dia útil normal — aplicar regra de remessa.
        const contexto: ContextoDia = {
          isFeriado: false,
          isFerias: forcarExclusiva,
          tipoSolicitacao,
        };
        if (!podeParticiparDiaUtil(temMatricula, contexto)) {
          remessaBloqueado = true;
          continue; // não gera diária nem refeição
        }
        if (forcarExclusiva) {
          valorDiariaPar = valorDiariaExclusiva;
          bucket = 'exclusiva';
        } else {
          valorDiariaPar = valorDiaria;
          bucket = 'normal';
        }
      }

      if (valorDiariaPar <= 0) {
        // Sem diária ⇒ sem refeição.
        detalhePares.push({
          data,
          funcionario_id: conv.funcionario_id,
          classificacao: classifEfetiva,
          bucket,
          valorDiaria: 0,
          valorRefeicao: 0,
        });
        continue;
      }

      // Soma no funcionário.
      if (bucket === 'normal') {
        valorDiasUteisESabados += valorDiariaPar;
        diasNormaisCount += 1;
      } else {
        valorDomFeriados += valorDiariaPar;
        diasExclusivosCount += 1;
      }
      valorRefeicoes += valorRefeicao;
      if (valorRefeicao > 0) diasRefeicaoCount += 1;

      detalhePares.push({
        data,
        funcionario_id: conv.funcionario_id,
        classificacao: classifEfetiva,
        bucket,
        valorDiaria: valorDiariaPar,
        valorRefeicao: valorRefeicao,
      });

      const agg = porDataMap.get(data) ?? {
        data,
        classificacao: classifEfetiva,
        funcionariosCount: 0,
        valorDiarias: 0,
        valorRefeicoes: 0,
        valorTotal: 0,
      };
      agg.funcionariosCount += 1;
      agg.valorDiarias += valorDiariaPar;
      agg.valorRefeicoes += valorRefeicao;
      agg.valorTotal += valorDiariaPar + valorRefeicao;
      porDataMap.set(data, agg);
    }

    detalhePorFuncionario.push({
      funcionario_id: conv.funcionario_id,
      nome: conv.nome_funcionario || '',
      valorDiasUteisESabados,
      valorDomFeriados,
      valorRefeicoes,
      valorTotal: valorDiasUteisESabados + valorDomFeriados + valorRefeicoes,
      remessaBloqueado,
    });
  }

  const totalDiasUteisESabados = detalhePorFuncionario.reduce((s, f) => s + f.valorDiasUteisESabados, 0);
  const totalDomFeriados = detalhePorFuncionario.reduce((s, f) => s + f.valorDomFeriados, 0);
  const totalRefeicoes = detalhePorFuncionario.reduce((s, f) => s + f.valorRefeicoes, 0);
  const totalEstimado = totalDiasUteisESabados + totalDomFeriados + totalRefeicoes;

  const porData = Array.from(porDataMap.values()).sort((a, b) => a.data.localeCompare(b.data));

  return {
    totalDiasUteisESabados,
    totalDomFeriados,
    totalRefeicoes,
    totalEstimado,
    totalDiasUteis: totalDiasUteisESabados,
    totalFdsFeriados: totalDomFeriados,
    detalhePorFuncionario,
    diasNormaisCount,
    diasExclusivosCount,
    diasRefeicaoCount,
    detalhePares,
    porData,
  };
}
