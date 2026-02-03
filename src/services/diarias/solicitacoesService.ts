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
    .order('data_inicio', { ascending: false });

  if (filters?.periodo_inicio) {
    query = query.gte('data_inicio', filters.periodo_inicio);
  }
  if (filters?.periodo_fim) {
    query = query.lte('data_fim', filters.periodo_fim);
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

  return (data || []) as unknown as DiariaSolicitacao[];
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

  return data as unknown as DiariaSolicitacao;
}

export async function createSolicitacao(formData: SolicitacaoFormData): Promise<DiariaSolicitacao> {
  const insertData = {
    data_inicio: formData.data_inicio,
    data_fim: formData.data_fim,
    centro_custo_id: formData.centro_custo_id,
    justificativa: formData.justificativa,
    considera_fds_feriado: formData.considera_fds_feriado ?? false,
    qtde_dias_uteis_estimado: formData.qtde_dias_uteis_estimado ?? 0,
    qtde_fds_estimado: formData.qtde_fds_estimado ?? 0,
    qtde_feriados_estimado: formData.qtde_feriados_estimado ?? 0,
    valor_estimado_total: formData.valor_estimado_total ?? 0,
    convocados_pre: formData.convocados_pre || [],
    responsavel_campo_id: formData.responsavel_campo_id || null,
    status: 'rascunho'
  };

  const { data, error } = await supabase
    .from('bd_diaria_solicitacoes')
    .insert(insertData as any)
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

  return data as unknown as DiariaSolicitacao;
}

export async function updateSolicitacao(id: string, formData: Partial<SolicitacaoFormData>): Promise<DiariaSolicitacao> {
  const updateData: any = {
    updated_at: new Date().toISOString()
  };
  
  if (formData.data_inicio !== undefined) updateData.data_inicio = formData.data_inicio;
  if (formData.data_fim !== undefined) updateData.data_fim = formData.data_fim;
  if (formData.centro_custo_id !== undefined) updateData.centro_custo_id = formData.centro_custo_id;
  if (formData.justificativa !== undefined) updateData.justificativa = formData.justificativa;
  if (formData.considera_fds_feriado !== undefined) updateData.considera_fds_feriado = formData.considera_fds_feriado;
  if (formData.qtde_dias_uteis_estimado !== undefined) updateData.qtde_dias_uteis_estimado = formData.qtde_dias_uteis_estimado;
  if (formData.qtde_fds_estimado !== undefined) updateData.qtde_fds_estimado = formData.qtde_fds_estimado;
  if (formData.qtde_feriados_estimado !== undefined) updateData.qtde_feriados_estimado = formData.qtde_feriados_estimado;
  if (formData.valor_estimado_total !== undefined) updateData.valor_estimado_total = formData.valor_estimado_total;
  if (formData.convocados_pre !== undefined) updateData.convocados_pre = formData.convocados_pre;
  if (formData.responsavel_campo_id !== undefined) updateData.responsavel_campo_id = formData.responsavel_campo_id || null;

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

  return data as unknown as DiariaSolicitacao;
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

  return data as unknown as DiariaSolicitacao;
}

export async function autorizarSolicitacao(
  id: string, 
  comentario?: string,
  responsavelCampoId?: string,
  observacaoGerente?: string
): Promise<DiariaSolicitacao> {
  const { data: userData } = await supabase.auth.getUser();
  
  const updateData: any = {
    status: 'autorizada' as StatusSolicitacao,
    autorizado_por: userData?.user?.id,
    autorizado_em: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  if (responsavelCampoId) {
    updateData.responsavel_campo_id = responsavelCampoId;
  }
  
  if (observacaoGerente) {
    updateData.observacao_gerente = observacaoGerente;
  }
  
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
    console.error('Erro ao autorizar solicitação:', error);
    throw new Error(error.message);
  }

  // Registrar na auditoria
  await registrarAprovacao(id, 'solicitacao', 'aprovar', comentario || observacaoGerente);

  return data as unknown as DiariaSolicitacao;
}

export async function reprovarSolicitacao(
  id: string, 
  comentario?: string,
  observacaoGerente?: string
): Promise<DiariaSolicitacao> {
  const { data: userData } = await supabase.auth.getUser();
  
  const updateData: any = {
    status: 'reprovada' as StatusSolicitacao,
    autorizado_por: userData?.user?.id,
    autorizado_em: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  if (observacaoGerente) {
    updateData.observacao_gerente = observacaoGerente;
  }
  
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
    console.error('Erro ao reprovar solicitação:', error);
    throw new Error(error.message);
  }

  // Registrar na auditoria
  await registrarAprovacao(id, 'solicitacao', 'reprovar', comentario || observacaoGerente);

  return data as unknown as DiariaSolicitacao;
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

  return data as unknown as DiariaSolicitacao;
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
