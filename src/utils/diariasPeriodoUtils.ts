/**
 * Utilitários para análise de período de diárias
 * Calcula dias úteis, sábados, domingos e feriados
 * 
 * Regra de negócio:
 * - Sábado, Domingo e Feriado: pagam Diária Exclusiva (valor_diaria_exclusiva)
 * - Dias úteis (Seg-Sex): pagam Diária Normal (valor_diaria)
 */

import { addDays, differenceInDays, parseISO, format, startOfWeek, endOfWeek } from 'date-fns';

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
  matricula?: string | null;
}

/**
 * Contexto do dia para regra de Remessa
 */
export interface ContextoDia {
  isFeriado: boolean;
  isFerias: boolean;  // usar_diaria_exclusiva
  tipoSolicitacao: 'normal' | 'extraordinaria';
}

export interface RegrasOperacionaisCalculo {
  datas?: Record<string, {
    ativa: boolean;
    descricao: string;
    exige_aprovacao_adicao?: boolean;
    tipo?: 'feriado_ponte_operacional';
  }>;
}

/**
 * Verifica se funcionário com matrícula (Remessa) pode participar de dia útil.
 * Remessa NÃO pode participar em dias úteis EXCETO se:
 * - É feriado
 * - Está de férias (D/Férias marcado)
 * - Solicitação é extraordinária
 */
export function podeParticiparDiaUtil(
  temMatricula: boolean,
  contexto: ContextoDia
): boolean {
  if (!temMatricula) return true;
  return contexto.isFeriado || contexto.isFerias || contexto.tipoSolicitacao === 'extraordinaria';
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
    remessaBloqueado?: boolean;
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
    
    // Sábado: paga diária exclusiva (mesmo tratamento de domingo/feriado)
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

export interface ResumoPeriodoSimulacao {
  diasUteis: number;
  sabados: number;
  domingos: number;
  feriados: number;
  diasOperacionais: number;
  diasExclusivos: number;
  diasParaRefeicao: number;
  datasExclusivas: string[];
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
  considerarFdsFeriado: boolean,
  tipoSolicitacao: 'normal' | 'extraordinaria' = 'normal',
  regrasOperacionais?: RegrasOperacionaisCalculo
): SimulacaoValores {
  const resumoPeriodo = resumirPeriodoParaSimulacao(analise, regrasOperacionais, considerarFdsFeriado);
  const deveCalcularExclusivosPorRegra = resumoPeriodo.diasOperacionais > 0;
  // Se período é exclusivamente FDS/feriados (sem dias úteis), calcular sempre
  const periodoExclusivoFDS = resumoPeriodo.diasUteis === 0;
  const deveCalcularExclusivos = considerarFdsFeriado || periodoExclusivoFDS || deveCalcularExclusivosPorRegra;

  const detalhePorFuncionario = funcionarios.map(func => {
    const valorDiaria = func.valor_diaria || 0;
    const valorDiariaExclusiva = func.valor_diaria_exclusiva || valorDiaria * 1.2;
    const valorRefeicao = func.valor_refeicao || 0;
    
    // Se usar_diaria_exclusiva === true, TODOS os dias usam diária exclusiva
    const forcarExclusiva = (func as any).usar_diaria_exclusiva === true;
    
    // Regra de Remessa: funcionário com matrícula não participa de dias úteis
    // exceto se: D/Férias marcado, solicitação extraordinária, ou feriado
    const temMatricula = !!func.matricula;
    const remessaBloqueadoDiasUteis = temMatricula && !forcarExclusiva && tipoSolicitacao !== 'extraordinaria';
    
    const diasNormais = remessaBloqueadoDiasUteis ? 0 : resumoPeriodo.diasUteis;
    const diasExclusivos = resumoPeriodo.diasExclusivos;
    
    let valorDiasUteisESabados: number;
    let valorDomFeriados: number;
    let diasParaRefeicao: number;
    
    if (forcarExclusiva) {
      // Todos os dias com valor exclusiva
      const totalDias = deveCalcularExclusivos 
        ? diasNormais + diasExclusivos 
        : diasNormais;
      valorDiasUteisESabados = 0;
      valorDomFeriados = totalDias * valorDiariaExclusiva;
      diasParaRefeicao = totalDias;
    } else {
      // Comportamento padrão
      valorDiasUteisESabados = diasNormais * valorDiaria;
      valorDomFeriados = deveCalcularExclusivos 
        ? diasExclusivos * valorDiariaExclusiva 
        : 0;
      diasParaRefeicao = deveCalcularExclusivos
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
      valorTotal: valorDiasUteisESabados + valorDomFeriados + valorRefeicoes,
      remessaBloqueado: remessaBloqueadoDiasUteis
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

export function resumirPeriodoParaSimulacao(
  analise: PeriodoAnalise,
  regrasOperacionais?: RegrasOperacionaisCalculo,
  considerarFdsFeriado: boolean = false
): ResumoPeriodoSimulacao {
  const datasOperacionais = new Set(
    Object.entries(regrasOperacionais?.datas ?? {})
      .filter(([, regra]) => regra?.ativa)
      .map(([data]) => data)
  );

  const datasExclusivas = new Set<string>();
  let sabados = 0;
  let domingos = 0;
  let feriados = 0;
  let diasOperacionais = 0;

  analise.datasClassificadas.forEach(({ data, tipo }) => {
    const operacional = datasOperacionais.has(data);

    if (operacional) {
      diasOperacionais += 1;
      datasExclusivas.add(data);
      return;
    }

    if (tipo === 'sabado') {
      sabados += 1;
      datasExclusivas.add(data);
      return;
    }

    if (tipo === 'fds') {
      domingos += 1;
      datasExclusivas.add(data);
      return;
    }

    if (tipo === 'feriado') {
      feriados += 1;
      datasExclusivas.add(data);
    }
  });

  const diasExclusivos = datasExclusivas.size;
  const diasUteis = Math.max(analise.totalDias - diasExclusivos, 0);
  const diasParaRefeicao = (considerarFdsFeriado || diasExclusivos > 0 || diasUteis === 0)
    ? diasUteis + diasExclusivos
    : diasUteis;

  return {
    diasUteis,
    sabados,
    domingos,
    feriados,
    diasOperacionais,
    diasExclusivos,
    diasParaRefeicao,
    datasExclusivas: Array.from(datasExclusivas).sort(),
  };
}

/**
 * Valida o período selecionado.
 * Regra fixa: período DEVE ser de segunda a domingo (7 dias exatos).
 * Não-SuperAdm não pode usar semana anterior à atual.
 */
export function validarPeriodo(
  dataInicio: string,
  dataFim: string,
  maxDias: number = 30,
  isSuperAdmin: boolean = false,
  isEditing: boolean = false
): { valido: boolean; erro?: string; isRetroativo?: boolean } {
  if (!dataInicio || !dataFim) {
    return { valido: false, erro: 'Selecione as datas de início e fim' };
  }

  const inicio = parseISO(dataInicio);
  const fim = parseISO(dataFim);

  if (fim < inicio) {
    return { valido: false, erro: 'Data fim deve ser igual ou posterior à data início' };
  }

  // Regra estrutural: Segunda → Domingo, exatamente 7 dias
  // getDay(): 0=Dom, 1=Seg ... 6=Sáb
  if (inicio.getDay() !== 1) {
    return { valido: false, erro: 'Data de início deve ser uma segunda-feira' };
  }
  if (fim.getDay() !== 0) {
    return { valido: false, erro: 'Data de fim deve ser o domingo da mesma semana' };
  }
  if (differenceInDays(fim, inicio) !== 6) {
    return { valido: false, erro: 'Período deve ser exatamente Seg→Dom (7 dias)' };
  }

  const dias = differenceInDays(fim, inicio) + 1;
  if (dias > maxDias) {
    return { valido: false, erro: `Período máximo é de ${maxDias} dias` };
  }

  // Retroativo: comparar contra a segunda-feira da semana atual
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const inicioSemanaAtual = startOfWeek(hoje, { weekStartsOn: 1 });
  const isRetroativo = inicio < inicioSemanaAtual;

  if (isRetroativo && !isSuperAdmin) {
    return {
      valido: false,
      erro: 'Não é permitido criar/editar solicitação fora da semana atual',
      isRetroativo,
    };
  }

  return { valido: true, isRetroativo };
}

/**
 * Validação estrutural usada no service (defesa em profundidade).
 * Lança Error se o período não for Seg→Dom de 7 dias exatos.
 * NÃO valida retroativo (essa parte depende do papel do usuário).
 */
export function assertPeriodoValidoOuFalhar(
  dataInicio: string,
  dataFim: string
): void {
  if (!dataInicio || !dataFim) {
    throw new Error('PERIODO_INVALIDO: Datas de início e fim são obrigatórias');
  }
  const inicio = parseISO(dataInicio);
  const fim = parseISO(dataFim);
  if (inicio.getDay() !== 1) {
    throw new Error('PERIODO_INVALIDO: data_inicio deve ser segunda-feira');
  }
  if (fim.getDay() !== 0) {
    throw new Error('PERIODO_INVALIDO: data_fim deve ser domingo');
  }
  if (differenceInDays(fim, inicio) !== 6) {
    throw new Error('PERIODO_INVALIDO: período deve ser exatamente Seg→Dom (7 dias)');
  }
}

/**
 * Verifica se uma data ISO (YYYY-MM-DD) é anterior a hoje (data local).
 * Usa parseISO + comparação a hoje@00:00 local — sem toISOString/UTC.
 */
export function isAnteriorAHoje(dataISO?: string | null): boolean {
  if (!dataISO) return false;
  const inicio = parseISO(dataISO);
  inicio.setHours(0, 0, 0, 0);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return inicio.getTime() < hoje.getTime();
}

/**
 * Verifica se um período é retroativo.
 * Definição oficial: data_inicio < hoje (data local).
 */
export function isPeriodoRetroativo(dataInicio: string): boolean {
  return isAnteriorAHoje(dataInicio);
}

/**
 * Calcula a janela operacional Seg→Dom (datas REAIS) para uma data de referência.
 * Sempre retorna a segunda-feira e o domingo reais da semana, mesmo que
 * `dataReferencia` seja terça/quarta/etc.
 *
 * Usada para preencher `data_inicio_semana` / `data_fim_semana` na solicitação,
 * que são as chaves de unicidade da Solicitação Normal por CC/semana.
 */
export function calcularJanelaSemanal(
  dataReferencia: string
): { data_inicio_semana: string; data_fim_semana: string } {
  const ref = parseISO(dataReferencia);
  const seg = startOfWeek(ref, { weekStartsOn: 1 });
  const dom = endOfWeek(ref, { weekStartsOn: 1 });
  return {
    data_inicio_semana: format(seg, 'yyyy-MM-dd'),
    data_fim_semana: format(dom, 'yyyy-MM-dd'),
  };
}

/**
 * Primeira data válida para iniciar uma Solicitação Normal.
 *
 * - SuperAdm: hoje (data local). SuperAdm pode escolher livremente datas
 *   anteriores via UI; o default do form não deve pré-preencher retroativo.
 * - Usuário comum: max(hoje, segunda-feira da semana corrente).
 */
export function primeiraDataValidaNormal(
  hoje: Date = new Date(),
  isSuperAdmin: boolean = false
): Date {
  const base = new Date(hoje);
  base.setHours(0, 0, 0, 0);
  if (isSuperAdmin) return base;
  const segunda = startOfWeek(base, { weekStartsOn: 1 });
  return base > segunda ? base : segunda;
}

/**
 * Validação para Solicitação Normal (frontend + service).
 * Regras:
 * - data_fim deve ser o domingo da MESMA semana operacional de data_inicio.
 * - data_inicio deve ser >= primeiraDataValidaNormal (bloqueia retroativo intra-semana
 *   para usuário comum).
 * - data_inicio e data_fim devem estar na mesma semana operacional (Seg→Dom).
 *
 * Erros tipados (lançados como Error.message com prefixo identificador):
 *   - PERIODO_RETROATIVO_INTRASEMANA
 *   - PERIODO_FORA_SEMANA_OPERACIONAL
 */
export interface ValidacaoNormalResult {
  valido: boolean;
  erro?: string;
  codigo?: 'PERIODO_RETROATIVO_INTRASEMANA' | 'PERIODO_FORA_SEMANA_OPERACIONAL' | 'PERIODO_INVALIDO';
}

export function validarPeriodoNormal(
  dataInicio: string,
  dataFim: string,
  isSuperAdmin: boolean = false,
  isEditing: boolean = false
): ValidacaoNormalResult {
  if (!dataInicio || !dataFim) {
    return { valido: false, erro: 'Selecione as datas de início e fim', codigo: 'PERIODO_INVALIDO' };
  }

  const inicio = parseISO(dataInicio);
  const fim = parseISO(dataFim);

  if (fim < inicio) {
    return { valido: false, erro: 'Data fim deve ser igual ou posterior à data início', codigo: 'PERIODO_INVALIDO' };
  }

  // Mesma semana operacional (Seg→Dom)
  const segInicio = startOfWeek(inicio, { weekStartsOn: 1 });
  const segFim = startOfWeek(fim, { weekStartsOn: 1 });
  if (segInicio.getTime() !== segFim.getTime()) {
    return {
      valido: false,
      erro: 'O período selecionado ultrapassa a semana operacional. Crie uma nova solicitação para a próxima semana.',
      codigo: 'PERIODO_FORA_SEMANA_OPERACIONAL',
    };
  }

  // data_fim deve ser o domingo da mesma semana
  const domingo = endOfWeek(inicio, { weekStartsOn: 1 });
  if (format(fim, 'yyyy-MM-dd') !== format(domingo, 'yyyy-MM-dd')) {
    return {
      valido: false,
      erro: 'Data Fim deve ser o domingo da semana operacional.',
      codigo: 'PERIODO_FORA_SEMANA_OPERACIONAL',
    };
  }

  // Edição não re-valida retroativo (período já persistido)
  if (!isEditing) {
    const minima = primeiraDataValidaNormal(new Date(), isSuperAdmin);
    // SuperAdm: retroativa é permitida no validador de período;
    // a justificativa é controlada no formulário (Step 1) e no service (defesa final).
    if (inicio < minima && !isSuperAdmin) {
      return {
        valido: false,
        erro: 'Solicitação retroativa permitida apenas para SuperAdm.',
        codigo: 'PERIODO_RETROATIVO_INTRASEMANA',
      };
    }
  }

  return { valido: true };
}

/**
 * Versão "assert" para uso no service: lança Error com prefixo do código.
 * Não consulta SuperAdm — quem chama deve passar o flag já resolvido.
 */
export function assertPeriodoNormalOuFalhar(
  dataInicio: string,
  dataFim: string,
  isSuperAdmin: boolean,
  isEditing: boolean = false
): void {
  const r = validarPeriodoNormal(dataInicio, dataFim, isSuperAdmin, isEditing);
  if (!r.valido) {
    throw new Error(`${r.codigo || 'PERIODO_INVALIDO'}: ${r.erro || 'Período inválido'}`);
  }
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
