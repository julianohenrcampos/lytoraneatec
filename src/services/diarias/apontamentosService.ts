// =====================================================
// SERVICE: APONTAMENTOS DE CAMPO - DIÁRIAS
// =====================================================

import { supabase } from '@/integrations/supabase/client';
import type { DiariaApontamento, StatusApontamento } from '@/types/diarias';

// Interface de escopo para filtros obrigatórios
interface ApontamentoScopeFilters {
  responsavel_campo_id?: string;  // Apontador: filtra por responsável
  centro_custo_ids?: string[];  // Gerente: filtra por CCs gerenciados
}

// Buscar apontamentos com filtros
export async function getApontamentos(
  filters?: {
    status?: StatusApontamento;
    responsavel_campo_id?: string;
    data_inicio?: string;
    data_fim?: string;
  },
  scope?: ApontamentoScopeFilters
) {
  let query = supabase
    .from('bd_diaria_apontamentos')
    .select(`
      *,
      bd_diaria_solicitacoes!inner (
        id,
        numero_solicitacao,
        data_inicio,
        data_fim,
        centro_custo_id,
        justificativa,
        status,
        considera_fds_feriado,
        convocados_pre,
        valor_estimado_total,
        criado_por,
        regras_operacionais_snapshot,
        bd_centros_custo (
          id,
          codigo_centro_custo,
          nome_centro_custo
        )
      ),
      responsavel_campo:bd_funcionarios!bd_diaria_apontamentos_responsavel_campo_id_fkey (
        id,
        nome_completo
      )
    `)
    .order('created_at', { ascending: false });

  // Aplicar filtros de ESCOPO OBRIGATÓRIOS
  if (scope?.responsavel_campo_id) {
    query = query.eq('responsavel_campo_id', scope.responsavel_campo_id);
  }

  if (scope?.centro_custo_ids?.length) {
    query = query.in('bd_diaria_solicitacoes.centro_custo_id', scope.centro_custo_ids);
  }

  // Aplicar filtros opcionais
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  
  if (filters?.responsavel_campo_id && !scope?.responsavel_campo_id) {
    query = query.eq('responsavel_campo_id', filters.responsavel_campo_id);
  }

  const { data, error } = await query;
  
  if (error) throw error;
  return data as unknown as DiariaApontamento[];
}

// Buscar apontamento por ID
export async function getApontamentoById(id: string) {
  const { data, error } = await supabase
    .from('bd_diaria_apontamentos')
    .select(`
      *,
      bd_diaria_solicitacoes!inner (
        id,
        numero_solicitacao,
        data_inicio,
        data_fim,
        centro_custo_id,
        justificativa,
        status,
        considera_fds_feriado,
        convocados_pre,
        valor_estimado_total,
        criado_por,
        regras_operacionais_snapshot,
        bd_centros_custo (
          id,
          codigo_centro_custo,
          nome_centro_custo
        )
      ),
      responsavel_campo:bd_funcionarios!bd_diaria_apontamentos_responsavel_campo_id_fkey (
        id,
        nome_completo
      )
    `)
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data as unknown as DiariaApontamento;
}

// Buscar apontamento por solicitação
export async function getApontamentoBySolicitacaoId(solicitacaoId: string) {
  const { data, error } = await supabase
    .from('bd_diaria_apontamentos')
    .select(`
      *,
      bd_diaria_solicitacoes!inner (
        id,
        numero_solicitacao,
        data_inicio,
        data_fim,
        centro_custo_id,
        justificativa,
        status,
        considera_fds_feriado,
        convocados_pre,
        valor_estimado_total,
        criado_por,
        regras_operacionais_snapshot,
        bd_centros_custo (
          id,
          codigo_centro_custo,
          nome_centro_custo
        )
      ),
      responsavel_campo:bd_funcionarios!bd_diaria_apontamentos_responsavel_campo_id_fkey (
        id,
        nome_completo
      )
    `)
    .eq('solicitacao_id', solicitacaoId)
    .maybeSingle();
  
  if (error) throw error;
  return data as unknown as DiariaApontamento | null;
}

// Iniciar apontamento (mudar status para em_andamento)
export async function iniciarApontamento(id: string) {
  const { data, error } = await supabase
    .from('bd_diaria_apontamentos')
    .update({
      status: 'em_andamento',
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// Finalizar apontamento
export async function finalizarApontamento(id: string, observacoes?: string) {
  const { data, error } = await supabase
    .from('bd_diaria_apontamentos')
    .update({
      status: 'finalizado',
      data_finalizacao: new Date().toISOString(),
      observacoes,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// Cancelar apontamento
export async function cancelarApontamento(id: string, observacoes?: string) {
  const { data, error } = await supabase
    .from('bd_diaria_apontamentos')
    .update({
      status: 'cancelado',
      observacoes,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// Toggle edição liberada (SuperAdmin)
// Auditoria: registra em bd_diaria_logs (tipo_evento='edicao_liberada_toggled').
export async function toggleEdicaoLiberada(
  id: string,
  liberada: boolean,
  justificativa?: string
) {
  const { data, error } = await supabase
    .from('bd_diaria_apontamentos')
    .update({
      edicao_liberada: liberada,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select('id, solicitacao_id')
    .single();

  if (error) throw error;

  // Log de auditoria (não bloqueia o fluxo se falhar)
  try {
    const { data: u } = await supabase.auth.getUser();
    const usuarioId = u?.user?.id;
    if (usuarioId && data?.solicitacao_id) {
      await supabase.from('bd_diaria_logs' as any).insert({
        solicitacao_id: data.solicitacao_id,
        tipo_evento: 'edicao_liberada_toggled',
        usuario_id: usuarioId,
        justificativa: justificativa ?? null,
        dados_extras: {
          apontamento_id: id,
          liberada,
          timestamp: new Date().toISOString(),
        },
      });
    }
  } catch (e) {
    console.warn('[apontamentosService] falha ao gravar log edicao_liberada_toggled:', e);
  }

  return data;
}

// Atualizar observações
export async function updateApontamentoObservacoes(id: string, observacoes: string) {
  const { data, error } = await supabase
    .from('bd_diaria_apontamentos')
    .update({
      observacoes,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}
