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

export async function listarSolicitacoes(): Promise<SolicitacaoTransferenciaHeader[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('data_solicitacao', { ascending: false });
  if (error) throw error;
  return (data || []) as any;
}

export async function obterSolicitacao(id: string): Promise<{
  header: SolicitacaoTransferenciaHeader;
  itens: SolicitacaoTransferenciaItem[];
}> {
  const [{ data: header, error: e1 }, { data: itens, error: e2 }] = await Promise.all([
    supabase.from(TABLE).select('*').eq('id', id).single(),
    supabase.from(ITENS_TABLE).select('*').eq('solicitacao_id', id).order('created_at'),
  ]);
  if (e1) throw e1;
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
): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({ ...patch, updated_by: (await supabase.auth.getUser()).data.user?.id ?? null } as any)
    .eq('id', id);
  if (error) throw error;
}

/** Remove um único item da solicitação. RLS exige status='rascunho'. */
export async function removerItem(item_id: string): Promise<void> {
  const { error } = await supabase.from(ITENS_TABLE).delete().eq('id', item_id);
  if (error) throw error;
}

export async function substituirItens(
  solicitacao_id: string,
  itens: TransferenciaItemInput[],
): Promise<void> {
  const { error: eDel } = await supabase
    .from(ITENS_TABLE)
    .delete()
    .eq('solicitacao_id', solicitacao_id);
  if (eDel) throw eDel;
  if (itens.length === 0) return;
  const payload = itens.map((it) => ({ ...it, solicitacao_id }));
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
): Promise<void> {
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

export async function cancelarSolicitacao(id: string): Promise<void> {
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
export async function excluirSolicitacao(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
