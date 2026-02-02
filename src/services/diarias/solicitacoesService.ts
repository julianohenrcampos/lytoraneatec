import { supabase } from "@/integrations/supabase/client";
import type { 
  DiariaSolicitacao, 
  SolicitacaoFormData, 
  SolicitacaoFilters,
  SolicitacaoResumo,
  StatusSolicitacao 
} from "@/types/diarias";

// =====================================================
// CRUD - SOLICITAÇÕES DE DIÁRIA
// =====================================================

export async function getSolicitacoes(filters?: SolicitacaoFilters): Promise<DiariaSolicitacao[]> {
  let query = supabase
    .from('bd_diaria_solicitacoes')
    .select(`
      *,
      bd_centros_custo (
        id,
        codigo_centro_custo,
        nome_centro_custo
      )
    `)
    .order('data', { ascending: false });

  if (filters?.data_inicio) {
    query = query.gte('data', filters.data_inicio);
  }
  if (filters?.data_fim) {
    query = query.lte('data', filters.data_fim);
  }
  if (filters?.centro_custo_id) {
    query = query.eq('centro_custo_id', filters.centro_custo_id);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.criado_por) {
    query = query.eq('criado_por', filters.criado_por);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Erro ao buscar solicitações:', error);
    throw new Error(error.message);
  }

  return (data || []) as DiariaSolicitacao[];
}

export async function getSolicitacaoById(id: string): Promise<DiariaSolicitacao | null> {
  const { data, error } = await supabase
    .from('bd_diaria_solicitacoes')
    .select(`
      *,
      bd_centros_custo (
        id,
        codigo_centro_custo,
        nome_centro_custo
      )
    `)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Erro ao buscar solicitação:', error);
    throw new Error(error.message);
  }

  return data as DiariaSolicitacao;
}

export async function createSolicitacao(formData: SolicitacaoFormData): Promise<DiariaSolicitacao> {
  const { data, error } = await supabase
    .from('bd_diaria_solicitacoes')
    .insert({
      data: formData.data,
      centro_custo_id: formData.centro_custo_id,
      justificativa: formData.justificativa,
      convocados_pre: formData.convocados_pre || [],
      status: 'rascunho'
    })
    .select(`
      *,
      bd_centros_custo (
        id,
        codigo_centro_custo,
        nome_centro_custo
      )
    `)
    .single();

  if (error) {
    console.error('Erro ao criar solicitação:', error);
    throw new Error(error.message);
  }

  return data as DiariaSolicitacao;
}

export async function updateSolicitacao(id: string, formData: Partial<SolicitacaoFormData>): Promise<DiariaSolicitacao> {
  const updateData: any = {
    updated_at: new Date().toISOString()
  };
  
  if (formData.data !== undefined) updateData.data = formData.data;
  if (formData.centro_custo_id !== undefined) updateData.centro_custo_id = formData.centro_custo_id;
  if (formData.justificativa !== undefined) updateData.justificativa = formData.justificativa;
  if (formData.convocados_pre !== undefined) updateData.convocados_pre = formData.convocados_pre;

  const { data, error } = await supabase
    .from('bd_diaria_solicitacoes')
    .update(updateData)
    .eq('id', id)
    .select(`
      *,
      bd_centros_custo (
        id,
        codigo_centro_custo,
        nome_centro_custo
      )
    `)
    .single();

  if (error) {
    console.error('Erro ao atualizar solicitação:', error);
    throw new Error(error.message);
  }

  return data as DiariaSolicitacao;
}

export async function deleteSolicitacao(id: string): Promise<void> {
  const { error } = await supabase
    .from('bd_diaria_solicitacoes')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Erro ao deletar solicitação:', error);
    throw new Error(error.message);
  }
}

// =====================================================
// AÇÕES DE STATUS
// =====================================================

export async function enviarParaAutorizacao(id: string): Promise<DiariaSolicitacao> {
  const { data, error } = await supabase
    .from('bd_diaria_solicitacoes')
    .update({
      status: 'enviada' as StatusSolicitacao,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select(`
      *,
      bd_centros_custo (
        id,
        codigo_centro_custo,
        nome_centro_custo
      )
    `)
    .single();

  if (error) {
    console.error('Erro ao enviar para autorização:', error);
    throw new Error(error.message);
  }

  // Registrar na auditoria
  await registrarAprovacao(id, 'solicitacao', 'enviar');

  return data as DiariaSolicitacao;
}

export async function autorizarSolicitacao(id: string, comentario?: string): Promise<DiariaSolicitacao> {
  const { data: userData } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from('bd_diaria_solicitacoes')
    .update({
      status: 'autorizada' as StatusSolicitacao,
      autorizado_por: userData?.user?.id,
      autorizado_em: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select(`
      *,
      bd_centros_custo (
        id,
        codigo_centro_custo,
        nome_centro_custo
      )
    `)
    .single();

  if (error) {
    console.error('Erro ao autorizar solicitação:', error);
    throw new Error(error.message);
  }

  // Registrar na auditoria
  await registrarAprovacao(id, 'solicitacao', 'aprovar', comentario);

  return data as DiariaSolicitacao;
}

export async function reprovarSolicitacao(id: string, comentario?: string): Promise<DiariaSolicitacao> {
  const { data: userData } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from('bd_diaria_solicitacoes')
    .update({
      status: 'reprovada' as StatusSolicitacao,
      autorizado_por: userData?.user?.id,
      autorizado_em: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select(`
      *,
      bd_centros_custo (
        id,
        codigo_centro_custo,
        nome_centro_custo
      )
    `)
    .single();

  if (error) {
    console.error('Erro ao reprovar solicitação:', error);
    throw new Error(error.message);
  }

  // Registrar na auditoria
  await registrarAprovacao(id, 'solicitacao', 'reprovar', comentario);

  return data as DiariaSolicitacao;
}

export async function cancelarEnvioSolicitacao(id: string): Promise<DiariaSolicitacao> {
  const { data, error } = await supabase
    .from('bd_diaria_solicitacoes')
    .update({
      status: 'rascunho' as StatusSolicitacao,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select(`
      *,
      bd_centros_custo (
        id,
        codigo_centro_custo,
        nome_centro_custo
      )
    `)
    .single();

  if (error) {
    console.error('Erro ao cancelar envio:', error);
    throw new Error(error.message);
  }

  // Registrar na auditoria
  await registrarAprovacao(id, 'solicitacao', 'cancelar_envio');

  return data as DiariaSolicitacao;
}

// =====================================================
// RESUMO E ESTATÍSTICAS
// =====================================================

export async function getSolicitacoesResumo(filters?: SolicitacaoFilters): Promise<SolicitacaoResumo> {
  const solicitacoes = await getSolicitacoes(filters);
  
  return {
    total: solicitacoes.length,
    rascunho: solicitacoes.filter(s => s.status === 'rascunho').length,
    enviada: solicitacoes.filter(s => s.status === 'enviada').length,
    autorizada: solicitacoes.filter(s => s.status === 'autorizada').length,
    reprovada: solicitacoes.filter(s => s.status === 'reprovada').length,
  };
}

// =====================================================
// AUDITORIA
// =====================================================

async function registrarAprovacao(
  entidadeId: string, 
  entidade: 'solicitacao' | 'convocacao' | 'relatorio',
  acao: string,
  comentario?: string
): Promise<void> {
  const { error } = await supabase
    .from('bd_diaria_aprovacoes')
    .insert({
      entidade,
      entidade_id: entidadeId,
      acao,
      comentario
    });

  if (error) {
    console.error('Erro ao registrar aprovação:', error);
    // Não lança erro para não interromper o fluxo principal
  }
}

export async function getHistoricoAprovacoes(entidadeId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('bd_diaria_aprovacoes')
    .select('*')
    .eq('entidade_id', entidadeId)
    .order('feito_em', { ascending: false });

  if (error) {
    console.error('Erro ao buscar histórico:', error);
    throw new Error(error.message);
  }

  return data || [];
}
