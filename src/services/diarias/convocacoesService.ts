import { supabase } from "@/integrations/supabase/client";
import type { 
  DiariaConvocacao, 
  ConvocacaoFormData, 
  ConvocacaoFilters,
  ConvocacaoResumo,
  StatusConvocacao 
} from "@/types/diarias";

// =====================================================
// CRUD - CONVOCAÇÕES DE DIÁRIA
// =====================================================

export async function getConvocacoes(filters?: ConvocacaoFilters): Promise<DiariaConvocacao[]> {
  let query = supabase
    .from('bd_diaria_convocacoes')
    .select(`
      *,
      bd_centros_custo (
        id,
        codigo_centro_custo,
        nome_centro_custo
      ),
      bd_diaria_solicitacoes (
        id,
        data,
        justificativa,
        status
      ),
      bd_diaria_convocados (
        id,
        funcionario_id,
        funcao_id,
        valor_diaria_aplicada,
        presenca_status,
        bd_funcionarios (
          id,
          nome_completo
        ),
        bd_funcoes (
          id,
          nome_funcao
        )
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
  if (filters?.solicitacao_id) {
    query = query.eq('solicitacao_id', filters.solicitacao_id);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Erro ao buscar convocações:', error);
    throw new Error(error.message);
  }

  return (data || []) as DiariaConvocacao[];
}

export async function getConvocacaoById(id: string): Promise<DiariaConvocacao | null> {
  const { data, error } = await supabase
    .from('bd_diaria_convocacoes')
    .select(`
      *,
      bd_centros_custo (
        id,
        codigo_centro_custo,
        nome_centro_custo
      ),
      bd_diaria_solicitacoes (
        id,
        data,
        justificativa,
        status
      ),
      bd_diaria_convocados (
        id,
        funcionario_id,
        funcao_id,
        valor_diaria_aplicada,
        hora_entrada,
        hora_saida,
        intervalo_inicio,
        intervalo_fim,
        presenca_status,
        confirmado_por,
        confirmado_em,
        bd_funcionarios (
          id,
          nome_completo,
          cpf,
          imagem
        ),
        bd_funcoes (
          id,
          nome_funcao,
          valor_diaria,
          valor_diaria_exclusiva
        )
      )
    `)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Erro ao buscar convocação:', error);
    throw new Error(error.message);
  }

  return data as DiariaConvocacao;
}

export async function createConvocacao(formData: ConvocacaoFormData): Promise<DiariaConvocacao> {
  const { data, error } = await supabase
    .from('bd_diaria_convocacoes')
    .insert({
      solicitacao_id: formData.solicitacao_id,
      data: formData.data,
      centro_custo_id: formData.centro_custo_id,
      observacao: formData.observacao,
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
    console.error('Erro ao criar convocação:', error);
    throw new Error(error.message);
  }

  return data as DiariaConvocacao;
}

export async function updateConvocacao(id: string, formData: Partial<ConvocacaoFormData>): Promise<DiariaConvocacao> {
  const { data, error } = await supabase
    .from('bd_diaria_convocacoes')
    .update({
      ...formData,
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
    console.error('Erro ao atualizar convocação:', error);
    throw new Error(error.message);
  }

  return data as DiariaConvocacao;
}

export async function deleteConvocacao(id: string): Promise<void> {
  const { error } = await supabase
    .from('bd_diaria_convocacoes')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Erro ao deletar convocação:', error);
    throw new Error(error.message);
  }
}

// =====================================================
// AÇÕES DE STATUS
// =====================================================

export async function enviarParaAprovacao(id: string): Promise<DiariaConvocacao> {
  // Verificar se há convocados
  const { data: convocados } = await supabase
    .from('bd_diaria_convocados')
    .select('id')
    .eq('convocacao_id', id);

  if (!convocados || convocados.length === 0) {
    throw new Error('Não é possível enviar uma convocação sem funcionários.');
  }

  const { data, error } = await supabase
    .from('bd_diaria_convocacoes')
    .update({
      status: 'enviada_aprovacao' as StatusConvocacao,
      enviado_em: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Erro ao enviar para aprovação:', error);
    throw new Error(error.message);
  }

  // Registrar na auditoria
  await registrarAprovacaoConvocacao(id, 'enviar');

  return data as DiariaConvocacao;
}

export async function aprovarConvocacao(id: string, comentario?: string): Promise<DiariaConvocacao> {
  const { data: userData } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from('bd_diaria_convocacoes')
    .update({
      status: 'aprovada' as StatusConvocacao,
      aprovado_por: userData?.user?.id,
      aprovado_em: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Erro ao aprovar convocação:', error);
    throw new Error(error.message);
  }

  // Registrar na auditoria
  await registrarAprovacaoConvocacao(id, 'aprovar', comentario);

  return data as DiariaConvocacao;
}

export async function reprovarConvocacao(id: string, comentario?: string): Promise<DiariaConvocacao> {
  const { data: userData } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from('bd_diaria_convocacoes')
    .update({
      status: 'reprovada' as StatusConvocacao,
      aprovado_por: userData?.user?.id,
      aprovado_em: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Erro ao reprovar convocação:', error);
    throw new Error(error.message);
  }

  // Registrar na auditoria
  await registrarAprovacaoConvocacao(id, 'reprovar', comentario);

  return data as DiariaConvocacao;
}

export async function iniciarExecucao(id: string): Promise<DiariaConvocacao> {
  const { data, error } = await supabase
    .from('bd_diaria_convocacoes')
    .update({
      status: 'executando' as StatusConvocacao,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Erro ao iniciar execução:', error);
    throw new Error(error.message);
  }

  return data as DiariaConvocacao;
}

export async function finalizarConvocacao(id: string): Promise<DiariaConvocacao> {
  const { data, error } = await supabase
    .from('bd_diaria_convocacoes')
    .update({
      status: 'finalizada' as StatusConvocacao,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Erro ao finalizar convocação:', error);
    throw new Error(error.message);
  }

  return data as DiariaConvocacao;
}

export async function cancelarConvocacao(id: string, comentario?: string): Promise<DiariaConvocacao> {
  const { data, error } = await supabase
    .from('bd_diaria_convocacoes')
    .update({
      status: 'cancelada' as StatusConvocacao,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Erro ao cancelar convocação:', error);
    throw new Error(error.message);
  }

  // Registrar na auditoria
  await registrarAprovacaoConvocacao(id, 'cancelar', comentario);

  return data as DiariaConvocacao;
}

// =====================================================
// RESUMO E ESTATÍSTICAS
// =====================================================

export async function getConvocacoesResumo(filters?: ConvocacaoFilters): Promise<ConvocacaoResumo> {
  const convocacoes = await getConvocacoes(filters);
  
  return {
    total: convocacoes.length,
    rascunho: convocacoes.filter(c => c.status === 'rascunho').length,
    enviada_aprovacao: convocacoes.filter(c => c.status === 'enviada_aprovacao').length,
    aprovada: convocacoes.filter(c => c.status === 'aprovada').length,
    reprovada: convocacoes.filter(c => c.status === 'reprovada').length,
    executando: convocacoes.filter(c => c.status === 'executando').length,
    finalizada: convocacoes.filter(c => c.status === 'finalizada').length,
    cancelada: convocacoes.filter(c => c.status === 'cancelada').length,
  };
}

// =====================================================
// AUDITORIA
// =====================================================

async function registrarAprovacaoConvocacao(
  convocacaoId: string, 
  acao: string,
  comentario?: string
): Promise<void> {
  const { error } = await supabase
    .from('bd_diaria_aprovacoes')
    .insert({
      entidade: 'convocacao',
      entidade_id: convocacaoId,
      acao,
      comentario
    });

  if (error) {
    console.error('Erro ao registrar aprovação:', error);
  }
}
