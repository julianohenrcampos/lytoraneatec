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

// Interface de escopo para filtros obrigatórios
interface SolicitacaoScopeFilters {
  criado_por?: string;  // Engenheiro: filtra por criador
  centro_custo_ids?: string[];  // Gerente: filtra por CCs gerenciados
}

export async function getSolicitacoes(
  filters?: SolicitacaoFilters,
  scope?: SolicitacaoScopeFilters
): Promise<DiariaSolicitacao[]> {
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

  // Aplicar filtros de ESCOPO OBRIGATÓRIOS
  if (scope?.criado_por) {
    query = query.eq('criado_por', scope.criado_por);
  }
  if (scope?.centro_custo_ids?.length) {
    query = query.in('centro_custo_id', scope.centro_custo_ids);
  }

  // Aplicar filtros opcionais do usuário
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
  if (filters?.criado_por && !scope?.criado_por) {
    // Aplicar apenas se não veio do scope
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

// Função para gerar número de solicitação
async function generateNumeroSolicitacao(): Promise<string> {
  const year = new Date().getFullYear();
  
  // Buscar o maior numero_solicitacao do ano atual
  const { data, error } = await supabase
    .from('bd_diaria_solicitacoes')
    .select('numero_solicitacao')
    .like('numero_solicitacao', `${year}-%`)
    .order('numero_solicitacao', { ascending: false })
    .limit(1)
    .maybeSingle();
    
  if (error) {
    console.error('Erro ao buscar último número:', error);
    throw error;
  }
  
  if (!data) {
    // Primeira solicitação do ano
    return `${year}-001`;
  }
  
  // Extrair parte sequencial e incrementar
  const lastNumber = data.numero_solicitacao;
  const sequentialPart = parseInt(lastNumber.split('-')[1], 10);
  const newSequential = sequentialPart + 1;
  
  return `${year}-${newSequential.toString().padStart(3, '0')}`;
}

export async function createSolicitacao(formData: SolicitacaoFormData): Promise<DiariaSolicitacao> {
  // Gerar número de solicitação
  const numero_solicitacao = await generateNumeroSolicitacao();
  
  const insertData = {
    numero_solicitacao,
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
    engenheiro_solicitante_id: formData.engenheiro_solicitante_id || null,
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
  if (formData.engenheiro_solicitante_id !== undefined) updateData.engenheiro_solicitante_id = formData.engenheiro_solicitante_id || null;

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
  // Deletar aprovações relacionadas (sem FK cascade)
  await supabase
    .from('bd_diaria_aprovacoes')
    .delete()
    .eq('entidade_id', id);

  // Deletar solicitação (apontamentos, presenças e convocações são cascateados pelo banco)
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

export async function getSolicitacoesResumo(
  filters?: SolicitacaoFilters,
  scope?: SolicitacaoScopeFilters
): Promise<SolicitacaoResumo> {
  const solicitacoes = await getSolicitacoes(filters, scope);
  
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

export async function checkSolicitacaoCanBeDeleted(id: string) {
  const [apontamentos, presencas, aprovacoes, convocacoes] = await Promise.all([
    supabase.from('bd_diaria_apontamentos').select('id', { count: 'exact', head: true }).eq('solicitacao_id', id),
    supabase.from('bd_diaria_presencas').select('id', { count: 'exact', head: true }).eq('solicitacao_id', id),
    supabase.from('bd_diaria_aprovacoes').select('id', { count: 'exact', head: true }).eq('entidade_id', id),
    supabase.from('bd_diaria_convocacoes').select('id', { count: 'exact', head: true }).eq('solicitacao_id', id),
  ]);
  return {
    canDelete: true,
    details: {
      totalApontamentos: apontamentos.count || 0,
      totalPresencas: presencas.count || 0,
      totalAprovacoes: aprovacoes.count || 0,
      totalConvocacoes: convocacoes.count || 0,
    }
  };
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
