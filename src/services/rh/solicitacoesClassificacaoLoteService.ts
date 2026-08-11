// Service de Solicitações de Classificação em Lote (Fase 2B v3).
// PURO: não importa hooks React. Gates RBAC ficam na UI; service confia na RLS.
//
// REGRA OPERACIONAL CENTRAL (v3):
//   Rascunho NORMAL nunca contém itens. Itens só são gravados em
//   bd_funcionario_classificacao_solicitacoes dentro de
//   `emitirSolicitacaoClassificacaoLote`. Um lote `rascunho` com
//   total_itens > 0 representa INCONSISTÊNCIA (falha entre o batch INSERT
//   e o UPDATE final para `emitida`) — bloqueado para qualquer ação além
//   de visualizar.
//
// LIMITAÇÃO Fase 2B: salário NÃO é persistido em
// bd_funcionario_classificacao_solicitacoes. O fluxo individual usa o
// valor apenas em memória/PDF. PDF fiel de lote exigirá nova coluna e
// migration em fase futura.

import { supabase } from '@/integrations/supabase/client';
import type {
  ItemRascunhoEmMemoria,
  SolicitacaoClassificacaoLoteHeader,
  SolicitacaoClassificacaoLoteHeaderListado,
  SolicitacaoClassificacaoLoteItem,
} from '@/types/rh/solicitacoesClassificacaoLote';
import { getNomeSolicitanteClassificacao } from '@/services/rh/getNomeSolicitanteClassificacao';
import { montarPayloadClassificacaoSolicitacao } from '@/services/rh/classificacaoSolicitacaoService';

const HEADER_TABLE = 'bd_solicitacoes_classificacao';
const ITENS_TABLE = 'bd_funcionario_classificacao_solicitacoes';

async function getCurrentUserIdOrThrow(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const uid = data?.user?.id;
  if (!uid) throw new Error('Usuário não autenticado.');
  return uid;
}

/** Protocolo SCL-YYYYMMDD-HHMMSS em America/Sao_Paulo (UTC-3 fixo). */
function gerarProtocoloBase(): string {
  const ms = Date.now() - 3 * 60 * 60 * 1000;
  const x = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `SCL-${x.getUTCFullYear()}${pad(x.getUTCMonth() + 1)}${pad(
    x.getUTCDate(),
  )}-${pad(x.getUTCHours())}${pad(x.getUTCMinutes())}${pad(x.getUTCSeconds())}`;
}
function sufixoRand(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

export async function listarSolicitacoesClassificacaoLote(): Promise<
  SolicitacaoClassificacaoLoteHeaderListado[]
> {
  const { data: headers, error } = await supabase
    .from(HEADER_TABLE)
    .select('*')
    .order('data_solicitacao', { ascending: false });
  if (error) throw error;
  const list = (headers || []) as SolicitacaoClassificacaoLoteHeader[];
  if (list.length === 0) return [];

  const ids = list.map((h) => h.id);
  const { data: itens, error: e2 } = await supabase
    .from(ITENS_TABLE)
    .select('id, solicitacao_lote_id')
    .in('solicitacao_lote_id', ids);
  if (e2) throw e2;
  const counts = new Map<string, number>();
  for (const it of itens || []) {
    const k = (it as any).solicitacao_lote_id as string | null;
    if (!k) continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  return list.map((h) => {
    const total = counts.get(h.id) ?? 0;
    return {
      ...h,
      total_itens: total,
      inconsistente: h.status === 'rascunho' && total > 0,
    };
  });
}

export async function obterSolicitacaoClassificacaoLote(
  id: string,
): Promise<SolicitacaoClassificacaoLoteHeader> {
  const { data, error } = await supabase
    .from(HEADER_TABLE)
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as SolicitacaoClassificacaoLoteHeader;
}

export async function listarItensDoLote(
  loteId: string,
): Promise<SolicitacaoClassificacaoLoteItem[]> {
  const { data, error } = await supabase
    .from(ITENS_TABLE)
    .select('*')
    .eq('solicitacao_lote_id', loteId)
    .order('solicitado_em', { ascending: true });
  if (error) throw error;
  return (data || []) as SolicitacaoClassificacaoLoteItem[];
}

async function contarItensDoLote(loteId: string): Promise<number> {
  const { count, error } = await supabase
    .from(ITENS_TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('solicitacao_lote_id', loteId);
  if (error) throw error;
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Escrita — funções dedicadas. APENAS `emitirSolicitacaoClassificacaoLote`
// grava itens. Qualquer outra operação que tente inserir itens em rascunho
// é proibida por construção.
// ---------------------------------------------------------------------------

/** Cria o cabeçalho em rascunho vazio. NUNCA insere itens. */
export async function criarRascunhoClassificacaoLote(input: {
  observacoes?: string | null;
}): Promise<SolicitacaoClassificacaoLoteHeader> {
  const userId = await getCurrentUserIdOrThrow();
  const info = await getNomeSolicitanteClassificacao(userId, {
    usarMetadataDoAuth: true,
  });
  const base = gerarProtocoloBase();

  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const protocolo = tentativa === 0 ? base : `${base}-R${sufixoRand()}`;
    const { data, error } = await supabase
      .from(HEADER_TABLE)
      .insert({
        protocolo,
        status: 'rascunho',
        solicitante_id: userId,
        solicitante_nome_snapshot: info.nome ?? null,
        observacoes: input.observacoes ?? null,
        created_by: userId,
        updated_by: userId,
      } as any)
      .select('*')
      .single();
    if (!error) return data as SolicitacaoClassificacaoLoteHeader;
    if ((error as any).code !== '23505') throw error;
  }
  throw new Error('Não foi possível gerar um protocolo único. Tente novamente.');
}

/**
 * UPDATE somente de `observacoes` (+ updated_by). Guarda: lote precisa
 * estar em rascunho e SEM itens (rascunho normal). Caso contrário,
 * trata-se de inconsistência e a operação é bloqueada.
 */
export async function atualizarObservacoesRascunho(
  id: string,
  observacoes: string | null,
): Promise<void> {
  const userId = await getCurrentUserIdOrThrow();
  const header = await obterSolicitacaoClassificacaoLote(id);
  if (header.status !== 'rascunho') {
    throw new Error('Apenas rascunhos podem ter observações alteradas.');
  }
  const total = await contarItensDoLote(id);
  if (total > 0) {
    throw new Error(
      'Lote em estado inconsistente (rascunho com itens). Edição bloqueada nesta fase.',
    );
  }
  const { error } = await supabase
    .from(HEADER_TABLE)
    .update({ observacoes, updated_by: userId } as any)
    .eq('id', id);
  if (error) throw error;
}

/**
 * Cancela um rascunho VAZIO. Guard duplo: status='rascunho' e total_itens=0.
 * Lote com itens (inclusive inconsistente) não pode ser cancelado nesta fase.
 */
export async function cancelarRascunhoVazio(
  id: string,
  motivo?: string | null,
): Promise<void> {
  const userId = await getCurrentUserIdOrThrow();
  const header = await obterSolicitacaoClassificacaoLote(id);
  if (header.status !== 'rascunho') {
    throw new Error('Apenas rascunhos podem ser cancelados nesta fase.');
  }
  const total = await contarItensDoLote(id);
  if (total > 0) {
    throw new Error(
      'Cancelamento de lote com itens será liberado em fase posterior, ' +
        'após regra segura para cancelamento dos itens individuais.',
    );
  }
  const { error } = await supabase
    .from(HEADER_TABLE)
    .update({
      status: 'cancelada',
      motivo_cancelamento: motivo ?? null,
      cancelado_por: userId,
      cancelado_em: new Date().toISOString(),
      updated_by: userId,
    } as any)
    .eq('id', id);
  if (error) throw error;
}

export interface EmitirSolicitacaoClassificacaoLoteInput {
  /** Se omitido, cria-se um novo cabeçalho rascunho. */
  id?: string | null;
  observacoes?: string | null;
  itens: ItemRascunhoEmMemoria[];
}

/**
 * ÚNICA função que grava itens.
 * Fluxo:
 *   1. Validação no client (chamador deve revalidar). Aqui só guards mínimos.
 *   2. Cria cabeçalho se ainda não existir.
 *   3. Conferência defensiva: cabeçalho ainda em rascunho.
 *   4. Batch INSERT único em bd_funcionario_classificacao_solicitacoes.
 *   5. UPDATE para status='emitida' com guarda otimista status='rascunho'.
 *
 * Risco residual: se (5) falhar após (4), o lote vira "rascunho com itens"
 * = inconsistência tratada na UI.
 */
export async function emitirSolicitacaoClassificacaoLote(
  input: EmitirSolicitacaoClassificacaoLoteInput,
): Promise<string> {
  const userId = await getCurrentUserIdOrThrow();

  if (!input.itens || input.itens.length === 0) {
    throw new Error('Inclua pelo menos 1 item antes de emitir.');
  }
  // Sem funcionário duplicado
  const seen = new Set<string>();
  for (const it of input.itens) {
    if (seen.has(it.funcionario_id)) {
      throw new Error('Há funcionários duplicados na lista de itens.');
    }
    seen.add(it.funcionario_id);
    if (!it.centro_custo_id) {
      throw new Error('Item sem centro de custo resolvido.');
    }
    if (!it.cargo_novo_id || !it.cargo_novo_nome) {
      throw new Error('Item sem novo cargo definido.');
    }
    if (!it.motivo) {
      throw new Error('Item sem motivo definido.');
    }
  }

  // Cabeçalho
  let loteId = input.id ?? null;
  if (!loteId) {
    const header = await criarRascunhoClassificacaoLote({
      observacoes: input.observacoes ?? null,
    });
    loteId = header.id;
  }

  // Conferência defensiva
  const header = await obterSolicitacaoClassificacaoLote(loteId);
  if (header.status !== 'rascunho') {
    throw new Error('Lote não está em rascunho.');
  }
  const totalExistente = await contarItensDoLote(loteId);
  if (totalExistente > 0) {
    throw new Error(
      'Lote já possui itens (estado inconsistente). Emissão bloqueada.',
    );
  }

  // Batch único — atomicidade garantida pelo statement.
  const payloads = input.itens.map((it) =>
    montarPayloadClassificacaoSolicitacao({
      funcionario_id: it.funcionario_id,
      centro_custo_id: it.centro_custo_id,
      cargo_atual_id: it.cargo_atual_id,
      cargo_atual_nome: it.cargo_atual_nome,
      cargo_novo_id: it.cargo_novo_id,
      cargo_novo_nome: it.cargo_novo_nome,
      motivo: it.motivo,
      observacao: it.observacao,
      data_efetivacao_desejada: it.data_efetivacao_desejada,
      precisa_exame: it.precisa_exame,
      salario_atual: it.salario_atual ?? null,
      salario_novo: it.salario_novo ?? null,
      solicitacao_lote_id: loteId,
    }),
  );
  const { error: eIns } = await supabase.from(ITENS_TABLE).insert(payloads as any);
  if (eIns) throw eIns;

  // Promoção para emitida — guarda otimista
  const { error: eUpd, data: upd } = await supabase
    .from(HEADER_TABLE)
    .update({ status: 'emitida', updated_by: userId } as any)
    .eq('id', loteId)
    .eq('status', 'rascunho')
    .select('id')
    .maybeSingle();
  if (eUpd) {
    // Aqui o lote ficou rascunho com itens = inconsistência.
    throw new Error(
      'Itens foram registrados, mas não foi possível promover o lote para emitida. ' +
        'O lote ficou em estado de inconsistência. Contate o administrador.',
    );
  }
  if (!upd) {
    throw new Error(
      'Itens foram registrados, mas o cabeçalho mudou de estado durante a emissão. ' +
        'Verifique a listagem.',
    );
  }
  return loteId;
}
