// =====================================================
// SERVICE: PRESENÇAS DE DIÁRIAS
// =====================================================

import { supabase } from '@/integrations/supabase/client';
import { lerConvocadosPre, derivarFuncionariosPlanos } from '@/lib/diarias/convocadosPreAdapter';
import { sanearPayloadPresenca } from './_presencaPayloadGuard';

export type TipoDiaria = 'completa' | 'meia' | 'uma_e_meia' | 'nenhuma';
export type TurnoDiaria = 'diurno' | 'noturno';

export interface PresencaDiaria {
  id: string;
  solicitacao_id: string;
  funcionario_id: string;
  data: string;
  presente: boolean;
  hora_entrada: string | null;
  hora_saida: string | null;
  intervalo_inicio: string | null;
  intervalo_fim: string | null;
  valor_diaria_aplicada: number;
  funcao_id: string | null;
  tipo_diaria: TipoDiaria | null;
  recebe_refeicao: boolean | null;
  valor_refeicao_aplicado: number | null;
  confirmado_por: string | null;
  confirmado_em: string | null;
  usar_diaria_exclusiva: boolean;
  turno: TurnoDiaria;
  created_at: string;
  updated_at: string;
  // Relations
  bd_funcionarios?: {
    id: string;
    nome_completo: string;
    cpf: string;
    imagem: string | null;
  };
  bd_funcoes?: {
    id: string;
    nome_funcao: string;
  };
}

export interface PresencaFormData {
  funcionario_id: string;
  nome_funcionario: string;
  funcao_id: string;
  nome_funcao?: string;
  valor_diaria: number;
  valor_diaria_original: number;
  presente: boolean;
  hora_entrada?: string;
  hora_saida?: string;
  tipo_diaria?: TipoDiaria;
  recebe_refeicao?: boolean;
  valor_refeicao_aplicado?: number;
  usar_diaria_exclusiva?: boolean;
  turno?: TurnoDiaria;
}

export interface ResultadoInsercaoIdempotente {
  totalSolicitado: number;
  inseridos: number;
  ignorados: number;
}

type PresencaInsertPayload = {
  solicitacao_id: string;
  funcionario_id: string;
  data: string;
} & Record<string, unknown>;

function deduplicarPresencas<T extends PresencaInsertPayload>(rows: T[]): T[] {
  const seen = new Set<string>();

  return rows.filter((row) => {
    const key = `${row.solicitacao_id}:${row.funcionario_id}:${row.data}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// APONTAMENTO-TIMEOUT-A1: tamanho do chunk para INSERT em bd_diaria_presencas.
// Cada linha dispara triggers AFTER ROW pesados (recalcular_status_diaria,
// auditoria) + RLS por linha. Lotes grandes ultrapassam statement_timeout (2 min).
// 50 linhas mantém cada chunk com folga abaixo do timeout.
const PRESENCAS_INSERT_CHUNK_SIZE = 50;

async function inserirPresencasIdempotente<T extends PresencaInsertPayload>(
  rows: T[]
): Promise<ResultadoInsercaoIdempotente> {
  const registrosUnicos = deduplicarPresencas(rows);

  if (registrosUnicos.length === 0) {
    return { totalSolicitado: 0, inseridos: 0, ignorados: 0 };
  }

  // Log final auditável: data efetivamente enviada ao banco em cada linha.
  registrosUnicos.forEach((row) => {
    console.log('[DIARIA][INSERT_PRESENCA]', {
      funcionario_id: row.funcionario_id,
      data_enviada: row.data,
      solicitacao_id: row.solicitacao_id,
    });
  });

  const total = registrosUnicos.length;
  const chunkSize = PRESENCAS_INSERT_CHUNK_SIZE;
  const totalChunks = Math.ceil(total / chunkSize);
  let inseridos = 0;

  // Processamento SEQUENCIAL (não paralelo) para evitar lock contention
  // em bd_diaria_solicitacoes via trg_recalcular_status_diaria.
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const inicio = chunkIndex * chunkSize;
    const fim = Math.min(inicio + chunkSize, total);
    const chunk = registrosUnicos.slice(inicio, fim);
    const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());

    const { data, error } = await supabase
      .from('bd_diaria_presencas')
      .upsert(chunk, {
        onConflict: 'solicitacao_id,funcionario_id,data',
        ignoreDuplicates: true,
      })
      .select('id');

    const tempoMs = Math.round(
      (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0
    );

    if (error) {
      // Instrumentação detalhada (PostgrestError) — captura tabela/policy real
      // que está bloqueando, inclusive quando a falha vem de trigger/cascade.
      console.error('[DIARIAS][PRESENCAS][BATCH_INSERT][ERRO]', {
        total,
        chunkSize,
        chunkIndex,
        totalChunks,
        quantidadeNoChunk: chunk.length,
        inseridosAcumulados: inseridos,
        tempoMs,
        error_code: (error as any).code,
        error_message: error.message,
        error_details: (error as any).details,
        error_hint: (error as any).hint,
        primeiro_registro: chunk[0],
      });
      throw new Error(
        `Falha ao salvar presenças (chunk ${chunkIndex + 1}/${totalChunks}, ` +
        `${chunk.length} linhas, ${inseridos} já inseridas anteriormente): ${error.message}` +
        ((error as any).details ? ` | detalhes: ${(error as any).details}` : '') +
        ((error as any).hint ? ` | dica: ${(error as any).hint}` : '')
      );
    }

    const inseridosChunk = data?.length ?? 0;
    inseridos += inseridosChunk;

    console.log('[DIARIAS][PRESENCAS][BATCH_INSERT]', {
      total,
      chunkSize,
      chunkIndex,
      totalChunks,
      quantidadeNoChunk: chunk.length,
      inseridosNoChunk: inseridosChunk,
      tempoMs,
    });
  }

  return {
    totalSolicitado: total,
    inseridos,
    ignorados: Math.max(total - inseridos, 0),
  };
}

// Buscar presenças por solicitação e data
export async function getPresencasPorSolicitacao(
  solicitacaoId: string,
  data?: string
): Promise<PresencaDiaria[]> {
  let query = supabase
    .from('bd_diaria_presencas')
    .select(`
      *,
      bd_funcionarios (
        id,
        nome_completo,
        cpf,
        imagem
      ),
      bd_funcoes (
        id,
        nome_funcao
      )
    `)
    .eq('solicitacao_id', solicitacaoId)
    .order('created_at', { ascending: false });

  if (data) {
    query = query.eq('data', data);
  }

  const { data: presencas, error } = await query;

  if (error) {
    console.error('Erro ao buscar presenças:', error);
    throw new Error(error.message);
  }

  return (presencas || []) as PresencaDiaria[];
}

// Salvar ou atualizar presenças em batch (upsert) - DEPRECATED, usar salvarInicio/salvarFinalizacao
export async function salvarPresencas(
  solicitacaoId: string,
  data: string,
  presencas: PresencaFormData[]
): Promise<ResultadoInsercaoIdempotente> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;

  const presencasData = presencas.map((p) => ({
    solicitacao_id: solicitacaoId,
    funcionario_id: p.funcionario_id,
    data,
    presente: p.presente,
    hora_entrada: p.presente && p.hora_entrada ? p.hora_entrada : null,
    hora_saida: p.presente && p.hora_saida ? p.hora_saida : null,
    valor_diaria_aplicada: p.valor_diaria,
    funcao_id: p.funcao_id || null,
    tipo_diaria: p.tipo_diaria || 'completa',
    recebe_refeicao: p.recebe_refeicao ?? true,
    valor_refeicao_aplicado: p.valor_refeicao_aplicado ?? 0,
    usar_diaria_exclusiva: p.usar_diaria_exclusiva ?? false,
    turno: p.turno || 'diurno',
    confirmado_por: userId,
    confirmado_em: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));

  return inserirPresencasIdempotente(presencasData.map(sanearPayloadPresenca));
}

// =====================================================
// NOVO FLUXO: Salvar em dois tempos (imutável)
// =====================================================

export interface InicioFormData {
  funcionario_id: string;
  funcao_id: string;
  presente: boolean;
  hora_entrada?: string;
  valor_diaria_original: number;
  usar_diaria_exclusiva?: boolean;
  turno?: TurnoDiaria;
  recebe_refeicao?: boolean;
  valor_refeicao_aplicado?: number;
}

export interface FinalizacaoFormData {
  funcionario_id: string;
  hora_saida: string;
  tipo_diaria: TipoDiaria;
  valor_diaria_aplicada: number;
  recebe_refeicao: boolean;
  valor_refeicao_aplicado: number;
  /**
   * Flag autoritativa da diária exclusiva (FDS/feriado/ponte/Férias).
   * Precisa ser persistida na saída/finalização, senão o relatório
   * classifica o dia como normal mesmo com valor exclusivo gravado.
   */
  usar_diaria_exclusiva?: boolean;
}

// Salvar INÍCIO — INSERT only, rejeita se já existir
export async function salvarInicio(
  solicitacaoId: string,
  data: string,
  registros: InicioFormData[]
): Promise<ResultadoInsercaoIdempotente> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;

  const rows = registros.map((r) => ({
    solicitacao_id: solicitacaoId,
    funcionario_id: r.funcionario_id,
    data,
    presente: r.presente,
    hora_entrada: r.presente && r.hora_entrada ? r.hora_entrada : null,
    hora_saida: null,
    valor_diaria_aplicada: r.valor_diaria_original,
    funcao_id: r.funcao_id || null,
    tipo_diaria: null,
    recebe_refeicao: r.recebe_refeicao ?? true,
    valor_refeicao_aplicado: r.valor_refeicao_aplicado ?? 0,
    usar_diaria_exclusiva: r.usar_diaria_exclusiva ?? false,
    turno: r.turno || 'diurno',
    confirmado_por: userId,
    confirmado_em: new Date().toISOString(),
  }));

  return inserirPresencasIdempotente(rows.map(sanearPayloadPresenca));
}

// Salvar INÍCIO PARCIAL — INSERT apenas para atrasados (durante fase de finalização)
export async function salvarInicioParcial(
  solicitacaoId: string,
  data: string,
  registros: InicioFormData[]
): Promise<ResultadoInsercaoIdempotente> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;

  const rows = registros.map((r) => ({
    solicitacao_id: solicitacaoId,
    funcionario_id: r.funcionario_id,
    data,
    presente: r.presente,
    hora_entrada: r.presente && r.hora_entrada ? r.hora_entrada : null,
    hora_saida: null,
    valor_diaria_aplicada: r.valor_diaria_original,
    funcao_id: r.funcao_id || null,
    tipo_diaria: null,
    recebe_refeicao: r.recebe_refeicao ?? true,
    valor_refeicao_aplicado: r.valor_refeicao_aplicado ?? 0,
    usar_diaria_exclusiva: r.usar_diaria_exclusiva ?? false,
    turno: r.turno || 'diurno',
    confirmado_por: userId,
    confirmado_em: new Date().toISOString(),
  }));

  return inserirPresencasIdempotente(rows.map(sanearPayloadPresenca));
}

// Salvar FINALIZAÇÃO — UPDATE only, não toca hora_entrada
export async function salvarFinalizacao(
  solicitacaoId: string,
  data: string,
  registros: FinalizacaoFormData[]
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;

  // IMPORTANTE: serializar (for…of await) em vez de Promise.all.
  // O trigger trg_recalcular_status_diaria recalcula bd_diaria_status a cada
  // UPDATE; com paralelo + autocommit do PostgREST cada trigger lia snapshot
  // sem os updates concorrentes ainda commitados e gravava 'iniciado'
  // sobrepondo o 'finalizado' final. Serializar garante que o último UPDATE
  // veja todas as horas_saida e o trigger persista 'finalizado'.
  for (const r of registros) {
    const { error } = await supabase
      .from('bd_diaria_presencas')
      .update({
        hora_saida: r.hora_saida,
        tipo_diaria: r.tipo_diaria,
        valor_diaria_aplicada: r.valor_diaria_aplicada,
        recebe_refeicao: r.recebe_refeicao,
        valor_refeicao_aplicado: r.valor_refeicao_aplicado,
        ...(r.usar_diaria_exclusiva != null
          ? { usar_diaria_exclusiva: r.usar_diaria_exclusiva }
          : {}),
        confirmado_por: userId,
        confirmado_em: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('solicitacao_id', solicitacaoId)
      .eq('funcionario_id', r.funcionario_id)
      .eq('data', data);

    if (error) {
      console.error(`Erro ao finalizar presença de ${r.funcionario_id}:`, error);
      throw new Error(error.message);
    }
  }
}

// Salvar saída individual de um funcionário (sem finalizar o apontamento completo)
export async function salvarSaidaIndividual(
  solicitacaoId: string,
  data: string,
  registro: FinalizacaoFormData
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;

  const { error } = await supabase
    .from('bd_diaria_presencas')
    .update({
      hora_saida: registro.hora_saida,
      tipo_diaria: registro.tipo_diaria,
      valor_diaria_aplicada: registro.valor_diaria_aplicada,
      recebe_refeicao: registro.recebe_refeicao,
      valor_refeicao_aplicado: registro.valor_refeicao_aplicado,
      ...(registro.usar_diaria_exclusiva != null
        ? { usar_diaria_exclusiva: registro.usar_diaria_exclusiva }
        : {}),
      confirmado_por: userId,
      confirmado_em: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('solicitacao_id', solicitacaoId)
    .eq('funcionario_id', registro.funcionario_id)
    .eq('data', data);

  if (error) {
    console.error(`Erro ao salvar saída individual de ${registro.funcionario_id}:`, error);
    throw new Error(error.message);
  }
}

// Atualizar registros de "falta" para "presente" (atrasados que já tinham presencaId)
export async function atualizarFaltaParaPresente(
  registros: { id: string; hora_entrada: string; valor_diaria_original: number; usar_diaria_exclusiva: boolean; turno?: TurnoDiaria }[]
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;

  // Serializado pelo mesmo motivo de salvarFinalizacao: trg_recalcular_status_diaria
  // precisa enxergar o estado consolidado da (solicitacao,data) para gravar
  // status correto.
  for (const r of registros) {
    const sanitized = sanearPayloadPresenca({
      presente: true,
      hora_entrada: r.hora_entrada,
      hora_saida: null,
      valor_diaria_aplicada: r.valor_diaria_original,
      tipo_diaria: null,
    });

    const { error } = await supabase
      .from('bd_diaria_presencas')
      .update({
        presente: sanitized.presente,
        hora_entrada: sanitized.hora_entrada,
        valor_diaria_aplicada: sanitized.valor_diaria_aplicada,
        tipo_diaria: sanitized.tipo_diaria,
        usar_diaria_exclusiva: r.usar_diaria_exclusiva,
        turno: r.turno || 'diurno',
        confirmado_por: userId,
        confirmado_em: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', r.id);

    if (error) {
      console.error(`Erro ao atualizar falta para presente (${r.id}):`, error);
      throw new Error(error.message);
    }
  }
}

// Inserir presenças completas (retroativos na correção pós-conclusão)
// Auditoria: registra em bd_diaria_aprovacoes (legado) e bd_diaria_logs
// (tipo_evento='presenca_retroativa') por funcionário inserido.
export async function inserirPresencasCompletas(
  solicitacaoId: string,
  data: string,
  registros: CorrecaoFormData[],
  observacao: string
): Promise<ResultadoInsercaoIdempotente> {
  // Justificativa mínima — alinhada ao mínimo retroativo das RPCs de aditivo.
  if (!observacao || observacao.trim().length < 20) {
    throw new Error('Justificativa retroativa obrigatória (mínimo 20 caracteres).');
  }

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;

  const justificativa = `[CORREÇÃO - ADIÇÃO RETROATIVA] ${observacao} | Por: ${userId} em ${new Date().toISOString()}`;

  const rows = registros.map((r) => ({
    solicitacao_id: solicitacaoId,
    funcionario_id: r.funcionario_id,
    data,
    presente: r.presente,
    hora_entrada: r.hora_entrada || null,
    hora_saida: r.hora_saida || null,
    valor_diaria_aplicada: r.valor_diaria_aplicada,
    funcao_id: r.funcao_id || null,
    tipo_diaria: r.tipo_diaria,
    recebe_refeicao: r.recebe_refeicao,
    valor_refeicao_aplicado: r.valor_refeicao_aplicado,
    usar_diaria_exclusiva: r.usar_diaria_exclusiva ?? false,
    turno: r.turno || 'diurno',
    observacoes: justificativa,
    confirmado_por: userId,
    confirmado_em: new Date().toISOString(),
  }));

  const resultado = await inserirPresencasIdempotente(rows.map(sanearPayloadPresenca));

  // Registrar auditoria
  if (resultado.inseridos > 0) {
    await supabase
      .from('bd_diaria_aprovacoes')
      .insert({
        entidade: 'relatorio',
        entidade_id: solicitacaoId,
        acao: 'adicao_retroativa',
        comentario: justificativa
      });

    // Novo log estruturado em bd_diaria_logs (não bloqueia em caso de erro)
    try {
      if (userId) {
        await supabase.from('bd_diaria_logs' as any).insert({
          solicitacao_id: solicitacaoId,
          tipo_evento: 'presenca_retroativa',
          usuario_id: userId,
          justificativa: observacao.trim(),
          dados_extras: {
            data,
            funcionarios: registros.map((r) => r.funcionario_id),
            total_inseridos: resultado.inseridos,
            total_ignorados: resultado.ignorados,
            timestamp: new Date().toISOString(),
          },
        });
      }
    } catch (e) {
      console.warn('[presencasService] falha ao gravar bd_diaria_logs:', e);
    }
  }

  return resultado;
}

// Buscar resumo de presenças de uma solicitação
export async function getResumoPresencas(solicitacaoId: string): Promise<{
  total_dias: number;
  total_presentes: number;
  total_ausentes: number;
  valor_total: number;
}> {
  const { data: presencas, error } = await supabase
    .from('bd_diaria_presencas')
    .select('*')
    .eq('solicitacao_id', solicitacaoId);

  if (error) {
    console.error('Erro ao buscar resumo de presenças:', error);
    throw new Error(error.message);
  }

  const diasUnicos = new Set((presencas || []).map((p) => p.data));
  const presentes = (presencas || []).filter((p) => p.presente);
  const ausentes = (presencas || []).filter((p) => !p.presente);
  const valorTotal = presentes.reduce((acc, p) => acc + (p.valor_diaria_aplicada || 0), 0);

  return {
    total_dias: diasUnicos.size,
    total_presentes: presentes.length,
    total_ausentes: ausentes.length,
    valor_total: valorTotal
  };
}

// Verificar se já existe apontamento para uma data específica
export async function verificarPresencasExistentes(
  solicitacaoId: string,
  data: string
): Promise<boolean> {
  const { count, error } = await supabase
    .from('bd_diaria_presencas')
    .select('*', { count: 'exact', head: true })
    .eq('solicitacao_id', solicitacaoId)
    .eq('data', data);

  if (error) {
    console.error('Erro ao verificar presenças existentes:', error);
    return false;
  }

  return (count || 0) > 0;
}

// Buscar datas únicas que já foram apontadas para uma solicitação
export async function getDatasApontadas(
  solicitacaoId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('bd_diaria_presencas')
    .select('data')
    .eq('solicitacao_id', solicitacaoId)
    .order('data');

  if (error) {
    console.error('Erro ao buscar datas apontadas:', error);
    return [];
  }

  // Retornar datas únicas
  return [...new Set((data || []).map((p) => p.data))];
}

// =====================================================
// CORREÇÃO PÓS-CONCLUSÃO (edicaoLiberada)
// =====================================================

export interface CorrecaoFormData {
  funcionario_id: string;
  presente: boolean;
  hora_entrada: string;
  hora_saida: string;
  tipo_diaria: TipoDiaria;
  valor_diaria_aplicada: number;
  recebe_refeicao: boolean;
  valor_refeicao_aplicado: number;
  turno?: TurnoDiaria;
  funcao_id?: string;
  usar_diaria_exclusiva?: boolean;
}

export async function salvarCorrecao(
  solicitacaoId: string,
  data: string,
  registros: CorrecaoFormData[],
  observacao: string
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;

  const justificativa = `[CORREÇÃO - EDIÇÃO LIBERADA] ${observacao} | Por: ${userId} em ${new Date().toISOString()}`;

  const promises = registros.map(async (r) => {
    const sanitized = sanearPayloadPresenca({
      solicitacao_id: solicitacaoId,
      funcionario_id: r.funcionario_id,
      data,
      presente: r.presente,
      hora_entrada: r.hora_entrada || null,
      hora_saida: r.hora_saida || null,
      tipo_diaria: r.tipo_diaria ?? null,
      valor_diaria_aplicada: r.valor_diaria_aplicada,
    });
    const updatePayload: any = {
        presente: sanitized.presente,
        hora_entrada: sanitized.hora_entrada,
        hora_saida: sanitized.hora_saida,
        tipo_diaria: sanitized.tipo_diaria,
        valor_diaria_aplicada: sanitized.valor_diaria_aplicada,
        recebe_refeicao: r.recebe_refeicao,
        valor_refeicao_aplicado: r.valor_refeicao_aplicado,
        ...(r.usar_diaria_exclusiva != null
          ? { usar_diaria_exclusiva: r.usar_diaria_exclusiva }
          : {}),
        turno: r.turno || 'diurno',
        observacoes: justificativa,
        confirmado_por: userId,
        confirmado_em: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    if (r.funcao_id) {
      updatePayload.funcao_id = r.funcao_id;
    }
    const { error } = await supabase
      .from('bd_diaria_presencas')
      .update(updatePayload)
      .eq('solicitacao_id', solicitacaoId)
      .eq('funcionario_id', r.funcionario_id)
      .eq('data', data);

    if (error) {
      console.error(`Erro ao corrigir presença de ${r.funcionario_id}:`, error);
      throw new Error(error.message);
    }
  });

  await Promise.all(promises);

  // Registrar auditoria
  await supabase
    .from('bd_diaria_aprovacoes')
    .insert({
      entidade: 'relatorio',
      entidade_id: solicitacaoId,
      acao: 'correcao_edicao_liberada',
      comentario: justificativa
    });
}

// =====================================================
// EDITAR HORA DE SAÍDA PÓS-CONCLUSÃO
// =====================================================

export async function editarHoraSaida(
  presencaId: string,
  novaHoraSaida: string,
  justificativa: string,
  engenheiroSolicitanteId: string | null
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;

  // Buscar presença atual para recalcular
  const { data: presenca, error: fetchError } = await supabase
    .from('bd_diaria_presencas')
    .select('hora_entrada, valor_diaria_aplicada, funcao_id, solicitacao_id, funcionario_id, data')
    .eq('id', presencaId)
    .single();

  if (fetchError || !presenca) {
    throw new Error('Presença não encontrada');
  }

  // Buscar valor original do convocado_pre na solicitação (via adapter, com fallback legado)
  const { data: solicitacao } = await supabase
    .from('bd_diaria_solicitacoes')
    .select('convocados_pre, data_inicio, data_fim')
    .eq('id', presenca.solicitacao_id)
    .single();

  let valorOriginal = presenca.valor_diaria_aplicada;
  if (solicitacao) {
    const view = lerConvocadosPre(solicitacao.convocados_pre, {
      inicio: solicitacao.data_inicio,
      fim: solicitacao.data_fim,
    });
    let conv: { valor_diaria?: number } | undefined = derivarFuncionariosPlanos(view).find(
      (c) => c.funcionario_id === presenca.funcionario_id,
    );

    // Fallback de paridade: convocados legados sem funcao_id são descartados
    // pelo adapter; preservar comportamento anterior buscando direto no array bruto.
    if (!conv && Array.isArray(solicitacao.convocados_pre)) {
      conv = (solicitacao.convocados_pre as any[]).find(
        (c: any) => c?.funcionario_id === presenca.funcionario_id,
      );
    }

    if (conv) {
      valorOriginal = conv.valor_diaria || presenca.valor_diaria_aplicada;
    }
  }

  // Recalcular jornada
  const entrada = presenca.hora_entrada;
  if (!entrada) throw new Error('Hora de entrada não registrada');

  const [hE, mE] = entrada.split(':').map(Number);
  const [hS, mS] = novaHoraSaida.split(':').map(Number);
  let totalMinutos = (hS * 60 + mS) - (hE * 60 + mE);
  if (totalMinutos < 0) totalMinutos += 24 * 60;
  const horasBrutas = totalMinutos / 60;
  // Descontar 1h de almoço se jornada bruta > 6h
  const horas = horasBrutas > 6 ? horasBrutas - 1 : horasBrutas;

  let tipoDiaria: TipoDiaria = 'nenhuma';
  if (horas >= 9.75) tipoDiaria = 'uma_e_meia';       // >= 9:45
  else if (horas >= 4.5) tipoDiaria = 'completa';      // >= 4:30
  else if (horas > 0) tipoDiaria = 'meia';

  let novoValor = 0;
  switch (tipoDiaria) {
    case 'uma_e_meia': novoValor = valorOriginal * 1.5; break;
    case 'completa': novoValor = valorOriginal; break;
    case 'meia': novoValor = valorOriginal * 0.5; break;
  }

  const justificativaCompleta = `[EDIÇÃO PÓS-CONCLUSÃO] ${justificativa}${engenheiroSolicitanteId ? ` | Eng: ${engenheiroSolicitanteId}` : ''} | Por: ${userId} em ${new Date().toISOString()}`;

  const { error } = await supabase
    .from('bd_diaria_presencas')
    .update({
      hora_saida: novaHoraSaida,
      tipo_diaria: tipoDiaria,
      valor_diaria_aplicada: novoValor,
      observacoes: justificativaCompleta,
      confirmado_por: userId,
      confirmado_em: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', presencaId);

  if (error) {
    console.error('Erro ao editar hora de saída:', error);
    throw new Error(error.message);
  }

  // Registrar auditoria
  await supabase
    .from('bd_diaria_aprovacoes')
    .insert({
      entidade: 'relatorio',
      entidade_id: presencaId,
      acao: 'editar_hora_saida',
      comentario: justificativaCompleta
    });
}

// =====================================================
// EXCLUIR REGISTRO DE PRESENÇA
// =====================================================

export async function deletePresencaRegistro(presencaId: string): Promise<void> {
  const { error } = await supabase
    .from('bd_diaria_presencas')
    .delete()
    .eq('id', presencaId);

  if (error) {
    console.error('Erro ao excluir registro de presença:', error);
    throw new Error(error.message);
  }
}
