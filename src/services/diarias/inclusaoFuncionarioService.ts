// =====================================================
// SERVICE: INCLUSÃO DE FUNCIONÁRIO EM DIÁRIAS
// =====================================================

import { supabase } from '@/integrations/supabase/client';

export interface InclusaoFuncionarioRequest {
  solicitacaoId: string;
  funcionarioId: string;
  justificativa?: string;
}

export interface InclusaoFuncionario {
  id: string;
  solicitacao_id: string;
  funcionario_id: string;
  solicitado_por: string | null;
  aprovado_por: string | null;
  status: string;
  justificativa: string | null;
  data_solicitacao: string;
  data_resposta: string | null;
}

/**
 * Solicitar inclusão de funcionário (cria registro pendente)
 */
export async function solicitarInclusaoFuncionario(
  params: InclusaoFuncionarioRequest
): Promise<InclusaoFuncionario> {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('bd_aprovacoes_inclusao_funcionario')
    .insert({
      solicitacao_id: params.solicitacaoId,
      funcionario_id: params.funcionarioId,
      solicitado_por: user?.id || null,
      justificativa: params.justificativa || null,
      status: 'pendente'
    })
    .select()
    .single();

  if (error) throw error;
  return data as InclusaoFuncionario;
}

/**
 * Aprovar inclusão de funcionário
 */
export async function aprovarInclusaoFuncionario(
  inclusaoId: string
): Promise<InclusaoFuncionario> {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('bd_aprovacoes_inclusao_funcionario')
    .update({
      status: 'aprovado',
      aprovado_por: user?.id || null,
      data_resposta: new Date().toISOString()
    })
    .eq('id', inclusaoId)
    .select()
    .single();

  if (error) throw error;
  return data as InclusaoFuncionario;
}

/**
 * Recusar inclusão de funcionário
 */
export async function recusarInclusaoFuncionario(
  inclusaoId: string,
  justificativa?: string
): Promise<InclusaoFuncionario> {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('bd_aprovacoes_inclusao_funcionario')
    .update({
      status: 'recusado',
      aprovado_por: user?.id || null,
      data_resposta: new Date().toISOString(),
      justificativa: justificativa || null
    })
    .eq('id', inclusaoId)
    .select()
    .single();

  if (error) throw error;
  return data as InclusaoFuncionario;
}

/**
 * Listar solicitações de inclusão pendentes
 */
export async function listarInclusoesPendentes(
  solicitacaoId?: string
): Promise<any[]> {
  let query = supabase
    .from('bd_aprovacoes_inclusao_funcionario')
    .select(`
      *,
      bd_funcionarios!bd_aprovacoes_inclusao_funcionario_funcionario_id_fkey (
        id, nome_completo, cpf, matricula
      ),
      bd_diaria_solicitacoes!bd_aprovacoes_inclusao_funcionario_solicitacao_id_fkey (
        id, numero_solicitacao, centro_custo_id,
        bd_centros_custo (id, codigo_centro_custo, nome_centro_custo)
      )
    `)
    .eq('status', 'pendente')
    .order('data_solicitacao', { ascending: false });

  if (solicitacaoId) {
    query = query.eq('solicitacao_id', solicitacaoId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Contar inclusões pendentes (para badge)
 */
export async function contarInclusoesPendentes(): Promise<number> {
  const { count, error } = await supabase
    .from('bd_aprovacoes_inclusao_funcionario')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pendente');

  if (error) return 0;
  return count || 0;
}

/**
 * Criar notificação para o aprovador sobre inclusão pendente
 */
export async function notificarAprovadorInclusao(params: {
  solicitacaoId: string;
  funcionarioNome: string;
  centroCustoNome: string;
  aprovadorId: string;
}) {
  // Buscar o usuário atual
  const { data: { user } } = await supabase.auth.getUser();

  // Criar notificação no sistema existente
  const { data: notificacao, error: errNotif } = await supabase
    .from('bd_notificacoes')
    .insert({
      tipo: 'aprovacao_inclusao',
      titulo: 'Aprovação de inclusão de funcionário',
      mensagem: `Funcionário ${params.funcionarioNome} solicitado para diária no CC ${params.centroCustoNome}.`,
      link: `/requisicoes/diarias/relatorio`,
      metadata: {
        solicitacao_id: params.solicitacaoId,
        funcionario_nome: params.funcionarioNome
      },
      created_by: user?.id || null
    })
    .select()
    .single();

  if (errNotif || !notificacao) return;

  // Vincular ao aprovador
  await supabase.from('bd_notificacoes_usuarios').insert({
    notificacao_id: notificacao.id,
    usuario_id: params.aprovadorId,
    lida: false
  });
}
