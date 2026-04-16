import { supabase } from '@/integrations/supabase/client';

// =====================================================
// TYPES
// =====================================================

export interface JornadaCalculada {
  entrada: string | null;
  saida: string | null;
  intervalo_inicio: string | null;
  intervalo_fim: string | null;
  tempo_bruto_min: number;
  tempo_intervalo_min: number;
  tempo_liquido_min: number;
  tipo_calculo: 'real' | 'automatico' | 'sem_intervalo' | 'incompleto' | 'inconsistente';
  batidas_count: number;
  observacoes: string[];
}

interface BatidaRow {
  id: string;
  tipo_batida: string;
  data_hora_considerada: string;
  status_validacao: string | null;
}

// =====================================================
// HELPERS
// =====================================================

function extrairHora(isoString: string): string {
  const d = new Date(isoString);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function minutosDesdeIso(isoString: string): number {
  const d = new Date(isoString);
  return d.getHours() * 60 + d.getMinutes();
}

function diffMinutos(isoA: string, isoB: string): number {
  return Math.round((new Date(isoB).getTime() - new Date(isoA).getTime()) / 60000);
}

function cruzaIntervaloAlmoco(entradaMin: number, saidaMin: number): boolean {
  const ALMOCO_INICIO = 12 * 60; // 720
  const ALMOCO_FIM = 13 * 60;    // 780
  return entradaMin < ALMOCO_FIM && saidaMin > ALMOCO_INICIO;
}

// =====================================================
// VALIDAÇÃO DE SEQUÊNCIA
// =====================================================

function validarSequencia(batidas: BatidaRow[]): string[] {
  const erros: string[] = [];
  const sequenciaEsperada: Record<string, string[]> = {
    entrada: ['intervalo_inicio', 'saida'],
    intervalo_inicio: ['intervalo_fim'],
    intervalo_fim: ['saida', 'intervalo_inicio'],
    saida: ['entrada'],
  };

  let ultimoTipo: string | null = null;

  for (const b of batidas) {
    const tipo = b.tipo_batida;

    if (ultimoTipo === null) {
      if (tipo !== 'entrada') {
        erros.push(`Primeira batida deveria ser "entrada", mas encontrou "${tipo}"`);
      }
    } else {
      const esperados = sequenciaEsperada[ultimoTipo];
      if (esperados && !esperados.includes(tipo)) {
        erros.push(`Sequência inválida: "${tipo}" após "${ultimoTipo}"`);
      }
    }

    ultimoTipo = tipo;
  }

  // Intervalo aberto
  const temIntInicio = batidas.some(b => b.tipo_batida === 'intervalo_inicio');
  const temIntFim = batidas.some(b => b.tipo_batida === 'intervalo_fim');
  if (temIntInicio && !temIntFim) {
    erros.push('Intervalo iniciado sem finalização');
  }

  return erros;
}

// =====================================================
// MOTOR DE CÁLCULO
// =====================================================

export async function calcularJornada(
  funcionarioId: string,
  dataOperacional: string,
): Promise<JornadaCalculada> {
  const resultado: JornadaCalculada = {
    entrada: null,
    saida: null,
    intervalo_inicio: null,
    intervalo_fim: null,
    tempo_bruto_min: 0,
    tempo_intervalo_min: 0,
    tempo_liquido_min: 0,
    tipo_calculo: 'incompleto',
    batidas_count: 0,
    observacoes: [],
  };

  // 1. Buscar batidas válidas
  const { data: batidas, error: errBatidas } = await supabase
    .from('bd_ponto_batidas')
    .select('id, tipo_batida, data_hora_considerada, status_validacao')
    .eq('funcionario_id', funcionarioId)
    .eq('data_operacional', dataOperacional)
    .neq('status_validacao', 'invalidada')
    .order('data_hora_considerada', { ascending: true });

  if (errBatidas || !batidas) {
    resultado.observacoes.push('Erro ao buscar batidas');
    return resultado;
  }

  resultado.batidas_count = batidas.length;

  if (batidas.length === 0) {
    resultado.observacoes.push('Nenhuma batida encontrada');
    return resultado;
  }

  // 2. Buscar tipo_escala do funcionário
  const { data: func } = await supabase
    .from('bd_funcionarios')
    .select('tipo_escala')
    .eq('id', funcionarioId)
    .single();

  const tipoEscala: string = (func as any)?.tipo_escala ?? 'normal';

  // 3. Validar sequência
  const errosSequencia = validarSequencia(batidas as BatidaRow[]);
  if (errosSequencia.length > 0) {
    resultado.tipo_calculo = 'inconsistente';
    resultado.observacoes = errosSequencia;

    // Ainda preenche entrada/saída para referência
    const entrada = batidas.find(b => b.tipo_batida === 'entrada');
    const saida = [...batidas].reverse().find(b => b.tipo_batida === 'saida');
    if (entrada) resultado.entrada = extrairHora(entrada.data_hora_considerada);
    if (saida) resultado.saida = extrairHora(saida.data_hora_considerada);

    return resultado;
  }

  // 4. Identificar entrada e saída
  const batidaEntrada = batidas.find(b => b.tipo_batida === 'entrada');
  const batidaSaida = [...batidas].reverse().find(b => b.tipo_batida === 'saida');

  if (!batidaEntrada) {
    resultado.observacoes.push('Sem batida de entrada');
    return resultado;
  }

  resultado.entrada = extrairHora(batidaEntrada.data_hora_considerada);

  if (!batidaSaida) {
    resultado.tipo_calculo = 'incompleto';
    resultado.observacoes.push('Sem batida de saída');
    return resultado;
  }

  resultado.saida = extrairHora(batidaSaida.data_hora_considerada);

  // 5. Calcular tempo bruto
  resultado.tempo_bruto_min = diffMinutos(
    batidaEntrada.data_hora_considerada,
    batidaSaida.data_hora_considerada
  );

  // 6. Verificar intervalo real
  const batidaIntInicio = batidas.find(b => b.tipo_batida === 'intervalo_inicio');
  const batidaIntFim = batidas.find(b => b.tipo_batida === 'intervalo_fim');

  if (batidaIntInicio && batidaIntFim) {
    // Intervalo real registrado
    resultado.intervalo_inicio = extrairHora(batidaIntInicio.data_hora_considerada);
    resultado.intervalo_fim = extrairHora(batidaIntFim.data_hora_considerada);
    resultado.tempo_intervalo_min = diffMinutos(
      batidaIntInicio.data_hora_considerada,
      batidaIntFim.data_hora_considerada
    );
    resultado.tipo_calculo = 'real';
  } else if (tipoEscala === '12x36') {
    // 12x36 nunca aplica intervalo automático
    resultado.tipo_calculo = 'sem_intervalo';
    resultado.tempo_intervalo_min = 0;
  } else {
    // Escala normal — avaliar intervalo automático
    const entradaMin = minutosDesdeIso(batidaEntrada.data_hora_considerada);
    const saidaMin = minutosDesdeIso(batidaSaida.data_hora_considerada);

    const jornadaLonga = resultado.tempo_bruto_min >= 360;
    const cruzaAlmoco = cruzaIntervaloAlmoco(entradaMin, saidaMin);

    if (jornadaLonga && cruzaAlmoco) {
      resultado.intervalo_inicio = '12:00';
      resultado.intervalo_fim = '13:00';
      resultado.tempo_intervalo_min = 60;
      resultado.tipo_calculo = 'automatico';
      resultado.observacoes.push('Intervalo automático 12:00–13:00 aplicado');
    } else {
      resultado.tipo_calculo = 'sem_intervalo';
      resultado.tempo_intervalo_min = 0;
      if (!jornadaLonga) {
        resultado.observacoes.push('Jornada < 6h — sem intervalo automático');
      }
      if (!cruzaAlmoco) {
        resultado.observacoes.push('Jornada não cruza 12:00–13:00');
      }
    }
  }

  // 7. Tempo líquido
  resultado.tempo_liquido_min = resultado.tempo_bruto_min - resultado.tempo_intervalo_min;

  return resultado;
}

// =====================================================
// BATCH — múltiplos funcionários/datas
// =====================================================

export interface JornadaBatchInput {
  funcionarioId: string;
  dataOperacional: string;
}

export interface JornadaBatchResult extends JornadaCalculada {
  funcionarioId: string;
  dataOperacional: string;
}

export async function calcularJornadaBatch(
  inputs: JornadaBatchInput[]
): Promise<JornadaBatchResult[]> {
  const results: JornadaBatchResult[] = [];

  for (const input of inputs) {
    const jornada = await calcularJornada(input.funcionarioId, input.dataOperacional);
    results.push({
      ...jornada,
      funcionarioId: input.funcionarioId,
      dataOperacional: input.dataOperacional,
    });
  }

  return results;
}
