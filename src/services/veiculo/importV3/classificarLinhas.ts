// PR-3 V3 — Classificação por linha antes de qualquer chamada de RPC.
// A partir do ParseWorkbookV3Result, produz linhas classificadas
// com STATUS_INICIAL fixo: NOVO_VALIDO | UPDATE_VALIDO | SEM_ALTERACAO | BLOQUEADO | ERRO.

import type { EquipamentoRowV3 } from './zodSchema';
import type {
  ParseWorkbookV3Result,
  ParsedEquipamentoLinha,
  LinhaBloqueada,
  ErroLinhaV3,
} from './parseWorkbookV3';

export type StatusInicial =
  | 'NOVO_VALIDO'
  | 'UPDATE_VALIDO'
  | 'SEM_ALTERACAO'
  | 'BLOQUEADO'
  | 'ERRO';

export type StatusResultado =
  | 'PENDENTE'
  | 'SUCESSO_INSERT'
  | 'SUCESSO_UPDATE'
  | 'JA_PROCESSADO'
  | 'JA_EXISTENTE'
  | 'CONFLITO'
  | 'ERRO'
  | 'NAO_PROCESSADO'
  | 'SEM_ALTERACAO'
  | 'BLOQUEADO'
  | 'ERRO_PARSER';

export interface LinhaClassificada {
  chave: string; // sha256::linha_excel::codigo_canonico
  linha_excel: number;
  codigo_exibicao: string;
  codigo_canonico: string;
  frota_codigo: string;
  numero_frota: string;
  centro_custo_codigo: string;
  subcategoria_nome: string;
  acao_arquivo: 'INSERIR' | 'ATUALIZAR' | 'SEM_ALTERACAO' | '—';
  status_inicial: StatusInicial;
  campos_atualizar: string;
  mensagem: string;
  parsed: EquipamentoRowV3 | null;
  raw: Record<string, unknown>;
}

function chaveLinha(sha: string, linha: number, canonico: string): string {
  return `${sha}::${linha}::${(canonico ?? '').toUpperCase()}`;
}

function fromOk(sha: string, l: ParsedEquipamentoLinha): LinhaClassificada {
  const p = l.parsed;
  const canonico = String(p.codigo_canonico ?? '').toUpperCase();
  let status: StatusInicial;
  if (p.acao === 'INSERIR') status = 'NOVO_VALIDO';
  else if (p.acao === 'ATUALIZAR') status = 'UPDATE_VALIDO';
  else status = 'SEM_ALTERACAO';
  return {
    chave: chaveLinha(sha, l.linha_excel, canonico),
    linha_excel: l.linha_excel,
    codigo_exibicao: String(p.codigo_exibicao ?? p.codigo_canonico ?? ''),
    codigo_canonico: canonico,
    frota_codigo: String(p.frota_codigo ?? ''),
    numero_frota: String(p.numero_frota ?? ''),
    centro_custo_codigo: String(p.centro_custo_codigo ?? ''),
    subcategoria_nome: String(p.subcategoria_nome ?? ''),
    acao_arquivo: p.acao,
    status_inicial: status,
    campos_atualizar: p.acao === 'ATUALIZAR' ? String(p.campos_atualizar ?? '') : '',
    mensagem: '',
    parsed: p,
    raw: l.raw,
  };
}

function fromBloqueada(sha: string, b: LinhaBloqueada): LinhaClassificada {
  const canonico = String(b.parsed?.codigo_canonico ?? b.raw['codigo_canonico'] ?? '').toUpperCase();
  return {
    chave: chaveLinha(sha, b.linha_excel, canonico),
    linha_excel: b.linha_excel,
    codigo_exibicao: String(b.raw['codigo_exibicao'] ?? canonico ?? ''),
    codigo_canonico: canonico,
    frota_codigo: String(b.raw['frota_codigo'] ?? ''),
    numero_frota: String(b.raw['numero_frota'] ?? ''),
    centro_custo_codigo: String(b.raw['centro_custo_codigo'] ?? ''),
    subcategoria_nome: String(b.raw['subcategoria_nome'] ?? ''),
    acao_arquivo: (b.parsed?.acao as LinhaClassificada['acao_arquivo']) ?? '—',
    status_inicial: 'BLOQUEADO',
    campos_atualizar: String(b.raw['campos_atualizar'] ?? ''),
    mensagem: `${b.codigo}: ${b.mensagem}`,
    parsed: b.parsed ?? null,
    raw: b.raw,
  };
}

function fromInvalida(
  sha: string,
  inv: { linha_excel: number; raw: Record<string, unknown>; erros: ErroLinhaV3[] },
): LinhaClassificada {
  const canonico = String(inv.raw['codigo_canonico'] ?? '').toUpperCase();
  const msg = inv.erros.map((e) => `${e.campo ?? '·'}: ${e.mensagem}`).join(' | ');
  return {
    chave: chaveLinha(sha, inv.linha_excel, canonico),
    linha_excel: inv.linha_excel,
    codigo_exibicao: String(inv.raw['codigo_exibicao'] ?? canonico ?? ''),
    codigo_canonico: canonico,
    frota_codigo: String(inv.raw['frota_codigo'] ?? ''),
    numero_frota: String(inv.raw['numero_frota'] ?? ''),
    centro_custo_codigo: String(inv.raw['centro_custo_codigo'] ?? ''),
    subcategoria_nome: String(inv.raw['subcategoria_nome'] ?? ''),
    acao_arquivo: (inv.raw['acao'] as LinhaClassificada['acao_arquivo']) ?? '—',
    status_inicial: 'ERRO',
    campos_atualizar: String(inv.raw['campos_atualizar'] ?? ''),
    mensagem: msg,
    parsed: null,
    raw: inv.raw,
  };
}

export interface ClassificacaoResumo {
  total: number;
  novos_validos: number;
  updates_validos: number;
  sem_alteracao: number;
  bloqueados: number;
  erros: number;
}

export interface ClassificacaoResult {
  linhas: LinhaClassificada[];
  resumo: ClassificacaoResumo;
}

export function classificarLinhas(
  arquivoSha256: string,
  parsed: ParseWorkbookV3Result,
): ClassificacaoResult {
  const out: LinhaClassificada[] = [];
  for (const l of parsed.linhas) out.push(fromOk(arquivoSha256, l));
  for (const b of parsed.linhas_bloqueadas) out.push(fromBloqueada(arquivoSha256, b));
  for (const inv of parsed.linhas_invalidas) out.push(fromInvalida(arquivoSha256, inv));
  out.sort((a, b) => a.linha_excel - b.linha_excel);
  const resumo: ClassificacaoResumo = {
    total: out.length,
    novos_validos: out.filter((l) => l.status_inicial === 'NOVO_VALIDO').length,
    updates_validos: out.filter((l) => l.status_inicial === 'UPDATE_VALIDO').length,
    sem_alteracao: out.filter((l) => l.status_inicial === 'SEM_ALTERACAO').length,
    bloqueados: out.filter((l) => l.status_inicial === 'BLOQUEADO').length,
    erros: out.filter((l) => l.status_inicial === 'ERRO').length,
  };
  return { linhas: out, resumo };
}
