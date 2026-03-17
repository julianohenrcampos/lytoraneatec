import { supabase } from "@/integrations/supabase/client";
import { notificationService } from "@/services/notificationService";
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
      ),
      engenheiro_solicitante:bd_funcionarios!bd_diaria_solicitacoes_engenheiro_solicitante_id_fkey(
        id,
        nome_completo
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

// Função para gerar número de solicitação via RPC (bypass RLS)
async function generateNumeroSolicitacao(): Promise<string> {
  const { data, error } = await supabase.rpc('generate_numero_solicitacao');
  if (error) {
    console.error('Erro ao gerar número de solicitação:', error);
    throw error;
  }
  return data as string;
}

// Verificar duplicidade de funcionários em solicitações com período sobreposto
async function verificarDuplicidadeSolicitacao(
  dataInicio: string,
  dataFim: string,
  convocadosPre: any[],
  solicitacaoAtualId?: string
): Promise<void> {
  const funcionarioIds = (convocadosPre || [])
    .map((c: any) => c.funcionario_id)
    .filter(Boolean);

  if (funcionarioIds.length === 0) return;

  const { data, error } = await supabase.rpc('verificar_duplicidade_solicitacao', {
    p_data_inicio: dataInicio,
    p_data_fim: dataFim,
    p_funcionario_ids: funcionarioIds,
    p_solicitacao_atual_id: solicitacaoAtualId || null,
  });

  if (error) {
    console.error('Erro ao verificar duplicidade:', error);
    return; // Não bloquear em caso de erro na verificação
  }

  const resultado = data as any;
  if (resultado?.duplicada) {
    const nomes = Array.isArray(resultado.funcionarios_conflito)
      ? resultado.funcionarios_conflito.join(', ')
      : '';
    throw new Error(
      `Funcionário(s) ${nomes} já está(ão) na solicitação Nº ${resultado.numero_solicitacao} no mesmo período. Não é possível duplicar.`
    );
  }
}

export async function createSolicitacao(formData: SolicitacaoFormData): Promise<DiariaSolicitacao> {
  // Verificar duplicidade antes de criar
  await verificarDuplicidadeSolicitacao(
    formData.data_inicio,
    formData.data_fim,
    formData.convocados_pre || []
  );

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
  // Deletar notificações vinculadas à solicitação
  await notificationService.deleteNotificationsByMetadata('solicitacao_id', id);

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
  // Buscar solicitação para validar duplicidade antes de enviar
  const solicitacao = await getSolicitacaoById(id);
  if (solicitacao) {
    await verificarDuplicidadeSolicitacao(
      solicitacao.data_inicio,
      solicitacao.data_fim,
      Array.isArray(solicitacao.convocados_pre) ? solicitacao.convocados_pre as any[] : [],
      id
    );
  }

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
  const [apontamentos, presencas, aprovacoes] = await Promise.all([
    supabase.from('bd_diaria_apontamentos').select('id', { count: 'exact', head: true }).eq('solicitacao_id', id),
    supabase.from('bd_diaria_presencas').select('id', { count: 'exact', head: true }).eq('solicitacao_id', id),
    supabase.from('bd_diaria_aprovacoes').select('id', { count: 'exact', head: true }).eq('entidade_id', id),
  ]);
  return {
    canDelete: true,
    details: {
      totalApontamentos: apontamentos.count || 0,
      totalPresencas: presencas.count || 0,
      totalAprovacoes: aprovacoes.count || 0,
    }
  };
}

export async function cancelarAutorizacao(id: string): Promise<DiariaSolicitacao> {
  // 1. Deletar presenças vinculadas
  await supabase
    .from('bd_diaria_presencas')
    .delete()
    .eq('solicitacao_id', id);

  // 2. Deletar apontamento vinculado
  await supabase
    .from('bd_diaria_apontamentos')
    .delete()
    .eq('solicitacao_id', id);

  // 3. Reverter status para enviada e limpar campos de aprovação
  const { data, error } = await supabase
    .from('bd_diaria_solicitacoes')
    .update({
      status: 'enviada' as StatusSolicitacao,
      autorizado_por: null,
      autorizado_em: null,
      observacao_gerente: null,
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
    console.error('Erro ao cancelar autorização:', error);
    throw new Error(error.message);
  }

  // 4. Registrar na auditoria
  await registrarAprovacao(id, 'solicitacao', 'cancelar_autorizacao');

  return data as unknown as DiariaSolicitacao;
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

// =====================================================
// ADICIONAR / REMOVER FUNCIONÁRIO DO CONVOCADOS_PRE
// =====================================================

export async function adicionarFuncionarioConvocado(
  solicitacaoId: string,
  funcionarioData: {
    funcionario_id: string;
    funcao_id: string;
    valor_diaria: number;
    valor_diaria_exclusiva?: number;
    valor_refeicao?: number;
    nome_funcionario: string;
    nome_funcao: string;
  }
): Promise<void> {
  // Buscar convocados_pre atual
  const { data: solicitacao, error: fetchError } = await supabase
    .from('bd_diaria_solicitacoes')
    .select('convocados_pre')
    .eq('id', solicitacaoId)
    .single();

  if (fetchError) throw new Error(fetchError.message);

  const currentList = Array.isArray(solicitacao?.convocados_pre) 
    ? solicitacao.convocados_pre as any[] 
    : [];

  // Verificar se já existe
  if (currentList.some((c: any) => c.funcionario_id === funcionarioData.funcionario_id)) {
    throw new Error('Funcionário já está na lista de convocados');
  }

  const updatedList = [...currentList, funcionarioData];

  const { error } = await supabase
    .from('bd_diaria_solicitacoes')
    .update({ 
      convocados_pre: updatedList,
      updated_at: new Date().toISOString()
    })
    .eq('id', solicitacaoId);

  if (error) throw new Error(error.message);
}

export async function removerFuncionarioConvocado(
  solicitacaoId: string,
  funcionarioId: string
): Promise<void> {
  const { data: solicitacao, error: fetchError } = await supabase
    .from('bd_diaria_solicitacoes')
    .select('convocados_pre')
    .eq('id', solicitacaoId)
    .single();

  if (fetchError) throw new Error(fetchError.message);

  const currentList = Array.isArray(solicitacao?.convocados_pre) 
    ? solicitacao.convocados_pre as any[] 
    : [];

  const updatedList = currentList.filter((c: any) => c.funcionario_id !== funcionarioId);

  const { error } = await supabase
    .from('bd_diaria_solicitacoes')
    .update({ 
      convocados_pre: updatedList,
      updated_at: new Date().toISOString()
    })
    .eq('id', solicitacaoId);

  if (error) throw new Error(error.message);
}

// Verificar se funcionário está em outra solicitação autorizada no mesmo período
export async function verificarFuncionarioEmOutraSolicitacao(
  funcionarioId: string,
  dataInicio: string,
  dataFim: string,
  solicitacaoAtualId: string
): Promise<{ emOutra: boolean; numeroSolicitacao?: string; solicitacaoId?: string }> {
  const { data: solicitacoes, error } = await supabase
    .from('bd_diaria_solicitacoes')
    .select('id, numero_solicitacao, convocados_pre')
    .eq('status', 'autorizada')
    .neq('id', solicitacaoAtualId)
    .lte('data_inicio', dataFim)
    .gte('data_fim', dataInicio);

  if (error) {
    console.error('Erro ao verificar duplicidade:', error);
    return { emOutra: false };
  }

  for (const sol of solicitacoes || []) {
    const convocados = Array.isArray(sol.convocados_pre) ? sol.convocados_pre as any[] : [];
    if (convocados.some((c: any) => c.funcionario_id === funcionarioId)) {
      return { emOutra: true, numeroSolicitacao: sol.numero_solicitacao, solicitacaoId: sol.id };
    }
  }

  return { emOutra: false };
}
