// =====================================================
// SERVICE: ADITIVOS DE DIÁRIAS (Fase I.2)
// =====================================================
// Wrappers tipados sobre as RPCs SECURITY DEFINER criadas na Fase I.1.
// NÃO escreve diretamente em bd_diaria_aditivos (policy aditivos_no_direct_write).
// NÃO toca em bd_diaria_presencas, apontamentos ou pagamento.
// =====================================================

import { supabase } from '@/integrations/supabase/client';
import type { Database, Json } from '@/integrations/supabase/types';

// ---------- Tipos públicos ----------

export type AditivoStatus = 'pendente' | 'aprovado' | 'reprovado' | 'cancelado';

/** Tipos persistidos em bd_diaria_aditivos.tipo */
export type AditivoTipo =
  | 'funcionario_inclusao'
  | 'funcionario_remocao'
  | 'dia_adicao'
  | 'dia_remocao';

/** Ação aceita pela RPC solicitar_aditivo_dia — valor exato persistido em bd_diaria_aditivos.tipo */
export type AditivoDiaAcao = 'adicionar_dia' | 'remover_dia';

/** Item enviado em p_funcionarios — depende da ação. */
export type AditivoDiaFuncionarioItem =
  | { funcionario_id: string; snapshot: SnapshotFuncionario } // adicionar_dia
  | { funcionario_id: string };                                // remover_dia

export interface SnapshotFuncionario {
  funcionario_id: string;
  nome?: string | null;
  matricula?: string | null;
  funcao_id?: string | null;
  funcao_nome?: string | null;
  centro_custo_id?: string | null;
  centro_custo_nome?: string | null;
  valor_diaria?: number | null;
  valor_diaria_exclusiva?: number | null;
  valor_refeicao?: number | null;
  [k: string]: unknown;
}

export interface ImpactoFinanceiro {
  valor_diaria?: number;
  valor_refeicao?: number;
  total?: number;
  [k: string]: unknown;
}

export type Aditivo = Database['public']['Tables']['bd_diaria_aditivos']['Row'];

export interface SolicitarAditivoFuncionarioInput {
  solicitacaoId: string;
  funcionarioId: string;
  dataAjustada: string; // YYYY-MM-DD
  snapshotFuncionario: SnapshotFuncionario;
  justificativa: string;
  impacto?: ImpactoFinanceiro;
}

export interface SolicitarAditivoDiaInput {
  solicitacaoId: string;
  dataAjustada: string; // YYYY-MM-DD
  acao: AditivoDiaAcao;
  funcionarios: AditivoDiaFuncionarioItem[];
  justificativa: string;
  impacto?: ImpactoFinanceiro;
}

export interface ListarAditivosPendentesFiltros {
  solicitacaoId?: string;
  tipo?: AditivoTipo;
  limit?: number;
}

// ---------- Tradução de erros ----------

function traduzirErroAditivo(rawMessage: string): string {
  const msg = (rawMessage || '').toUpperCase();
  if (msg.includes('AUTH_REQUIRED')) return 'Sessão expirada. Faça login novamente.';
  if (msg.includes('PERMISSION_DENIED') || msg.includes('PERMISSAO_NEGADA_APROVAR_ADITIVO')) return 'Você não tem permissão para aprovar este aditivo.';
  if (msg.includes('REMOCAO_BLOQUEADA_PRESENCA_REAL_TOTAL')) return 'Não é possível aprovar a remoção: todos os funcionários já possuem presença real registrada nessa data.';
  if (msg.includes('REMOCAO_BLOQUEADA_PRESENCA_REAL')) return 'Não é possível aprovar a remoção. Já existe presença real registrada nessa data.';
  if (msg.includes('JUSTIFICATIVA_OBRIGATORIA')) return 'Justificativa é obrigatória para solicitar o aditivo.';
  if (msg.includes('CONFLICT_PRESENCA_REAL')) return 'Conflito: já existe presença registrada para essa data.';
  if (msg.includes('SOLICITACAO_NAO_ENCONTRADA')) return 'Solicitação de diária não encontrada.';
  if (msg.includes('ADITIVO_NAO_ENCONTRADO')) return 'Aditivo não encontrado.';
  if (msg.includes('ADITIVO_NAO_PENDENTE') || msg.includes('STATUS_INVALIDO')) return 'Este aditivo já foi analisado.';
  if (msg.includes('DATA_FORA_PERIODO')) return 'Data ajustada fora do período da solicitação.';
  if (msg.includes('FUNCIONARIO_DUPLICADO')) return 'Funcionário já consta na convocação para essa data.';
  if (msg.includes('FUNCIONARIO_NAO_CONVOCADO')) return 'Funcionário não está convocado nessa data.';
  return rawMessage || 'Erro ao processar aditivo.';
}

function throwTraduzido(error: { message: string } | null): never {
  throw new Error(traduzirErroAditivo(error?.message ?? ''));
}

// ---------- Mutations (RPCs) ----------

export async function solicitarAditivoFuncionario(
  input: SolicitarAditivoFuncionarioInput,
): Promise<string> {
  const { data, error } = await supabase.rpc('solicitar_aditivo_funcionario', {
    p_solicitacao_id: input.solicitacaoId,
    p_funcionario_id: input.funcionarioId,
    p_data_ajustada: input.dataAjustada,
    p_snapshot: input.snapshotFuncionario as unknown as Json,
    p_justificativa: input.justificativa,
    p_impacto: (input.impacto ?? {}) as unknown as Json,
  });
  if (error) throwTraduzido(error);
  return data as string;
}

export async function solicitarAditivoDia(input: SolicitarAditivoDiaInput): Promise<string> {
  const { data, error } = await supabase.rpc('solicitar_aditivo_dia', {
    p_solicitacao_id: input.solicitacaoId,
    p_data_ajustada: input.dataAjustada,
    p_tipo: input.acao,
    p_funcionarios: input.funcionarios as unknown as Json,
    p_justificativa: input.justificativa,
    p_impacto: (input.impacto ?? {}) as unknown as Json,
  });
  if (error) throwTraduzido(error);
  return data as string;
}

export interface AprovarAditivoResumo {
  aditivo_id: string;
  tipo: string;
  data: string | null;
  aplicados: Array<{ funcionario_id: string }>;
  ignorados: Array<{ funcionario_id: string; nome: string; data: string; motivo: string }>;
}

export async function aprovarAditivo(
  aditivoId: string,
  observacao?: string,
): Promise<AprovarAditivoResumo | null> {
  const { data, error } = await (supabase.rpc as any)('aprovar_aditivo', {
    p_aditivo_id: aditivoId,
    p_observacao: observacao,
  });
  if (error) throwTraduzido(error);
  return (data as AprovarAditivoResumo) ?? null;
}


export async function reprovarAditivo(aditivoId: string, motivo: string): Promise<void> {
  if (!motivo?.trim()) {
    throw new Error('Motivo da reprovação é obrigatório.');
  }
  const { error } = await supabase.rpc('reprovar_aditivo', {
    p_aditivo_id: aditivoId,
    p_motivo: motivo,
  });
  if (error) throwTraduzido(error);
}

export async function cancelarAditivo(aditivoId: string, motivo?: string): Promise<void> {
  const { error } = await supabase.rpc('cancelar_aditivo', {
    p_aditivo_id: aditivoId,
    p_motivo: motivo,
  });
  if (error) throwTraduzido(error);
}

// ---------- Queries (RLS filtra) ----------

export async function getAditivoById(id: string): Promise<Aditivo | null> {
  const { data, error } = await supabase
    .from('bd_diaria_aditivos')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as Aditivo) ?? null;
}

export async function listarAditivosPorSolicitacao(solicitacaoId: string): Promise<Aditivo[]> {
  const { data, error } = await supabase
    .from('bd_diaria_aditivos')
    .select('*')
    .eq('solicitacao_id', solicitacaoId)
    .order('solicitado_em', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Aditivo[];
}

export async function listarAditivosPendentes(
  filtros?: ListarAditivosPendentesFiltros,
): Promise<Aditivo[]> {
  let query = supabase
    .from('bd_diaria_aditivos')
    .select('*')
    .eq('status', 'pendente')
    .order('solicitado_em', { ascending: true });

  if (filtros?.solicitacaoId) query = query.eq('solicitacao_id', filtros.solicitacaoId);
  if (filtros?.tipo) query = query.eq('tipo', filtros.tipo);
  if (filtros?.limit) query = query.limit(filtros.limit);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Aditivo[];
}

export async function contarAditivosPendentes(): Promise<number> {
  const { count, error } = await supabase
    .from('bd_diaria_aditivos')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pendente');
  if (error) throw error;
  return count ?? 0;
}

// ---------- Notificação complementar ao aprovador da obra ----------
// Complementa a notificação já criada pelo RPC (que vincula apenas
// SuperAdms via acesso_global) adicionando o aprovador formal do CC
// como destinatário. Não cria notificação nova: reaproveita o
// notificacao_id já persistido em bd_diaria_aditivos.notificacao_id.
import { getAprovadorDoCentroCusto, resolverUserId } from './diariaNotificationService';

export async function notificarAprovadorAditivo(params: {
  aditivoId: string;
  centroCustoId: string;
}): Promise<void> {
  try {
    const { data: aditivo } = await supabase
      .from('bd_diaria_aditivos')
      .select('notificacao_id')
      .eq('id', params.aditivoId)
      .maybeSingle();
    if (!aditivo?.notificacao_id) return;

    const aprovadorFuncId = await getAprovadorDoCentroCusto(params.centroCustoId);
    if (!aprovadorFuncId) return;
    const userId = await resolverUserId(aprovadorFuncId);
    if (!userId) return;

    await supabase
      .from('bd_notificacoes_usuarios')
      .upsert(
        { notificacao_id: aditivo.notificacao_id, usuario_id: userId, lida: false },
        { onConflict: 'notificacao_id,usuario_id', ignoreDuplicates: true },
      );
  } catch (err) {
    console.error('[Aditivo] Falha ao notificar aprovador da obra:', err);
  }
}
