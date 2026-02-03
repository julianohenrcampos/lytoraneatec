/**
 * Utilitários para análise de período de diárias
 * Calcula dias úteis, finais de semana e feriados
 */

import { addDays, differenceInDays, isWeekend, parseISO, format } from 'date-fns';

export type TipoDia = 'util' | 'fds' | 'feriado';

export interface DataClassificada {
  data: string; // YYYY-MM-DD
  tipo: TipoDia;
  nome?: string; // Nome do feriado, se aplicável
}

export interface PeriodoAnalise {
  totalDias: number;
  diasUteis: number;
  finaisDeSemana: number;
  feriados: number;
  diasParaCalculo: number; // Baseado no toggle considera_fds_feriado
  datasClassificadas: DataClassificada[];
}

export interface FuncionarioParaCalculo {
  funcionario_id: string;
  valor_diaria: number;
  valor_diaria_exclusiva?: number;
  nome_funcionario?: string;
  nome_funcao?: string;
}

export interface SimulacaoValores {
  totalDiasUteis: number;
  totalFdsFeriados: number;
  totalEstimado: number;
  detalhePorFuncionario: {
    funcionario_id: string;
    nome: string;
    valorDiasUteis: number;
    valorFdsFeriados: number;
    valorTotal: number;
  }[];
}

/**
 * Gera todas as datas entre data início e data fim
 */
export function gerarDatasNoPeriodo(dataInicio: string, dataFim: string): string[] {
  const inicio = parseISO(dataInicio);
  const fim = parseISO(dataFim);
  const dias: string[] = [];
  
  let atual = inicio;
  while (atual <= fim) {
    dias.push(format(atual, 'yyyy-MM-dd'));
    atual = addDays(atual, 1);
  }
  
  return dias;
}

/**
 * Classifica cada data do período como dia útil, final de semana ou feriado
 */
export function analisarPeriodo(
  dataInicio: string,
  dataFim: string,
  feriados: { data: string; nome: string }[] = [],
  considerarFdsFeriado: boolean = false
): PeriodoAnalise {
  if (!dataInicio || !dataFim) {
    return {
      totalDias: 0,
      diasUteis: 0,
      finaisDeSemana: 0,
      feriados: 0,
      diasParaCalculo: 0,
      datasClassificadas: []
    };
  }

  const datas = gerarDatasNoPeriodo(dataInicio, dataFim);
  const feriadosSet = new Map(feriados.map(f => [f.data, f.nome]));
  
  const datasClassificadas: DataClassificada[] = datas.map(dataStr => {
    const dataObj = parseISO(dataStr);
    
    // Verifica se é feriado primeiro
    if (feriadosSet.has(dataStr)) {
      return { 
        data: dataStr, 
        tipo: 'feriado' as TipoDia, 
        nome: feriadosSet.get(dataStr) 
      };
    }
    
    // Verifica se é final de semana
    if (isWeekend(dataObj)) {
      return { data: dataStr, tipo: 'fds' as TipoDia };
    }
    
    // É dia útil
    return { data: dataStr, tipo: 'util' as TipoDia };
  });

  const diasUteis = datasClassificadas.filter(d => d.tipo === 'util').length;
  const finaisDeSemana = datasClassificadas.filter(d => d.tipo === 'fds').length;
  const feriadosCount = datasClassificadas.filter(d => d.tipo === 'feriado').length;
  
  // Dias para cálculo: se toggle ativo, todos os dias; senão, apenas dias úteis
  const diasParaCalculo = considerarFdsFeriado 
    ? datas.length 
    : diasUteis;

  return {
    totalDias: datas.length,
    diasUteis,
    finaisDeSemana,
    feriados: feriadosCount,
    diasParaCalculo,
    datasClassificadas
  };
}

/**
 * Calcula a estimativa total de valores para o período
 */
export function calcularEstimativaTotal(
  funcionarios: FuncionarioParaCalculo[],
  analise: PeriodoAnalise,
  considerarFdsFeriado: boolean
): SimulacaoValores {
  const detalhePorFuncionario = funcionarios.map(func => {
    const valorDiaria = func.valor_diaria || 0;
    const valorDiariaExclusiva = func.valor_diaria_exclusiva || valorDiaria * 1.2; // Default: 20% extra
    
    // Dias úteis sempre contam
    const valorDiasUteis = analise.diasUteis * valorDiaria;
    
    // FDS/Feriados só contam se toggle ativo
    const diasFdsFeriado = analise.finaisDeSemana + analise.feriados;
    const valorFdsFeriados = considerarFdsFeriado 
      ? diasFdsFeriado * valorDiariaExclusiva 
      : 0;
    
    return {
      funcionario_id: func.funcionario_id,
      nome: func.nome_funcionario || '',
      valorDiasUteis,
      valorFdsFeriados,
      valorTotal: valorDiasUteis + valorFdsFeriados
    };
  });

  return {
    totalDiasUteis: detalhePorFuncionario.reduce((sum, f) => sum + f.valorDiasUteis, 0),
    totalFdsFeriados: detalhePorFuncionario.reduce((sum, f) => sum + f.valorFdsFeriados, 0),
    totalEstimado: detalhePorFuncionario.reduce((sum, f) => sum + f.valorTotal, 0),
    detalhePorFuncionario
  };
}

/**
 * Valida o período selecionado
 */
export function validarPeriodo(
  dataInicio: string,
  dataFim: string,
  maxDias: number = 30
): { valido: boolean; erro?: string } {
  if (!dataInicio || !dataFim) {
    return { valido: false, erro: 'Selecione as datas de início e fim' };
  }

  const inicio = parseISO(dataInicio);
  const fim = parseISO(dataFim);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  if (inicio < hoje) {
    return { valido: false, erro: 'Data de início não pode ser anterior a hoje' };
  }

  if (fim < inicio) {
    return { valido: false, erro: 'Data fim deve ser igual ou posterior à data início' };
  }

  const dias = differenceInDays(fim, inicio) + 1;
  if (dias > maxDias) {
    return { valido: false, erro: `Período máximo é de ${maxDias} dias` };
  }

  return { valido: true };
}

/**
 * Formata um número como moeda BRL
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}
