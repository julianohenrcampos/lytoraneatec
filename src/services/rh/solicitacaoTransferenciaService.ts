// Service de Solicitações de Transferência (persistido).
// Não escreve em bd_funcionarios. Não altera centro de custo de ninguém.
// Apenas grava o pedido/documento.
import { supabase } from '@/integrations/supabase/client';
import type {
  SolicitacaoTransferenciaHeader,
  SolicitacaoTransferenciaItem,
  TransferenciaItemInput,
} from '@/types/solicitacaoRh';
import {
  resolverNomeSolicitante,
  resolverDiretorDaArea,
  resolverGerenteDaArea,
  resolverDiretoriaFinanceira,
} from '@/components/desligamento/_resolverAssinaturas';

const TABLE = 'bd_solicitacoes_transferencia';
const ITENS_TABLE = 'bd_solicitacao_transferencia_itens';

function gerarProtocoloBase(): string {
  const d = new Date();
  const ms = d.getTime() - 3 * 60 * 60 * 1000;
  const x = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `ST-${x.getUTCFullYear()}${pad(x.getUTCMonth() + 1)}${pad(x.getUTCDate())}-${pad(x.getUTCHours())}${pad(x.getUTCMinutes())}${pad(x.getUTCSeconds())}`;
}

const sufixoRand = () => Math.random().toString(36).slice(2, 6).toUpperCase();

function assertScopeOrThrow(
  header: { solicitante_id?: string | null; created_by?: string | null } | null | undefined,
  scopeUserId: string | null,
): void {
  if (scopeUserId == null) return;
  if (!header) throw new Error('Sem permissão para acessar esta solicitação.');
  const owner =
    header.solicitante_id === scopeUserId || header.created_by === scopeUserId;
  if (!owner) throw new Error('Sem permissão para acessar esta solicitação.');
}

export async function listarSolicitacoes(
  scopeUserId: string | null = null,
): Promise<SolicitacaoTransferenciaHeader[]> {
  let q = supabase.from(TABLE).select('*').order('data_solicitacao', { ascending: false });
  if (scopeUserId) {
    q = q.or(`solicitante_id.eq.${scopeUserId},created_by.eq.${scopeUserId}`);
  }
  const { data, error } = await q;
  if (error) throw error;
  console.log('[RH_SCOPE]', { module: 'transferencia', hasScope: scopeUserId !== null, total: data?.length ?? 0 });
  return (data || []) as any;
}

export async function obterSolicitacao(
  id: string,
  scopeUserId: string | null = null,
): Promise<{
  header: SolicitacaoTransferenciaHeader;
  itens: SolicitacaoTransferenciaItem[];
}> {
  const { data: header, error: e1 } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .single();
  if (e1) throw e1;
  assertScopeOrThrow(header as any, scopeUserId);
  const { data: itens, error: e2 } = await supabase
    .from(ITENS_TABLE)
    .select('*')
    .eq('solicitacao_id', id)
    .order('created_at');
  if (e2) throw e2;
  return { header: header as any, itens: (itens || []) as any };
}

export async function criarRascunho(input: {
  solicitante_id?: string | null;
  solicitante_nome_snapshot?: string | null;
  observacoes?: string | null;
}): Promise<SolicitacaoTransferenciaHeader> {
  const base = gerarProtocoloBase();
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const protocolo = tentativa === 0 ? base : `${base}-R${sufixoRand()}`;
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        protocolo,
        solicitante_id: input.solicitante_id ?? null,
        solicitante_nome_snapshot: input.solicitante_nome_snapshot ?? null,
        observacoes: input.observacoes ?? null,
        status: 'rascunho',
      } as any)
      .select()
      .single();
    if (!error) return data as any;
    if ((error as any).code !== '23505') throw error;
  }
  throw new Error('Não foi possível gerar um protocolo único. Tente novamente.');
}

export async function atualizarRascunhoHeader(
  id: string,
  patch: { observacoes?: string | null; total_funcionarios?: number; total_salarios?: number },
  scopeUserId: string | null = null,
): Promise<void> {
  await obterSolicitacao(id, scopeUserId);
  const { error } = await supabase
    .from(TABLE)
    .update({ ...patch, updated_by: (await supabase.auth.getUser()).data.user?.id ?? null } as any)
    .eq('id', id);
  if (error) throw error;
}

/** Remove um único item da solicitação. RLS exige status='rascunho'. */
export async function removerItem(
  item_id: string,
  scopeUserId: string | null = null,
): Promise<void> {
  const { data: it, error: eGet } = await supabase
    .from(ITENS_TABLE)
    .select('solicitacao_id')
    .eq('id', item_id)
    .single();
  if (eGet) throw eGet;
  if (it?.solicitacao_id) {
    await obterSolicitacao(it.solicitacao_id as string, scopeUserId);
  }
  const { error } = await supabase.from(ITENS_TABLE).delete().eq('id', item_id);
  if (error) throw error;
}

export async function substituirItens(
  solicitacao_id: string,
  itens: TransferenciaItemInput[],
  scopeUserId: string | null = null,
): Promise<void> {
  await obterSolicitacao(solicitacao_id, scopeUserId);
  const { error: eDel } = await supabase
    .from(ITENS_TABLE)
    .delete()
    .eq('solicitacao_id', solicitacao_id);
  if (eDel) throw eDel;
  if (itens.length === 0) return;

  const toNum = (v: unknown): number | null => {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  };

  // Payload explícito: apenas colunas conhecidas da tabela, sem spread.
  const payload = itens.map((it) => {
    const alteracao = Boolean(it.alteracao_passagem);
    return {
      solicitacao_id,
      funcionario_id: it.funcionario_id ?? null,
      nome_snapshot: it.nome_snapshot,
      matricula_snapshot: it.matricula_snapshot ?? null,
      cpf_snapshot: it.cpf_snapshot ?? null,
      cargo_snapshot: it.cargo_snapshot ?? null,
      centro_custo_origem_id: it.centro_custo_origem_id ?? null,
      centro_custo_origem_snapshot: it.centro_custo_origem_snapshot ?? null,
      centro_custo_destino_id: it.centro_custo_destino_id ?? null,
      centro_custo_destino_snapshot: it.centro_custo_destino_snapshot ?? null,
      data_admissao_snapshot: it.data_admissao_snapshot ?? null,
      data_transferencia: it.data_transferencia ?? null,
      salario_manual: toNum(it.salario_manual),
      alteracao_passagem: alteracao,
      valor_passagem_atual: alteracao ? toNum(it.valor_passagem_atual) : null,
      valor_passagem_novo: alteracao ? toNum(it.valor_passagem_novo) : null,
    };
  });

  const { error: eIns } = await supabase.from(ITENS_TABLE).insert(payload as any);
  if (eIns) throw eIns;
}

export function calcularTotais(itens: TransferenciaItemInput[]) {
  return {
    total_funcionarios: itens.length,
    total_salarios: itens.reduce((s, it) => s + (it.salario_manual || 0), 0),
  };
}

export async function emitirSolicitacao(
  id: string,
  perfilSolicitante: { funcionario_id?: string | null; nome_completo?: string | null } | null,
  ccIds: Array<string | null>,
  scopeUserId: string | null = null,
): Promise<void> {
  await obterSolicitacao(id, scopeUserId);
  const [solicitante, gerenteArea, diretorArea, diretoriaFinanceira] = await Promise.all([
    resolverNomeSolicitante(perfilSolicitante),
    resolverGerenteDaArea(ccIds),
    resolverDiretorDaArea(ccIds),
    resolverDiretoriaFinanceira(),
  ]);
  const { error } = await supabase
    .from(TABLE)
    .update({
      status: 'emitida',
      solicitante_nome_snapshot: solicitante,
      gerente_area_nome_snapshot: gerenteArea,
      diretor_area_nome_snapshot: diretorArea,
      diretoria_financeira_nome_snapshot: diretoriaFinanceira,
      updated_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    } as any)
    .eq('id', id);
  if (error) throw error;
}

export async function cancelarSolicitacao(
  id: string,
  scopeUserId: string | null = null,
): Promise<void> {
  await obterSolicitacao(id, scopeUserId);
  const { error } = await supabase
    .from(TABLE)
    .update({
      status: 'cancelada',
      updated_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    } as any)
    .eq('id', id);
  if (error) throw error;
}

/** Exclui definitivamente a solicitação. Itens são removidos em cascata. */
export async function excluirSolicitacao(
  id: string,
  scopeUserId: string | null = null,
): Promise<void> {
  await obterSolicitacao(id, scopeUserId);
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────
// Fluxo de aprovação (toggle transferencia_aprovacao_recebedor_ativo)
// ─────────────────────────────────────────────────────────────

const ERROS_TRANSFERENCIA: Record<string, string> = {
  TRANSFERENCIA_APROVACAO_DESATIVADA: 'O fluxo de aprovação de transferências está desativado no momento.',
  SEM_PERMISSAO_EMISSAO: 'Você não tem permissão para emitir solicitações de transferência.',
  SOLICITACAO_NAO_ENCONTRADA: 'Solicitação não encontrada.',
  CC_DESTINO_NAO_ENCONTRADO: 'Centro de custo de destino não encontrado.',
  CC_DESTINO_INATIVO: 'O centro de custo de destino está inativo.',
  CC_DESTINO_SEM_ENGENHEIRO_RESPONSAVEL:
    'O centro de custo de destino não possui Engenheiro Responsável cadastrado. Regularize o cadastro do CC antes de emitir.',
  ENGENHEIRO_SEM_USUARIO_VINCULADO:
    'O Engenheiro Responsável do CC destino não possui usuário vinculado no sistema.',
  DATA_TRANSFERENCIA_OBRIGATORIA: 'Informe a Data da Transferência da solicitação.',
  DESTINO_IGUAL_ORIGEM: 'O centro de custo de destino não pode ser igual ao de origem de um funcionário.',
  SOLICITACAO_SEM_ITENS: 'A solicitação não possui funcionários.',
  FUNCIONARIO_COM_TRANSFERENCIA_PENDENTE:
    'Há funcionário(s) com outra transferência em andamento. Aguarde a conclusão ou cancele a solicitação anterior.',
  SEM_PERMISSAO_DECISAO:
    'Apenas o recebedor designado (com permissão de aprovação) pode decidir esta solicitação.',
  DECISAO_INVALIDA: 'Decisão inválida.',
  MOTIVO_REJEICAO_OBRIGATORIO_MIN_10: 'Informe o motivo da rejeição (mínimo 10 caracteres).',
};

function traduzirErroTransferencia(msg: string): string {
  if (msg.includes('SEM_AUTORIDADE_CC_ORIGEM')) {
    const cc = msg.split(':').pop()?.trim();
    return `Você não tem autoridade sobre o centro de custo de origem${cc ? ` (${cc})` : ''}.`;
  }
  if (msg.includes('ORIGEM_DIVERGENTE')) return msg;
  if (msg.includes('STATUS_INVALIDO')) return 'A solicitação não está em estado válido para esta ação.';
  for (const [codigo, texto] of Object.entries(ERROS_TRANSFERENCIA)) {
    if (msg.includes(codigo)) return texto;
  }
  return msg;
}

/** Emite a solicitação para aprovação do engenheiro responsável do CC destino (RPC autoritativa). */
export async function emitirParaAprovacao(
  id: string,
  centroCustoDestinoId: string,
  dataTransferencia: string,
): Promise<void> {
  const { error } = await supabase.rpc('fn_transferencia_emitir', {
    p_solicitacao_id: id,
    p_centro_custo_destino_id: centroCustoDestinoId,
    p_data_transferencia: dataTransferencia,
  });
  if (error) throw new Error(traduzirErroTransferencia(error.message));
}

/** Aprova (efetivando a lotação) ou rejeita a solicitação (RPC autoritativa). */
export async function decidirTransferencia(
  id: string,
  decisao: 'APROVAR' | 'REPROVAR',
  observacao?: string,
): Promise<void> {
  const { error } = await supabase.rpc('fn_transferencia_decidir', {
    p_solicitacao_id: id,
    p_decisao: decisao,
    p_observacao: observacao ?? null,
  });
  if (error) throw new Error(traduzirErroTransferencia(error.message));
}
