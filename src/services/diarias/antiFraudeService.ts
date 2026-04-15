// =====================================================
// SERVICE: ANTI-FRAUDE DE DIÁRIAS
// =====================================================

import { supabase } from '@/integrations/supabase/client';

export interface StatusFuncionarioResult {
  status: string;
  bloqueado: boolean;
  motivo?: string;
  tipo?: 'ferias' | 'afastado' | 'inativo' | 'inconsistencia';
  semHistorico?: boolean;
}

/**
 * Consulta o status do funcionário em uma data específica
 * usando a RPC get_status_funcionario_na_data (SEM FALLBACK)
 */
export async function getStatusFuncionarioNaData(
  funcionarioId: string,
  data: string
): Promise<string> {
  const { data: status, error } = await supabase
    .rpc('get_status_funcionario_na_data', {
      p_funcionario_id: funcionarioId,
      p_data: data
    });

  if (error) {
    // RPC lança exceção se não encontrar histórico
    if (error.message?.includes('STATUS_HISTORICO_NAO_ENCONTRADO')) {
      throw new Error('STATUS_HISTORICO_NAO_ENCONTRADO');
    }
    console.error('Erro ao consultar status do funcionário:', error);
    throw error;
  }

  return status || 'ativo';
}

/**
 * Valida o status do funcionário para uma data específica
 * Sem fallback — exige histórico de status cadastrado
 */
export async function validarStatusFuncionario(
  funcionarioId: string,
  data: string
): Promise<StatusFuncionarioResult> {
  try {
    const status = await getStatusFuncionarioNaData(funcionarioId, data);

    if (status === 'ferias') {
      return {
        status,
        bloqueado: true,
        motivo: 'Funcionário em período de férias nesta data.',
        tipo: 'ferias'
      };
    }

    if (status === 'afastado') {
      return {
        status,
        bloqueado: true,
        motivo: 'Funcionário afastado nesta data.',
        tipo: 'afastado'
      };
    }

    if (status === 'inativo') {
      return {
        status,
        bloqueado: true,
        motivo: 'Funcionário inativo nesta data.',
        tipo: 'inativo'
      };
    }

    return { status, bloqueado: false };
  } catch (err: any) {
    if (err.message === 'STATUS_HISTORICO_NAO_ENCONTRADO') {
      return {
        status: 'sem_historico',
        bloqueado: false,
        semHistorico: true,
        motivo: 'Funcionário sem histórico de status cadastrado para esta data.'
      };
    }
    throw err;
  }
}

/**
 * Valida status para cada dia do período (CRÍTICO)
 */
export async function validarStatusPorDia(
  funcionarioId: string,
  dataInicio: string,
  dataFim: string
): Promise<{ bloqueado: boolean; diasBloqueados: Array<{ data: string; status: string; motivo: string }> }> {
  const inicio = new Date(dataInicio);
  const fim = new Date(dataFim);
  const diasBloqueados: Array<{ data: string; status: string; motivo: string }> = [];

  for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
    const dataStr = d.toISOString().split('T')[0];
    try {
      const result = await validarStatusFuncionario(funcionarioId, dataStr);
      if (result.bloqueado) {
        diasBloqueados.push({
          data: dataStr,
          status: result.status,
          motivo: result.motivo || 'Status bloqueado'
        });
      }
    } catch {
      // Se não encontrar histórico para um dia, continua
    }
  }

  return { bloqueado: diasBloqueados.length > 0, diasBloqueados };
}

/**
 * Valida inconsistência de 30 dias sem apontamento
 * Considera data_admissao como fallback para funcionários novos
 */
export async function validarInconsistencia30Dias(
  funcionarioId: string,
  dataReferencia: string
): Promise<{ inconsistente: boolean; diasSemApontamento: number; motivo?: string }> {
  const { data: ultimaPresenca } = await supabase
    .from('bd_diaria_presencas')
    .select('data')
    .eq('funcionario_id', funcionarioId)
    .eq('presente', true)
    .order('data', { ascending: false })
    .limit(1)
    .single();

  if (!ultimaPresenca) {
    const { data: funcionario } = await supabase
      .from('bd_funcionarios')
      .select('data_admissao, created_at')
      .eq('id', funcionarioId)
      .single();

    if (funcionario) {
      const dataBase = funcionario.data_admissao || funcionario.created_at;
      const diff = Math.abs(
        (new Date(dataReferencia).getTime() - new Date(dataBase).getTime()) /
        (1000 * 60 * 60 * 24)
      );

      if (diff <= 30) {
        return { inconsistente: false, diasSemApontamento: 0 };
      }

      return {
        inconsistente: true,
        diasSemApontamento: Math.round(diff),
        motivo: 'Funcionário sem nenhum apontamento registrado.'
      };
    }

    return { inconsistente: false, diasSemApontamento: 0 };
  }

  const diff = Math.abs(
    (new Date(dataReferencia).getTime() - new Date(ultimaPresenca.data).getTime()) /
    (1000 * 60 * 60 * 24)
  );

  if (diff > 30) {
    return {
      inconsistente: true,
      diasSemApontamento: Math.round(diff),
      motivo: `Funcionário sem apontamento há ${Math.round(diff)} dias.`
    };
  }

  return { inconsistente: false, diasSemApontamento: Math.round(diff) };
}

/**
 * Verifica se já existe solicitação ativa para o mesmo CC e período semanal
 */
export async function verificarDuplicidadeSolicitacao(
  centroCustoId: string,
  dataInicio: string,
  dataFim: string,
  solicitacaoIdExcluir?: string
): Promise<{ duplicada: boolean; solicitacaoExistente?: any }> {
  let query = supabase
    .from('bd_diaria_solicitacoes')
    .select('id, numero_solicitacao, data_inicio, data_fim, status')
    .eq('centro_custo_id', centroCustoId)
    .in('status', ['rascunho', 'enviada', 'autorizada'])
    .or(`and(data_inicio.lte.${dataFim},data_fim.gte.${dataInicio})`);

  if (solicitacaoIdExcluir) {
    query = query.neq('id', solicitacaoIdExcluir);
  }

  const { data, error } = await query.limit(1).maybeSingle();

  if (error || !data) {
    return { duplicada: false };
  }

  return {
    duplicada: true,
    solicitacaoExistente: data
  };
}

/**
 * Busca o histórico de status de um funcionário
 */
export async function getHistoricoStatusFuncionario(funcionarioId: string) {
  const { data, error } = await supabase
    .from('bd_funcionario_status_historico')
    .select('*')
    .eq('funcionario_id', funcionarioId)
    .order('data_inicio', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Registra um novo status no histórico
 */
export async function registrarStatusFuncionario(params: {
  funcionarioId: string;
  status: string;
  dataInicio: string;
  dataFim?: string;
  motivo?: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('bd_funcionario_status_historico')
    .insert({
      funcionario_id: params.funcionarioId,
      status: params.status,
      data_inicio: params.dataInicio,
      data_fim: params.dataFim || null,
      motivo: params.motivo || null,
      registrado_por: user?.id || null
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Registrar log de comunicação (WhatsApp rastreável)
 */
export async function registrarLogComunicacao(params: {
  tipo: string;
  funcionarioId?: string;
  destinatario?: string;
  mensagem?: string;
  metadata?: Record<string, any>;
}) {
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('bd_log_comunicacao')
    .insert({
      tipo: params.tipo,
      funcionario_id: params.funcionarioId || null,
      enviado_por: user?.id || null,
      destinatario: params.destinatario || null,
      mensagem: params.mensagem || null,
      metadata: params.metadata || null
    });

  if (error) console.error('Erro ao registrar log de comunicação:', error);
}
