/**
 * Utilitários para análise de período de diárias
 * Calcula dias úteis, sábados, domingos e feriados
 * 
 * Regra de negócio:
 * - Sábado: é FDS visualmente, mas paga Diária Normal (valor_diaria)
 * - Domingo e Feriado: pagam Diária Exclusiva (valor_diaria_exclusiva)
 */

import { addDays, differenceInDays, parseISO, format } from 'date-fns';

export type TipoDia = 'util' | 'sabado' | 'fds' | 'feriado';

export interface DataClassificada {
  data: string; // YYYY-MM-DD
  tipo: TipoDia;
  nome?: string; // Nome do feriado, se aplicável
}

export interface PeriodoAnalise {
  totalDias: number;
  diasUteis: number;       // Seg-Sex
  sabados: number;         // Sábados (paga diária normal)
  domingos: number;        // Domingos (paga diária exclusiva)
  feriados: number;        // Feriados (paga diária exclusiva)
  /** @deprecated Use sabados + domingos. Mantido para compatibilidade */
  finaisDeSemana: number;  
  diasParaCalculo: number;
  datasClassificadas: DataClassificada[];
}

export interface FuncionarioParaCalculo {
  funcionario_id: string;
  valor_diaria: number;
  valor_diaria_exclusiva?: number;
  valor_refeicao?: number;
  nome_funcionario?: string;
  nome_funcao?: string;
}

export interface SimulacaoValores {
  totalDiasUteisESabados: number;   // Valor diária normal (úteis + sábados)
  totalDomFeriados: number;          // Valor diária exclusiva (dom + feriados)
  totalRefeicoes: number;
  totalEstimado: number;
  /** @deprecated Use totalDiasUteisESabados */
  totalDiasUteis: number;
  /** @deprecated Use totalDomFeriados */
  totalFdsFeriados: number;
  detalhePorFuncionario: {
    funcionario_id: string;
    nome: string;
    valorDiasUteisESabados: number;
    valorDomFeriados: number;
    valorRefeicoes: number;
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
 * Classifica cada data do período como dia útil, sábado, domingo (fds) ou feriado
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
      sabados: 0,
      domingos: 0,
      feriados: 0,
      finaisDeSemana: 0,
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
    
    const diaSemana = dataObj.getDay();
    
    // Sábado: FDS visualmente, mas paga diária normal
    if (diaSemana === 6) {
      return { data: dataStr, tipo: 'sabado' as TipoDia };
    }
    
    // Domingo: paga diária exclusiva
    if (diaSemana === 0) {
      return { data: dataStr, tipo: 'fds' as TipoDia };
    }
    
    // É dia útil (seg-sex)
    return { data: dataStr, tipo: 'util' as TipoDia };
  });

  const diasUteis = datasClassificadas.filter(d => d.tipo === 'util').length;
  const sabados = datasClassificadas.filter(d => d.tipo === 'sabado').length;
  const domingos = datasClassificadas.filter(d => d.tipo === 'fds').length;
  const feriadosCount = datasClassificadas.filter(d => d.tipo === 'feriado').length;
  
  // finaisDeSemana para compatibilidade = sabados + domingos
  const finaisDeSemana = sabados + domingos;
  
  // Dias para cálculo: se toggle ativo, todos os dias; senão, apenas dias úteis + sábados
  const diasParaCalculo = considerarFdsFeriado 
    ? datas.length 
    : diasUteis + sabados;

  return {
    totalDias: datas.length,
    diasUteis,
    sabados,
    domingos,
    feriados: feriadosCount,
    finaisDeSemana,
    diasParaCalculo,
    datasClassificadas
  };
}

/**
 * Calcula a estimativa total de valores para o período
 * 
 * Dias úteis (seg-sex): valor_diaria (normal)
 * Sábados + Domingos + Feriados: valor_diaria_exclusiva
 */
export function calcularEstimativaTotal(
  funcionarios: FuncionarioParaCalculo[],
  analise: PeriodoAnalise,
  considerarFdsFeriado: boolean
): SimulacaoValores {
  const detalhePorFuncionario = funcionarios.map(func => {
    const valorDiaria = func.valor_diaria || 0;
    const valorDiariaExclusiva = func.valor_diaria_exclusiva || valorDiaria * 1.2;
    const valorRefeicao = func.valor_refeicao || 0;
    
    // Se usar_diaria_exclusiva === true, TODOS os dias usam diária exclusiva
    const forcarExclusiva = (func as any).usar_diaria_exclusiva === true;
    
    const diasNormais = analise.diasUteis; // apenas dias úteis pagam diária normal
    const diasExclusivos = analise.sabados + analise.domingos + analise.feriados; // sábados, domingos e feriados pagam exclusiva
    
    let valorDiasUteisESabados: number;
    let valorDomFeriados: number;
    let diasParaRefeicao: number;
    
    if (forcarExclusiva) {
      // Todos os dias com valor exclusiva
      const totalDias = considerarFdsFeriado 
        ? diasNormais + diasExclusivos 
        : diasNormais;
      valorDiasUteisESabados = 0;
      valorDomFeriados = totalDias * valorDiariaExclusiva;
      diasParaRefeicao = totalDias;
    } else {
      // Comportamento padrão
      valorDiasUteisESabados = diasNormais * valorDiaria;
      valorDomFeriados = considerarFdsFeriado 
        ? diasExclusivos * valorDiariaExclusiva 
        : 0;
      diasParaRefeicao = considerarFdsFeriado
        ? diasNormais + diasExclusivos
        : diasNormais;
    }
    
    const valorRefeicoes = diasParaRefeicao * valorRefeicao;
    
    return {
      funcionario_id: func.funcionario_id,
      nome: func.nome_funcionario || '',
      valorDiasUteisESabados,
      valorDomFeriados,
      valorRefeicoes,
      valorTotal: valorDiasUteisESabados + valorDomFeriados + valorRefeicoes
    };
  });

  const totalDiasUteisESabados = detalhePorFuncionario.reduce((sum, f) => sum + f.valorDiasUteisESabados, 0);
  const totalDomFeriados = detalhePorFuncionario.reduce((sum, f) => sum + f.valorDomFeriados, 0);

  return {
    totalDiasUteisESabados,
    totalDomFeriados,
    totalRefeicoes: detalhePorFuncionario.reduce((sum, f) => sum + f.valorRefeicoes, 0),
    totalEstimado: detalhePorFuncionario.reduce((sum, f) => sum + f.valorTotal, 0),
    // Deprecated aliases
    totalDiasUteis: totalDiasUteisESabados,
    totalFdsFeriados: totalDomFeriados,
    detalhePorFuncionario
  };
}

/**
 * Valida o período selecionado
 */
export function validarPeriodo(
  dataInicio: string,
  dataFim: string,
  maxDias: number = 30,
  isSuperAdmin: boolean = false
): { valido: boolean; erro?: string; isRetroativo?: boolean } {
  if (!dataInicio || !dataFim) {
    return { valido: false, erro: 'Selecione as datas de início e fim' };
  }

  const inicio = parseISO(dataInicio);
  const fim = parseISO(dataFim);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const isRetroativo = inicio < hoje;

  if (isRetroativo && !isSuperAdmin) {
    return { valido: false, erro: 'Data de início não pode ser anterior a hoje' };
  }

  if (fim < inicio) {
    return { valido: false, erro: 'Data fim deve ser igual ou posterior à data início' };
  }

  const dias = differenceInDays(fim, inicio) + 1;
  if (dias > maxDias) {
    return { valido: false, erro: `Período máximo é de ${maxDias} dias` };
  }

  // Verificar mistura de dias úteis com FDS
  const datas = gerarDatasNoPeriodo(dataInicio, dataFim);
  let temDiaUtil = false;
  let temFds = false;
  for (const d of datas) {
    const dia = parseISO(d).getDay();
    if (dia === 0 || dia === 6) temFds = true;
    else temDiaUtil = true;
  }
  if (temDiaUtil && temFds) {
    return { 
      valido: false, 
      erro: 'O período não pode misturar dias de semana com finais de semana. Crie solicitações separadas.' 
    };
  }

  return { valido: true, isRetroativo };
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

/**
 * Arredonda valor financeiro para cima (Math.ceil).
 * Regra de negócio: qualquer fração de centavo é arredondada para cima.
 */
export function roundUp(value: number): number {
  return Math.ceil(value);
}

/**
 * Calcula labels de ranges de datas para D.S (seg-sáb, exceto feriado) e F.S (dom + feriado)
 * Ex: { dsLabel: "09 à 13/03", fsLabel: "14 à 15/03" }
 */
export function calcularRangesDSFS(
  dataInicio: string,
  dataFim: string,
  feriados: string[] = []
): { dsLabel: string; fsLabel: string } {
  if (!dataInicio || !dataFim) return { dsLabel: '-', fsLabel: '-' };

  const datas = gerarDatasNoPeriodo(dataInicio, dataFim);
  const feriadosSet = new Set(feriados.map(f => f.substring(0, 10)));

  const dsDates: string[] = [];
  const fsDates: string[] = [];

  datas.forEach(d => {
    const obj = parseISO(d);
    const day = obj.getDay();
    if (feriadosSet.has(d) || day === 0) {
      fsDates.push(d);
    } else {
      dsDates.push(d);
    }
  });

  return {
    dsLabel: formatDateRanges(dsDates),
    fsLabel: formatDateRanges(fsDates),
  };
}

function formatDateRanges(dates: string[]): string {
  if (dates.length === 0) return '-';

  // Sort dates
  const sorted = [...dates].sort();

  // Group contiguous dates into ranges
  const ranges: { start: string; end: string }[] = [];
  let rangeStart = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const prevDate = parseISO(prev);
    const currDate = parseISO(sorted[i]);
    const diff = differenceInDays(currDate, prevDate);

    if (diff === 1) {
      prev = sorted[i];
    } else {
      ranges.push({ start: rangeStart, end: prev });
      rangeStart = sorted[i];
      prev = sorted[i];
    }
  }
  ranges.push({ start: rangeStart, end: prev });

  // Format each range
  return ranges.map(r => {
    const startDate = parseISO(r.start);
    const endDate = parseISO(r.end);
    const startDay = format(startDate, 'dd');
    const endDay = format(endDate, 'dd');
    const endMonth = format(endDate, 'MM');

    if (r.start === r.end) {
      return `${startDay}/${endMonth}`;
    }
    return `${startDay} à ${endDay}/${endMonth}`;
  }).join(', ');
}
