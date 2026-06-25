// =====================================================
// SERVICE: APONTAMENTOS DE CAMPO - DIÁRIAS
// =====================================================
// NOTA (M3.1): a tabela bd_diaria_apontamentos NÃO possui FKs declaradas
// no schema public. Embeds PostgREST (bd_diaria_solicitacoes!inner, ...)
// causam HTTP 500. Portanto, fazemos fetch base + hidratação por IDs.
// RLS continua sendo a barreira de segurança em cada tabela relacionada.

import { supabase } from '@/integrations/supabase/client';
import type { DiariaApontamento, StatusApontamento } from '@/types/diarias';

interface ApontamentoScopeFilters {
  responsavel_campo_id?: string;
  centro_custo_ids?: string[];
}

// --- Helpers de hidratação --------------------------------------------------

async function hydrateSolicitacoes(ids: string[]) {
  if (ids.length === 0) return new Map<string, any>();
  const { data, error } = await supabase
    .from('bd_diaria_solicitacoes')
    .select(`
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
      regras_operacionais_snapshot
    `)
    .in('id', ids);
  if (error) throw error;
  return new Map((data || []).map((s: any) => [s.id, s]));
}

async function hydrateCentrosCusto(ids: string[]) {
  if (ids.length === 0) return new Map<string, any>();
  const { data, error } = await supabase
    .from('bd_centros_custo')
    .select('id, codigo_centro_custo, nome_centro_custo')
    .in('id', ids);
  if (error) throw error;
  return new Map((data || []).map((c: any) => [c.id, c]));
}

async function hydrateResponsaveis(ids: string[]) {
  if (ids.length === 0) return new Map<string, any>();
  const { data, error } = await supabase
    .from('bd_funcionarios')
    .select('id, nome_completo')
    .in('id', ids);
  if (error) throw error;
  return new Map((data || []).map((f: any) => [f.id, f]));
}

function uniq<T>(arr: (T | null | undefined)[]): T[] {
  return Array.from(new Set(arr.filter((v): v is T => !!v)));
}

async function montarApontamentos(baseRows: any[]): Promise<DiariaApontamento[]> {
  if (!baseRows || baseRows.length === 0) return [];

  const solicitacaoIds = uniq(baseRows.map((r) => r.solicitacao_id));
  const responsavelIds = uniq(baseRows.map((r) => r.responsavel_campo_id));

  const [solMap, respMap] = await Promise.all([
    hydrateSolicitacoes(solicitacaoIds),
    hydrateResponsaveis(responsavelIds),
  ]);

  const centroCustoIds = uniq(
    Array.from(solMap.values()).map((s: any) => s.centro_custo_id)
  );
  const ccMap = await hydrateCentrosCusto(centroCustoIds);

  return baseRows.map((row) => {
    const sol = solMap.get(row.solicitacao_id) || null;
    const cc = sol ? ccMap.get(sol.centro_custo_id) || null : null;
    const resp = respMap.get(row.responsavel_campo_id) || null;
    return {
      ...row,
      bd_diaria_solicitacoes: sol
        ? { ...sol, bd_centros_custo: cc }
        : null,
      responsavel_campo: resp,
    };
  }) as unknown as DiariaApontamento[];
}

// --- Queries principais -----------------------------------------------------

export async function getApontamentos(
  filters?: {
    status?: StatusApontamento;
    responsavel_campo_id?: string;
    data_inicio?: string;
    data_fim?: string;
  },
  scope?: ApontamentoScopeFilters
) {
  // Pré-filtro de escopo por CC (resolve solicitacao_ids antes do fetch base)
  let solIdsFiltro: string[] | null = null;
  if (scope?.centro_custo_ids !== undefined) {
    if (scope.centro_custo_ids.length === 0) {
      return [] as DiariaApontamento[];
    }
    const { data: sols, error: solErr } = await supabase
      .from('bd_diaria_solicitacoes')
      .select('id')
      .in('centro_custo_id', scope.centro_custo_ids);
    if (solErr) throw solErr;
    solIdsFiltro = (sols || []).map((s) => s.id);
    if (solIdsFiltro.length === 0) return [] as DiariaApontamento[];
  }

  let query = supabase
    .from('bd_diaria_apontamentos')
    .select('*')
    .order('created_at', { ascending: false });

  if (scope?.responsavel_campo_id) {
    query = query.eq('responsavel_campo_id', scope.responsavel_campo_id);
  }
  if (solIdsFiltro) {
    query = query.in('solicitacao_id', solIdsFiltro);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.responsavel_campo_id && !scope?.responsavel_campo_id) {
    query = query.eq('responsavel_campo_id', filters.responsavel_campo_id);
  }

  const { data: baseRows, error } = await query;

  if (error) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[AUDIT][apontamento:svc] erro no fetch base', {
        scope,
        filters,
        supabaseError: (error as any)?.message ?? null,
      });
    }
    throw error;
  }

  const hydrated = await montarApontamentos(baseRows || []);

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.info('[AUDIT][apontamento:svc]', {
      scope,
      solIdsCount: solIdsFiltro?.length ?? null,
      filters,
      baseCount: (baseRows || []).length,
      resultCount: hydrated.length,
      hydrate: {
        solicitacoes: uniq((baseRows || []).map((r: any) => r.solicitacao_id)).length,
        responsaveis: uniq((baseRows || []).map((r: any) => r.responsavel_campo_id)).length,
      },
      supabaseError: null,
    });
  }

  return hydrated;
}

export async function getApontamentoById(id: string) {
  const { data, error } = await supabase
    .from('bd_diaria_apontamentos')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  const [hydrated] = await montarApontamentos([data]);
  return hydrated as DiariaApontamento;
}

export async function getApontamentoBySolicitacaoId(solicitacaoId: string) {
  const { data, error } = await supabase
    .from('bd_diaria_apontamentos')
    .select('*')
    .eq('solicitacao_id', solicitacaoId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [hydrated] = await montarApontamentos([data]);
  return hydrated as DiariaApontamento;
}

// --- Mutations (sem embed, sem mudança de contrato) -------------------------

export async function iniciarApontamento(id: string) {
  const { data, error } = await supabase
    .from('bd_diaria_apontamentos')
    .update({
      status: 'em_andamento',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function finalizarApontamento(id: string, observacoes?: string) {
  const { data, error } = await supabase
    .from('bd_diaria_apontamentos')
    .update({
      status: 'finalizado',
      data_finalizacao: new Date().toISOString(),
      observacoes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function cancelarApontamento(id: string, observacoes?: string) {
  const { data, error } = await supabase
    .from('bd_diaria_apontamentos')
    .update({
      status: 'cancelado',
      observacoes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function toggleEdicaoLiberada(
  id: string,
  liberada: boolean,
  justificativa?: string
) {
  const { data, error } = await supabase
    .from('bd_diaria_apontamentos')
    .update({
      edicao_liberada: liberada,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, solicitacao_id')
    .single();

  if (error) throw error;

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

export async function updateApontamentoObservacoes(id: string, observacoes: string) {
  const { data, error } = await supabase
    .from('bd_diaria_apontamentos')
    .update({
      observacoes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
